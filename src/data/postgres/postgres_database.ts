import { FExceptionInvalidOperation, FExecutionContext, FSqlResultRecord, FSqlStatementParam } from "@freemework/common";
import { FSqlConnectionFactoryPostgres } from "@freemework/sql.postgres";

import * as _ from "lodash";

import {
	DeliveryIdentifier,
	EgressIdentifier,
	IngressIdentifier,
	LabelIdentifier,
	LabelHandlerIdentifier,
	MessageIdentifier,
	TopicIdentifier,
	ensureIngressHttpResponseKind,
	ensureIngressHttpHostResponseDynamicKind,
	IdentifierPrefix
} from "../../model";
import { Delivery, Egress, Ingress, Message, Topic, ensureEgressKind, ensureIngressKind } from "../../model";
import { SqlDatabase } from "../sql_database";
import { Database } from "../database";
import { Label } from "../../model/label";
import { LabelHandler, ensureLabelHandlerKind } from "../../model/label_handler";
import { ensureEgressFilterLabelPolicy } from "../../model/egress";
import { IngressManagement } from "../../model/ingress";
import { Meta } from "../../model/meta";
import { ManagementMessage } from "../../model/message";

export class PostgresDatabase extends SqlDatabase {
	public constructor(sqlConnectionFactory: FSqlConnectionFactoryPostgres) {
		super(sqlConnectionFactory);
	}
	private async bindLabelToEgress(
		executionContext: FExecutionContext,
		egressId: EgressIdentifier,
		labelId: LabelIdentifier
	): Promise<void> {
		await this.sqlConnection
			.statement(`
			INSERT INTO "tb_egress_label" ("label_id", "egress_id")
				VALUES (
					(SELECT "id" FROM "tb_label" WHERE "api_uuid" = $1), 
					(SELECT "id" FROM "tb_egress" WHERE "api_uuid" = $2)
				)
			`)
			.execute(
				executionContext,
				/* 1 */labelId.uuid,
				/* 2 */egressId.uuid,
			);
	}

	private async bindLabelToMessage(
		executionContext: FExecutionContext,
		messageId: string,
		label: Label.Id
	): Promise<void> {
		await this.sqlConnection
			.statement(`
			INSERT INTO "tb_message_label" ("label_id", "message_id")
				VALUES (
					(SELECT "id" FROM "tb_label" WHERE "api_uuid" = $1), 
					$2
				)
			`)
			.execute(
				executionContext,
				/* 1 */label.labelId.uuid,
				/* 2 */messageId,
			);
	}


	public async createDelivery(
		executionContext: FExecutionContext,
		deliveryData: Partial<Delivery.Id> & Delivery.Data
	): Promise<Delivery> {
		this.verifyInitializedAndNotDisposed();

		const deliveryId: DeliveryIdentifier = deliveryData.deliveryId ?? DeliveryIdentifier.generate();

		const sqlCreatedSate = await this.sqlConnection
			.statement(`
					INSERT INTO "tb_egress_delivery"(
						"api_uuid",
						"egress_id",
						"topic_id",
						"message_id",
						"egress_topic_id",
						"status",
						"success_evidence",
						"failure_evidence"
					)
					VALUES (
						$1,
						(SELECT "id" FROM "tb_egress" WHERE "api_uuid" = $2),
						(SELECT "id" FROM "tb_topic" WHERE "api_uuid" = $3),
						(SELECT "id" FROM "tb_message" WHERE "api_uuid" = $4),
						(
							SELECT "id" FROM "tb_egress_topic"
							WHERE "topic_id" = (
									SELECT "id" FROM "tb_topic" WHERE "api_uuid" = $3
								)
								AND "utc_deleted_date" IS NULL
								AND "egress_id" = (
									SELECT "id" FROM "tb_egress" WHERE "api_uuid" = $2
								)
						),
						$5,
						$6,
						$7
					)
					RETURNING "utc_created_date"
				`)
			.executeScalar(
				executionContext,
				/* 1 */deliveryId.uuid,
				/* 2 */deliveryData.egressId.uuid,
				/* 3 */deliveryData.topicId.uuid,
				/* 4 */deliveryData.messageId.uuid,
				/* 5 */deliveryData.status,
				/* 6 */deliveryData.status === Delivery.Status.Success ? JSON.stringify(deliveryData.successEvidence) : null,
				/* 7 */deliveryData.status === Delivery.Status.Failure ? JSON.stringify(deliveryData.failureEvidence) : null,
			);

		const deliveryModel: Delivery = {
			...deliveryData,
			deliveryId,
			deliverCreatedAt: sqlCreatedSate.asDate,
		};
		return deliveryModel;
	}

	public async createEgress(
		executionContext: FExecutionContext,
		egressData: Partial<Egress.Id> & Egress.Data
	): Promise<Egress> {
		this.verifyInitializedAndNotDisposed();

		const egressId: EgressIdentifier = egressData.egressId ?? EgressIdentifier.generate();

		const egressMainRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
				INSERT INTO "tb_egress"("kind", "api_uuid", "filter_label_policy")
				VALUES ($1, $2, $3)
				RETURNING "id", "kind", "api_uuid", "filter_label_policy", "utc_created_date", "utc_deleted_date"
			`)
			.executeSingle(
				executionContext,
				/* 1 */egressData.egressKind,
				/* 2 */egressId.uuid,
				/* 3 */egressData.egressFilterLabelPolicy,
			);
		const egressDbId: number = egressMainRecord.get("id").asNumber; // INT

		let egressExtRecord: FSqlResultRecord;
		switch (egressData.egressKind) {
			case Egress.Kind.WebSocketHost:
				egressExtRecord = await this.sqlConnection
					.statement(`
						INSERT INTO "tb_egress_websockethost"("id", "kind")
						VALUES ($1, $2)
						RETURNING "id", "kind"
					`)
					.executeSingle(
						executionContext,
						/* 1 */egressMainRecord.get("id").asNumber,
						/* 2 */egressData.egressKind
					);
				break;
			case Egress.Kind.Webhook:
				egressExtRecord = await this.sqlConnection
					.statement(`
						INSERT INTO "tb_egress_webhook"(
							"id", "kind", "http_url", "http_method"
						)
						VALUES (
							$1, $2, $3, $4
						)
						RETURNING "id", "kind", "http_url" AS "webhook_http_url", "http_method" AS "webhook_http_method"
					`)
					.executeSingle(
						executionContext,
						/* 1 */egressDbId,
						/* 2 */egressData.egressKind,
						/* 3 */egressData.egressHttpUrl.toString(),
						/* 4 */egressData.egressHttpMethod,
					);
				break;
			default:
				throw new FExceptionInvalidOperation(`Not supported ingress kind: ${egressData.egressKind}`);
		}

		await this.sqlConnection
			.statement(`
				INSERT INTO "tb_egress_topic"("egress_id", "topic_id")
				SELECT $1::INT, T."id"
				FROM (SELECT unnest($2::UUID[]) AS "topic_uuid") AS INPUT
				LEFT JOIN "tb_topic" AS T ON T."api_uuid" = INPUT."topic_uuid"
				RETURNING "topic_id"
			`)
			.execute(
				executionContext,
				/* 1 */egressDbId,
				/* 2 */egressData.egressTopicIds.map(s => s.uuid)
			);

		for (const labelId of egressData.egressFilterLabelIds) {
			await this.bindLabelToEgress(executionContext, egressId, labelId);
		}

		const egressModel: Egress = PostgresDatabase._mapEgressDbRow(egressMainRecord, egressExtRecord, {
			egressLabels: egressData.egressFilterLabelIds,
			egressTopics: egressData.egressTopicIds
		});
		return egressModel;
	}

	public async createIngress(
		executionContext: FExecutionContext,
		ingressData: Partial<Ingress.Id> & Ingress.Data
	): Promise<Ingress> {
		this.verifyInitializedAndNotDisposed();

		const ingressId: IngressIdentifier = ingressData.ingressId ?? IngressIdentifier.generate();

		const sqlMainRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
				INSERT INTO "tb_ingress"("kind", "api_uuid", "topic_id")
				VALUES (
					$1, $2,
					(
						SELECT "id"
						FROM "tb_topic"
						WHERE "api_uuid" = $3
					)
				)
				RETURNING "id", "kind", "api_uuid", "topic_id", "utc_created_date", "utc_deleted_date"
			`)
			.executeSingle(
				executionContext,
				/* 1 */ingressData.ingressKind,
				/* 2 */ingressId.uuid,
				/* 3 */ingressData.ingressTopicId.uuid,
			);

		let sqlExtendedRecord: FSqlResultRecord;

		switch (ingressData.ingressKind) {
			case Ingress.Kind.HttpHost:

				sqlExtendedRecord = await this.sqlConnection
					.statement(`
						INSERT INTO "tb_ingress_httphost"(
							"id", "kind", "path", "response_kind",
							"response_static_status_code",
							"response_static_status_message",
							"response_static_headers",
							"response_static_body",
							"response_dynamic_handler_kind",
							"response_dynamic_handler_external_script_path"
						)
						VALUES (
							$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
						)
						RETURNING "id", "kind", "path", "response_kind",
							"response_static_status_code",
							"response_static_status_message",
							"response_static_headers",
							"response_static_body",
							"response_dynamic_handler_kind",
							"response_dynamic_handler_external_script_path"
					`)
					.executeSingle(
						executionContext,
						/* 1 */sqlMainRecord.get("id").asNumber,
						/* 2 */ingressData.ingressKind,
						/* 3 */ingressData.ingressHttpHostPath,
						/* 4 */ingressData.ingressHttpHostResponseKind,
						/* 5 */ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.STATIC ? ingressData.ingressHttpHostResponseStaticStatusCode : null,
						/* 6 */ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.STATIC ? ingressData.ingressHttpHostResponseStaticStatusMessage : null,
						/* 7 */ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.STATIC ? JSON.stringify(ingressData.ingressHttpHostResponseStaticHeaders) : null,
						/* 8 */ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.STATIC ? ingressData.ingressHttpHostResponseStaticBody : null,
						/* 9 */ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.DYNAMIC ? ingressData.ingressHttpHostResponseDynamicHandlerKind : null,
						/* 10*/ingressData.ingressHttpHostResponseKind === Ingress.HttpResponseKind.DYNAMIC ? ingressData.ingressHttpHostResponseDynamicHandlerExternalScriptPath : null,

					);
				break;
			case Ingress.Kind.WebSocketClient:
				sqlExtendedRecord = await this.sqlConnection
					.statement(`
						INSERT INTO "tb_ingress_websocketclient"(
							"id", "kind", "url"
						)
						VALUES (
							$1, $2, $3
						)
						RETURNING "id", "kind", "url"
					`)
					.executeSingle(
						executionContext,
						/* 1 */sqlMainRecord.get("id").asNumber,
						/* 2 */ingressData.ingressKind,
						/* 3 */ingressData.ingressWebSocketClientUrl.toString(),
					);
				break;
			default:
				throw new FExceptionInvalidOperation(`Not supported ingress kind: ${ingressData.ingressKind}`);
		}

		const ingressModel: Ingress = PostgresDatabase._mapIngressDbRow(sqlMainRecord, sqlExtendedRecord, ingressData.ingressTopicId.uuid);
		return ingressModel;
	}

	public async createMessage(
		executionContext: FExecutionContext,
		ingressApiId: IngressIdentifier,
		messageApiId: MessageIdentifier,
		headers: Message.Headers,
		mimeType: string | null,
		originalBody: Uint8Array | null,
		body: Uint8Array | null,
		labels: ReadonlyArray<Label>
	): Promise<Message> {
		this.verifyInitializedAndNotDisposed();

		const messageResultRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
				INSERT INTO "tb_message" ("api_uuid", "headers", "media_type", "body", "original_body", "ingress_id", "topic_id")
				SELECT
					INPUT."api_uuid",
					INPUT."headers",
					INPUT."media_type",
					INPUT."body",
					INPUT."original_body",
					SUB."id" AS "ingress_id",
					SUB."topic_id"
				FROM (SELECT
					$1::UUID AS "api_uuid",
					$2::JSONB AS "headers",
					$3::TEXT AS "media_type",
					$4::BYTEA AS "body",
					$5::BYTEA AS "original_body",
					$6::UUID AS "ingress_uuid"
				) AS INPUT
				LEFT JOIN "tb_ingress" AS SUB ON SUB."api_uuid" = INPUT."ingress_uuid"
				RETURNING "id", "api_uuid", "topic_id", "ingress_id", "media_type", "body", "original_body", "headers", "utc_created_at"
			`)
			.executeSingle(
				executionContext,
					/* 1 */messageApiId.uuid,
					/* 2 */JSON.stringify(headers),
					/* 3 */mimeType,
					/* 4 */body,
					/* 5 */_.isEqual(originalBody, body) ? null : originalBody,
					/* 6 */ingressApiId.uuid,
			);

		const messageDbId: string = messageResultRecord.get("id").asString; // BIGINT as string

		await this.sqlConnection
			.statement(`
				INSERT INTO "tb_egress_message_queue" ("message_id", "topic_id", "egress_id")
				SELECT M."id", M."topic_id", ET."egress_id"
				FROM "tb_message" AS M
				INNER JOIN "tb_egress_topic" AS ET ON ET."topic_id" = M."topic_id"
				WHERE M."id" = $1
			`)
			.execute(executionContext, messageDbId);

		for (const label of labels) {
			await this.bindLabelToMessage(executionContext, messageDbId, label);
		}

		return PostgresDatabase._mapCreatedMessageDbRow(messageResultRecord, labels);
	}

	public async createLabelHandler(
		executionContext: FExecutionContext,
		labelHandlerData: Partial<LabelHandler.Id> & LabelHandler.Data
	): Promise<LabelHandler["labelHandlerId"]> {
		this.verifyInitializedAndNotDisposed();

		const topicSqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT "id"
				FROM "tb_topic" 
				WHERE "api_uuid" = $1 AND "utc_deleted_date" IS NULL
			`)
			.executeSingleOrNull(
				executionContext,
			/* 1 */labelHandlerData.topicId.uuid
			);

		if (!topicSqlRecord) {
			throw new FExceptionInvalidOperation(`Can not find topic ${labelHandlerData.topicId} to create label handler`);
		}

		const labelHandlerId: LabelHandlerIdentifier = labelHandlerData.labelHandlerId ?? LabelHandlerIdentifier.generate();

		const sqlMainRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
					INSERT INTO "tb_label_handler" ("api_uuid", "kind", "topic_id")
					VALUES ($1, $2, (
						SELECT T."id" FROM "tb_topic" AS T WHERE T."api_uuid" = $3
					))
					RETURNING "id", "api_uuid", "kind", "topic_id", $3 AS "topic_api_uuid", "utc_created_date", "utc_deleted_date"
				`)
			.executeSingle(
				executionContext,
				/* 1 */labelHandlerId.uuid,
				/* 2 */labelHandlerData.labelHandlerKind,
				/* 3 */labelHandlerData.topicId.uuid
			);

		const labelHandlerDbId = sqlMainRecord.get("id").asInteger;

		await this.sqlConnection
			.statement(`
					INSERT INTO "tb_label_handler_external_process" ("id", "path")
					VALUES ($1, $2)
					RETURNING "path"
				`)
			.execute(
				executionContext,
				/* 1 */labelHandlerDbId,
				/* 2 */labelHandlerData.externalProcessPath,
			);

		return labelHandlerId;
	}

	public async createLabel(executionContext: FExecutionContext, labelData: Partial<Label.Id> & Label.Data): Promise<Label> {
		this.verifyInitializedAndNotDisposed();

		const labelId: LabelIdentifier = labelData.labelId ?? LabelIdentifier.generate();

		const sqlRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
				INSERT INTO "tb_label"("api_uuid", "value")
				VALUES ($1, $2)
				RETURNING "api_uuid", "value", "utc_created_date", "utc_deleted_date"
			`)
			.executeSingle(
				executionContext,
			/* 1 */labelId.uuid,
			/* 2 */labelData.labelValue,
			);

		const labelModel: Label = PostgresDatabase._mapLabelDbRow(sqlRecord);
		return labelModel;

	}

	public async createTopic(
		executionContext: FExecutionContext,
		topicData: Partial<Topic.Id> & Topic.Data
	): Promise<Topic> {
		this.verifyInitializedAndNotDisposed();

		const topicId: TopicIdentifier = topicData.topicId ?? TopicIdentifier.generate();

		const sqlRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
					INSERT INTO "tb_topic"("api_uuid", "domain", "name", "description", "media_type")
					VALUES ($1, $2, $3, $4, $5)
					RETURNING "api_uuid", "domain", "name", "description", "media_type", "utc_created_date", "utc_deleted_date"
				`)
			.executeSingle(
				executionContext,
				/* 1 */topicId.uuid,
				/* 2 */topicData.topicDomain,
				/* 3 */topicData.topicName,
				/* 4 */topicData.topicDescription,
				/* 5 */topicData.topicMediaType,
			);

		const topicModel: Topic = PostgresDatabase._mapTopicDbRow(sqlRecord);
		return topicModel;
	}

	public async findEgress(executionContext: FExecutionContext, opts: Egress.Id): Promise<Egress | null> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`E."utc_deleted_date" IS NULL`
		];
		const conditionParams: Array<FSqlStatementParam> = [];

		// by "api_uuid"
		conditionParams.push(opts.egressId.uuid)
		conditionStatements.push(`E."api_uuid" = $${conditionParams.length}`);

		const egressMainRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT
					E."id",
					E."kind",
					E."api_uuid",
					E."filter_label_policy",
					E."utc_created_date",
					E."utc_deleted_date",
					(
						SELECT json_agg("api_uuid")
						FROM "tb_egress_topic" AS ET
						INNER JOIN "tb_topic" AS T ON T."id" = ET."topic_id"
						WHERE ET."egress_id" = E."id"
					)::JSONB AS "topic_uuids",
					(
						SELECT json_agg("api_uuid")
						FROM "tb_egress_label" AS EL
						INNER JOIN "tb_label" AS L ON L."id" = EL."label_id"
						WHERE EL."egress_id" = E."id"
					)::JSONB AS "label_uuids"
				FROM "tb_egress" AS E
				WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
			`)
			.executeSingleOrNull(
				executionContext,
				...conditionParams,
			);

		// (
		// SELECT array_agg("id") FROM "tb_egress_topic"
		// ) AS "topic_uuids"

		if (egressMainRecord === null) {
			return null;
		}

		const egressDbId: number = egressMainRecord.get("id").asNumber; // INT
		const egressKind: string = egressMainRecord.get("kind").asString;
		ensureEgressKind(egressKind);

		let egressExtRecord: FSqlResultRecord;
		switch (egressKind) {
			case Egress.Kind.Telegram:
				throw new FExceptionInvalidOperation(`Not supported egress kind: ${egressKind}`);
			case Egress.Kind.Webhook:
				egressExtRecord = await this.sqlConnection
					.statement(`
						SELECT
							"id",
							"kind",
							"http_url" AS "webhook_http_url",
							"http_method" AS "webhook_http_method"
						FROM "tb_egress_webhook"
						WHERE "id" = $1
					`)
					.executeSingle(
						executionContext,
						/* 1 */egressDbId,
					);
				break;
			case Egress.Kind.WebSocketHost:
				egressExtRecord = await this.sqlConnection
					.statement(`
						SELECT "id", "kind"
						FROM "tb_egress_websockethost"
						WHERE "id" = $1
					`)
					.executeSingle(
						executionContext,
						/* 1 */egressDbId,
					);
				break;
			default:
				throw new FExceptionInvalidOperation(`Not supported egress kind: ${egressKind}`);
		}

		// const egressTopicRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
		// 	.statement(`
		// 		SELECT T."api_uuid"
		// 		FROM "tb_egress_topic" AS ET
		// 		INNER JOIN "tb_topic" AS T ON T."id" = ET."topic_id"
		// 		WHERE "egress_id" = $1
		// 	`)
		// 	.executeQuery(
		// 		executionContext,
		// 		/* 1 */egressDbId
		// 	);

		const egressModel: Egress = PostgresDatabase._mapEgressDbRow(egressMainRecord, egressExtRecord);
		return egressModel;
	}

	public async findIngress(executionContext: FExecutionContext, opts: Ingress.Id): Promise<Ingress | null> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`I."utc_deleted_date" IS NULL`
		];
		const conditionParams: Array<FSqlStatementParam> = [];

		// by "api_uuid"
		conditionParams.push(opts.ingressId.uuid)
		conditionStatements.push(`I."api_uuid" = $${conditionParams.length}`);

		const sqlMainRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT I."id", I."kind", I."api_uuid", T."api_uuid" AS "topic_uuid", I."utc_created_date", I."utc_deleted_date"
				FROM "tb_ingress" AS I
				INNER JOIN "tb_topic" AS T ON T."id" = I."topic_id"
				WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
			`)
			.executeSingleOrNull(
				executionContext,
				...conditionParams,
			);

		if (sqlMainRecord === null) {
			return null;
		}

		const ingressDbId: number = sqlMainRecord.get("id").asNumber;
		const topicUuid: string = sqlMainRecord.get("topic_uuid").asString;
		const ingressKind: string = sqlMainRecord.get("kind").asString;
		ensureIngressKind(ingressKind);

		let sqlExtendedRecord: FSqlResultRecord;
		switch (ingressKind) {
			case Ingress.Kind.HttpHost:
				sqlExtendedRecord = await this.sqlConnection
					.statement(`
						SELECT
							"id",
							"kind",
							"path",
							"response_kind",
							"response_static_status_code", 
							"response_static_status_message",
							"response_static_headers", 
							"response_static_body",
							"response_dynamic_handler_kind",
							"response_dynamic_handler_external_script_path"
						FROM "tb_ingress_httphost"
						WHERE "id" = $1
					`)
					.executeSingle(
						executionContext,
						/* 1 */ingressDbId,
					);
				break;
			case Ingress.Kind.WebSocketClient:
				sqlExtendedRecord = await this.sqlConnection
					.statement(`
							SELECT "id", "kind", "url"
							FROM "tb_ingress_websocketclient"
							WHERE "id" = $1
						`)
					.executeSingle(
						executionContext,
							/* 1 */ingressDbId,
					);
				break;
			default:
				throw new FExceptionInvalidOperation(`Not supported ingress kind: ${ingressKind}`);
		}

		const ingressModel: Ingress = PostgresDatabase._mapIngressDbRow(sqlMainRecord, sqlExtendedRecord, topicUuid);
		return ingressModel;
	}

	public async findLabel(executionContext: FExecutionContext, opts: Label.Id): Promise<Label | null> {
		this.verifyInitializedAndNotDisposed();

		const sqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT "id", "api_uuid", "value", "utc_created_date", "utc_deleted_date"
				FROM "tb_label"
				WHERE "api_uuid" = $1 AND "utc_deleted_date" IS NULL
			`)
			.executeSingleOrNull(
				executionContext,
				opts.labelId.uuid,
			);

		if (sqlRecord === null) {
			return null;
		}

		const label: Label = PostgresDatabase._mapLabelDbRow(sqlRecord);

		return label;
	}

	public async findLabelByValue(executionContext: FExecutionContext, value: Label.Data["labelValue"]): Promise<Label | null> {
		this.verifyInitializedAndNotDisposed();

		const sqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT "id", "api_uuid", "value", "utc_created_date", "utc_deleted_date"
				FROM "tb_label"
				WHERE "value" = $1 AND "utc_deleted_date" IS NULL
			`)
			.executeSingleOrNull(
				executionContext,
				value,
			);

		if (sqlRecord === null) {
			return null;
		}

		const label: Label = PostgresDatabase._mapLabelDbRow(sqlRecord);

		return label;
	}

	public async findLabelHandler(executionContext: FExecutionContext, opts: LabelHandler.Id): Promise<LabelHandler | null> {
		const sqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
				SELECT 
					LH."id",
					LH."api_uuid",
					LH."kind",
					LH."utc_created_date",
					LH."utc_deleted_date",
					T."api_uuid" AS "topic_api_uuid",
					EP."path"
				FROM "tb_label_handler" AS LH
					INNER JOIN "tb_topic" AS T ON T."id" = LH."topic_id"
					LEFT JOIN "tb_label_handler_external_process" AS EP ON EP."id" = LH."id"
				WHERE LH."api_uuid" = $1 AND LH."utc_deleted_date" IS NULL
			`)
			.executeSingleOrNull(
				executionContext,
				opts.labelHandlerId.uuid,
			);

		if (sqlRecord === null) {
			return null;
		}

		const labelHandler: LabelHandler = PostgresDatabase._mapLabelHandlerDbRow(sqlRecord);

		return labelHandler;
	}

	public async findTopic(executionContext: FExecutionContext, opts: Topic.Id | Topic.Name | Ingress.Id): Promise<Topic | null> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`"utc_deleted_date" IS NULL`
		];
		const conditionParams: Array<FSqlStatementParam> = [];

		if ("topicId" in opts) {
			// by "api_uuid"
			conditionParams.push(opts.topicId.uuid)
			conditionStatements.push(`"api_uuid" = $${conditionParams.length}`);
		} else if ("ingressId" in opts) {
			// by "ingressId"
			conditionParams.push(opts.ingressId.uuid)
			conditionStatements.push(`"id" = (SELECT "topic_id" FROM "tb_ingress" WHERE "api_uuid" = $${conditionParams.length})`);
		} else {
			// by "name"
			conditionParams.push(opts.topicName)
			conditionStatements.push(`"name" = $${conditionParams.length}`);

			// by "domain"
			if (opts.topicDomain !== null) {
				conditionParams.push(opts.topicDomain)
				conditionStatements.push(`"domain" = $${conditionParams.length}`);
			} else {
				conditionStatements.push(`"domain" IS NULL`);
			}
		}

		const sqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
					SELECT "api_uuid", "domain", "name", "description", "media_type", "utc_created_date", "utc_deleted_date"
					FROM "tb_topic"
					WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
				`)
			.executeSingleOrNull(
				executionContext,
				...conditionParams,
			);

		if (sqlRecord === null) {
			return null;
		}

		const topicModel: Topic = PostgresDatabase._mapTopicDbRow(sqlRecord);
		return topicModel;
	}

	public async getEgress(executionContext: FExecutionContext, opts: Egress.Id): Promise<Egress> {
		const egressModel: Egress | null = await this.findEgress(executionContext, opts);

		if (egressModel === null) {
			throw new FExceptionInvalidOperation(`Trying to get non-existing egress.`);
		}

		return egressModel;
	}

	public async getIngress(executionContext: FExecutionContext, opts: Ingress.Id): Promise<Ingress> {
		const ingressModel: Ingress | null = await this.findIngress(executionContext, opts);

		if (ingressModel === null) {
			throw new FExceptionInvalidOperation(`Trying to get non-existing ingress.`);
		}

		return ingressModel;
	}

	public async getLabel(executionContext: FExecutionContext, opts: Label.Id): Promise<Label> {
		const labelModel: Label | null = await this.findLabel(executionContext, opts);

		if (labelModel === null) {
			throw new FExceptionInvalidOperation(`Trying to get non-existing label.`);
		}

		return labelModel;
	}

	public async getTopic(executionContext: FExecutionContext, opts: Topic.Id | Topic.Name | Ingress.Id): Promise<Topic> {
		const topicModel: Topic | null = await this.findTopic(executionContext, opts);

		if (topicModel === null) {
			throw new FExceptionInvalidOperation(`Trying to get non-existing topic.`);
		}

		return topicModel;
	}

	public async getMeta(
		executionContext: FExecutionContext,
	): Promise<Meta> {
		const sqlRecord: FSqlResultRecord = await this.sqlConnection
			.statement(`
			SELECT 
				(SELECT COUNT(id) FROM "tb_topic") AS "topics_count",
				(SELECT COUNT(id) FROM "tb_label") AS "labels_count",
				(SELECT COUNT(id) FROM "tb_ingress") AS "ingresses_count",
				(SELECT COUNT(id) FROM "tb_egress") AS "egresses_count"
		`)
			.executeSingle(
				executionContext
			);

		return PostgresDatabase._mapMetaDbRow(sqlRecord);
	}

	public async listEgresses(
		executionContext: FExecutionContext,
		opts?: { search?: string; }
	): Promise<Array<Egress>> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`E."utc_deleted_date" IS NULL`
		];
		if (opts?.search) {
			conditionStatements.push(`E."kind"::TEXT ILIKE '%${opts.search}%'
				OR '${IdentifierPrefix.EGRESS}' || REPLACE(E."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'`)
		}
		const conditionParams: Array<FSqlStatementParam> = [];

		const sqlRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement(`
				SELECT
					E."id",
					E."kind",
					E."api_uuid",
					E."filter_label_policy",
					E."utc_created_date",
					E."utc_deleted_date",
					(
						SELECT json_agg("api_uuid")
						FROM "tb_egress_topic" AS ET
						INNER JOIN "tb_topic" AS T ON T."id" = ET."topic_id"
						WHERE ET."egress_id" = E."id"
					)::JSONB AS "topic_uuids",
					(
						SELECT json_agg("api_uuid")
						FROM "tb_egress_label" AS EL
						INNER JOIN "tb_label" AS L ON L."id" = EL."label_id"
						WHERE EL."egress_id" = E."id"
					)::JSONB AS "label_uuids",
					EW."http_url" AS "webhook_http_url",
					EW."http_method" AS "webhook_http_method"
				FROM "tb_egress" AS E
				LEFT JOIN "tb_egress_webhook" AS EW ON EW."id" = E."id"
				LEFT JOIN "tb_egress_websockethost" AS EWH ON EWH."id" = E."id"
				WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
			`)
			.executeQuery(
				executionContext,
				...conditionParams,
			);

		const egressModels: Array<Egress> = sqlRecords.map((sqlRecord) => {
			return PostgresDatabase._mapEgressDbRow(sqlRecord, sqlRecord);
		});
		return egressModels;
	}

	public async listEgressMessageQueue(
		executionContext: FExecutionContext,
		opts: Topic.Id | Egress.Id | Message.Id,
	): Promise<Array<Database.EgressMessageQueue>> {
		//
		throw new FExceptionInvalidOperation("Not implemented yet");
	}

	public async listLabelHandlers(executionContext: FExecutionContext): Promise<Array<LabelHandler>> {
		const sqlRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement(`
					SELECT 
						LH."api_uuid",
						T."api_uuid" AS "topic_api_uuid",
						LH."kind",
						LH."utc_created_date",
						LH."utc_deleted_date",
						EP."path"
					FROM "tb_label_handler" AS LH
						INNER JOIN "tb_topic" AS T ON T."id" = LH."topic_id"
						LEFT JOIN "tb_label_handler_external_process" AS EP ON EP."id" = LH."id"
					WHERE LH."utc_deleted_date" IS NULL
				`)
			.executeQuery(
				executionContext,
			);

		return sqlRecords.map(e => PostgresDatabase._mapLabelHandlerDbRow(e));
	}

	public async listTopics(
		executionContext: FExecutionContext,
		opts?: { search?: string; }
	): Promise<Array<Topic>> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`"utc_deleted_date" IS NULL`
		];
		if (opts?.search) {
			conditionStatements.push(`"name" ILIKE '%${opts.search}%' OR "description" ILIKE '%${opts.search}%' OR '${IdentifierPrefix.TOPIC}' || REPLACE("api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'`)
		}
		const conditionParams: Array<FSqlStatementParam> = [];

		const sqlRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement(`
					SELECT "api_uuid", "domain", "name", "description", "media_type", "utc_created_date", "utc_deleted_date"
					FROM "tb_topic"
					WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
				`)
			.executeQuery(
				executionContext,
				...conditionParams,
			);

		const topicModels: Array<Topic> = sqlRecords.map(PostgresDatabase._mapTopicDbRow);
		return topicModels;
	}

	public async listIngesses(
		executionContext: FExecutionContext,
		opts?: { search?: string }
	): Promise<Array<IngressManagement>> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [
			`I."utc_deleted_date" IS NULL`
		];
		if (opts?.search) {
			conditionStatements.push(`I."kind"::TEXT ILIKE '%${opts.search}%'
				OR '${IdentifierPrefix.TOPIC}' || REPLACE(T."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'
				OR '${IdentifierPrefix.INGRESS}' || REPLACE(I."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'`)
		}
		const conditionParams: Array<FSqlStatementParam> = [];

		const sqlRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement(`
					SELECT I."kind", I."api_uuid", I."utc_created_date", I."utc_deleted_date", T."api_uuid" AS "topic_api_uuid"
					FROM "tb_ingress" AS I
						INNER JOIN "tb_topic" AS T ON T."id" = I."topic_id"
					WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}
				`)
			.executeQuery(
				executionContext,
				...conditionParams,
			);

		const ingessManagementModels: Array<IngressManagement> = sqlRecords.map(PostgresDatabase._mapIngressManagementDbRow);
		return ingessManagementModels;
	}

	public async listVersions(
		executionContext: FExecutionContext
	): Promise<Array<string>> {
		const versionRows: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement('SELECT "version" FROM "public"."__migration" ORDER BY "version" DESC')
			.executeQuery(executionContext);
		return versionRows.map(versionRow => versionRow.get("version").asString);
	}

	public async listMessages(
		executionContext: FExecutionContext,
		opts?: { search?: string; }
	): Promise<Array<ManagementMessage>> {
		this.verifyInitializedAndNotDisposed();

		const conditionStatements: Array<string> = [];
		if (opts?.search) {
			conditionStatements.push(`M."media_type" ILIKE '%${opts.search}%' 
				OR '${IdentifierPrefix.MESSAGE}' || REPLACE(M."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'
				OR '${IdentifierPrefix.INGRESS}' || REPLACE(I."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'
				OR '${IdentifierPrefix.TOPIC}' || REPLACE(T."api_uuid"::TEXT, '-', '') ILIKE '%${opts.search}%'`)
		}
		const conditionParams: Array<FSqlStatementParam> = [];

		const sqlRecords: ReadonlyArray<FSqlResultRecord> = await this.sqlConnection
			.statement(`
					SELECT 
						M."api_uuid",
						I."api_uuid" AS "ingress_uuid",
						T."api_uuid" AS "topic_uuid",
						M."media_type",
						M."body",
						M."original_body",
						M."headers",
						M."utc_created_at"
					FROM "tb_message" AS M
					INNER JOIN "tb_ingress" AS I ON I."id" = M."ingress_id"
					INNER JOIN "tb_topic" AS T ON T."id" = M."topic_id"
						${conditionStatements.length > 0 ? `WHERE ${conditionStatements.map((condition) => `(${condition})`).join(" AND ")}` : ''}
					ORDER BY M."utc_created_at" DESC
				`)
			.executeQuery(
				executionContext,
				...conditionParams,
			);

		const messageModels: Array<ManagementMessage> = sqlRecords.map(e => PostgresDatabase._mapMessageManagementDbRow(e));
		return messageModels;
	}

	public async findMessage(
		executionContext: FExecutionContext,
		messageId: MessageIdentifier
	): Promise<ManagementMessage | null> {
		this.verifyInitializedAndNotDisposed();

		const sqlRecord: FSqlResultRecord | null = await this.sqlConnection
			.statement(`
					SELECT 
						M."api_uuid",
						I."api_uuid" AS "ingress_uuid",
						T."api_uuid" AS "topic_uuid",
						M."media_type",
						M."body",
						M."original_body",
						M."headers",
						M."utc_created_at"
					FROM "tb_message" AS M
					INNER JOIN "tb_ingress" AS I ON I."id" = M."ingress_id"
					INNER JOIN "tb_topic" AS T ON T."id" = M."topic_id"
						WHERE M."api_uuid" = $1
				`)
			.executeSingleOrNull(
				executionContext,
				messageId.uuid,
			);

		return sqlRecord ? PostgresDatabase._mapMessageManagementDbRow(sqlRecord) : null;
	}

	public async getMessage(
		executionContext: FExecutionContext,
		messageId: MessageIdentifier
	): Promise<ManagementMessage> {
		const messageModel: ManagementMessage | null = await this.findMessage(executionContext, messageId);

		if (messageModel === null) {
			throw new FExceptionInvalidOperation(`Trying to get non-existing topic.`);
		}

		return messageModel;
	}

	public async lockEgressMessageQueue(
		executionContext: FExecutionContext,
		opts: Topic.Id & Egress.Id & Message.Id
	): Promise<void> {
		this.verifyInitializedAndNotDisposed();

		await this.sqlConnection
			.statement(`
						SELECT 1
						FROM "tb_egress_message_queue" AS EMQ
						INNER JOIN "tb_topic" AS T ON T."id" = EMQ."topic_id"
						INNER JOIN "tb_egress" AS E ON E."id" = EMQ."egress_id"
						INNER JOIN "tb_message" AS M ON M."id" = EMQ."message_id"
						WHERE T."api_uuid" = $1 AND E."api_uuid" = $2 AND M."api_uuid" = $3
						FOR UPDATE
					`)
			.executeSingle(
				executionContext,
				/* 1 */opts.topicId.uuid,
				/* 1 */opts.egressId.uuid,
				/* 1 */opts.messageId.uuid,
			);
	}

	public async removeEgressMessageQueue(
		executionContext: FExecutionContext,
		opts: Topic.Id & Egress.Id & Message.Id
	): Promise<void> {
		this.verifyInitializedAndNotDisposed();

		await this.sqlConnection
			.statement(`
						DELETE
						FROM "tb_egress_message_queue"
						WHERE "topic_id" = (SELECT "id" FROM "tb_topic" WHERE "api_uuid" = $1)
							AND "egress_id" = (SELECT "id" FROM "tb_egress" WHERE "api_uuid" = $2)
							AND "message_id" = (SELECT "id" FROM "tb_message" WHERE "api_uuid" = $3)
					`)
			.execute(
				executionContext,
				/* 1 */opts.topicId.uuid,
				/* 1 */opts.egressId.uuid,
				/* 1 */opts.messageId.uuid,
			);
	}

	// public async removeSubscriber(
	// 	executionContext: FExecutionContext,
	// 	egressId: EgressApiIdentifier
	// ): Promise<void> {
	// 	this.verifyInitializedAndNotDisposed();

	// 	try {
	// 		await this._sqlProviderFactory.usingProvider(cancellationToken,
	// 			async (sqlProvider: SqlProvider) => sqlToolsSubscriber
	// 				.setDeleteDate(cancellationToken, sqlProvider, egressId)
	// 		);
	// 	} catch (e) {
	// 		throw storageHandledException(e);
	// 	}
	// }


	// public async deleteTopic(
	// 	executionContext: FExecutionContext,
	// 	topicData: Topic.Name & TopicSecurity
	// ): Promise<void> {
	// 	this._log.debug(`Run deleteTopic with topicData: ${topicData}`);
	// 	this.verifyInitializedAndNotDisposed();
	// 	try {

	// 		await this._sqlProviderFactory.usingProvider(cancellationToken, async (sqlProvider: SqlProvider) => {
	// 			return await topicFunctions.updateDeleteDate(cancellationToken, sqlProvider, topicData.topicName);
	// 		});
	// 		return;

	// 	} catch (e) {
	// 		this._log.error(`deleteTopic Error: ${e.message}`);
	// 		throw storageHandledException(e);
	// 	}
	// }

	// public async addSubscriberWebhook(
	// 	executionContext: FExecutionContext,
	// 	topicName: Topic.Name["topicName"],
	// 	webhookData: Webhook.Data
	// ): Promise<Webhook> {

	// 	this._log.debug(`Run addSubscriberWebhook with topicName: ${topicName} and webhookData ${webhookData}`);
	// 	this.verifyInitializedAndNotDisposed();

	// 	try {

	// 		const webhook: Webhook
	// 			= await this._sqlProviderFactory.usingProvider(cancellationToken, async (sqlProvider: SqlProvider) => {
	// 				return await webhookFunctions.save(cancellationToken, sqlProvider, topicName, webhookData);
	// 			});

	// 		return webhook;

	// 	} catch (e) {
	// 		this._log.error(`addSubscriberWebhook Error: ${e.message}`);
	// 		throw storageHandledException(e);
	// 	}
	// }

	// public getSubscriberWebhook(
	// 	executionContext: FExecutionContext,
	// 	webhook: Webhook.Id["webhookId"]
	// ): Promise<Webhook> {
	// 	this._log.debug(`Run getSubscriberWebhook with webhook: ${webhook}`);
	// 	this.verifyInitializedAndNotDisposed();
	// 	throw new Error("Method not implemented.");
	// }

	// public async getTopicByWebhookId(executionContext: FExecutionContext, webhookId: Webhook.Id["webhookId"]): Promise<Topic> {
	// 	this._log.debug(`Run getTopicByWebhookId with webhookId: ${webhookId}`);
	// 	this.verifyInitializedAndNotDisposed();

	// 	try {
	// 		const topic: Topic
	// 			= await this._sqlProviderFactory.usingProvider(cancellationToken, async (sqlProvider: SqlProvider) => {
	// 				return await topicFunctions.getTopicByWebhookId(cancellationToken, sqlProvider, webhookId);
	// 			});

	// 		return topic;
	// 	} catch (e) {
	// 		this._log.error(`getTopicByWebhookId Error: ${e.message}`);
	// 		throw storageHandledException(e);
	// 	}
	// }

	// public async getTopicByName(executionContext: FExecutionContext, topicName: Topic.Name["topicName"]): Promise<Topic> {
	// 	this._log.debug(`Run getTopicByName with topicName: ${topicName}`);
	// 	this.verifyInitializedAndNotDisposed();

	// 	try {
	// 		const topic: Topic
	// 			= await this._sqlProviderFactory.usingProvider(cancellationToken, async (sqlProvider: SqlProvider) => {
	// 				return await topicFunctions.getByName(cancellationToken, sqlProvider, topicName);
	// 			});

	// 		return topic;
	// 	} catch (e) {
	// 		this._log.error(`getTopicByName Error: ${e.message}`);
	// 		throw storageHandledException(e);
	// 	}
	// }

	// public async getAvailableWebhooks(executionContext: FExecutionContext, security: Security): Promise<Array<Webhook>> {
	// 	this._log.debug(`Run getAvailableWebhooks with security: ${security}`);
	// 	this.verifyInitializedAndNotDisposed();

	// 	try {
	// 		const webhooks: Array<Webhook>
	// 			= await this._sqlProviderFactory.usingProvider(cancellationToken, async (sqlProvider: SqlProvider) => {
	// 				return await webhookFunctions.getBySecurity(cancellationToken, sqlProvider, security);
	// 			});

	// 		return webhooks;
	// 	} catch (e) {
	// 		this._log.error(`getTopicByName Error: ${e.message}`);
	// 		throw storageHandledException(e);
	// 	}
	// }

	// public removeSubscriberWebhook(
	// 	executionContext: FExecutionContext, webhook: Webhook.Id["webhookId"]
	// ): Promise<void> {
	// 	throw new Error("");
	// }

	protected async onInit(): Promise<void> {
		await super.onInit();
	}

	protected async onDispose(): Promise<void> {
		await super.onDispose();
	}

	private static _mapEgressDbRow(
		egressMainRecord: FSqlResultRecord,
		egressExtRecord: FSqlResultRecord,
		optional?: {
			readonly egressLabels: ReadonlyArray<LabelIdentifier>;
			readonly egressTopics: ReadonlyArray<TopicIdentifier>;
		}
	): Egress {
		const egressUuid: string = egressMainRecord.get("api_uuid").asString;
		const egressKind: string = egressMainRecord.get("kind").asString;
		const egressFilterLabelPolicy: string = egressMainRecord.get("filter_label_policy").asString;
		const egressCreatedAt: Date = egressMainRecord.get("utc_created_date").asDate;
		const egressDeletedAt: Date | null = egressMainRecord.get("utc_deleted_date").asDateNullable;

		ensureEgressKind(egressKind);
		ensureEgressFilterLabelPolicy(egressFilterLabelPolicy);

		let egressTopics: ReadonlyArray<TopicIdentifier> | undefined = optional?.egressTopics;
		if (egressTopics === undefined) {
			try {
				const egressTopicUuids: Array<string> | null = egressMainRecord.get("topic_uuids").asObjectNullable;
				egressTopics = egressTopicUuids !== null
					? egressTopicUuids.map(TopicIdentifier.fromUuid)
					: [];
			} catch (e) {
				throw e;
			}
		}

		let egressFilterLabelIds: ReadonlyArray<LabelIdentifier> | undefined = optional?.egressLabels;
		if (egressFilterLabelIds === undefined) {
			try {
				const egressLabelUuids: Array<string> | null = egressMainRecord.get("label_uuids").asObjectNullable;
				egressFilterLabelIds = egressLabelUuids !== null
					? egressLabelUuids.map(LabelIdentifier.fromUuid)
					: [];
			} catch (e) {
				throw e;
			}
		}

		const egressBase: Egress.Id & Omit<Egress.DataCommon, "egressKind"> & Egress.Instance = {
			egressId: EgressIdentifier.fromUuid(egressUuid),
			egressTopicIds: egressTopics,
			egressCreatedAt: egressCreatedAt,
			egressDeletedAt: egressDeletedAt,
			egressFilterLabelPolicy,
			egressFilterLabelIds,
		};

		switch (egressKind) {
			case Egress.Kind.Webhook:
				return Object.freeze<Egress>({
					...egressBase,
					egressKind,
					egressHttpUrl: new URL(egressExtRecord.get("webhook_http_url").asString),
					egressHttpMethod: egressExtRecord.get("webhook_http_method").asStringNullable,
				});
			case Egress.Kind.WebSocketHost:
				return Object.freeze<Egress>({
					...egressBase,
					egressKind,
				});
			default:
				throw new FExceptionInvalidOperation(`Unsupported ingress kind: '${egressKind}'`);
		}
	}

	private static _mapIngressDbRow(
		sqlMainRecord: FSqlResultRecord,
		sqlExtendedRecord: FSqlResultRecord,
		topicUuid: string
	): Ingress {
		const ingressUuid: string = sqlMainRecord.get("api_uuid").asString;
		const ingressTopicUuid: string = topicUuid;
		const ingressKind: string = sqlMainRecord.get("kind").asString;
		const ingressCreatedAt: Date = sqlMainRecord.get("utc_created_date").asDate;
		const ingressDeletedAt: Date | null = sqlMainRecord.get("utc_deleted_date").asDateNullable;

		ensureIngressKind(ingressKind);

		const ingressBase: Ingress.Id & Omit<Ingress.DataBase, "ingressKind"> & Ingress.Instance = {
			ingressId: IngressIdentifier.fromUuid(ingressUuid),
			ingressTopicId: TopicIdentifier.fromUuid(ingressTopicUuid),
			ingressCreatedAt,
			ingressDeletedAt,
		};

		switch (ingressKind) {
			case Ingress.Kind.HttpHost:
				const ingressHttpHostPath: string = sqlExtendedRecord.get("path").asString;
				const ingressHttpHostResponseKind: string = sqlExtendedRecord.get("response_kind").asString;
				ensureIngressHttpResponseKind(ingressHttpHostResponseKind);
				switch (ingressHttpHostResponseKind) {
					case Ingress.HttpResponseKind.STATIC: {
						return Object.freeze<Ingress>({
							...ingressBase,
							ingressKind,
							ingressHttpHostPath,
							ingressHttpHostResponseKind,
							ingressHttpHostResponseStaticStatusCode: sqlExtendedRecord.get("response_static_status_code").asNumber,
							ingressHttpHostResponseStaticStatusMessage: sqlExtendedRecord.get("response_static_status_message").asStringNullable,
							ingressHttpHostResponseStaticHeaders: sqlExtendedRecord.get("response_static_headers").asObjectNullable,
							ingressHttpHostResponseStaticBody: sqlExtendedRecord.get("response_static_body").asBinaryNullable,
						});
					}
					case Ingress.HttpResponseKind.DYNAMIC: {
						const responseHandlerKind: string = sqlExtendedRecord.get("response_dynamic_handler_kind").asString;
						ensureIngressHttpHostResponseDynamicKind(responseHandlerKind);
						return Object.freeze<Ingress>({
							...ingressBase,
							ingressKind,
							ingressHttpHostPath,
							ingressHttpHostResponseKind,
							ingressHttpHostResponseDynamicHandlerKind: responseHandlerKind,
							ingressHttpHostResponseDynamicHandlerExternalScriptPath: sqlExtendedRecord.get("response_dynamic_handler_external_script_path").asString,
						});
					}
					default:
						throw new FExceptionInvalidOperation(`Unsupported ingress http host response kind: '${ingressHttpHostResponseKind}'`);
				}

			case Ingress.Kind.WebSocketClient:
				return Object.freeze<Ingress>({
					...ingressBase,
					ingressKind,
					ingressWebSocketClientUrl: new URL(sqlExtendedRecord.get("url").asString),
				});
			default:
				throw new FExceptionInvalidOperation(`Unsupported ingress kind: '${ingressKind}'`);
		}
	}

	private static _mapCreatedMessageDbRow(
		sqlRecord: FSqlResultRecord,
		labels: ReadonlyArray<Label>,
	): Message {
		const messageUuid: string = sqlRecord.get("api_uuid").asString;
		const headers: Record<string, string> = sqlRecord.get("headers").asObject;
		const mediaType: string = sqlRecord.get("media_type").asString;
		const ingressBody: Uint8Array | null = sqlRecord.get("original_body").asBinaryNullable;
		const body: Uint8Array = sqlRecord.get("body").asBinary;

		const messageId: MessageIdentifier = MessageIdentifier.fromUuid(messageUuid);

		return {
			messageId,
			messageHeaders: headers,
			messageMediaType: mediaType,
			messageIngressBody: ingressBody ?? body,
			messageBody: body,
			messageLabels: labels
		}
	}

	private static _mapMessageManagementDbRow(
		sqlRecord: FSqlResultRecord,
		// labels: ReadonlyArray<Label>,
	): ManagementMessage {
		const messageUuid: string = sqlRecord.get("api_uuid").asString;
		const headers: Record<string, string> = sqlRecord.get("headers").asObject;
		const mediaType: string = sqlRecord.get("media_type").asString;
		const ingressBody: Uint8Array | null = sqlRecord.get("original_body").asBinaryNullable;
		const body: Uint8Array = sqlRecord.get("body").asBinary;
		const topicUuid: string = sqlRecord.get("topic_uuid").asString;
		const ingressUuid: string = sqlRecord.get("ingress_uuid").asString;
		const createAt: Date = sqlRecord.get("utc_created_at").asDate;

		const messageId: MessageIdentifier = MessageIdentifier.fromUuid(messageUuid);
		const topicId: TopicIdentifier = TopicIdentifier.fromUuid(topicUuid);
		const ingressId: IngressIdentifier = IngressIdentifier.fromUuid(ingressUuid);

		return {
			messageId,
			messageHeaders: headers,
			messageMediaType: mediaType,
			messageIngressBody: ingressBody ?? body,
			messageBody: body,
			topicId,
			ingressId,
			createAt
			// messageLabels: labels
		}
	}

	private static _mapLabelDbRow(
		sqlRow: FSqlResultRecord
	): Label {
		const labelUuid: string = sqlRow.get("api_uuid").asString;
		const labelValue: string = sqlRow.get("value").asString;
		const labelCreatedAt: Date = sqlRow.get("utc_created_date").asDate;
		const labelDeletedAt: Date | null = sqlRow.get("utc_deleted_date").asDateNullable;

		const label: Label = {
			labelId: LabelIdentifier.fromUuid(labelUuid),
			labelValue: labelValue,
			labelCreatedAt,
			labelDeletedAt
		};

		return Object.freeze<Label>(label);
	}

	private static _mapLabelHandlerDbRow(
		sqlRow: FSqlResultRecord,
	): LabelHandler {
		const labelHandlerUuid: string = sqlRow.get("api_uuid").asString;
		const topicUuid: string = sqlRow.get("topic_api_uuid").asString;
		const labelHandlerKind: string = sqlRow.get("kind").asString;
		const labelHandlerCreatedAt: Date = sqlRow.get("utc_created_date").asDate;
		const labelHandlerDeletedAt: Date | null = sqlRow.get("utc_deleted_date").asDateNullable;
		const labelHandlerId: LabelHandlerIdentifier = LabelHandlerIdentifier.fromUuid(labelHandlerUuid);
		const topicId: TopicIdentifier = TopicIdentifier.fromUuid(topicUuid);

		ensureLabelHandlerKind(labelHandlerKind);

		switch (labelHandlerKind) {
			case LabelHandler.Kind.ExternalProcess:
				const externalProcessPath: string = sqlRow.get("path").asString;

				const labelHandler: LabelHandler = {
					labelHandlerId,
					topicId,
					labelHandlerKind: LabelHandler.Kind.ExternalProcess,
					externalProcessPath,
					labelHandlerCreatedAt,
					labelHandlerDeletedAt
				}
				return Object.freeze<LabelHandler>(labelHandler);

			default:
				throw new FExceptionInvalidOperation(`Not supported label handler kind: ${labelHandlerKind}`);
		}
	}

	private static _mapTopicDbRow(
		sqlRow: FSqlResultRecord
	): Topic {
		const topicUuid: string = sqlRow.get("api_uuid").asString;
		const topicDomain: string | null = sqlRow.get("domain").asStringNullable;
		const topicName: string = sqlRow.get("name").asString;
		const topicDescription: string = sqlRow.get("description").asString;
		const topicMediaType: string = sqlRow.get("media_type").asString;
		const topicCreatedAt: Date = sqlRow.get("utc_created_date").asDate;
		const topicDeletedAt: Date | null = sqlRow.get("utc_deleted_date").asDateNullable;

		const topic: Topic = {
			topicId: TopicIdentifier.fromUuid(topicUuid),
			topicName,
			topicDomain,
			topicDescription,
			topicMediaType,
			topicCreatedAt,
			topicDeletedAt
		};

		return Object.freeze<Topic>(topic);
	}

	private static _mapIngressManagementDbRow(
		sqlRow: FSqlResultRecord
	): IngressManagement {
		const ingressUuid: string = sqlRow.get("api_uuid").asString;
		const ingressTopicUuid: string = sqlRow.get("topic_api_uuid").asString;
		const ingressKind: string = sqlRow.get("kind").asString;
		const ingressCreatedAt: Date = sqlRow.get("utc_created_date").asDate;
		const ingressDeletedAt: Date | null = sqlRow.get("utc_deleted_date").asDateNullable;

		ensureIngressKind(ingressKind);

		const ingress: IngressManagement = {
			ingressId: IngressIdentifier.fromUuid(ingressUuid),
			ingressTopicId: TopicIdentifier.fromUuid(ingressTopicUuid),
			ingressKind,
			ingressCreatedAt,
			ingressDeletedAt
		};

		return Object.freeze<IngressManagement>(ingress);
	}


	private static _mapMetaDbRow(
		sqlRow: FSqlResultRecord
	): Meta {
		const topicsCount: string = sqlRow.get("topics_count").asString;
		const labelsCount: string = sqlRow.get("labels_count").asString;
		const ingressesCount: string = sqlRow.get("ingresses_count").asString;
		const egressesCount: string = sqlRow.get("egresses_count").asString;

		const meta: Meta = {
			topicsCount,
			labelsCount,
			ingressesCount,
			egressesCount
		};

		return Object.freeze<Meta>(meta);
	}

}
