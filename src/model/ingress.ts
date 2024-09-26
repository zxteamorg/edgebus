import { FException } from "@freemework/common";
import { IngressIdentifier, TopicIdentifier } from "./identifiers";

export namespace Ingress {
	export const enum Kind {
		/**
		 * Allows to ingress messages via HTTP request
		 */
		HttpHost = "HTTP_HOST",

		/**
		 * Allows to ingress messages via WebSocket. `EdgeBus` will connect to your WebSocket server to get messages.
		 */
		WebSocketClient = "WEB_SOCKET_CLIENT",


		/**
		 * Allows to ingress messages via WebSocket. `EdgeBus` will listen for client's connections.
		 */
		WebSocketHost = "WEB_SOCKET_HOST"
	}

	export const enum HttpResponseKind {
		STATIC = "STATIC",
		DYNAMIC = "DYNAMIC"
	}

	/**
	 * The ID of the Webhook
	 */
	export interface Id {
		readonly ingressId: IngressIdentifier;
	}

	export interface DataBase {
		/**
		 * Name of the attached topic
		 */
		readonly ingressTopicId: TopicIdentifier;

		/**
		 * Kind of ingress
		 */
		readonly ingressKind: Kind;

		// readonly ingressConverters: ReadonlyArray<Converter>;
	}

	export interface HttpHostBase extends DataBase {
		readonly ingressKind: Kind.HttpHost;
		readonly ingressHttpHostPath: string;
		readonly ingressHttpHostResponseKind: HttpResponseKind;
	}

	export interface HttpHostResponseStatic extends HttpHostBase {
		readonly ingressHttpHostResponseKind: HttpResponseKind.STATIC;
		readonly ingressHttpHostResponseStaticStatusCode: number;
		readonly ingressHttpHostResponseStaticStatusMessage: string | null;
		readonly ingressHttpHostResponseStaticHeaders: Readonly<Record<string, string | null>> | null;
		readonly ingressHttpHostResponseStaticBody: Uint8Array | null;

		// /**
		//  * The ingress will trust for clients that provide SSL certificate issued by this authorities
		//  */
		// readonly ingressHttpHostResponseStaticClientSslTrustedCaCertificates: string | null;

		// /**
		//  * The ingress will trust for clients that provide SSL certificate with this common name
		//  */
		// readonly ingressHttpHostResponseStaticClientSslCommonName: string | null;

		// /**
		//  * The ingress will trust for clients that provide all of these headers
		//  */
		// readonly ingressHttpHostResponseStaticMandatoryHeaders: Readonly<Record<string, string | null>> | null;
	}

	export namespace HttpHostResponseDynamic {
		export const enum Kind {
			ExternalProcess = "EXTERNAL_PROCESS"
		}
	}

	export interface HttpHostResponseDynamic extends HttpHostBase {
		readonly ingressHttpHostResponseKind: HttpResponseKind.DYNAMIC;
		readonly ingressHttpHostResponseDynamicHandlerKind: HttpHostResponseDynamic.Kind.ExternalProcess;
		readonly ingressHttpHostResponseDynamicHandlerExternalScriptPath: string;
	}


	export type HttpHost = HttpHostResponseStatic | HttpHostResponseDynamic;

	export interface WebSocketHost extends DataBase {
		readonly ingressKind: Kind.WebSocketHost;

		// TBD
		readonly a: string;
	}

	export interface WebSocketClient extends DataBase {
		readonly ingressKind: Kind.WebSocketClient;

		readonly ingressWebSocketClientUrl: URL;
		// TBD
	}

	export type Data = HttpHost | WebSocketClient | WebSocketHost;

	export interface Instance {
		readonly ingressCreatedAt: Date;
		readonly ingressDeletedAt: Date | null;
	}
}

// interface SslModel {
// 	readonly clientTrustedCA: string;
// 	readonly clientCommonName: string;
// }

export type IngressManagement
	= Ingress.Id
	& Ingress.DataBase
	& Ingress.Instance
	;

export type Ingress
	= Ingress.Id
	& Ingress.Data
	& Ingress.Instance
	;

export function ensureIngressKind(kind: string): asserts kind is Ingress.Kind {
	const friendlyKind: Ingress.Kind = kind as Ingress.Kind;
	switch (friendlyKind) {
		case Ingress.Kind.HttpHost:
		case Ingress.Kind.WebSocketClient:
		case Ingress.Kind.WebSocketHost:
			return;
		default:
			throw new EnsureIngressKindNeverException(friendlyKind);
	}
}
class EnsureIngressKindNeverException extends FException {
	public constructor(kind: never) {
		super(`Wrong ingress kind value '${kind}'`);
	}
}

export function ensureIngressHttpResponseKind(kind: string): asserts kind is Ingress.HttpResponseKind {
	const friendlyKind: Ingress.HttpResponseKind = kind as Ingress.HttpResponseKind;
	switch (friendlyKind) {
		case Ingress.HttpResponseKind.DYNAMIC:
		case Ingress.HttpResponseKind.STATIC:
			return;
		default:
			throw new EnsureIngressHttpResponseKindNeverException(friendlyKind);
	}
}
class EnsureIngressHttpResponseKindNeverException extends FException {
	public constructor(kind: never) {
		super(`Wrong ingress http response kind value '${kind}'`);
	}
}

export function ensureIngressHttpHostResponseDynamicKind(kind: string): asserts kind is Ingress.HttpHostResponseDynamic.Kind {
	const friendlyKind: Ingress.HttpHostResponseDynamic.Kind = kind as Ingress.HttpHostResponseDynamic.Kind;
	switch (friendlyKind) {
		case Ingress.HttpHostResponseDynamic.Kind.ExternalProcess:
			return;
		default:
			throw new EnsureIngressHttpHostResponseDynamicKindNeverException(friendlyKind);
	}
}
class EnsureIngressHttpHostResponseDynamicKindNeverException extends FException {
	public constructor(kind: never) {
		super(`Wrong ingress http response kind value '${kind}'`);
	}
}


