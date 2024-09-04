import {
	FDisposable, FExecutionContext,
	FLoggerLabelsExecutionContext, FInitable,
	FLogger, FExceptionArgument, FDecimal, FDecimalRoundMode,
	FDecimalBackendNumber, FExceptionInvalidOperation, FConfigurationException, FException,
	makeDisposable
} from "@freemework/common";
import { FLauncherRuntimeFactory, FLauncherRestartRequiredException } from "@freemework/hosting";

import * as _ from "lodash";

// Providers
import { SettingsProvider, SettingsProviderImpl } from "./provider/settings_provider";
import { StorageProvider } from "./provider/storage_provider";
import { EndpointsProvider } from "./provider/endpoints_provider";
import { HostingProvider } from "./provider/hosting_provider";
import { MessageBusProvider } from "./provider/message_bus_provider";
import { WebSocketHostEgress, WebhookEgress } from "./egress";
import { MessageBus } from "./messaging/message_bus";
import { Container } from "typescript-ioc";
import { Settings } from "./settings";
import { EgressIdentifier, IngressIdentifier, Message, TopicIdentifier } from "./model";
import packageInfo from "./utils/package_info";
import { ProviderLocator } from "./provider_locator";
import { SetupServiceProvider } from "./provider/setup_service_provider";
import { ApiProvider } from "./provider/api_provider";
import { Egress } from "./model/egress";
import { Ingress } from "./model/ingress";
import { IngressEndpoint } from "./endpoints/ingress_endpoint";
import { MessageBusBull } from "./messaging/message_bus_bull";
import { WebSocketClientIngress } from "./ingress/web_socket_client.ingress";
import { ResponseHandlerDynamicExternalProcess } from "./ingress/response_handler/response_handler_dynamic_external_process";
import { ResponseHandlerStatic } from "./ingress/response_handler/response_handler_static";

// Re-export stuff for embedded user's
export * from "./api/errors";
export { ManagementApi } from "./api/management_api";
export { PublisherApi } from "./api/publisher_api";
export { EgressApi } from "./api/egress_api";
export { ApiProvider } from "./provider/api_provider";
export { Settings } from "./settings";
export { HostingProvider } from "./provider/hosting_provider";

export * from "./misc";

export class RestartRequireException extends FLauncherRestartRequiredException { }


export default async function (executionContext: FExecutionContext, settings: Settings): Promise<FDisposable> {
	executionContext = new FLoggerLabelsExecutionContext(executionContext, {
		service: packageInfo.name,
		version: packageInfo.version
	});

	FDecimal.configure(new FDecimalBackendNumber(8, FDecimalRoundMode.Trunc));

	const log: FLogger = FLogger.create("EdgeBus");

	{
		log.info(executionContext, "Initializing ConfigurationProvider...");
		// const dbEncryptionKey = await passwordDerivation(configuration.dbEncryptionPassword);
		const ownProvider: SettingsProvider = new SettingsProviderImpl(settings);
		Container.bind(SettingsProvider).provider({ get() { return ownProvider; } });
	}

	{ // TODO: Temporary solution to expose Bull dashboard
		const messageBus: MessageBus = ProviderLocator.default.get(MessageBusProvider).wrap;
		if (messageBus instanceof MessageBusBull) {
			ProviderLocator.default.get(HostingProvider).serverInstances.forEach(s => {
				s.server.rootExpressApplication.use(messageBus.dashboardBindPath, messageBus.serverAdapterRouter);
			});
		}
	}

	const storageProvider: StorageProvider = Container.get(StorageProvider);
	await storageProvider.init(executionContext);

	const itemsToDispose: Array<FDisposable> = [];
	try {
		{ // local scope
			log.trace(executionContext, "Reading database versions...");
			const versions: Array<string> = await storageProvider.databaseFactory
				.using(executionContext, db => db.listVersions(executionContext));
			const versionChain: string = versions.join(" -> ");
			log.info(executionContext, `Database versions chain: ${versionChain}`);
		}


		log.info(executionContext, "Initializing DI runtime...");
		await FInitable.initAll(executionContext,
			ProviderLocator.default.get(MessageBusProvider),
			ProviderLocator.default.get(ApiProvider),
		);

		try {
			{
				// Setup Management
				const setupSettings: Settings.Setup | null = ProviderLocator.default.get(SettingsProvider).setup;
				if (setupSettings !== null) {
					const setupServiceProvider: SetupServiceProvider = ProviderLocator.default.get(SetupServiceProvider);
					const wasChanged: boolean = await setupServiceProvider.setup(
						executionContext = new FLoggerLabelsExecutionContext(executionContext, {
							phase: "setup"
						}),
						setupSettings
					);

					if (wasChanged) {
						throw new RestartRequireException({ exitCode: 100, message: "Setup process was applied. This action required restart of the service. Exiting..." });
					}
				} else {
					log.info(executionContext, "Skip setup process due no setup settings");
				}
			}

			const endpointsProvider: EndpointsProvider = ProviderLocator.default.get(EndpointsProvider);
			const hostingProvider: HostingProvider = ProviderLocator.default.get(HostingProvider);

			/* ---------HARDCODED INITIALIZATION--------------- */
			{
				const hardcodedPublisherConfigurations: Array<{
					readonly topicId: TopicIdentifier,
					readonly topicName: string;
					readonly topicDescription: string;
					readonly topicMediaType: string;
					readonly ingressConfiguration: Settings.Setup.Ingress;
				}> = [];
				const hardcodedSubscriberConfigurations: Array<{
					readonly topicIds: ReadonlyArray<string>;
					readonly topicNames: ReadonlyArray<string>;
					readonly egress: Settings.Setup.Egress;
				}> = [];

				const { setup } = settings;
				if (setup !== null) {
					const { ingresses, egresses, topics } = setup;

					const topicsByIdMap = new Map<string, Settings.Setup.Topic>();
					for (const topic of topics) {
						topicsByIdMap.set(topic.topicId, topic);
					}

					for (const ingress of ingresses) {
						hardcodedPublisherConfigurations.push({
							topicId: TopicIdentifier.parse(topicsByIdMap.get(ingress.topicId)!.topicId),
							topicName: topicsByIdMap.get(ingress.topicId)!.name,
							topicDescription: topicsByIdMap.get(ingress.topicId)!.description,
							topicMediaType: topicsByIdMap.get(ingress.topicId)!.mediaType,
							ingressConfiguration: ingress
						});
					}

					for (const egress of egresses) {
						hardcodedSubscriberConfigurations.push({
							topicIds: egress.sourceTopicIds,
							topicNames: egress.sourceTopicIds.map(s => topicsByIdMap.get(s)!.name),
							egress,
						});
					}
				}

				const messageBusProvider: MessageBusProvider = ProviderLocator.default.get(MessageBusProvider);

				const serverInstancesMap: Map<string, HostingProvider.ServerInstance> = hostingProvider.serverInstances.reduce(
					(acc, element) => {
						acc.set(element.name, element);
						return acc;
					},
					new Map<string, HostingProvider.ServerInstance>()
				);

				// Setup HTTP ingress
				for (const hardcodedPublisherConfiguration of hardcodedPublisherConfigurations) {
					const ingressConfiguration = hardcodedPublisherConfiguration.ingressConfiguration;
					const ingressId: IngressIdentifier = IngressIdentifier.parse(ingressConfiguration.ingressId);
					if (ingressConfiguration.kind === Ingress.Kind.WebSocketClient) {
						const webSocketClientIngress: WebSocketClientIngress = new WebSocketClientIngress(
							{
								topicId: hardcodedPublisherConfiguration.topicId,
								topicName: hardcodedPublisherConfiguration.topicName,
								topicDomain: null,
								topicDescription: hardcodedPublisherConfiguration.topicDescription,
								topicMediaType: hardcodedPublisherConfiguration.topicMediaType,
							},
							ingressId,
							messageBusProvider.wrap,
							{
								wsOptions: {},
								transformers: [],
								url: ingressConfiguration.url
							}
						);
						await webSocketClientIngress.init(executionContext);
						itemsToDispose.push(webSocketClientIngress);
					} else {
						if (ingressConfiguration.kind !== Ingress.Kind.HttpHost) {
							throw new FExceptionInvalidOperation(`Not supported yet: ${ingressConfiguration.kind}`);
						}

						const servers = ingressConfiguration.servers.map((serverIndex) => {
							const serverInstance: HostingProvider.ServerInstance | undefined = serverInstancesMap.get(serverIndex);
							if (serverInstance === undefined) {
								throw new FException(
									`Non-existing server index '${serverIndex}' defined in ingress '${ingressConfiguration.ingressId}'`
								);
							}
							return serverInstance.server;
						});

						const ingressEndpoint: IngressEndpoint = new IngressEndpoint(
							servers,
							{
								bindPath: ingressConfiguration.path,
							},
							{
								topic: {
									topicId: hardcodedPublisherConfiguration.topicId,
									topicName: hardcodedPublisherConfiguration.topicName,
									topicDomain: null,
									topicDescription: hardcodedPublisherConfiguration.topicDescription,
									topicMediaType: hardcodedPublisherConfiguration.topicMediaType,
								},
								ingressId,
								messageBus: messageBusProvider.wrap,
								opts: {
									transformers: [],
									successResponseHandler: (function () {
										switch (ingressConfiguration.httpResponseKind) {
											case Ingress.HttpResponseKind.DYNAMIC: {
												return new ResponseHandlerDynamicExternalProcess(
													ingressConfiguration.responseHandlerPath
												);
											}
											case Ingress.HttpResponseKind.STATIC: {
												return new ResponseHandlerStatic(
													ingressConfiguration.responseStatusCode,
													ingressConfiguration.responseStatusMessage,
													ingressConfiguration.responseHeaders,
													ingressConfiguration.responseBody,
												);
											}
										}
									})(),
								}
							},
						);
						endpointsProvider.registerIngressApiRestEndpoint(ingressEndpoint);
					}
				}

				// Setup egresses
				for (const hardcodedSubscriberConfiguration of hardcodedSubscriberConfigurations) {
					const egressId: EgressIdentifier = EgressIdentifier.parse(hardcodedSubscriberConfiguration.egress.egressId);
					const channelFactories: Array<MessageBus.ChannelFactory> = [];
					for (const topicIdStr of hardcodedSubscriberConfiguration.topicIds) {
						const channelFactory = async (): Promise<MessageBus.Channel> => {
							const topicId: TopicIdentifier = TopicIdentifier.parse(topicIdStr);
							const channel = await messageBusProvider.wrap.retainChannel(executionContext, topicId, egressId);
							return channel;
						}
						channelFactories.push(channelFactory);
					}

					for (const subscriberApiRestEndpoint of endpointsProvider.egressApiRestEndpoints) {
						switch (hardcodedSubscriberConfiguration.egress.kind) {
							case Egress.Kind.WebSocketHost:
								const webSocketHostSubscriber = new WebSocketHostEgress(
									{
										baseBindPath: subscriberApiRestEndpoint.bindPath,
										bindServers: subscriberApiRestEndpoint.servers,
										egressId,
										channelFactories
									},
								);
								await webSocketHostSubscriber.init(executionContext);
								itemsToDispose.push(webSocketHostSubscriber);
								break;
							case Egress.Kind.Webhook:
								const httpClientSubscriber = new WebhookEgress(
									{
										deliveryHttpMethod: hardcodedSubscriberConfiguration.egress.method,
										deliveryUrl: hardcodedSubscriberConfiguration.egress.url,
										ssl: hardcodedSubscriberConfiguration.egress.ssl,
										egressId,
										channelFactories
									}
								);
								await httpClientSubscriber.init(executionContext);
								itemsToDispose.push(httpClientSubscriber);
								break;
							default:
								throw new FExceptionArgument(`Unsupported egress type ${(hardcodedSubscriberConfiguration.egress as any).kind}`);
						}
					}
				}
			}

			await FInitable.initAll(executionContext,
				endpointsProvider,
				hostingProvider
			);
		} catch (e) {
			for (const hardcodedItem of itemsToDispose) { await hardcodedItem.dispose(); }

			await FDisposable.disposeAll(
				ProviderLocator.default.get(ApiProvider),
				ProviderLocator.default.get(MessageBusProvider)
			);
			throw e;
		}
	} catch (e) {
		await storageProvider.dispose();
		throw e;
	}
	/* ------------------------ */

	return makeDisposable(async function () {
		log.info(executionContext, "Destroying DI runtime...");

		for (const hardcodedItem of itemsToDispose.reverse()) {
			await hardcodedItem.dispose();
		}

		await FDisposable.disposeAll(
			// Endpoints should dispose first (reply 503, while finishing all active requests)
			ProviderLocator.default.get(EndpointsProvider),
			ProviderLocator.default.get(HostingProvider),
			ProviderLocator.default.get(MessageBusProvider),
			storageProvider
		);

	});
}
