import { IngressIdentifier, MessageIdentifier, TopicIdentifier } from "./identifiers";
import { Label } from "./label";

export namespace Message {
	export interface Id {
		/**
		 * An identifier of the `Message`
		 */
		readonly messageId: MessageIdentifier;
	}

	export type Headers = Readonly<Record<string, string>>;
	export const enum HeaderPrefix {
		HTTP = "http.header."
	}

	export interface Data {
		readonly messageHeaders: Headers;
		/**
		 * https://en.wikipedia.org/wiki/Media_type
		 */
		readonly messageMediaType: string;
		/**
		 * Binary data of the ingress(original) message
		 */
		readonly messageIngressBody: Uint8Array;
		/**
		 * Binary data of the transformed message
		 */
		readonly messageBody: Uint8Array;
	}
	export interface Labels {
		readonly messageLabels: ReadonlyArray<Label>;
	}

	// export interface StatusBase {
	// 	readonly deliveryAttemptsCount: number;
	// }
	// export interface StatusNew extends StatusBase {
	// 	readonly status: Status.Kind.NEW;
	// }
	// export interface StatusOnTheWay extends StatusBase {
	// 	readonly status: Status.Kind.ON_THE_WAY;

	// 	readonly latestDeliveryErrorMessage: string | null;
	// }
	// export interface StatusCancelled extends StatusBase {
	// 	readonly status: Status.Kind.CANCELLED;

	// 	readonly cancelDate: Date;
	// }
	// export interface StatusDelivered extends StatusBase {
	// 	readonly status: Status.Kind.DELIVERED;

	// 	readonly deliveryDate: Date;
	// }
	// export interface StatusRejected extends StatusBase {
	// 	readonly status: Status.Kind.REJECTED;

	// 	readonly rejectDate: Date;
	// }
	// export type Status = StatusNew | StatusOnTheWay | StatusCancelled | StatusDelivered | StatusRejected;
	// export namespace Status {
	// 	export const enum Kind {
	// 		NEW = "NEW",
	// 		ON_THE_WAY = "ON_THE_WAY",
	// 		CANCELLED = "CANCELLED",
	// 		DELIVERED = "DELIVERED",
	// 		REJECTED = "REJECTED"
	// 	}
	// }
	export interface Management {
		readonly topicId: TopicIdentifier;
		readonly ingressId: IngressIdentifier;
		readonly createAt: Date;
	}
}

export type Message = Message.Id & Message.Data & Message.Labels/* & Message.Status*/;
export type ManagementMessage = Message.Id & Message.Data & Message.Management;
