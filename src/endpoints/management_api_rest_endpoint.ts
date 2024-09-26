import { FEnsure, FExecutionContext, FLoggerLabelsExecutionContext, FLogger } from "@freemework/common";
import { FHostingConfiguration, FServersBindEndpoint, FWebServer } from "@freemework/hosting";

import * as fs from 'node:fs';
import * as express from "express";
import * as bodyParser from "body-parser";

import { ManagementApi } from "../api/management_api";
import { endpointHandledException } from "./errors";
import { Topic } from "../model/topic";
import { Bind } from "../utils/bind";
import { ManagementApiProvider } from "../provider/management_api_provider";
import path = require("path");
import { Egress, Ingress, IngressIdentifier, MessageIdentifier } from "../model";
import { IngressManagement } from "../model/ingress";
import { Settings } from "../settings";
import { Meta } from "../model/meta";
import { ManagementMessage } from "../model/message";

const ensure: FEnsure = FEnsure.create();

export class ManagementApiRestEndpoint extends FServersBindEndpoint {

	public constructor(
		servers: ReadonlyArray<FWebServer>,
		private readonly _managementApiProvider: ManagementApiProvider,
		private readonly _opts: FHostingConfiguration.BindEndpoint & Settings.RestManagementEndpoint,
		log: FLogger
	) {
		super(servers, _opts);
	}

	protected onInit(): void {
		for (const server of this._servers) {
			const app: express.Application = server.rootExpressApplication;

			const router = express.Router({ strict: true });
			app.use(this._bindPath, router);

			router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
				if (this.disposing || this.disposed) {
					return res.writeHead(503, "Service temporary unavailable. Going to maintenance...").end();
				} else {
					next();
				}
			});

			router.use(bodyParser.json());
			router.use(bodyParser.urlencoded({ extended: false }));


			if (this._opts.assets?.path) {
				router.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
					const pathParts = req.path.split('/');
					console.log(pathParts);
					if (pathParts[1] === 'api') {
						return next();
					}

					const filePath = path.join(process.cwd(), this._opts.assets!.path!, ...pathParts);
					try {
						await fs.promises.access(filePath, fs.constants.F_OK);
						return next();
					} catch (e) {
						// Nothing
					}

					res.sendFile(path.join(process.cwd(), this._opts.assets!.path!, 'index.html'));
				});

				router.use(express.static(path.join(process.cwd(), this._opts.assets.path)));
			}

			function safeBinder(cb: (req: express.Request, res: express.Response) => (void | Promise<void>)) {
				function handler(req: express.Request, res: express.Response, next: express.NextFunction) {
					try {
						const result = cb(req, res);
						if (result instanceof Promise) {
							result.catch(next);
						}
					} catch (e) {
						next(e);
					}
				}
				return handler;
			}

			router.get("/api/topic", safeBinder(this.listTopics));
			router.get("/api/egress", safeBinder(this.listEgresses));
			router.get("/api/ingress/:id", safeBinder(this.ingress));
			router.get("/api/ingress", safeBinder(this.listIngress));
			router.get("/api/message", safeBinder(this.listMessages));
			router.get("/api/message/:id", safeBinder(this.message));
			router.get("/api/meta", safeBinder(this.getMeta));
			router.post("/api/topic", safeBinder(this.createTopic));


			//router.delete("/topic/:name", safeBinder(this.destroyTopic));
		}
	}

	protected onDispose(): void {
		//
	}

	@Bind
	private async getMeta(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const meta: Meta = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.getMeta(req.getExecutionContext(), domain)
			);

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(meta)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async createTopic(req: express.Request, res: express.Response): Promise<void> {
		try {
			const topicDomain: string | null = null; // TODO get from CN of the cert

			const topicName = ensure.string(req.body.name, "Create topic, 'name' should be a string");
			const topicDescription = ensure.string(req.body.description, "Create topic, 'description' should be a string");
			const topicMediaType = ensure.string(req.body.mediaType, "Create topic, 'mediaType' should be a string");

			const topicData: Topic.Name & Topic.Data = {
				topicDomain,
				topicName,
				topicDescription,
				topicMediaType
			};

			const topic: Topic = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.createTopic(req.getExecutionContext(), topicData)
			);

			res
				.status(201)
				.header("Content-Type", "application/json")
				.end(Buffer.from(JSON.stringify({
					name: topic.topicDomain !== null ? `${topic.topicName}.${topic.topicDomain}` : topic.topicName,
					mediaType: topic.topicMediaType,
					description: topic.topicDescription,
					createAt: topic.topicCreatedAt.toISOString(),
					deleteAt: topic.topicDeletedAt !== null ? topic.topicDeletedAt.toISOString() : null
				}), "utf-8"));
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}

	}

	@Bind
	private async listTopics(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const topics: Array<Topic> = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.listTopics(req.getExecutionContext(), domain, { search: req.query?.search ? String(req.query?.search) : undefined })
			);

			const responseData = topics.map(topic => ({
				id: topic.topicId,
				name: topic.topicDomain !== null ? `${topic.topicName}.${topic.topicDomain}` : topic.topicName,
				mediaType: topic.topicMediaType,
				description: topic.topicDescription,
				createAt: topic.topicCreatedAt.toISOString(),
				deleteAt: topic.topicDeletedAt !== null ? topic.topicDeletedAt.toISOString() : null
			}));

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(responseData)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async ingress(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const { id } = req.params;
			const ingress: Ingress | null = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.findIngress(req.getExecutionContext(), IngressIdentifier.parse(id))
			);

			if (!ingress) {
				res.status(404).end();
				return;
			}

			let responseData: any = {
				id: ingress.ingressId,
				topicId: ingress.ingressTopicId,
				createdAt: ingress.ingressCreatedAt.toISOString(),
				kind: ingress.ingressKind
			}

			switch (ingress.ingressKind) {
				case Ingress.Kind.HttpHost: {
					responseData = {
						...responseData,
						hostResponseKind: ingress.ingressHttpHostResponseKind,
						httpHostPath: ingress.ingressHttpHostPath,
					}
					switch (ingress.ingressHttpHostResponseKind) {
						case Ingress.HttpResponseKind.STATIC: {
							responseData = {
								...responseData,
								httpHostResponseStaticStatusCode: ingress.ingressHttpHostResponseStaticStatusCode,
								httpHostResponseStaticStatusMessage: ingress.ingressHttpHostResponseStaticStatusMessage,
								httpHostResponseStaticHeaders: ingress.ingressHttpHostResponseStaticHeaders,
								httpHostResponseStaticBody: ingress.ingressHttpHostResponseStaticBody ? ingress.ingressHttpHostResponseStaticBody.toString() : null
							}
							break;
						}
						case Ingress.HttpResponseKind.DYNAMIC: {
							responseData = {
								...responseData,
								httpHostResponseDynamicHandlerKind: ingress.ingressHttpHostResponseDynamicHandlerKind,
								httpHostResponseDynamicHandlerExternalScriptPath: ingress.ingressHttpHostResponseDynamicHandlerExternalScriptPath,
							}
							break;
						}
					}
					break;
				}
				case Ingress.Kind.WebSocketHost:
				case Ingress.Kind.WebSocketClient: {
					throw new Error('Not implemented yet');
				}
			}

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(responseData)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async message(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const { id } = req.params;
			const message: ManagementMessage | null = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.findMessage(req.getExecutionContext(), MessageIdentifier.parse(id))
			);

			if (!message) {
				res.status(404).end();
				return;
			}

			const result = {
				messageId: message.messageId,
				messageHeaders: message.messageHeaders,
				messageMediaType: message.messageMediaType,
				messageBody: message.messageBody.toString(),
				topicId: message.topicId,
				ingressId: message.ingressId,
				createAt: message.createAt.toISOString(),
			}

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(result)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async listIngress(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const ingresses: Array<IngressManagement> = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.listIngresses(req.getExecutionContext(), domain, { search: req.query?.search ? String(req.query?.search) : undefined })
			);

			const responseData = ingresses.map(ingress => ({
				id: ingress.ingressId,
				kind: ingress.ingressKind,
				topic: ingress.ingressTopicId,
				createAt: ingress.ingressCreatedAt.toISOString(),
			}));

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(responseData)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async listEgresses(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const egresses: Array<Egress> = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.listEgresses(req.getExecutionContext(), domain, { search: req.query?.search ? String(req.query?.search) : undefined })
			);

			const responseData = egresses.map(egress => ({
				id: egress.egressId,
				kind: egress.egressKind,
				topics: egress.egressTopicIds,
				labels: egress.egressFilterLabelIds,
				labelPolicy: egress.egressFilterLabelPolicy,
				createAt: egress.egressCreatedAt.toISOString()
			}));

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(responseData)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}

	@Bind
	private async listMessages(req: express.Request, res: express.Response): Promise<void> {
		try {
			const domain: string | null = null; // TODO get from CN of the cert

			const messages: Array<any> = await this._managementApiProvider.using(
				FExecutionContext.Default,
				(api) => api.listMessages(req.getExecutionContext(), domain, { search: req.query?.search ? String(req.query?.search) : undefined })
			);

			const responseData = messages.map(message => ({
				messageId: message.messageId,
				messageMediaType: message.messageMediaType,
				topicId: message.topicId,
				ingressId: message.ingressId,
				createAt: message.createAt.toISOString(),
			}));

			res.contentType('application/json').status(200).end(Buffer.from(JSON.stringify(responseData)), "utf-8");
			return;
		} catch (error) {
			endpointHandledException(res, error);
			return;
		}
	}
	// @Bind
	// private async destroyTopic(req: express.Request, res: express.Response): Promise<void> {

	// 	const topicName = req.params.name;
	// 	const kind = req.body.topicSecurityKind;
	// 	const token = req.body.topicSecurityToken;

	// 	if (!topicName || !kind || !token) {
	// 		const message = {
	// 			error: "required parameters",
	// 			message: "[name, topicSecurityKind, topicSecurityToken] is missing"
	// 		};

	// 		return res
	// 			.status(400)
	// 			.header("Content-Type", "application/json")
	// 			.end(JSON.stringify(message));
	// 	}

	// 	const topic: Topic.Id & TopicSecurity = {
	// 		topicName,
	// 		topicDomain: null,
	// 		topicSecurity: { kind, token }
	// 	};

	// 	try {

	// 		await this._api.destroyTopic(DUMMY_CANCELLATION_TOKEN, topic);

	// 		return res.writeHead(200, "Delete").end();

	// 	} catch (error) {
	// 		return endpointHandledException(res, error);
	// 	}
	// }
}
