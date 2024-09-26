import { FConfiguration, FConfigurationValue, FException, FExceptionInvalidOperation } from "@freemework/common";
import { FHostingConfiguration } from "@freemework/hosting";

import { Router } from "express-serve-static-core";
import { existsSync, readFileSync } from "fs";

import {
	Ingress as IngressModel,
	Egress as EgressModel,
	LabelHandler as LabelHandlerModel,
	Label as LabelModel,
	ensureIngressHttpHostResponseDynamicKind,
	ensureLabelHandlerKind,
} from "./model";

export class Settings {
	private constructor(
		/**
		 * Servers
		 */
		public readonly servers: ReadonlyArray<FHostingConfiguration.WebServer>,

		/**
		 * Endpoints configuration
		 */
		public readonly endpoints: ReadonlyArray<Settings.Endpoint>,

		/**
		 * Connection URL to persistent storage (for example PostgreSQL)
		 */
		public readonly persistentStorageURL: URL,

		/**
		 * Message Bus instance settings
		 */
		public readonly messageBus: Settings.MessageBus,

		/**
		 * Predefined configuration
		 */
		public readonly setup: Settings.Setup | null
	) { }

	public static parse(configuration: FConfiguration): Settings {
		const edgebusConfiguration: FConfiguration = configuration.getNamespace("edgebus");

		const edgebusRuntimeConfiguration: FConfiguration = edgebusConfiguration.getNamespace("runtime");

		const servers: ReadonlyArray<FHostingConfiguration.WebServer> = Object.freeze(FHostingConfiguration.parseWebServers(edgebusRuntimeConfiguration));

		const endpoints: ReadonlyArray<Settings.Endpoint> = Object.freeze(
			edgebusRuntimeConfiguration.getArray("endpoint").map(parseEndpoint)
		);

		const messageBus: Settings.MessageBus = (function () {
			const messageBusConfiguration: FConfiguration = edgebusRuntimeConfiguration.getNamespace("messagebus");
			const messageBusKind: string = messageBusConfiguration.get("kind").asString;
			switch (messageBusKind) {
				case "bull":
					{
						const messageBusBullConfiguration = messageBusConfiguration.getNamespace(messageBusKind);
						const redisUrl: URL = messageBusBullConfiguration.get("redisUrl").asUrl;
						return Object.freeze<Settings.MessageBus>({
							kind: "bull",
							redisUrl
						});
					}
				case "local":
					{
						const messageBusLocalConfiguration = messageBusConfiguration.getNamespace(messageBusKind);
						return Object.freeze<Settings.MessageBus>({
							kind: "local",
						});
					}
				default:
					throw new FExceptionInvalidOperation(`Not supported message bus kind '${messageBusKind}'.`);
			}
		})();

		const persistentStorageURL: URL = edgebusRuntimeConfiguration.get("persistent.url").asUrl;

		const setupConfiguration: FConfiguration | null = edgebusConfiguration.findNamespace("setup");
		const setup: Settings.Setup | null = setupConfiguration !== null ? parseSetup(setupConfiguration) : null;

		const appConfig: Settings = new Settings(
			servers,
			endpoints,
			persistentStorageURL,
			messageBus,
			setup
		);

		return appConfig;
	}
}

export namespace Settings {

	export type Endpoint =
		| RestInfoEndpoint
		| RestManagementEndpoint
		// | RestIngressEndpoint
		| RestSubscriberEndpoint
		| ExpressRouterManagementEndpoint
		| ExpressRouterIngressEndpoint;

	export interface BaseRestEndpoint extends FHostingConfiguration.BindEndpoint, FHostingConfiguration.ServerEndpoint {
		readonly cors: Cors | null;
	}
	export interface RestInfoEndpoint extends BaseRestEndpoint {
		readonly type: "rest-info";
	}	export interface RestManagementEndpoint extends BaseRestEndpoint {
		readonly type: "rest-management";
		readonly assets: Settings.Assets | null;
	}
	// export interface RestIngressEndpoint extends BaseRestEndpoint {
	// 	readonly type: "rest-ingress";
	// }
	export interface RestSubscriberEndpoint extends BaseRestEndpoint {
		readonly type: "rest-egress";
	}
	export interface ExpressRouterManagementEndpoint extends FHostingConfiguration.BindEndpoint {
		readonly type: "express-router-management";
		readonly router: Router;
	}
	export interface ExpressRouterIngressEndpoint extends FHostingConfiguration.BindEndpoint {
		readonly type: "express-router-ingress";
		readonly router: Router;
	}

	export type MessageBus =
		| MessageBus.Bull
		| MessageBus.Local;
	export namespace MessageBus {
		export interface Base {
			readonly kind: string;
		}
		export interface Bull extends Base {
			readonly kind: "bull";
			readonly redisUrl: URL;
		}
		export interface Local extends Base {
			readonly kind: "local";
		}
	}

	export interface Cors {
		readonly methods: ReadonlyArray<string>;
		readonly whiteList: ReadonlyArray<string>;
		readonly allowedHeaders: ReadonlyArray<string>;
	}

	export interface Assets {
		readonly path: string | null;
	}

	export interface SSL {
		readonly trustedCertificateAuthorities: ReadonlyArray<Buffer> | null;
		readonly client: {
			readonly certificate: Buffer;
			readonly key: Buffer;
		} | null;
	}

	export interface Setup {
		readonly ingresses: ReadonlyArray<Setup.Ingress>;
		readonly egresses: ReadonlyArray<Setup.Egress>;
		readonly topics: ReadonlyArray<Setup.Topic>;
	}

	export namespace Setup {

		export type Ingress =
			| HttpHost
			| Ingress.WebSocketClient
			| Ingress.WebSocketHost;

		export type HttpHost =
			| Ingress.HttpHostResponseStatic
			| Ingress.HttpHostResponseDynamic;

		export namespace Ingress {
			export interface Base {
				/**
				 * Ingress API Identifier
				 */
				readonly ingressId: string;

				readonly kind: IngressModel.Kind;

				/**
				 * API Identifier of target topic
				 */
				readonly topicId: string;
			}

			export interface HttpHost extends Base {
				readonly kind: IngressModel.Kind.HttpHost;
				readonly servers: ReadonlyArray<FHostingConfiguration.WebServer["name"]>;
				readonly path: string;
				readonly httpResponseKind: IngressModel.HttpResponseKind
			}

			export interface HttpHostResponseStatic extends HttpHost {
				readonly httpResponseKind: IngressModel.HttpResponseKind.STATIC;
				readonly responseStatusCode: number;
				readonly responseStatusMessage: string | null;
				readonly responseHeaders: Readonly<Record<string, string | null>> | null;
				readonly responseBody: Uint8Array | null;
			}

			export interface HttpHostResponseDynamic extends HttpHost {
				readonly httpResponseKind: IngressModel.HttpResponseKind.DYNAMIC;
				readonly responseHandlerKind: IngressModel.HttpHostResponseDynamic.Kind.ExternalProcess;
				readonly responseHandlerPath: string;
			}

			export interface WebSocketClient extends Base {
				readonly kind: IngressModel.Kind.WebSocketClient;
				readonly url: URL;
			}

			export interface WebSocketHost extends Base {
				readonly kind: IngressModel.Kind.WebSocketHost;
				// TBD
			}
		}

		export type Egress =
			| Egress.Webhook
			| Egress.WebsocketHost;

		export namespace Egress {
			export interface Base {
				/**
				 * Egress API Identifier
				 */
				readonly egressId: string;

				readonly kind: EgressModel.Kind;

				/**
				 * API Identifiers of source topics
				 */
				readonly sourceTopicIds: ReadonlyArray<string>;

				readonly filterLabelPolicy: EgressModel.FilterLabelPolicy;

				readonly filterLabels: ReadonlyArray<LabelModel.Data["labelValue"]>
			}

			export interface Webhook extends Base {
				readonly kind: EgressModel.Kind.Webhook;
				/**
				 * Delivery HTTP Method
				 */
				readonly method: string | null;
				/**
				 * Delivery HTTP URL
				 */
				readonly url: URL;

				readonly ssl: SSL | null;
			}

			export interface WebsocketHost extends Base {
				readonly kind: EgressModel.Kind.WebSocketHost;
			}
		}

		export interface Topic {
			/**
			 * Topic API Identifier
			 */
			readonly topicId: string;
			readonly name: string;
			readonly description: string;
			readonly mediaType: string;
			readonly labelHandlers: ReadonlyArray<LabelHandler>
		}

		export type LabelHandler =
			| LabelHandler.ExternalProcess;

		export namespace LabelHandler {
			export interface Base {
				readonly labelHandlerId: string;
				readonly kind: LabelHandlerModel.Kind;
			}

			export interface ExternalProcess extends Base {
				readonly kind: LabelHandlerModel.Kind.ExternalProcess;
				readonly path: string;
			}
		}

	}
}

export class SettingsException extends FException { }


//  ___           _                                   _
// |_ _|  _ __   | |_    ___   _ __   _ __     __ _  | |
//  | |  | '_ \  | __|  / _ \ | '__| | '_ \   / _` | | |
//  | |  | | | | | |_  |  __/ | |    | | | | | (_| | | |
// |___| |_| |_|  \__|  \___| |_|    |_| |_|  \__,_| |_|


function parseEndpoint(endpointConfiguration: FConfiguration): Settings.Endpoint {
	const endpointType: Settings.Endpoint["type"] = endpointConfiguration.get("type").asString as Settings.Endpoint["type"];
	switch (endpointType) {
		case "rest-info": {
			const cors = endpointConfiguration.hasNamespace("cors")
				? parseCors(endpointConfiguration.getNamespace("cors")) : null;

			const httpEndpoint: Settings.RestInfoEndpoint = Object.freeze({
				type: endpointType,
				servers: endpointConfiguration.get("servers").asString.split(" "),
				bindPath: endpointConfiguration.get("bindPath", "/").asString,
				cors
			});
			return httpEndpoint;
		}
		case "rest-management": {
			const cors = endpointConfiguration.hasNamespace("cors")
				? parseCors(endpointConfiguration.getNamespace("cors")) : null;

				const assets = endpointConfiguration.hasNamespace("assets")
				? parseAssets(endpointConfiguration.getNamespace("assets")) : null;

			const httpEndpoint: Settings.RestManagementEndpoint = Object.freeze({
				assets,
				type: endpointType,
				servers: endpointConfiguration.get("servers").asString.split(" "),
				bindPath: endpointConfiguration.get("bindPath", "/").asString,
				cors
			});
			return httpEndpoint;
		}
		// case "rest-ingress": {
		// 	const cors = endpointConfiguration.hasNamespace("cors")
		// 		? parseCors(endpointConfiguration.getNamespace("cors")) : null;

		// 	const httpEndpoint: Settings.RestIngressEndpoint = Object.freeze({
		// 		type: endpointType,
		// 		servers: endpointConfiguration.get("servers").asString.split(" "),
		// 		bindPath: endpointConfiguration.get("bindPath", "/").asString,
		// 		cors
		// 	});
		// 	return httpEndpoint;
		// }
		case "rest-egress": {
			const cors = endpointConfiguration.hasNamespace("cors")
				? parseCors(endpointConfiguration.getNamespace("cors")) : null;

			const httpEndpoint: Settings.RestSubscriberEndpoint = Object.freeze({
				type: endpointType,
				servers: endpointConfiguration.get("servers").asString.split(" "),
				bindPath: endpointConfiguration.get("bindPath", "/").asString,
				cors
			});
			return httpEndpoint;
		}
		case "express-router-management":
		case "express-router-ingress":
			throw new FExceptionInvalidOperation(`Endpoint type '${endpointType}' may not be parsed as config item.`);
		default:
			throw new UnreachableNotSupportedEndpointError(endpointType);
	}
}

function parseCors(corsConfiguration: FConfiguration): Settings.Cors {
	const methods: ReadonlyArray<string> = Object.freeze(corsConfiguration.get("methods").asString.split(" "));
	const whiteList: ReadonlyArray<string> = Object.freeze(corsConfiguration.get("whiteList").asString.split(" "));
	const allowedHeaders: ReadonlyArray<string> = Object.freeze(corsConfiguration.get("allowedHeaders").asString.split(" "));
	return Object.freeze({ methods, whiteList, allowedHeaders });
}

function parseAssets(staticConfiguration: FConfiguration): Settings.Assets {
	const path: string | null = staticConfiguration.get("path").asStringNullable;
	return Object.freeze({ path });
}

function parseSsl(sslConfiguration: FConfiguration): Settings.SSL {
	let trustedCertificateAuthorities: Settings.SSL["trustedCertificateAuthorities"] = null;
	if (sslConfiguration.hasNamespace("trustedCertificateAuthorities")) {
		const certificates: Array<Buffer> = [];
		const trustedCertificateAuthoritiesConfiguration: FConfiguration
			= sslConfiguration.getNamespace("trustedCertificateAuthorities");
		const indexes = trustedCertificateAuthoritiesConfiguration.get("indexes").asString.split(" ");
		for (const index of indexes) {
			const trustedCertificateAuthority: string
				= trustedCertificateAuthoritiesConfiguration.get(index).asString;
			if (existsSync(trustedCertificateAuthority)) {
				const certificateData = readFileSync(trustedCertificateAuthority);
				certificates.push(certificateData);
			} else {
				const certificateData: Buffer = Buffer.from(trustedCertificateAuthority, "base64");
				certificates.push(certificateData);
			}
		}
		trustedCertificateAuthorities = Object.freeze(certificates);
	}

	let client: Settings.SSL["client"] = null;
	// TBD Parse client cert

	return Object.freeze<Settings.SSL>({
		trustedCertificateAuthorities,
		client
	});
}

function parseSetup(setupConfiguration: FConfiguration): Settings.Setup | null {

	const ingresses: Array<Settings.Setup.Ingress> = [];
	const egresses: Array<Settings.Setup.Egress> = [];
	const topics: Array<Settings.Setup.Topic> = [];

	const egressKey: string = "egress";
	if (setupConfiguration.hasNamespace(egressKey)) {
		const subscribersConfiguration = setupConfiguration.getArray(egressKey);
		for (const subscriberConfiguration of subscribersConfiguration) {
			const egressId: string = subscriberConfiguration.namespaceParent!;
			const type: string = subscriberConfiguration.get("kind").asString;
			const sourceTopicIds: string = subscriberConfiguration.get("source_topic_ids").asString;
			const filterLabelPolicy: EgressModel.FilterLabelPolicy = (function () {
				const filterLabelPolicyValue: FConfigurationValue = subscriberConfiguration.get("filter_label_policy", EgressModel.FilterLabelPolicy.IGNORE);
				const filterLabelPolicyStr = subscriberConfiguration.get("filter_label_policy", EgressModel.FilterLabelPolicy.IGNORE).asString as EgressModel.FilterLabelPolicy;
				switch (filterLabelPolicyStr) {
					case EgressModel.FilterLabelPolicy.IGNORE:
					case EgressModel.FilterLabelPolicy.LAX:
					case EgressModel.FilterLabelPolicy.SKIP:
					case EgressModel.FilterLabelPolicy.STRICT:
						return filterLabelPolicyStr;
					default:
						{
							const unsupportedFilterLabelPolicy: never = filterLabelPolicyStr;
							throw new FExceptionInvalidOperation(`Unsupported value '${unsupportedFilterLabelPolicy}' for '${filterLabelPolicyValue.key}' configuration key.`);
						}
				}
			})();
			const filterLabels: ReadonlyArray<string> = (() => {
				if (subscriberConfiguration.has("filter_labels")) {
					const labels: string = subscriberConfiguration.get("filter_labels").asString;
					return Object.freeze(labels.split(" ").filter(w => w !== ""));
				} else {
					return Object.freeze([]);
				}
			})();
			const baseSubscriberSettings = {
				egressId,
				sourceTopicIds: sourceTopicIds.split(" ").filter(w => w !== ""),
				filterLabelPolicy,
				filterLabels,
			};
			let subscriberSettings: Settings.Setup.Egress;
			switch (type) {
				case EgressModel.Kind.Webhook:
					subscriberSettings = {
						...baseSubscriberSettings,
						kind: type,
						method: subscriberConfiguration.get("method", null).asStringNullable,
						url: subscriberConfiguration.get("url").asUrl,
						ssl: subscriberConfiguration.hasNamespace("ssl") ? parseSsl(subscriberConfiguration.getNamespace("ssl")) : null
					};
					break;
				case EgressModel.Kind.WebSocketHost:
					subscriberSettings = {
						...baseSubscriberSettings,
						kind: type,
					};
					break;
				default:
					throw new FExceptionInvalidOperation(`Unsupported ${subscriberConfiguration.namespaceFull}.type '${type}'.`);
			}
			egresses.push(Object.freeze(subscriberSettings));
		}
	}

	const ingressConfigurationKey: string = "ingress";
	if (setupConfiguration.hasNamespace(ingressConfigurationKey)) {
		const ingressesConfiguration: Array<FConfiguration> = setupConfiguration.getArray(ingressConfigurationKey);
		for (const ingressConfiguration of ingressesConfiguration) {
			const ingressId: string = ingressConfiguration.namespaceParent!;
			const type: string = ingressConfiguration.get("kind").asString;
			const topicId: string = ingressConfiguration.get("target_topic_id").asString;
			const ingressBaseSettings = { ingressId, topicId };
			let ingressSettings: Settings.Setup.Ingress;
			switch (type) {
				case IngressModel.Kind.HttpHost:
					{
						const servers: ReadonlyArray<string> = Object.freeze(ingressConfiguration.get("servers").asString.split(" "));

						const responseConfiguration: FConfiguration | null = ingressConfiguration.findNamespace("response");
						if (responseConfiguration === null) {
							throw new FExceptionInvalidOperation(`Unexpected configuration, ingress ${ingressId} must be configured`);
						}

						const responseKind: string = responseConfiguration.get("kind").asString;
						switch (responseKind) {
							case "dynamic": {
								const responseConfigDynamic = responseConfiguration.getNamespace("dynamic");
								if (responseConfigDynamic === null) {
									throw new FExceptionInvalidOperation(`Unexpected configuration, ingress ${ingressId} must be configured as dynamic`);
								}

								const responseHandlerKind: string = responseConfigDynamic.get("kind").asString;
								const responseHandlerPath: string = responseConfigDynamic.get("path").asString;

								ensureIngressHttpHostResponseDynamicKind(responseHandlerKind);

								ingressSettings = {
									...ingressBaseSettings,
									kind: type,
									servers,
									path: ingressConfiguration.get("path").asString,
									httpResponseKind: IngressModel.HttpResponseKind.DYNAMIC,
									responseHandlerKind,
									responseHandlerPath,
								};
								break;
							}
							case "static": {
								const responseConfigStatic = responseConfiguration.getNamespace("static");
								if (responseConfigStatic === null) {
									throw new FExceptionInvalidOperation(`Unexpected configuration, ingress ${ingressId} must be configured as static`);
								}

								const responseHeadersConfiguration: FConfiguration | null = responseConfigStatic.findNamespace("header");
								const responseStatusCode: number = responseConfigStatic.get("status_code", "200").asIntegerPositive;
								const responseStatusMessage: string | null = responseConfigStatic.get("status_message", null).asStringNullable;
								const responseBodyStr: string | null = responseConfigStatic.get("body", null).asStringNullable;
								const responseBody: Uint8Array | null = responseBodyStr === null
									? null
									: Buffer.from(responseBodyStr, "utf-8");
								const responseHeaders: Record<string, string | null> | null = responseHeadersConfiguration === null ?
									null
									: responseHeadersConfiguration.keys.reduce((acc, key) => {
										acc[key] = responseHeadersConfiguration.get(key).asString;
										return acc;
									}, {} as Record<string, string | null>);

								ingressSettings = {
									...ingressBaseSettings,
									kind: type,
									servers,
									httpResponseKind: IngressModel.HttpResponseKind.STATIC,
									path: ingressConfiguration.get("path").asString,
									responseStatusCode,
									responseStatusMessage,
									responseHeaders: Object.freeze(responseHeaders),
									responseBody
								};
								break;
							}
							default: {
								throw new FExceptionInvalidOperation(`Unexpected response kind ${responseKind}`);
							}
						}
					}
					break;
				case IngressModel.Kind.WebSocketClient:
					{
						const url: URL = new URL(ingressConfiguration.get("url").asString);

						ingressSettings = {
							...ingressBaseSettings,
							kind: type,
							url
						};
					}
					break;
				default:
					throw new FExceptionInvalidOperation(`Unsupported ${ingressConfiguration.namespaceFull}.type '${type}'.`);
			}
			ingresses.push(Object.freeze(ingressSettings));
		}
	}

	const topicKey: string = "topic";
	if (setupConfiguration.hasNamespace(topicKey)) {
		const topicsConfiguration = setupConfiguration.getArray(topicKey);
		for (const topicConfiguration of topicsConfiguration) {
			const topicId: string = topicConfiguration.namespaceParent!;
			const name: string = topicConfiguration.get("name").asString;
			const description: string = topicConfiguration.get("description").asString;
			const mediaType: string = topicConfiguration.get("mediaType").asString;

			const labelHandlers: Array<Settings.Setup.LabelHandler> = []
			const labelHandlerKey: string = "labelHandler";
			if (topicConfiguration.hasNamespace(labelHandlerKey)) {
				const labelHandlersConfiguration = topicConfiguration.getArray(labelHandlerKey);
				for (const labelHandlerConfiguration of labelHandlersConfiguration) {
					const labelHandlerId: string = labelHandlerConfiguration.namespaceParent!;
					const kind: string = labelHandlerConfiguration.get("kind").asString;

					ensureLabelHandlerKind(kind);

					switch (kind) {
						case LabelHandlerModel.Kind.ExternalProcess:
							const path: string = labelHandlerConfiguration.get("path").asString;
							labelHandlers.push(Object.freeze({
								labelHandlerId,
								kind,
								path,
							}));
							break;
						default:
							throw new FExceptionInvalidOperation(`Unsupported ${labelHandlerConfiguration.namespaceFull}.type '${kind}'.`);
					}
				}

			}

			const topicSettings: Settings.Setup.Topic = { topicId, name, description, mediaType, labelHandlers: Object.freeze(labelHandlers) };
			topics.push(Object.freeze(topicSettings));
		}
	}

	if (egresses.length > 0 || ingresses.length > 0 || topics.length > 0) {
		return Object.freeze({
			egresses: Object.freeze(egresses),
			ingresses: Object.freeze(ingresses),
			topics: Object.freeze(topics)
		});
	}

	return null;
}

class UnreachableNotSupportedEndpointError extends Error {
	public constructor(endpointType: never) {
		super(`Non supported endpoint type: ${endpointType}`);
	}
}
