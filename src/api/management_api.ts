import { FException, FExecutionContext, FInitableBase, FLogger } from "@freemework/common";

// Models
import { Topic } from "../model/topic";

import { DatabaseFactory } from "../data/database_factory";
import {
	EgressIdentifier, Egress,
	IngressIdentifier, Ingress,
	LabelHandlerIdentifier, LabelHandler,
	LabelIdentifier, Label,
	TopicIdentifier,
	MessageIdentifier
} from "../model";
import { Database } from "../data/database";
import { MessageBus } from "../messaging/message_bus";
import { IngressManagement } from "../model/ingress";
import { Meta } from "../model/meta";
import { ManagementMessage } from "../model/message";

/**
 * Management API allows to control user's delivery endpoints, like add/remove webhooks
 */
export class ManagementApi extends FInitableBase {
	public constructor(
		private readonly _dbFactory: DatabaseFactory,
		private readonly _messageBus: MessageBus,
	) {
		super();
		this._log = FLogger.create(ManagementApi.name);
		this.__db = null;
	}

	public async createEgress(
		executionContext: FExecutionContext, egressData: Partial<Egress.Id> & Egress.Data
	): Promise<Egress> {
		this.verifyInitializedAndNotDisposed();

		const fullEgressData: Egress.Id & Egress.Data = {
			...egressData,
			egressId: egressData.egressId ?? EgressIdentifier.generate(),
		};

		const egress: Egress = await this._db.createEgress(
			executionContext,
			fullEgressData
		);
		await this._db.transactionCommit(executionContext);

		await this._messageBus.registerEgress(executionContext, egress.egressId);

		this._log.trace(executionContext, () => `Exit createEgress with data: ${JSON.stringify(egress)}`);
		return egress;
	}

	public async createIngress(
		executionContext: FExecutionContext, ingressData: Partial<Ingress.Id> & Ingress.Data
	): Promise<Ingress> {
		this.verifyInitializedAndNotDisposed();

		const fullIngressData: Ingress.Id & Ingress.Data = {
			...ingressData,
			ingressId: ingressData.ingressId ?? IngressIdentifier.generate(),
		};

		const ingress: Ingress = await this._db.createIngress(
			executionContext,
			fullIngressData
		);

		this._log.trace(executionContext, () => `Exit createIngress with data: ${JSON.stringify(ingress)}`);
		return ingress;
	}

	public async createLabelHandler(
		executionContext: FExecutionContext, labelHandlerData: Partial<LabelHandler.Id> & LabelHandler.Data
	): Promise<LabelHandler["labelHandlerId"]> {
		this.verifyInitializedAndNotDisposed();

		const fullLabelHandlerData: LabelHandler.Id & LabelHandler.Data = {
			labelHandlerId: labelHandlerData.labelHandlerId ?? LabelHandlerIdentifier.generate(),
			topicId: labelHandlerData.topicId,
			labelHandlerKind: labelHandlerData.labelHandlerKind,
			externalProcessPath: labelHandlerData.externalProcessPath
		};

		const labelHandlerId: LabelHandlerIdentifier = await this._db.createLabelHandler(
			executionContext,
			fullLabelHandlerData
		);
		await this._db.transactionCommit(executionContext);

		this._log.debug(executionContext, () => `Exit createLabelHandler with data: ${JSON.stringify(labelHandlerData)}`);
		return labelHandlerId;
	}


	public async getOrCreateLabel(
		executionContext: FExecutionContext, labelValue: Label.Data["labelValue"]
	): Promise<Label> {
		this.verifyInitializedAndNotDisposed();

		const label: Label | null = await this._db.findLabelByValue(executionContext, labelValue);
		if (label !== null) {
			return label;
		}
		const newLabel = this._db.createLabel(executionContext, { labelValue });

		this._log.debug(executionContext, () => `Exit createLabelHandler with data: ${JSON.stringify(labelValue)}`);
		return newLabel;
	}

	public async createTopic(
		executionContext: FExecutionContext, topicData: Partial<Topic.Id> & Topic.Data
	): Promise<Topic> {
		this.verifyInitializedAndNotDisposed();

		const fullTopicData: Topic.Id & Topic.Data = {
			topicId: topicData.topicId ?? TopicIdentifier.generate(),
			topicName: topicData.topicName,
			topicDomain: topicData.topicDomain,
			topicDescription: topicData.topicDescription,
			topicMediaType: topicData.topicMediaType
		};

		const topic: Topic = await this._db.createTopic(
			executionContext,
			fullTopicData
		);
		await this._db.transactionCommit(executionContext);

		await this._messageBus.registerTopic(executionContext, topic.topicId);

		this._log.debug(executionContext, () => `Exit createTopic with data: ${JSON.stringify(topic)}`);
		return topic;
	}

	public async findEgress(executionContext: FExecutionContext, egressId: EgressIdentifier): Promise<Egress | null> {
		this.verifyInitializedAndNotDisposed();

		const egress = await this._db.findEgress(executionContext, { egressId });

		return egress;
	}

	public async findIngress(executionContext: FExecutionContext, ingressId: IngressIdentifier): Promise<Ingress | null> {
		this.verifyInitializedAndNotDisposed();

		const ingress = await this._db.findIngress(executionContext, { ingressId });

		return ingress;
	}

	public async findMessage(executionContext: FExecutionContext, messageId: MessageIdentifier): Promise<ManagementMessage | null> {
		this.verifyInitializedAndNotDisposed();

		const message = await this._db.findMessage(executionContext, messageId);

		return message;
	}

	public async findLabel(executionContext: FExecutionContext, labelId: LabelIdentifier): Promise<Label | null> {
		this.verifyInitializedAndNotDisposed();

		const label = await this._db.findLabel(executionContext, { labelId });

		return label;
	}

	public async findLabelHandler(executionContext: FExecutionContext, labelHandlerId: LabelHandlerIdentifier): Promise<LabelHandler | null> {
		this.verifyInitializedAndNotDisposed();

		const labelHandler = await this._db.findLabelHandler(executionContext, { labelHandlerId });

		return labelHandler;
	}

	public async findTopic(executionContext: FExecutionContext, topicId: TopicIdentifier): Promise<Topic | null> {
		this.verifyInitializedAndNotDisposed();

		const topic = await this._db.findTopic(executionContext, { topicId });

		return topic;
	}

	public async listTopics(
		executionContext: FExecutionContext, domain: string | null, opts?: { search?: string; }
	): Promise<Array<Topic>> {
		this.verifyInitializedAndNotDisposed();

		const topics: Array<Topic> = await this._db.listTopics(executionContext, { search: opts?.search });
		return topics;
	}

	public async getMeta(
		executionContext: FExecutionContext, domain: string | null
	): Promise<Meta> {
		this.verifyInitializedAndNotDisposed();

		const meta: Meta = await this._db.getMeta(executionContext);
		return meta;
	}

	public async listIngresses(
		executionContext: FExecutionContext, domain: string | null,
		opts?: { search?: string }
	): Promise<Array<IngressManagement>> {
		this.verifyInitializedAndNotDisposed();

		const ingresses: Array<IngressManagement> = await this._db.listIngesses(executionContext, opts);
		return ingresses;
	}

	public async listEgresses(
		executionContext: FExecutionContext, domain: string | null,
		opts?: { search?: string; }
	): Promise<Array<Egress>> {
		this.verifyInitializedAndNotDisposed();

		const egresses: Array<Egress> = await this._db.listEgresses(executionContext, opts);
		return egresses;
	}


	public async listMessages(
		executionContext: FExecutionContext, domain: string | null,
		opts?: { search?: string; }
	): Promise<Array<any>> {
		this.verifyInitializedAndNotDisposed();

		const messages: Array<any> = await this._db.listMessages(executionContext, opts);
		return messages;
	}

	// public async destroyTopic(
	// 	executionContext: FExecutionContext, topicId: Topic.Id, security: Security
	// ): Promise<void> {
	// 	this._log.debug(`Run destroyTopic with topic: ${topicId}`);

	// 	try {
	// 		const topicRecord: Topic = await this._storage.getTopic(cancellationToken, topicId);

	// 		const topicSecurityKind = topicRecord.topicSecurity.kind;
	// 		const topicSecurityToken = topicRecord.topicSecurity.token;

	// 		if (security.kind !== topicSecurityKind || security.token !== topicSecurityToken) {
	// 			throw new WrongArgumentApiError(`Wrong topic Security Kind or topic Security Token`);
	// 		}

	// 		if (topicRecord.deleteAt) {
	// 			throw new WrongArgumentApiError(`Topic ${topicId.topicName} already deleted`);
	// 		}

	// 		await this._storage.removeTopic(cancellationToken, topicId);
	// 	} catch (e) {
	// 		this._log.error(`destroyTopic Error: ${e.message}`);
	// 		throw apiHandledException(e);
	// 	}
	// }

	public async persist(executionContext: FExecutionContext): Promise<void> {
		this.verifyInitializedAndNotDisposed();

		await this.__db!.transactionCommit(executionContext);
	}

	protected async onInit() {
		this.__db = await this._dbFactory.create(this.initExecutionContext);
	}
	protected async onDispose() {
		this.__db!.transactionRollback(this.initExecutionContext);
		this.__db!.dispose();
	}

	private get _db(): Database {
		this.verifyInitializedAndNotDisposed();
		return this.__db!;
	}

	private __db: Database | null;
	private readonly _log: FLogger;
}
