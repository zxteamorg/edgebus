import {
	FChannelPublisher,
	FChannelSubscriber,
	FException,
	FExecutionContext,
	FInitableBase,
	FLogger,
} from "@freemework/common";

import WebSocket from "ws";
import * as http from "http";
import * as crypto from "crypto";
import * as  _ from "lodash";

import { Bind } from "../utils/bind";

export namespace SslConnectionProblem {
	export interface Debug {
		caCerts?: ReadonlyArray<string>;
		clientCert?: string;
		clientKeySha256?: string;
	}
	export interface Info {
		caCertsSha256?: ReadonlyArray<string>;
		clientCertSha256?: string;
		clientKeySha256?: string;
	}
}

/**
 * Класс WebSocketMessenger скрывает детали работы с WebSocket Client предоставляя
 * упрощенный интерфейс FChannelPublisher + FChannelSubscriber. Пользователю достаточно
 * знать, о следующем:
 * - Объект реализует Initable - требует вызовать init() и dispose() на жизненном цикле
 * - Соединение одноразовое, никаких автореконнектов! (после обрыва соединения, нужно создать инстанс данного класса повторно)
 * - Для отправки сообщения серверу - используем метод send()
 * - Для приема сообщений от сервера - подписываемся через addHandler()
 * - Если обработчик получил объект с типом `Error` - это означает что соединение оборвано (больше НИКАКИХ сообщений не будет)
 * @example
 * const wsMessenger = new WebSocketMessenger(...);
 * wsMessenger.addHandler(async (event) => {
 * 	if(event instanceof Error) {
 * 		console.this._log(event);
 * 		await wsMessenger.dispose(); // release used resources (connection already closed)
 * 		return;
 * 	}
 * 	const receivedData = event.data;
 * 	console.this._log("Received: ", receivedData);
 * });
 * await wsMessenger.init();
 * // Object ready to use (connection to server was established)
 * ...
 * await wsMessenger.send(yourData); // send data to server
 * ...
 * await wsMessenger.dispose(); // disconnect from server, release used resources
 */
export class WebSocketMessenger
	extends FInitableBase
	implements FChannelPublisher<WebSocket.Data>, FChannelSubscriber<WebSocket.Data> {
	private _log: FLogger;
	private readonly _callbacks: Array<WebSocketMessenger.Callback>;
	private _ws: WebSocket | null;

	/**
	 * Init time field only. Deleted by init process.
	 */
	private readonly _wsUrl: URL;
	/**
	 * Init time field only. Deleted by init process.
	 */
	private readonly _wsOptions: WebSocket.ClientOptions | http.ClientRequestArgs;
	private readonly _incomingPingTimeout: number;
	private readonly _outgoingPingTimeout: number;

	public constructor(wsUrl: URL, opts?: WebSocketMessenger.Opts) {
		super();

		this._log = FLogger.create(this.constructor.name);

		this._wsUrl = wsUrl;
		this._wsOptions = opts !== undefined && opts.wsOptions !== undefined ? opts.wsOptions : {};
		this._incomingPingTimeout = opts !== undefined && opts.incomingPingTimeout !== undefined ? opts.incomingPingTimeout : 0;
		this._outgoingPingTimeout = opts !== undefined && opts.outgoingPingTimeout !== undefined ? opts.outgoingPingTimeout : 0;
		this._ws = null;
		this._callbacks = [];
	}

	public addHandler(cb: WebSocketMessenger.Callback): void {
		this._callbacks.push(cb);
	}

	public send(executionContext: FExecutionContext, message: WebSocket.Data): Promise<void> {
		this.verifyInitializedAndNotDisposed();
		return this._send(executionContext, message);
	}

	public removeHandler(cb: WebSocketMessenger.Callback): void {
		const index = this._callbacks.indexOf(cb);
		if (index !== -1) {
			this._callbacks.splice(index, 1);
		}
	}

	protected async onInit(): Promise<void> {
		const executionContext: FExecutionContext = this.initExecutionContext;

		this._log.trace(executionContext, "Initializing");

		const wsUrl: string = this._wsUrl.toString();

		const wsOptions: WebSocket.ClientOptions | http.ClientRequestArgs = this._wsOptions;

		// First of all we need to create WebSocket
		const transportProtocol: string | undefined = undefined;
		const ws = new WebSocket(this._wsUrl, transportProtocol, { ...wsOptions });


		let wsEstablishingConnectionPromise: Promise<unknown>;
		{
			// establish connection
			// success: event 'open'
			// fail: events 'error' + 'close'

			const wsEstablishingResolverListeners: Array<() => void> = [];

			const openPromise = new Promise<void>(openPromiseResolve => {
				const openCallback = function (): void { openPromiseResolve(); };
				ws.once("open", openCallback);
				wsEstablishingResolverListeners.push(() => {
					ws.removeListener("open", openCallback);
				});
			});

			const errorPromise = new Promise(errorPromiseResolve => {
				// const ws = this._ws;
				const errorCallback = function (err: any): void { errorPromiseResolve(err); };
				ws.once("error", errorCallback);
				wsEstablishingResolverListeners.push(() => {
					ws.removeListener("error", errorCallback);
				});
			});

			const closePromise = new Promise(closePromiseResolve => {
				// const ws = this._ws;
				ws.once("close", closePromiseResolve);
				wsEstablishingResolverListeners.push(() => {
					ws.removeListener("close", closePromiseResolve);
				});
			});

			wsEstablishingConnectionPromise = Promise.race([openPromise, closePromise])
				.then(() => {
					if (ws.readyState === WebSocket.OPEN) {
						return Promise.resolve();
					}
					return Promise.all([errorPromise, closePromise]).then(res => {
						const [webSocketError, webSocketCode] = res;
						const wsErrorMsg = `WebSocket ${wsUrl} Error Code: ${webSocketCode}`;
						const err: (Error & { [custom: string]: any; }) | undefined
							= webSocketError instanceof Error ? webSocketError : undefined;

						if (err !== undefined) {
							this._log.trace(executionContext, wsErrorMsg, FException.wrapIfNeeded(err));
							if ("code" in err && err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
								if (this._log.isDebugEnabled) {
									const debugLogEntry: SslConnectionProblem.Debug = {};
									if ("ca" in wsOptions && wsOptions.ca !== undefined) {
										const ca = wsOptions.ca instanceof Buffer ? wsOptions.ca.toString("base64") : wsOptions.ca.toString();
										debugLogEntry.caCerts = [ca];
									}
									this._log.debug(executionContext, () => `${wsErrorMsg}. Message: ${err.message}. '${JSON.stringify(debugLogEntry)}'`);
								}
								if (this._log.isInfoEnabled) {
									const infoLogEntry: SslConnectionProblem.Info = {};
									if ("ca" in wsOptions && wsOptions.ca !== undefined) {
										const ca = wsOptions.ca instanceof Buffer ? wsOptions.ca.toString("base64") : wsOptions.ca.toString();
										infoLogEntry.caCertsSha256 = [crypto.createHash("sha256").update(ca).digest("hex")];
									}
									this._log.info(executionContext, () => `${wsErrorMsg}. Message: ${err.message} '${JSON.stringify(infoLogEntry)}'`);
								}
							} else {
								this._log.debug(executionContext, () => `${wsErrorMsg}. Message: ${err.message}`);
							}
						} else {
							this._log.debug(executionContext, wsErrorMsg);
						}
						throw new WebSocketMessenger.ConnectionError(wsErrorMsg, FException.wrapIfNeeded(err));
					});
				})
				.finally(() => {
					// Remove all listeners used in Establishing Connection phase
					wsEstablishingResolverListeners.forEach(resolveCallback => resolveCallback());
				});
		}

		ws.on("message", this._handleMessage);

		// wsEstablishingConnectionPromise will:
		// - resolve after connection established
		// - reject if connection failed
		try {
			await wsEstablishingConnectionPromise;
			this._ws = ws;
		} catch (e) {
			this._ws = null;
			throw e;
		}

		// Here, we have good(established) websocket

		ws.on("close", () => {
			this._notifySubscribers(this.initExecutionContext, new WebSocketMessenger.ConnectionError("Connection was closed."));
			this._callbacks.splice(0, this._callbacks.length); // Prevent send any message to client (due client's destroy)
			ws.removeAllListeners();
			this._ws = null;
		});
		ws.on("error", (e: any) => {
			this._log.debug(this.initExecutionContext, "WebSocket emits 'error'", FException.wrapIfNeeded(e));
		});
		ws.on("unexpected-response", () => {
			if (this._log.isWarnEnabled) {
				this._log.warn(this.initExecutionContext, "WebSocket emits 'unexpected-response'");
			} else {
				console.warn("unexpected-response");
			}
		});


		if (this._incomingPingTimeout > 0) { // local scope: PING income message
			const incomingPingTimeout = this._incomingPingTimeout;
			let pingTimeout: NodeJS.Timeout | null = null;
			function heartbeat() {
				if (pingTimeout !== null) { clearTimeout(pingTimeout); }

				// Use `WebSocket#terminate()`, which immediately destroys the connection,
				// instead of `WebSocket#close()`, which waits for the close timer.
				// Delay should be equal to the interval at which your server
				// sends out pings plus a conservative assumption of the latency.
				pingTimeout = setTimeout(function () { ws.terminate(); }, incomingPingTimeout);
			}
			ws.on("ping", function () {
				heartbeat();
				// Pong messages are automatically sent in response to ping messages as required by the spec.
				// https://www.npmjs.com/package/ws
			});
			ws.on("close", function () {
				if (pingTimeout !== null) { clearTimeout(pingTimeout); }
			});
			heartbeat();
		}

		if (this._outgoingPingTimeout > 0) { // local scope: PING income message
			const outgoingPingTimeout = this._outgoingPingTimeout;
			let outgoingPingInterval: NodeJS.Timeout | null = null;
			let isAlive: boolean = true;
			function heartbeat() {
				if (isAlive === false) {
					ws.terminate();
				}

				isAlive = false;
				ws.ping();
			}
			ws.on("pong", function () {
				isAlive = true;
			});
			ws.on("close", function () {
				if (outgoingPingInterval !== null) {
					clearInterval(outgoingPingInterval);
				}
			});
			outgoingPingInterval = setInterval(heartbeat, outgoingPingTimeout);
		}
	}

	protected async onDispose() {
		this._notifySubscribers(this.initExecutionContext, new WebSocketMessenger.ConnectionError("Connection was closed by disposing phase."));
		this._callbacks.splice(0, this._callbacks.length); // Prevent send any message to client (due client's destroy)
		if (this._ws !== null) {
			try {
				this._log.trace(this.initExecutionContext, "Destroying");
				this._ws.removeListener("message", this._handleMessage);
				this._ws.close();
			} catch (e) {
				if (e instanceof Error && e.message === "WebSocket was closed before the connection was established") {
					// Skip this error, due this is expected behavior in WebSocket#close in case WebSocket has initial state
				} else {
					// Expecting this case never happens
					// Nothing to do anymore. dispose() is exception safe. so just send message into STDERR.
					const msg = "Destroy abnormal";
					this._log.debug(this.initExecutionContext, msg, FException.wrapIfNeeded(e));
					if (this._log.isErrorEnabled) {
						this._log.error(this.initExecutionContext, msg);
					} else {
						console.error(msg, e);
					}
				}
			}
		}
	}

	protected async _send(executionContext: FExecutionContext, message: WebSocket.Data): Promise<void> {
		// TODO: Add support for cancellationToken

		const ws = this._ws;

		if (ws === null) {
			throw new WebSocketMessenger.ConnectionError("Communication error. Not connected.");
		}

		return new Promise<void>((resolve, reject) => {
			ws.send(message, function (err) {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	@Bind
	protected _handleMessage(data: WebSocket.Data): void {
		if (this._callbacks.length > 0) {
			this._notifySubscribers(this.initExecutionContext, { data });
		} else {
			// This very bad situation. The user-developer forgot to setup callback.
			// const this._log: FLogger = FExecutionContextLogger.of(this.initExecutionContext).logger;
			const msg = `MISSING WEBSOCKET MESSAGE! Message received while callback is not set. This looks like a development issue.`;
			if (this._log.isErrorEnabled) {
				this._log.error(this.initExecutionContext, msg);
			} else {
				// Log over STDERR is a TRUE way for the situation.
				console.error(`[${this.constructor.name}] msg`);
			}
			if (this._log.isTraceEnabled) {
				this._log.trace(this.initExecutionContext, msg + " " + JSON.stringify(data));
			}
		}
	}

	private _logCallbackError(err: any): void {
		// This very bad situation. The user-developer did wrote shit code that raise an error from callback.
		// const this._log: FLogger = FExecutionContextLogger.of(this.initExecutionContext).logger;
		const ex: FException = FException.wrapIfNeeded(err);
		const msg = "UNSTABLE CALLBACK! Please handle your errors yourself to prevent this message.";
		if (this._log.isErrorEnabled) {
			this._log.error(this.initExecutionContext, msg + " " + ex.message);
		} else {
			// Log over STDERR is a TRUE way for the situation.
			console.error(`[${this.constructor.name}] ${msg}`, err);
		}
		this._log.debug(this.initExecutionContext, msg, ex);
	}

	private _notifySubscribers(executionContext: FExecutionContext, event: FChannelSubscriber.Event<WebSocket.Data> | FException) {
		for (const callback of this._callbacks) {
			try {
				Promise
					.resolve()
					.then(() => callback(executionContext, event))
					.catch((err) => this._logCallbackError(err));
			} catch (err) {
				this._logCallbackError(err);
			}
		}
	}
}

export namespace WebSocketMessenger {
	export interface Opts {
		wsOptions?: WebSocket.ClientOptions | http.ClientRequestArgs;
		incomingPingTimeout?: number;
		outgoingPingTimeout?: number;
	}

	export type Callback = FChannelSubscriber.Callback<WebSocket.Data>;
	export class ConnectionError extends FException {
		public readonly innerError: FException | null;

		public constructor(innerError: FException);
		public constructor(message: string, innerError?: FException);

		constructor(messageOrError: string | FException, innerError?: FException) {
			let message: string;
			if (messageOrError instanceof FException) {
				message = messageOrError.message;
				innerError = messageOrError;
			} else {
				message = messageOrError;
			}
			super(message);
			this.innerError = innerError !== undefined ? innerError : null;
		}
	}
}
