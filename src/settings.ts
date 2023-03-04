import { FConfiguration, FException, FExceptionInvalidOperation } from "@freemework/common";
import { FHostingConfiguration } from "@freemework/hosting";

import { Router } from "express-serve-static-core";

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
		 * Connection URL to cache storage (for example Redis)
		 */
		public readonly cacheStorageURL: URL,

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

		const cacheStorageURL: URL = edgebusRuntimeConfiguration.get("cache.url").asUrl;
		const persistentStorageURL: URL = edgebusRuntimeConfiguration.get("persistent.url").asUrl;

		const setupConfiguration: FConfiguration | null = edgebusConfiguration.findNamespace("setup");
		const setup: Settings.Setup | null = setupConfiguration !== null ? parseSetup(setupConfiguration) : null;

		const appConfig: Settings = new Settings(
			servers,
			endpoints,
			persistentStorageURL,
			cacheStorageURL,
			setup
		);

		return appConfig;
	}
}

export namespace Settings {

	export type Endpoint =
		| RestInfoEndpoint
		| RestManagementEndpoint
		| RestPublisherEndpoint
		| RestSubscriberEndpoint
		| ExpressRouterManagementEndpoint
		| ExpressRouterPublisherEndpoint;

	export interface BaseRestEndpoint extends FHostingConfiguration.BindEndpoint, FHostingConfiguration.ServerEndpoint {
		readonly cors: Cors | null;
	}
	export interface RestInfoEndpoint extends BaseRestEndpoint {
		readonly type: "rest-info";
	}	export interface RestManagementEndpoint extends BaseRestEndpoint {
		readonly type: "rest-management";
	}
	export interface RestPublisherEndpoint extends BaseRestEndpoint {
		readonly type: "rest-publisher";
	}
	export interface RestSubscriberEndpoint extends BaseRestEndpoint {
		readonly type: "rest-subscriber";
	}
	export interface ExpressRouterManagementEndpoint extends FHostingConfiguration.BindEndpoint {
		readonly type: "express-router-management";
		readonly router: Router;
	}
	export interface ExpressRouterPublisherEndpoint extends FHostingConfiguration.BindEndpoint {
		readonly type: "express-router-publisher";
		readonly router: Router;
	}

	export interface Cors {
		readonly methods: ReadonlyArray<string>;
		readonly whiteList: ReadonlyArray<string>;
		readonly allowedHeaders: ReadonlyArray<string>;
	}

	export interface SSL {
		readonly caCert?: Buffer;
		readonly clientCert?: {
			readonly cert: Buffer;
			readonly key: Buffer;
		};
	}

	export interface Setup {
		readonly publishers: ReadonlyArray<Setup.Publisher>;
		readonly subscribers: ReadonlyArray<Setup.Subscriber>;
		readonly topics: ReadonlyArray<Setup.Topic>;
	}

	export namespace Setup {
		export type Publisher =
			| Publisher.HttpHost;
		export namespace Publisher {
			export const enum Type {
				HTTP_HOST = "http_host",
			}

			export interface Base {
				/**
				 * Publisher API Identifier
				 */
				readonly publisherId: string;

				readonly type: Type;

				/**
				 * API ID of target topic
				 */
				readonly targetTopicId: string;
			}

			export interface HttpHost extends Base {
				readonly type: Type.HTTP_HOST;
				readonly path: string;
			}
		}

		export type Subscriber =
			| Subscriber.HttpClient
			| Subscriber.WebsocketHost;

		export namespace Subscriber {
			export const enum Type {
				WEBSOCKET_HOST = "websocket_host",
				HTTP_CLIENT = "http_client",
			}

			export interface Base {
				/**
				 * Subscriber API Identifier
				 */
				readonly subscriberId: string;

				readonly type: Type;

				/**
				 * API IDs of source topics
				 */
				readonly sourceTopicIds: ReadonlyArray<string>;


			}

			export interface HttpClient extends Base {
				readonly type: Type.HTTP_CLIENT;
				readonly httpMethod: string;
				readonly httpUrl: URL;
			}

			export interface WebsocketHost extends Base {
				readonly type: Type.WEBSOCKET_HOST;
			}

		}

		export interface Topic {
			/**
			 * Topic API Identifier
			 */
			readonly topicId: string;
			readonly name: string;
			readonly description: string;
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

			const httpEndpoint: Settings.RestManagementEndpoint = Object.freeze({
				type: endpointType,
				servers: endpointConfiguration.get("servers").asString.split(" "),
				bindPath: endpointConfiguration.get("bindPath", "/").asString,
				cors
			});
			return httpEndpoint;
		}
		case "rest-publisher": {
			const cors = endpointConfiguration.hasNamespace("cors")
				? parseCors(endpointConfiguration.getNamespace("cors")) : null;

			const httpEndpoint: Settings.RestPublisherEndpoint = Object.freeze({
				type: endpointType,
				servers: endpointConfiguration.get("servers").asString.split(" "),
				bindPath: endpointConfiguration.get("bindPath", "/").asString,
				cors
			});
			return httpEndpoint;
		}
		case "rest-subscriber": {
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
		case "express-router-publisher":
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

function parseSetup(setupConfiguration: FConfiguration): Settings.Setup | null {

	const publishers: Array<Settings.Setup.Publisher> = [];
	const subscribers: Array<Settings.Setup.Subscriber> = [];
	const topics: Array<Settings.Setup.Topic> = [];

	const publisherKey: string = "publisher";
	if (setupConfiguration.hasNamespace(publisherKey)) {
		const publishersConfiguration = setupConfiguration.getArray(publisherKey);
		for (const publisherConfiguration of publishersConfiguration) {
			const publisherId: string = publisherConfiguration.get("index").asString;
			const type: string = publisherConfiguration.get("type").asString;
			const targetTopicId: string = publisherConfiguration.get("target_topic_id").asString;
			const basePublisherSettings = { publisherId, targetTopicId };
			let publisherSettings: Settings.Setup.Publisher;
			switch (type) {
				case Settings.Setup.Publisher.Type.HTTP_HOST:
					publisherSettings = {
						...basePublisherSettings,
						type,
						path: publisherConfiguration.get("path").asString
					};
					break;
				default:
					throw new FExceptionInvalidOperation(`Unsupported ${publisherConfiguration.configurationNamespace}.type '${type}'.`);
			}
			publishers.push(Object.freeze(publisherSettings));
		}

		const subscriberKey: string = "subscriber";
		if (setupConfiguration.hasNamespace(subscriberKey)) {
			const subscribersConfiguration = setupConfiguration.getArray(subscriberKey);
			for (const subscriberConfiguration of subscribersConfiguration) {
				const subscriberId: string = subscriberConfiguration.get("index").asString;
				const type: string = subscriberConfiguration.get("type").asString;
				const sourceTopicIds: string = subscriberConfiguration.get("source_topic_ids").asString;
				const baseSubscriberSettings = { subscriberId, sourceTopicIds: sourceTopicIds.split(" ").filter(w => w !== "") };
				let subscriberSettings: Settings.Setup.Subscriber;
				switch (type) {
					case Settings.Setup.Subscriber.Type.HTTP_CLIENT:
						subscriberSettings = {
							...baseSubscriberSettings,
							type,
							httpMethod: subscriberConfiguration.get("http_method").asString,
							httpUrl: subscriberConfiguration.get("http_url").asUrl,
						};
						break;
					case Settings.Setup.Subscriber.Type.WEBSOCKET_HOST:
						subscriberSettings = {
							...baseSubscriberSettings,
							type,
						};
						break;
					default:
						throw new FExceptionInvalidOperation(`Unsupported ${subscriberConfiguration.configurationNamespace}.type '${type}'.`);
				}
				subscribers.push(Object.freeze(subscriberSettings));
			}
		}

		const topicKey: string = "topic";
		if (setupConfiguration.hasNamespace(topicKey)) {
			const topicsConfiguration = setupConfiguration.getArray(topicKey);
			for (const topicConfiguration of topicsConfiguration) {
				const topicId: string = topicConfiguration.get("index").asString;
				const name: string = topicConfiguration.get("name").asString;
				const description: string = topicConfiguration.get("description").asString;
				const topicSettings: Settings.Setup.Topic = { topicId, name, description };
				topics.push(Object.freeze(topicSettings));
			}
		}

		return Object.freeze({
			publishers: Object.freeze(publishers),
			subscribers: Object.freeze(subscribers),
			topics: Object.freeze(topics),
		});
	}
	else {
		return null;
	}
}

class UnreachableNotSupportedEndpointError extends Error {
	public constructor(endpointType: never) {
		super(`Non supported endpoint type: ${endpointType}`);
	}
}
