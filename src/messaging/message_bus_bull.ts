import { FException, FExceptionAggregate, FExceptionInvalidOperation, FExecutionContext, FLogger, FLoggerLabelsExecutionContext } from "@freemework/common";

import { DoneCallback, Job, JobOptions, Queue } from "bull";
import Bull from "bull";
import { RedisOptions } from 'ioredis';
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { EgressIdentifier, Label, LabelIdentifier, MessageIdentifier, TopicIdentifier } from "../model";
import { Message } from "../model/message";
import { MessageBus } from "./message_bus";
import { MessageBusBase } from "./message_bus_base";
import { DatabaseFactory } from "../data/database_factory";
import { EventChannelBase } from "../utils/event_channel_base";
import { MIME_APPLICATION_JSON } from "../utils/mime";
import { Database } from "../data/database";
import { Topic } from "../model/topic";
import { Ingress } from "../model/ingress";
import { Egress } from "../model/egress";
import { Bind } from "../utils/bind";
import { unpromise } from "../utils/unpromise";
import { Delivery } from "../model";
import { MaskService } from "../misc/mask_service";

/**
 * Implementation of Message Bus top on bull library
 * See: https://www.npmjs.com/package/bull
 */
export class MessageBusBull extends MessageBusBase {
	protected readonly log: FLogger;

	public get serverAdapterRouter() {
		return this._serverAdapter.getRouter();
	}

	public constructor(
		storage: DatabaseFactory,
		redisUrl: URL,
		public readonly dashboardBindPath: string = '/admin/queues',
		// temporary passed (should be initialized inside)
	) {
		super(storage);

		this.log = FLogger.create(MessageBusBull.name);

		const db: number = Number.parseInt(redisUrl.pathname.substring(1) ?? '0');
		const port: number = Number.parseInt(redisUrl.port ?? '6379');
		const host: string = redisUrl.hostname;

		const redisOpts: RedisOptions = { host, port, db };
		if (redisUrl.password.length > 0) {
			redisOpts.password = decodeURIComponent(redisUrl.password);
		}
		this._redisOpts = Object.freeze(redisOpts);
		this._redisUrl = redisUrl;

		this._channels = new Map();
		this._bullEgressQueues = new Map<EgressIdentifier["value"], Queue>();
		this._bullTopicQueues = new Map<TopicIdentifier["value"], TopicQueueItem>();

		this._bullJobOpts = Object.freeze({
			attempts: 512,
			backoff: Object.freeze({
				type: "exponential",
				delay: 1000
			})
		});

		this._serverAdapter = new ExpressAdapter();
		this._serverAdapter.setBasePath(dashboardBindPath);

		this._bullBoardController = createBullBoard({
			queues: [],
			serverAdapter: this._serverAdapter,
		});
	}

	protected async onPublish(
		executionContext: FExecutionContext,
		ingress: Ingress,
		topic: Topic,
		message: Message.Id & Message.Data & Message.Labels
	): Promise<void> {
		const topicQueueItem: TopicQueueItem = this.getOrRegisterTopicQueue(topic);

		await topicQueueItem.queue.add(
			"TOPIC",
			{
				topicId: topic.topicId.value,
				message: {
					id: message.messageId.value,
					mediaType: message.messageMediaType,
					headers: message.messageHeaders,
					ingressBody: Buffer.from(message.messageIngressBody).toString("base64"),
					ingressBodyJson: message.messageMediaType === MIME_APPLICATION_JSON ? JSON.parse(Buffer.from(message.messageIngressBody).toString()) : null,
					body: Buffer.from(message.messageBody).toString("base64"),
					bodyJson: message.messageMediaType === MIME_APPLICATION_JSON ? JSON.parse(Buffer.from(message.messageBody).toString()) : null,
					labels: message.messageLabels.map(l => ({ id: l.labelId, value: l.labelValue }))
				}
			},
			this._bullJobOpts
		);
	}

	protected async onRegisterEgress(
		executionContext: FExecutionContext,
		egress: Egress
	): Promise<void> {
		this.getOrRegisterEgressQueue(egress);
	}

	protected async onRegisterTopic(
		executionContext: FExecutionContext,
		topic: Topic
	): Promise<void> {
		this.getOrRegisterTopicQueue(topic);
	}

	protected async onRetainChannel(
		executionContext: FExecutionContext,
		topic: Topic,
		egress: Egress
	): Promise<MessageBus.Channel> {
		if (!this._channels.has(egress.egressId.value)) {
			this._channels.set(egress.egressId.value, new Map());
		}

		const existingChannel: MessageBusBullEventChannel | undefined = this._channels.get(egress.egressId.value)!.get(topic.topicId.value);
		if (existingChannel !== undefined) {
			throw new FExceptionInvalidOperation(`Unable to retain channel for ${egress.egressId.value} due it already used.`);
		}

		const channel: MessageBusBullEventChannel = new MessageBusBullEventChannel(topic.topicName, () => {
			this._channels.get(egress.egressId.value)!.delete(topic.topicId.value);
		});

		this._channels.get(egress.egressId.value)!.set(topic.topicId.value, channel);

		return channel;
	}

	protected async onInit(): Promise<void> {
		const executionContext: FExecutionContext = this.initExecutionContext;

		const maskedRedisUrlString: string = MaskService.DEFAULT.maskUri(this._redisUrl).toString();
		this.log.info(executionContext, `Initializing MessageBusBull with Redis connection ${maskedRedisUrlString}`);

		await super.onInit();
		//
		try {
			await this.storage.using(
				executionContext,
				async (db: Database) => {
					const topics: Array<Topic> = await db.listTopics(executionContext);
					const egresses: Array<Egress> = await db.listEgresses(executionContext);
					for (const topic of topics) {
						this.getOrRegisterTopicQueue(topic);
					}
					for (const egress of egresses) {
						this.getOrRegisterEgressQueue(egress);
					}
				}
			);
		} catch (e) {
			try {
				await super.onDispose();
			} catch (e2) {
				throw new FExceptionAggregate([FException.wrapIfNeeded(e), FException.wrapIfNeeded(e2)])
			}
			throw e;
		}
	}

	protected onDispose(): void | Promise<void> {
		//
		console.log(`onDispose ${this.constructor.name}`);
	}

	private getOrRegisterTopicQueue(topic: Topic): TopicQueueItem {
		if (this._bullTopicQueues.has(topic.topicId.value)) {
			return this._bullTopicQueues.get(topic.topicId.value)!;
		}

		const queue: Queue = new Bull(`TOPIC:${topic.topicName}`, {
			redis: this._redisOpts,
		});
		const topicQueueItem: TopicQueueItem = Object.freeze({
			queue,
			targetEgressQueues: new Set<[EgressIdentifier, Queue]>()
		});
		this._bullTopicQueues.set(topic.topicId.value, topicQueueItem);
		this._bullBoardController.addQueue(new BullAdapter(queue));
		queue.process("TOPIC", this.topicJobProcessor).then(() => {
			console.log("queue.process finished");
		});

		return topicQueueItem;
	}

	private getOrRegisterEgressQueue(egress: Egress): Queue {
		if (this._bullEgressQueues.has(egress.egressId.value)) {
			return this._bullEgressQueues.get(egress.egressId.value)!;
		}

		const topicQueueItems: Array<TopicQueueItem> = egress.egressTopicIds.map(egressTopicId => {
			const topicQueueItem: TopicQueueItem = this.getTopicQueueItem(egressTopicId);
			return topicQueueItem;
		});

		const queue: Queue = new Bull(egress.egressId.value, {
			redis: this._redisOpts,
		});

		this._bullEgressQueues.set(egress.egressId.value, queue);
		for (const topicQueueItem of topicQueueItems) {
			topicQueueItem.targetEgressQueues.add([egress.egressId, queue]);
		}

		this._bullBoardController.addQueue(new BullAdapter(queue));
		queue.process("EGRESS", this.egressJobProcessor).then(() => {
			console.log("queue.process finished");
		});

		return queue;
	}

	private getTopicQueueItem(topicId: TopicIdentifier): TopicQueueItem {
		const topicQueueItem: TopicQueueItem | undefined = this._bullTopicQueues.get(topicId.value);
		if (topicQueueItem === undefined) {
			throw new FExceptionInvalidOperation(`Integrity error. No such topic queue '${topicId.value}'.`);
		}
		return topicQueueItem;
	}

	@Bind
	private egressJobProcessor(job: Job, done: DoneCallback) {
		unpromise(
			(async () => {
				let executionContext: FExecutionContext = this.initExecutionContext;
				try {
					const topicId: TopicIdentifier = TopicIdentifier.parse(job.data.topicId);
					const egressId: EgressIdentifier = EgressIdentifier.parse(job.data.egressId);

					executionContext = new FLoggerLabelsExecutionContext(executionContext, {
						topicId: topicId.value,
						egressId: egressId.value,
					});

					await this.storage.using(executionContext, async (db: Database) => {
						const rawMessage = job.data.message;
						const messageId = MessageIdentifier.parse(rawMessage.id);

						executionContext = new FLoggerLabelsExecutionContext(executionContext, {
							messageId: messageId.value
						});

						await db.lockEgressMessageQueue(
							executionContext, { egressId, topicId, messageId }
						);

						try {
							const topicChannelsMap: Map<TopicIdentifier["value"], MessageBusBullEventChannel> | undefined
								= this._channels.get(egressId.value);

							if (topicChannelsMap === undefined || topicChannelsMap.size === 0) {
								throw new FException("No any egress consumers");
							}

							const channel: MessageBusBullEventChannel | undefined = topicChannelsMap.get(topicId.value);
							if (channel === undefined) {
								throw new FException("No any egress consumers");
							}

							const messageLabels: Array<Label> = [];
							{
								const labelIds: Array<LabelIdentifier> = rawMessage.labels.map((l: any) => LabelIdentifier.parse(l.id));
								for (const labelId of labelIds) {
									messageLabels.push(await db.getLabel(executionContext, { labelId }));
								}
							}

							const message: Message = {
								messageId,
								messageMediaType: rawMessage.mediaType,
								messageHeaders: rawMessage.headers,
								messageIngressBody: Buffer.from(rawMessage.ingressBody, "base64"),
								messageBody: Buffer.from(rawMessage.body, "base64"),
								messageLabels
							};

							const event: MessageBus.Channel.Event = {
								source: channel,
								data: message
							};

							// const isMatchLabels: boolean = await this.matchLabels(executionContext, db, egressId, message.messageLabels);
							const isMatchLabels: boolean = true;
							if (isMatchLabels) {
								await channel.notify(executionContext, event);
							}

							await db.removeEgressMessageQueue(
								executionContext, { egressId, topicId, messageId }
							);

							const status: Delivery.Status = isMatchLabels ? Delivery.Status.Success : Delivery.Status.Skip;

							await db.createDelivery(executionContext, {
								egressId,
								topicId,
								messageId,
								status: isMatchLabels ? Delivery.Status.Success : Delivery.Status.Skip,
								successEvidence: event.deliveryEvidence ?? null
							});

							this.log.info(executionContext, () => `Delivery completed with status '${status}'.`);

							done();
						}
						catch (e) {
							try {
								await db.createDelivery(executionContext, {
									egressId,
									topicId, messageId,
									status: Delivery.Status.Failure,
									failureEvidence: `${e}`
								});
								await db.transactionCommit(executionContext);
							} catch (e2) {
								throw new FExceptionAggregate([
									FException.wrapIfNeeded(e2),
									FException.wrapIfNeeded(e)
								]);
							}
							throw e;
						}
					});
				}
				catch (e) {
					const inputData = (() => {
						try {
							const topicId: TopicIdentifier = TopicIdentifier.parse(job.data.topicId);
							const egressId: EgressIdentifier = EgressIdentifier.parse(job.data.egressId);
							const messageId: MessageIdentifier = MessageIdentifier.parse(job.data.message.id);
							return { topicId, egressId, messageId }
						} catch (e2) {
							return null;
						}
					})();

					const wrappedException: FException = FException.wrapIfNeeded(e);
					if (wrappedException.message !== "No any egress consumers") {
						this.log.info(executionContext, () => `Delivery failure with error: ${wrappedException.message}`);
						this.log.debug(executionContext, "Delivery failure", wrappedException);
					}
					done(wrappedException);
				}
			})()
		);
	}

	@Bind
	private topicJobProcessor(job: Job, done: DoneCallback) {
		unpromise(
			(async () => {
				let executionContext: FExecutionContext = this.initExecutionContext;
				try {
					const topicId: TopicIdentifier = TopicIdentifier.parse(job.data.topicId);

					executionContext = new FLoggerLabelsExecutionContext(executionContext, { topicId: topicId.value });

					const topicQueueItem: TopicQueueItem = this.getTopicQueueItem(topicId);

					await this.storage.using(executionContext, async (db) => {

						for (const [targetEgressId, targetEgressQueue] of topicQueueItem.targetEgressQueues) {
							const rawMessage = job.data.message;
							const messageId = MessageIdentifier.parse(rawMessage.id);

							const cycleExecutionContext: FExecutionContext = new FLoggerLabelsExecutionContext(executionContext, {
								egressId: targetEgressId.value,
								messageId: messageId.value,
							});

							const messageLabels: Array<Label> = [];
							{
								const labelIds: Array<LabelIdentifier> = rawMessage.labels.map((l: any) => LabelIdentifier.parse(l.id));
								for (const labelId of labelIds) {
									messageLabels.push(await db.getLabel(cycleExecutionContext, { labelId }));
								}
							}

							const isMessageMatchToEgress: boolean = await this.matchLabels(cycleExecutionContext, db, targetEgressId, messageLabels);
							if (isMessageMatchToEgress) {
								this.log.info(cycleExecutionContext, () => `Message was routed at routing phase.`);
								await targetEgressQueue.add(
									"EGRESS",
									{
										topicId: job.data.topicId,
										egressId: targetEgressId,
										message: job.data.message
									},
									this._bullJobOpts
								);
							} else {
								this.log.info(cycleExecutionContext, () => `Message was skipped at routing phase.`);
							}
						}
					});

					done();
				}
				catch (e) {
					done(FException.wrapIfNeeded(e));
				}
			})()
		);
	}

	private readonly _channels: Map<EgressIdentifier["value"], Map<TopicIdentifier["value"], MessageBusBullEventChannel>>;
	private readonly _bullEgressQueues: Map<EgressIdentifier["value"], Queue>;
	private readonly _bullTopicQueues: Map<TopicIdentifier["value"], TopicQueueItem>;
	private readonly _serverAdapter: ExpressAdapter;
	private readonly _bullJobOpts: JobOptions;
	private readonly _redisOpts: RedisOptions;
	private readonly _redisUrl: URL;
	private readonly _bullBoardController: ReturnType<typeof createBullBoard>;
}

interface TopicQueueItem {
	readonly queue: Queue;
	readonly targetEgressQueues: Set<[EgressIdentifier, Queue]>;
}

class MessageBusBullEventChannel
	extends EventChannelBase<Message.Id & Message.Data, MessageBus.Channel.Event>
	implements MessageBus.Channel {
	public constructor(
		public readonly topicName: string,
		private readonly _onDispose: () => void
	) {
		super();
	}

	public notify(executionContext: FExecutionContext, event: MessageBus.Channel.Event): void | Promise<void> {
		return super.notify(executionContext, event);
	}

	protected async onInit(): Promise<void> {
		//
	}
	protected async onDispose(): Promise<void> {
		this._onDispose();
	}
}
