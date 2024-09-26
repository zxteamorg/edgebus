import { FExecutionContext, FInitable, FInitableBase } from "@freemework/common";

import { EgressIdentifier, IngressIdentifier, MessageIdentifier, TopicIdentifier } from "../model";
import { Delivery, Egress, Ingress, Message, Topic } from "../model";
import { Label } from "../model/label";
import { LabelHandler } from "../model/label_handler";
import { IngressManagement } from "../model/ingress";
import { Meta } from "../model/meta";
import { ManagementMessage } from "../model/message";

export abstract class Database extends FInitableBase {
	public abstract createDelivery(
		executionContext: FExecutionContext,
		deliveryData: Partial<Delivery.Id> & Delivery.Data
	): Promise<Delivery>;

	public abstract createEgress(
		executionContext: FExecutionContext,
		egressData: Partial<Egress.Id> & Egress.Data
	): Promise<Egress>;

	public abstract createIngress(
		executionContext: FExecutionContext,
		ingressData: Partial<Ingress.Id> & Ingress.Data
	): Promise<Ingress>;

	/**
	 * Register a message entity and related egress message queue entities
	 * @param executionContext TBD
	 * @param ingressApiId TBD
	 * @param messageApiId TBD
	 * @param headers TBD
	 * @param mimeType TBD
	 * @param body TBD
	 * @param originalBody TBD
	 * @param labels list of message labels
	 */
	public abstract createMessage(
		executionContext: FExecutionContext,
		ingressApiId: IngressIdentifier,
		messageApiId: MessageIdentifier,
		headers: Message.Headers,
		mimeType: string | null,
		originalBody: Uint8Array | null,
		body: Uint8Array | null,
		labels: ReadonlyArray<Label>
	): Promise<Message>;

	public abstract createLabelHandler(
		executionContext: FExecutionContext,
		labelHandlerData: Partial<LabelHandler.Id> & LabelHandler.Data
	): Promise<LabelHandler["labelHandlerId"]>;

	public abstract createLabel(executionContext: FExecutionContext, labelData: Partial<Label.Id> & Label.Data): Promise<Label>;

	public abstract createTopic(
		executionContext: FExecutionContext,
		topicData: Partial<Topic.Id> & Topic.Data
	): Promise<Topic>;

	public abstract findEgress(executionContext: FExecutionContext, opts: Egress.Id): Promise<Egress | null>;

	public abstract findIngress(executionContext: FExecutionContext, opts: Ingress.Id): Promise<Ingress | null>;

	public abstract findLabel(executionContext: FExecutionContext, opts: Label.Id): Promise<Label | null>;

	public abstract findLabelByValue(executionContext: FExecutionContext, value: Label.Data["labelValue"]): Promise<Label | null>;

	public abstract findLabelHandler(executionContext: FExecutionContext, opts: LabelHandler.Id): Promise<LabelHandler | null>;

	public abstract findTopic(executionContext: FExecutionContext, opts: Topic.Id | Topic.Name | Ingress.Id): Promise<Topic | null>;

	public abstract getEgress(executionContext: FExecutionContext, opts: Egress.Id): Promise<Egress>;

	public abstract getIngress(executionContext: FExecutionContext, opts: Ingress.Id): Promise<Ingress>;

	public abstract getLabel(executionContext: FExecutionContext, opts: Label.Id): Promise<Label>;

	public abstract getTopic(executionContext: FExecutionContext, opts: Topic.Id | Topic.Name | Ingress.Id): Promise<Topic>;

	public abstract listEgresses(
		executionContext: FExecutionContext,
		opts?: { search?: string; }
	): Promise<Array<Egress>>;

	public abstract listEgressMessageQueue(
		executionContext: FExecutionContext,
		opts: Topic.Id | Egress.Id | Message.Id,
	): Promise<Array<Database.EgressMessageQueue>>;

	public abstract listLabelHandlers(executionContext: FExecutionContext): Promise<Array<LabelHandler>>;

	public abstract listTopics(
		executionContext: FExecutionContext,
		opts?: {
			search?: string;
		}
	): Promise<Array<Topic>>

	public abstract getMeta(
		executionContext: FExecutionContext,
	): Promise<Meta>

	public abstract listIngesses(
		executionContext: FExecutionContext,
		opts?: { search?: string }
	): Promise<Array<IngressManagement>>

	public abstract listVersions(
		executionContext: FExecutionContext,
	): Promise<Array<string>>;

	public abstract listMessages(
		executionContext: FExecutionContext,
		opts?: { search?: string; }
	): Promise<Array<ManagementMessage>>;

	public abstract getMessage(
		executionContext: FExecutionContext,
		messageId: MessageIdentifier
	): Promise<ManagementMessage>;

	public abstract findMessage(
		executionContext: FExecutionContext,
		messageId: MessageIdentifier
	): Promise<ManagementMessage | null>;

	public abstract lockEgressMessageQueue(executionContext: FExecutionContext, opts: Topic.Id & Egress.Id & Message.Id): Promise<void>;

	public abstract removeEgressMessageQueue(executionContext: FExecutionContext, opts: Topic.Id & Egress.Id & Message.Id): Promise<void>;

	// getSubscriber(
	// executionContext: FExecutionContext,
	// 	egressId: EgressApiIdentifier
	// ): Promise<Egress>;

	// getTopic(
	// executionContext: FExecutionContext,
	// 	topic: Topic.Id
	// ): Promise<Topic>;

	// getTopicBySubscriber(
	// executionContext: FExecutionContext,
	// 	egressId: EgressApiIdentifier
	// ): Promise<Topic>;

	// removePublish(
	// executionContext: FExecutionContext,
	// 	ingressId: Ingress["ingressId"]
	// ): Promise<void>;

	// removeSubscriber(
	// executionContext: FExecutionContext,
	// 	egressId: EgressApiIdentifier
	// ): Promise<void>;

	// removeTopic(
	// executionContext: FExecutionContext,
	// 	topic: Topic.Id
	// ): Promise<void>;

	public abstract transactionCommit(executionContext: FExecutionContext): Promise<void>;
	public abstract transactionRollback(executionContext: FExecutionContext): Promise<void>;
}

export namespace Database {
	export type EgressMessageQueue = [TopicIdentifier, EgressIdentifier, MessageIdentifier];
}
