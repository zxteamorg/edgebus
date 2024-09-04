--
-- PostgreSQL database dump
--

-- Dumped from database version 15.7
-- Dumped by pg_dump version 15.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: runtime; Type: SCHEMA; Schema: -; Owner: edgebus-local-owner
--

CREATE SCHEMA runtime;


ALTER SCHEMA runtime OWNER TO "edgebus-local-owner";

--
-- Name: SCHEMA runtime; Type: COMMENT; Schema: -; Owner: edgebus-local-owner
--

COMMENT ON SCHEMA runtime IS 'The schema contains data related to main runtime. Such a topics, messages, etc.';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: DELIVERY_STATUS; Type: TYPE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TYPE runtime."DELIVERY_STATUS" AS ENUM (
    'SUCCESS',
    'FAILURE',
    'SKIP'
);


ALTER TYPE runtime."DELIVERY_STATUS" OWNER TO "edgebus-local-owner";

--
-- Name: EGRESS_KIND; Type: TYPE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TYPE runtime."EGRESS_KIND" AS ENUM (
    'WEBHOOK',
    'WEB_SOCKET_HOST'
);


ALTER TYPE runtime."EGRESS_KIND" OWNER TO "edgebus-local-owner";

--
-- Name: INGRESS_KIND; Type: TYPE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TYPE runtime."INGRESS_KIND" AS ENUM (
    'HTTP_HOST',
    'WEB_SOCKET_CLIENT',
    'WEB_SOCKET_HOST'
);


ALTER TYPE runtime."INGRESS_KIND" OWNER TO "edgebus-local-owner";

--
-- Name: LABEL_HANDLER_KIND; Type: TYPE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TYPE runtime."LABEL_HANDLER_KIND" AS ENUM (
    'EXTERNAL_PROCESS'
);


ALTER TYPE runtime."LABEL_HANDLER_KIND" OWNER TO "edgebus-local-owner";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __migration; Type: TABLE; Schema: public; Owner: edgebus-local-owner
--

CREATE TABLE public.__migration (
    id smallint NOT NULL,
    version character varying(64) NOT NULL,
    utc_deployed_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    log text NOT NULL
);


ALTER TABLE public.__migration OWNER TO "edgebus-local-owner";

--
-- Name: __migration_id_seq; Type: SEQUENCE; Schema: public; Owner: edgebus-local-owner
--

CREATE SEQUENCE public.__migration_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.__migration_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: __migration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: edgebus-local-owner
--

ALTER SEQUENCE public.__migration_id_seq OWNED BY public.__migration.id;


--
-- Name: __migration_rollback_script; Type: TABLE; Schema: public; Owner: edgebus-local-owner
--

CREATE TABLE public.__migration_rollback_script (
    id smallint NOT NULL,
    version_id smallint NOT NULL,
    name character varying(256) NOT NULL,
    kind character varying(32) NOT NULL,
    file character varying(2048) NOT NULL,
    content text NOT NULL
);


ALTER TABLE public.__migration_rollback_script OWNER TO "edgebus-local-owner";

--
-- Name: __migration_rollback_script_id_seq; Type: SEQUENCE; Schema: public; Owner: edgebus-local-owner
--

CREATE SEQUENCE public.__migration_rollback_script_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.__migration_rollback_script_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: __migration_rollback_script_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: edgebus-local-owner
--

ALTER SEQUENCE public.__migration_rollback_script_id_seq OWNED BY public.__migration_rollback_script.id;


--
-- Name: tb_egress; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress (
    id integer NOT NULL,
    kind runtime."EGRESS_KIND" NOT NULL,
    api_uuid uuid NOT NULL,
    filter_label_policy character varying(6) NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone,
    CONSTRAINT ck__filter_label_policy CHECK (((filter_label_policy)::text = ANY ((ARRAY['strict'::character varying, 'lax'::character varying, 'skip'::character varying, 'ignore'::character varying])::text[])))
);


ALTER TABLE runtime.tb_egress OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_delivery; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_delivery (
    id integer NOT NULL,
    api_uuid uuid NOT NULL,
    egress_id integer NOT NULL,
    topic_id integer NOT NULL,
    message_id bigint NOT NULL,
    egress_topic_id integer NOT NULL,
    status runtime."DELIVERY_STATUS" NOT NULL,
    success_evidence jsonb,
    failure_evidence jsonb,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    CONSTRAINT ck__tb_egress_delivery__evidence CHECK ((((status = 'SUCCESS'::runtime."DELIVERY_STATUS") AND (success_evidence IS NOT NULL) AND (failure_evidence IS NULL)) OR ((status = 'FAILURE'::runtime."DELIVERY_STATUS") AND (failure_evidence IS NOT NULL) AND (success_evidence IS NULL)) OR ((status = 'SKIP'::runtime."DELIVERY_STATUS") AND (success_evidence IS NULL) AND (failure_evidence IS NULL))))
);


ALTER TABLE runtime.tb_egress_delivery OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_delivery_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_egress_delivery_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_egress_delivery_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_delivery_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_egress_delivery_id_seq OWNED BY runtime.tb_egress_delivery.id;


--
-- Name: tb_egress_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_egress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_egress_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_egress_id_seq OWNED BY runtime.tb_egress.id;


--
-- Name: tb_egress_label; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_label (
    label_id integer NOT NULL,
    egress_id integer NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_egress_label OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_message_queue; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_message_queue (
    id bigint NOT NULL,
    topic_id integer NOT NULL,
    egress_id integer NOT NULL,
    message_id bigint NOT NULL
);


ALTER TABLE runtime.tb_egress_message_queue OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_message_queue_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_egress_message_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_egress_message_queue_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_message_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_egress_message_queue_id_seq OWNED BY runtime.tb_egress_message_queue.id;


--
-- Name: tb_egress_topic; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_topic (
    id integer NOT NULL,
    egress_id integer NOT NULL,
    topic_id integer NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_egress_topic OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_topic_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_egress_topic_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_egress_topic_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_topic_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_egress_topic_id_seq OWNED BY runtime.tb_egress_topic.id;


--
-- Name: tb_egress_webhook; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_webhook (
    id integer NOT NULL,
    kind runtime."EGRESS_KIND" NOT NULL,
    http_url character varying(2048) NOT NULL,
    http_method character varying(16),
    CONSTRAINT ck__tb_egress_http_client__kind CHECK ((kind = 'WEBHOOK'::runtime."EGRESS_KIND"))
);


ALTER TABLE runtime.tb_egress_webhook OWNER TO "edgebus-local-owner";

--
-- Name: tb_egress_websockethost; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_egress_websockethost (
    id integer NOT NULL,
    kind runtime."EGRESS_KIND" NOT NULL,
    CONSTRAINT ck__tb_egress_websockethost__kind CHECK ((kind = 'WEB_SOCKET_HOST'::runtime."EGRESS_KIND"))
);


ALTER TABLE runtime.tb_egress_websockethost OWNER TO "edgebus-local-owner";

--
-- Name: tb_ingress; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_ingress (
    id integer NOT NULL,
    kind runtime."INGRESS_KIND" NOT NULL,
    api_uuid uuid NOT NULL,
    topic_id integer NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_ingress OWNER TO "edgebus-local-owner";

--
-- Name: tb_ingress_httphost; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_ingress_httphost (
    id integer NOT NULL,
    kind runtime."INGRESS_KIND" NOT NULL,
    path character varying(2048) NOT NULL,
    response_static_status_code smallint,
    response_static_status_message character varying(32),
    response_static_headers jsonb,
    response_static_body bytea,
    response_kind character varying(32) NOT NULL,
    response_dynamic_handler_kind character varying(32),
    response_dynamic_handler_external_script_path character varying(2048),
    CONSTRAINT ck__kind CHECK ((kind = 'HTTP_HOST'::runtime."INGRESS_KIND")),
    CONSTRAINT ck_response_handler_kind CHECK (((((response_kind)::text = 'STATIC'::text) AND (response_static_status_code IS NOT NULL) AND (response_dynamic_handler_kind IS NULL) AND (response_dynamic_handler_external_script_path IS NULL)) OR (((response_kind)::text = 'DYNAMIC'::text) AND (response_static_status_code IS NULL) AND (response_static_status_message IS NULL) AND (response_static_headers IS NULL) AND (response_static_body IS NULL) AND ((response_dynamic_handler_kind)::text = 'EXTERNAL_PROCESS'::text) AND (response_dynamic_handler_external_script_path IS NOT NULL)))),
    CONSTRAINT ck_response_kind CHECK ((((response_kind)::text = 'STATIC'::text) OR ((response_kind)::text = 'DYNAMIC'::text)))
);


ALTER TABLE runtime.tb_ingress_httphost OWNER TO "edgebus-local-owner";

--
-- Name: tb_ingress_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_ingress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_ingress_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_ingress_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_ingress_id_seq OWNED BY runtime.tb_ingress.id;


--
-- Name: tb_ingress_websocketclient; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_ingress_websocketclient (
    id integer NOT NULL,
    kind runtime."INGRESS_KIND" NOT NULL,
    url character varying(2048) NOT NULL,
    CONSTRAINT ck__kind CHECK ((kind = 'WEB_SOCKET_CLIENT'::runtime."INGRESS_KIND"))
);


ALTER TABLE runtime.tb_ingress_websocketclient OWNER TO "edgebus-local-owner";

--
-- Name: tb_label; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_label (
    id integer NOT NULL,
    api_uuid uuid NOT NULL,
    value character varying(512),
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_label OWNER TO "edgebus-local-owner";

--
-- Name: tb_label_handler; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_label_handler (
    id integer NOT NULL,
    api_uuid uuid NOT NULL,
    kind runtime."LABEL_HANDLER_KIND" NOT NULL,
    topic_id integer NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_label_handler OWNER TO "edgebus-local-owner";

--
-- Name: tb_label_handler_external_process; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_label_handler_external_process (
    id integer NOT NULL,
    path character varying(2048) NOT NULL
);


ALTER TABLE runtime.tb_label_handler_external_process OWNER TO "edgebus-local-owner";

--
-- Name: tb_label_handler_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_label_handler_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_label_handler_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_label_handler_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_label_handler_id_seq OWNED BY runtime.tb_label_handler.id;


--
-- Name: tb_label_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_label_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_label_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_label_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_label_id_seq OWNED BY runtime.tb_label.id;


--
-- Name: tb_message; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_message (
    id bigint NOT NULL,
    api_uuid uuid NOT NULL,
    topic_id integer NOT NULL,
    ingress_id integer NOT NULL,
    media_type character varying(64),
    body bytea,
    original_body bytea,
    headers jsonb NOT NULL,
    utc_created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    CONSTRAINT ck__tb_message__body CHECK (((original_body IS NULL) OR ((original_body IS NOT NULL) AND (body IS NOT NULL))))
);


ALTER TABLE runtime.tb_message OWNER TO "edgebus-local-owner";

--
-- Name: CONSTRAINT ck__tb_message__body ON tb_message; Type: COMMENT; Schema: runtime; Owner: edgebus-local-owner
--

COMMENT ON CONSTRAINT ck__tb_message__body ON runtime.tb_message IS 'Force to set "body" if "original_body" presented.';


--
-- Name: tb_message_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_message_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_message_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_message_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_message_id_seq OWNED BY runtime.tb_message.id;


--
-- Name: tb_message_label; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_message_label (
    label_id integer NOT NULL,
    message_id integer NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_message_label OWNER TO "edgebus-local-owner";

--
-- Name: tb_topic; Type: TABLE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE TABLE runtime.tb_topic (
    id integer NOT NULL,
    api_uuid uuid NOT NULL,
    domain character varying(256),
    name character varying(256) NOT NULL,
    description character varying(1028) NOT NULL,
    media_type character varying(128) NOT NULL,
    utc_created_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    utc_deleted_date timestamp without time zone
);


ALTER TABLE runtime.tb_topic OWNER TO "edgebus-local-owner";

--
-- Name: tb_topic_id_seq; Type: SEQUENCE; Schema: runtime; Owner: edgebus-local-owner
--

CREATE SEQUENCE runtime.tb_topic_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE runtime.tb_topic_id_seq OWNER TO "edgebus-local-owner";

--
-- Name: tb_topic_id_seq; Type: SEQUENCE OWNED BY; Schema: runtime; Owner: edgebus-local-owner
--

ALTER SEQUENCE runtime.tb_topic_id_seq OWNED BY runtime.tb_topic.id;


--
-- Name: vw_message; Type: VIEW; Schema: runtime; Owner: edgebus-local-owner
--

CREATE VIEW runtime.vw_message AS
 SELECT tb_message.id,
    tb_message.api_uuid,
    tb_message.topic_id,
    tb_message.ingress_id,
    tb_message.media_type,
    tb_message.body,
        CASE
            WHEN ((tb_message.media_type)::text = 'application/json'::text) THEN (convert_from(tb_message.body, 'UTF8'::name))::json
            ELSE NULL::json
        END AS body_json,
    tb_message.original_body,
        CASE
            WHEN ((tb_message.media_type)::text = 'application/json'::text) THEN (convert_from(tb_message.original_body, 'UTF8'::name))::json
            ELSE NULL::json
        END AS original_body_json,
    tb_message.headers,
    tb_message.utc_created_at
   FROM runtime.tb_message;


ALTER TABLE runtime.vw_message OWNER TO "edgebus-local-owner";

--
-- Name: __migration id; Type: DEFAULT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration ALTER COLUMN id SET DEFAULT nextval('public.__migration_id_seq'::regclass);


--
-- Name: __migration_rollback_script id; Type: DEFAULT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration_rollback_script ALTER COLUMN id SET DEFAULT nextval('public.__migration_rollback_script_id_seq'::regclass);


--
-- Name: tb_egress id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress ALTER COLUMN id SET DEFAULT nextval('runtime.tb_egress_id_seq'::regclass);


--
-- Name: tb_egress_delivery id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery ALTER COLUMN id SET DEFAULT nextval('runtime.tb_egress_delivery_id_seq'::regclass);


--
-- Name: tb_egress_message_queue id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue ALTER COLUMN id SET DEFAULT nextval('runtime.tb_egress_message_queue_id_seq'::regclass);


--
-- Name: tb_egress_topic id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_topic ALTER COLUMN id SET DEFAULT nextval('runtime.tb_egress_topic_id_seq'::regclass);


--
-- Name: tb_ingress id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress ALTER COLUMN id SET DEFAULT nextval('runtime.tb_ingress_id_seq'::regclass);


--
-- Name: tb_label id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label ALTER COLUMN id SET DEFAULT nextval('runtime.tb_label_id_seq'::regclass);


--
-- Name: tb_label_handler id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler ALTER COLUMN id SET DEFAULT nextval('runtime.tb_label_handler_id_seq'::regclass);


--
-- Name: tb_message id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message ALTER COLUMN id SET DEFAULT nextval('runtime.tb_message_id_seq'::regclass);


--
-- Name: tb_topic id; Type: DEFAULT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_topic ALTER COLUMN id SET DEFAULT nextval('runtime.tb_topic_id_seq'::regclass);


--
-- Data for Name: __migration; Type: TABLE DATA; Schema: public; Owner: edgebus-local-owner
--

COPY public.__migration (id, version, utc_deployed_at, log) FROM stdin;
1	v0001	2024-09-04 08:29:17.255249	[INFO] Execute JS script: 01-guards.js\n[TRACE] \nconst EXPECTED_PREVIOUS_VERSION = "v0000"; // change by you own\n\nasync function migration(cancellationToken, sqlConnection, logger) {\n\t{ // Database name guard\n\t\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\t\tif (dbName !== "edgebus-local") {\n\t\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t\t}\n\t}\n\n\t{ // Migration user guard\n\t\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\t\tif (dbUser !== "edgebus-local-owner") {\n\t\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t\t}\n\t}\n\n\t{ // Version guard\n\t\tconst versionNumbers = await sqlConnection\n\t\t\t.statement('SELECT COUNT(*)::INT FROM "public"."__migration"')\n\t\t\t.executeScalar(cancellationToken);\n\n\t\tif (versionNumbers.asNumber !== 0) {\n\t\t\tthrow new Error(`Wrong database! Some migrations found. Expected a database without migrations. Cannot continue.`);\n\t\t}\n\t}\n}\n\n[INFO] Execute SQL script: 50-schemas-install.sql\n[TRACE] \nCREATE SCHEMA "runtime";\nCOMMENT ON SCHEMA "runtime" IS 'The schema contains data related to main runtime. Such a topics, messages, etc.';\n\n\n[TRACE] \nCREATE SCHEMA "runtime";\nCOMMENT ON SCHEMA "runtime" IS 'The schema contains data related to main runtime. Such a topics, messages, etc.';\n\n
2	v0002	2024-09-04 08:29:17.298164	[INFO] Execute JS script: 01-guards.js\n[TRACE] \nconst EXPECTED_PREVIOUS_VERSION = "v0001"; // change by you own\n\nasync function migration(cancellationToken, sqlConnection, logger) {\n\t{ // Database name guard\n\t\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\t\tif (dbName !== "edgebus-local") {\n\t\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t\t}\n\t}\n\n\t{ // Migration user guard\n\t\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\t\tif (dbUser !== "edgebus-local-owner") {\n\t\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t\t}\n\t}\n\n\t{ // Version guard\n\t\tconst versionRow = await sqlConnection\n\t\t\t.statement('SELECT "version", "utc_deployed_at" FROM "public"."__migration" ORDER BY "version" DESC LIMIT 1')\n\t\t\t.executeSingleOrNull(cancellationToken);\n\n\t\tif (versionRow === null) {\n\t\t\tthrow new Error(`Wrong database! No any migrations found. Expected previous version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\n\t\tconst version = versionRow.get("version").asString;\n\t\tconst deployedAt = versionRow.get("utc_deployed_at").asDate;\n\n\t\tif (version !== EXPECTED_PREVIOUS_VERSION) {\n\t\t\tthrow new Error(`Wrong database! Database version is "${version}" (deployed at ${deployedAt.toISOString()}). Expected version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\t}\n}\n\n[INFO] Execute SQL script: 10-tb_topic.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_topic" (\n\t"id" SERIAL NOT NULL PRIMARY KEY,\n\t"api_uuid" UUID NOT NULL,\n\t"domain" VARCHAR(256) NULL,\n\t"name" VARCHAR(256) NOT NULL,\n\t"description" VARCHAR(1028) NOT NULL,\n\t"media_type" VARCHAR(128) NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\tCONSTRAINT "uq__tb_topic__api_uuid" UNIQUE ("api_uuid")\n);\n\nCREATE UNIQUE INDEX "uq__tb_topic__doman_name" \nON "runtime"."tb_topic" ("domain", "name")\nWHERE "domain" IS NOT NULL AND "utc_deleted_date" IS NULL;\n\nCREATE UNIQUE INDEX "uq__tb_topic__name"\nON "runtime"."tb_topic" ("name")\nWHERE "domain" IS NULL AND "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_topic" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_topic" TO "edgebus-local-api";\nGRANT UPDATE ("description", "utc_deleted_date") ON "runtime"."tb_topic" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_topic" (\n\t"id" SERIAL NOT NULL PRIMARY KEY,\n\t"api_uuid" UUID NOT NULL,\n\t"domain" VARCHAR(256) NULL,\n\t"name" VARCHAR(256) NOT NULL,\n\t"description" VARCHAR(1028) NOT NULL,\n\t"media_type" VARCHAR(128) NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\tCONSTRAINT "uq__tb_topic__api_uuid" UNIQUE ("api_uuid")\n);\n\nCREATE UNIQUE INDEX "uq__tb_topic__doman_name" \nON "runtime"."tb_topic" ("domain", "name")\nWHERE "domain" IS NOT NULL AND "utc_deleted_date" IS NULL;\n\nCREATE UNIQUE INDEX "uq__tb_topic__name"\nON "runtime"."tb_topic" ("name")\nWHERE "domain" IS NULL AND "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_topic" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_topic" TO "edgebus-local-api";\nGRANT UPDATE ("description", "utc_deleted_date") ON "runtime"."tb_topic" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 20-INGRESS_KIND.sql\n[TRACE] \nCREATE TYPE "runtime"."INGRESS_KIND" AS ENUM (\n\t'HTTP_HOST', 'WEB_SOCKET_CLIENT', 'WEB_SOCKET_HOST'\n);\n\n[TRACE] \nCREATE TYPE "runtime"."INGRESS_KIND" AS ENUM (\n\t'HTTP_HOST', 'WEB_SOCKET_CLIENT', 'WEB_SOCKET_HOST'\n);\n\n[INFO] Execute SQL script: 21-tb_ingress.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress" (\n\t"id" SERIAL NOT NULL,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_ingress"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_ingress__kind__integrity"\n\tUNIQUE ("id", "kind"),\n\n\tCONSTRAINT "pk__tb_ingress__topic__integrity"\n\tUNIQUE ("id", "topic_id"),\n\n\tCONSTRAINT "uq__tb_ingress__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_ingress__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_ingress" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress" (\n\t"id" SERIAL NOT NULL,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_ingress"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_ingress__kind__integrity"\n\tUNIQUE ("id", "kind"),\n\n\tCONSTRAINT "pk__tb_ingress__topic__integrity"\n\tUNIQUE ("id", "topic_id"),\n\n\tCONSTRAINT "uq__tb_ingress__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_ingress__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_ingress" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 22-tb_ingress_httphost.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress_httphost" (\n\t"id" INT NOT NULL PRIMARY KEY,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"path" VARCHAR(2048) NOT NULL,\n\t"response_status_code" SMALLINT NOT NULL,\n\t"response_status_message" VARCHAR(32) NULL,\n\t"response_headers" JSONB NULL,\n\t"response_body" BYTEA NULL,\n\n\tCONSTRAINT "ck__kind"\n\tCHECK ("kind" = 'HTTP_HOST'),\n\t\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_ingress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress_httphost" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress_httphost" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress_httphost" (\n\t"id" INT NOT NULL PRIMARY KEY,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"path" VARCHAR(2048) NOT NULL,\n\t"response_status_code" SMALLINT NOT NULL,\n\t"response_status_message" VARCHAR(32) NULL,\n\t"response_headers" JSONB NULL,\n\t"response_body" BYTEA NULL,\n\n\tCONSTRAINT "ck__kind"\n\tCHECK ("kind" = 'HTTP_HOST'),\n\t\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_ingress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress_httphost" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress_httphost" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 23-tb_ingress_websocketclient.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress_websocketclient" (\n\t"id" INT NOT NULL PRIMARY KEY,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"url" VARCHAR(2048) NOT NULL,\n\n\tCONSTRAINT "ck__kind"\n\tCHECK ("kind" = 'WEB_SOCKET_CLIENT'),\n\t\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_ingress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress_websocketclient" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress_websocketclient" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_ingress_websocketclient" (\n\t"id" INT NOT NULL PRIMARY KEY,\n\t"kind" "runtime"."INGRESS_KIND" NOT NULL,\n\t"url" VARCHAR(2048) NOT NULL,\n\n\tCONSTRAINT "ck__kind"\n\tCHECK ("kind" = 'WEB_SOCKET_CLIENT'),\n\t\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_ingress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_ingress_websocketclient" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_ingress_websocketclient" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 30-EGRESS_KIND.sql\n[TRACE] \nCREATE TYPE "runtime"."EGRESS_KIND" AS ENUM (\n\t'WEBHOOK', 'WEB_SOCKET_HOST'\n);\n\n[TRACE] \nCREATE TYPE "runtime"."EGRESS_KIND" AS ENUM (\n\t'WEBHOOK', 'WEB_SOCKET_HOST'\n);\n\n[INFO] Execute SQL script: 31-tb_egress.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress" (\n\t"id" SERIAL NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"filter_label_policy" VARCHAR(6) NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_egress__kind__integrity"\n\tUNIQUE ("id", "kind"),\n\n\tCONSTRAINT "uq__tb_egress__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "ck__filter_label_policy"\n\tCHECK ("filter_label_policy" IN ('strict', 'lax', 'skip', 'ignore'))\n);\n\n\nGRANT INSERT ON TABLE "runtime"."tb_egress" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress" (\n\t"id" SERIAL NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"filter_label_policy" VARCHAR(6) NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_egress__kind__integrity"\n\tUNIQUE ("id", "kind"),\n\n\tCONSTRAINT "uq__tb_egress__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "ck__filter_label_policy"\n\tCHECK ("filter_label_policy" IN ('strict', 'lax', 'skip', 'ignore'))\n);\n\n\nGRANT INSERT ON TABLE "runtime"."tb_egress" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 32-tb_egress_webhook.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_webhook" (\n\t"id" INT NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\t"http_url" VARCHAR(2048) NOT NULL,\n\t"http_method" VARCHAR(16) NULL,\n\n\tCONSTRAINT "pk__tb_egress_http_client"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "ck__tb_egress_http_client__kind"\n\tCHECK ("kind" = 'WEBHOOK'),\n\t\n\tCONSTRAINT "fk__tb_egress_http_client__tb_egress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_egress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_webhook" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_webhook" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_webhook" (\n\t"id" INT NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\t"http_url" VARCHAR(2048) NOT NULL,\n\t"http_method" VARCHAR(16) NULL,\n\n\tCONSTRAINT "pk__tb_egress_http_client"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "ck__tb_egress_http_client__kind"\n\tCHECK ("kind" = 'WEBHOOK'),\n\t\n\tCONSTRAINT "fk__tb_egress_http_client__tb_egress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_ingress_httphost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_egress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_webhook" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_webhook" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 33-tb_egress_websockethost.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_websockethost" (\n\t"id" INT NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\n\tCONSTRAINT "pk__tb_egress_websockethost"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "ck__tb_egress_websockethost__kind"\n\tCHECK ("kind" = 'WEB_SOCKET_HOST'),\n\t\n\tCONSTRAINT "fk__tb_egress_websockethost__tb_egress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_websockethost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_egress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_websockethost" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_websockethost" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_websockethost" (\n\t"id" INT NOT NULL,\n\t"kind" "runtime"."EGRESS_KIND" NOT NULL,\n\n\tCONSTRAINT "pk__tb_egress_websockethost"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "ck__tb_egress_websockethost__kind"\n\tCHECK ("kind" = 'WEB_SOCKET_HOST'),\n\t\n\tCONSTRAINT "fk__tb_egress_websockethost__tb_egress"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_websockethost__tb_ingress__integrity"\n\tFOREIGN KEY ("id", "kind")\n\tREFERENCES "runtime"."tb_egress" ("id", "kind")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_websockethost" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_websockethost" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 40-tb_egress_topic.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_topic" (\n\t"id" SERIAL NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress_topic"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_egress_topic__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_topic__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "pk__tb_egress_topic__integrity"\n\tUNIQUE ("id", "egress_id", "topic_id")\n);\n\nCREATE UNIQUE INDEX "uq__tb_egress_topic__success"\nON "runtime"."tb_egress_topic" ("topic_id", "egress_id")\nWHERE "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_topic" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_topic" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress_topic" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_topic" (\n\t"id" SERIAL NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress_topic"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_egress_topic__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_topic__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "pk__tb_egress_topic__integrity"\n\tUNIQUE ("id", "egress_id", "topic_id")\n);\n\nCREATE UNIQUE INDEX "uq__tb_egress_topic__success"\nON "runtime"."tb_egress_topic" ("topic_id", "egress_id")\nWHERE "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_topic" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_topic" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress_topic" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 60-tb_message.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_message" (\n\t"id" BIGSERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"ingress_id" INT NOT NULL,\n\t"media_type" VARCHAR(64) NULL,\n\t"body" BYTEA NULL,\n\t"original_body" BYTEA NULL,\n\t"headers" JSONB NOT NULL,\n\t"utc_created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),\n\n\tCONSTRAINT "pk__tb_message"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_message__topic__integrity"\n\tUNIQUE ("id", "topic_id"),\n\n\tCONSTRAINT "pk__tb_message__topic_ingress__integrity"\n\tUNIQUE ("id", "topic_id", "ingress_id"),\n\n\tCONSTRAINT "uq__tb_message__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_message__tb_ingress"\n\tFOREIGN KEY ("ingress_id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_message__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_message__tb_ingress__integrity"\n\tFOREIGN KEY ("ingress_id", "topic_id")\n\tREFERENCES "runtime"."tb_ingress" ("id", "topic_id"),\n\n\tCONSTRAINT "ck__tb_message__body"\n\tCHECK (("original_body" IS NULL) OR ("original_body" IS NOT NULL AND "body" IS NOT NULL))\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_message" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_message" TO "edgebus-local-api";\n\nCOMMENT ON CONSTRAINT "ck__tb_message__body"\nON "runtime"."tb_message"\nIS 'Force to set "body" if "original_body" presented.';\n\n[TRACE] \nCREATE TABLE "runtime"."tb_message" (\n\t"id" BIGSERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"ingress_id" INT NOT NULL,\n\t"media_type" VARCHAR(64) NULL,\n\t"body" BYTEA NULL,\n\t"original_body" BYTEA NULL,\n\t"headers" JSONB NOT NULL,\n\t"utc_created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),\n\n\tCONSTRAINT "pk__tb_message"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "pk__tb_message__topic__integrity"\n\tUNIQUE ("id", "topic_id"),\n\n\tCONSTRAINT "pk__tb_message__topic_ingress__integrity"\n\tUNIQUE ("id", "topic_id", "ingress_id"),\n\n\tCONSTRAINT "uq__tb_message__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_message__tb_ingress"\n\tFOREIGN KEY ("ingress_id")\n\tREFERENCES "runtime"."tb_ingress" ("id"),\n\n\tCONSTRAINT "fk__tb_message__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_message__tb_ingress__integrity"\n\tFOREIGN KEY ("ingress_id", "topic_id")\n\tREFERENCES "runtime"."tb_ingress" ("id", "topic_id"),\n\n\tCONSTRAINT "ck__tb_message__body"\n\tCHECK (("original_body" IS NULL) OR ("original_body" IS NOT NULL AND "body" IS NOT NULL))\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_message" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_message" TO "edgebus-local-api";\n\nCOMMENT ON CONSTRAINT "ck__tb_message__body"\nON "runtime"."tb_message"\nIS 'Force to set "body" if "original_body" presented.';\n\n[INFO] Execute SQL script: 65-tb_egress_message_queue.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_message_queue" (\n\t"id" BIGSERIAL NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"message_id" BIGINT NOT NULL,\n\n\tCONSTRAINT "pk__tb_egress_message_queue"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic__integrity"\n\tFOREIGN KEY ("message_id", "topic_id")\n\tREFERENCES "runtime"."tb_message" ("id", "topic_id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\nGRANT DELETE ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_message_queue" (\n\t"id" BIGSERIAL NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"message_id" BIGINT NOT NULL,\n\n\tCONSTRAINT "pk__tb_egress_message_queue"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic__integrity"\n\tFOREIGN KEY ("message_id", "topic_id")\n\tREFERENCES "runtime"."tb_message" ("id", "topic_id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\nGRANT DELETE ON TABLE "runtime"."tb_egress_message_queue" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 75-vw_message.sql\n[TRACE] \nCREATE VIEW "runtime"."vw_message" AS\nSELECT\n\t"id",\n\t"api_uuid",\n\t"topic_id",\n\t"ingress_id",\n\t"media_type",\n\t"body",\n\tCASE\n\t\tWHEN "media_type" = 'application/json' THEN CONVERT_FROM("body", 'UTF8')::JSON\n\t\tELSE NULL\n\tEND AS "body_json",\n\t"original_body",\n\tCASE\n\t\tWHEN "media_type" = 'application/json' THEN CONVERT_FROM("original_body", 'UTF8')::JSON\n\t\tELSE NULL\n\tEND AS "original_body_json",\n\t"headers",\n\t"utc_created_at"\nFROM "runtime"."tb_message";\n\nGRANT SELECT ON TABLE "runtime"."vw_message" TO "edgebus-local-api";\n\n[TRACE] \nCREATE VIEW "runtime"."vw_message" AS\nSELECT\n\t"id",\n\t"api_uuid",\n\t"topic_id",\n\t"ingress_id",\n\t"media_type",\n\t"body",\n\tCASE\n\t\tWHEN "media_type" = 'application/json' THEN CONVERT_FROM("body", 'UTF8')::JSON\n\t\tELSE NULL\n\tEND AS "body_json",\n\t"original_body",\n\tCASE\n\t\tWHEN "media_type" = 'application/json' THEN CONVERT_FROM("original_body", 'UTF8')::JSON\n\t\tELSE NULL\n\tEND AS "original_body_json",\n\t"headers",\n\t"utc_created_at"\nFROM "runtime"."tb_message";\n\nGRANT SELECT ON TABLE "runtime"."vw_message" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 80-DELIVERY_STATUS.sql\n[TRACE] \nCREATE TYPE "runtime"."DELIVERY_STATUS" AS ENUM (\n\t'SUCCESS', 'FAILURE'\n);\n\n[TRACE] \nCREATE TYPE "runtime"."DELIVERY_STATUS" AS ENUM (\n\t'SUCCESS', 'FAILURE'\n);\n\n[INFO] Execute SQL script: 81-tb_egress_delivery.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_delivery" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"message_id" BIGINT NOT NULL,\n\t"egress_topic_id" INT NOT NULL,\n\t"status" "runtime"."DELIVERY_STATUS" NOT NULL,\n\t"success_evidence" JSONB NULL,\n\t"failure_evidence" JSONB NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\n\tCONSTRAINT "pk__tb_egress_delivery"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_egress_delivery__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress_topic"\n\tFOREIGN KEY ("egress_topic_id")\n\tREFERENCES "runtime"."tb_egress_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_delivery__tb_topic__integrity_1"\n\tFOREIGN KEY ("message_id", "topic_id")\n\tREFERENCES "runtime"."tb_message" ("id", "topic_id"),\n\n\tCONSTRAINT "fk__tb_egress_delivery__tb_topic__integrity_2"\n\tFOREIGN KEY ("egress_topic_id", "egress_id", "topic_id")\n\tREFERENCES "runtime"."tb_egress_topic" ("id", "egress_id", "topic_id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_delivery" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_delivery" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_delivery" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"message_id" BIGINT NOT NULL,\n\t"egress_topic_id" INT NOT NULL,\n\t"status" "runtime"."DELIVERY_STATUS" NOT NULL,\n\t"success_evidence" JSONB NULL,\n\t"failure_evidence" JSONB NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\n\tCONSTRAINT "pk__tb_egress_delivery"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_egress_delivery__api_uuid"\n\tUNIQUE ("api_uuid"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_egress_topic"\n\tFOREIGN KEY ("egress_topic_id")\n\tREFERENCES "runtime"."tb_egress_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_message_queue__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_egress_delivery__tb_topic__integrity_1"\n\tFOREIGN KEY ("message_id", "topic_id")\n\tREFERENCES "runtime"."tb_message" ("id", "topic_id"),\n\n\tCONSTRAINT "fk__tb_egress_delivery__tb_topic__integrity_2"\n\tFOREIGN KEY ("egress_topic_id", "egress_id", "topic_id")\n\tREFERENCES "runtime"."tb_egress_topic" ("id", "egress_id", "topic_id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_delivery" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_delivery" TO "edgebus-local-api";\n\n[INFO] Execute SQL script: 82-ck__tb_egress_delivery__evidence.sql\n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\nADD CONSTRAINT "ck__tb_egress_delivery__evidence"\nCHECK (\n\t("status" = 'SUCCESS' AND "success_evidence" IS NOT NULL) \n\tOR\n\t("status" = 'FAILURE' AND "failure_evidence" IS NOT NULL)\n);\n\n\n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\nADD CONSTRAINT "ck__tb_egress_delivery__evidence"\nCHECK (\n\t("status" = 'SUCCESS' AND "success_evidence" IS NOT NULL) \n\tOR\n\t("status" = 'FAILURE' AND "failure_evidence" IS NOT NULL)\n);\n\n\n[INFO] Execute SQL script: 83-uq__tb_egress_delivery__success.sql\n[TRACE] \nCREATE UNIQUE INDEX "uq__tb_egress_delivery__success"\nON "runtime"."tb_egress_delivery" ("message_id", "egress_id")\nWHERE "status" = 'SUCCESS';\n\nCOMMENT ON INDEX "runtime"."uq__tb_egress_delivery__success"\nIS 'Only one success message for an egress.';\n\n[TRACE] \nCREATE UNIQUE INDEX "uq__tb_egress_delivery__success"\nON "runtime"."tb_egress_delivery" ("message_id", "egress_id")\nWHERE "status" = 'SUCCESS';\n\nCOMMENT ON INDEX "runtime"."uq__tb_egress_delivery__success"\nIS 'Only one success message for an egress.';\n
3	v0003	2024-09-04 08:29:17.458104	[INFO] Execute JS script: 01-guards.js\n[TRACE] \nconst EXPECTED_PREVIOUS_VERSION = "v0002"; // change by you own\n\nasync function migration(cancellationToken, sqlConnection, logger) {\n\t{ // Database name guard\n\t\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\t\tif (dbName !== "edgebus-local") {\n\t\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t\t}\n\t}\n\n\t{ // Migration user guard\n\t\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\t\tif (dbUser !== "edgebus-local-owner") {\n\t\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t\t}\n\t}\n\n\t{ // Version guard\n\t\tconst versionRow = await sqlConnection\n\t\t\t.statement('SELECT "version", "utc_deployed_at" FROM "public"."__migration" ORDER BY "version" DESC LIMIT 1')\n\t\t\t.executeSingleOrNull(cancellationToken);\n\n\t\tif (versionRow === null) {\n\t\t\tthrow new Error(`Wrong database! No any migrations found. Expected previous version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\n\t\tconst version = versionRow.get("version").asString;\n\t\tconst deployedAt = versionRow.get("utc_deployed_at").asDate;\n\n\t\tif (version !== EXPECTED_PREVIOUS_VERSION) {\n\t\t\tthrow new Error(`Wrong database! Database version is "${version}" (deployed at ${deployedAt.toISOString()}). Expected version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\t}\n}\n\n[INFO] Execute SQL script: 04-tb_label.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_label" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"value" VARCHAR(512),\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_label"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_label__api_uuid"\n\tUNIQUE ("api_uuid")\n);\n\nCREATE UNIQUE INDEX "uq__tb_label__value"\nON "runtime"."tb_label" ("value")\nWHERE "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_label" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_label" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"value" VARCHAR(512),\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_label"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_label__api_uuid"\n\tUNIQUE ("api_uuid")\n);\n\nCREATE UNIQUE INDEX "uq__tb_label__value"\nON "runtime"."tb_label" ("value")\nWHERE "utc_deleted_date" IS NULL;\n\nGRANT INSERT ON TABLE "runtime"."tb_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_label" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 06-tb_message_label.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_message_label" (\n\t"label_id" INT NOT NULL,\n\t"message_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_massage_label__integrity"\n\tUNIQUE ("label_id", "message_id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_label"\n\tFOREIGN KEY ("label_id")\n\tREFERENCES "runtime"."tb_label" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_message_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_message_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_message_label" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_message_label" (\n\t"label_id" INT NOT NULL,\n\t"message_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_massage_label__integrity"\n\tUNIQUE ("label_id", "message_id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_message"\n\tFOREIGN KEY ("message_id")\n\tREFERENCES "runtime"."tb_message" ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_label"\n\tFOREIGN KEY ("label_id")\n\tREFERENCES "runtime"."tb_label" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_message_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_message_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_message_label" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 08-LABEL_HANDLER_KIND.sql\n[TRACE] \nCREATE TYPE "runtime"."LABEL_HANDLER_KIND" AS ENUM (\n\t'EXTERNAL_PROCESS'\n);\n\n[TRACE] \nCREATE TYPE "runtime"."LABEL_HANDLER_KIND" AS ENUM (\n\t'EXTERNAL_PROCESS'\n);\n\n[INFO] Execute SQL script: 10-tb_label_handler.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_label_handler" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"kind" "runtime"."LABEL_HANDLER_KIND" NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_label_handler"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "uq__tb_label_handler__api_uuid"\n\tUNIQUE ("api_uuid")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_label_handler" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label_handler" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_label_handler" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_label_handler" (\n\t"id" SERIAL NOT NULL,\n\t"api_uuid" UUID NOT NULL,\n\t"kind" "runtime"."LABEL_HANDLER_KIND" NOT NULL,\n\t"topic_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_label_handler"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_topic"\n\tFOREIGN KEY ("topic_id")\n\tREFERENCES "runtime"."tb_topic" ("id"),\n\n\tCONSTRAINT "uq__tb_label_handler__api_uuid"\n\tUNIQUE ("api_uuid")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_label_handler" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label_handler" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_label_handler" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 12-tb_label_handler_external_process.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_label_handler_external_process" (\n\t"id" INT NOT NULL,\n\t"path" VARCHAR(2048) NOT NULL,\n\n\tCONSTRAINT "pk__tb_label_handler_external_process"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_label_handler_external_process__tb_label_handler"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_label_handler" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_label_handler_external_process" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label_handler_external_process" TO "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_label_handler_external_process" (\n\t"id" INT NOT NULL,\n\t"path" VARCHAR(2048) NOT NULL,\n\n\tCONSTRAINT "pk__tb_label_handler_external_process"\n\tPRIMARY KEY ("id"),\n\n\tCONSTRAINT "uq__tb_label_handler_external_process__tb_label_handler"\n\tFOREIGN KEY ("id")\n\tREFERENCES "runtime"."tb_label_handler" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_label_handler_external_process" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_label_handler_external_process" TO "edgebus-local-api";\n
4	v0004	2024-09-04 08:29:17.511592	[INFO] Execute JS script: 01-guards.js\n[TRACE] \nconst EXPECTED_PREVIOUS_VERSION = "v0003"; // change by you own\n\nasync function migration(cancellationToken, sqlConnection, logger) {\n\t{ // Database name guard\n\t\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\t\tif (dbName !== "edgebus-local") {\n\t\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t\t}\n\t}\n\n\t{ // Migration user guard\n\t\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\t\tif (dbUser !== "edgebus-local-owner") {\n\t\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t\t}\n\t}\n\n\t{ // Version guard\n\t\tconst versionRow = await sqlConnection\n\t\t\t.statement('SELECT "version", "utc_deployed_at" FROM "public"."__migration" ORDER BY "version" DESC LIMIT 1')\n\t\t\t.executeSingleOrNull(cancellationToken);\n\n\t\tif (versionRow === null) {\n\t\t\tthrow new Error(`Wrong database! No any migrations found. Expected previous version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\n\t\tconst version = versionRow.get("version").asString;\n\t\tconst deployedAt = versionRow.get("utc_deployed_at").asDate;\n\n\t\tif (version !== EXPECTED_PREVIOUS_VERSION) {\n\t\t\tthrow new Error(`Wrong database! Database version is "${version}" (deployed at ${deployedAt.toISOString()}). Expected version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\t}\n}\n\n[INFO] Execute SQL script: 03-drop-ck__tb_egress_delivery__evidence.sql\n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\n\tDROP CONSTRAINT "ck__tb_egress_delivery__evidence";\n\n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\n\tDROP CONSTRAINT "ck__tb_egress_delivery__evidence";\n\n[INFO] Execute SQL script: 04-drop-uq__tb_egress_delivery__success.sql\n[TRACE] \nDROP INDEX "runtime"."uq__tb_egress_delivery__success";\n\n[TRACE] \nDROP INDEX "runtime"."uq__tb_egress_delivery__success";\n\n[INFO] Execute SQL script: 05-extand-DELIVERY_STATUS.sql\n[TRACE] \nALTER TYPE "runtime"."DELIVERY_STATUS" RENAME TO "DELIVERY_STATUS_OLD";\nCREATE TYPE "runtime"."DELIVERY_STATUS" AS ENUM('SUCCESS', 'FAILURE', 'SKIP');\nALTER TABLE "runtime"."tb_egress_delivery" \n\tALTER COLUMN "status" TYPE "runtime"."DELIVERY_STATUS"\n\tUSING ("status"::TEXT::"runtime"."DELIVERY_STATUS");\nDROP TYPE "runtime"."DELIVERY_STATUS_OLD";\n\n[TRACE] \nALTER TYPE "runtime"."DELIVERY_STATUS" RENAME TO "DELIVERY_STATUS_OLD";\nCREATE TYPE "runtime"."DELIVERY_STATUS" AS ENUM('SUCCESS', 'FAILURE', 'SKIP');\nALTER TABLE "runtime"."tb_egress_delivery" \n\tALTER COLUMN "status" TYPE "runtime"."DELIVERY_STATUS"\n\tUSING ("status"::TEXT::"runtime"."DELIVERY_STATUS");\nDROP TYPE "runtime"."DELIVERY_STATUS_OLD";\n\n[INFO] Execute SQL script: 06-tb_message_label.sql\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_label" (\n\t"label_id" INT NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress_label__integrity"\n\tUNIQUE ("label_id", "egress_id"),\n\n\tCONSTRAINT "fk__tb_egress_label__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_label"\n\tFOREIGN KEY ("label_id")\n\tREFERENCES "runtime"."tb_label" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress_label" to "edgebus-local-api";\n\n[TRACE] \nCREATE TABLE "runtime"."tb_egress_label" (\n\t"label_id" INT NOT NULL,\n\t"egress_id" INT NOT NULL,\n\t"utc_created_date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),\n\t"utc_deleted_date" TIMESTAMP WITHOUT TIME ZONE NULL,\n\n\tCONSTRAINT "pk__tb_egress_label__integrity"\n\tUNIQUE ("label_id", "egress_id"),\n\n\tCONSTRAINT "fk__tb_egress_label__tb_egress"\n\tFOREIGN KEY ("egress_id")\n\tREFERENCES "runtime"."tb_egress" ("id"),\n\n\tCONSTRAINT "fk__tb_message_label__tb_label"\n\tFOREIGN KEY ("label_id")\n\tREFERENCES "runtime"."tb_label" ("id")\n);\n\nGRANT INSERT ON TABLE "runtime"."tb_egress_label" TO "edgebus-local-api";\nGRANT SELECT ON TABLE "runtime"."tb_egress_label" TO "edgebus-local-api";\nGRANT UPDATE ("utc_deleted_date") ON "runtime"."tb_egress_label" to "edgebus-local-api";\n\n[INFO] Execute SQL script: 07-ck__tb_egress_delivery__evidence.sql\n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\n\tADD CONSTRAINT "ck__tb_egress_delivery__evidence"\n\tCHECK (\n\t\t("status" = 'SUCCESS' AND "success_evidence" IS NOT NULL AND "failure_evidence" IS NULL) \n\t\tOR ("status" = 'FAILURE' AND "failure_evidence" IS NOT NULL AND "success_evidence" IS NULL)\n\t\tOR ("status" = 'SKIP' AND "success_evidence" IS NULL AND "failure_evidence" IS NULL)\n\t);\n \n[TRACE] \nALTER TABLE "runtime"."tb_egress_delivery"\n\tADD CONSTRAINT "ck__tb_egress_delivery__evidence"\n\tCHECK (\n\t\t("status" = 'SUCCESS' AND "success_evidence" IS NOT NULL AND "failure_evidence" IS NULL) \n\t\tOR ("status" = 'FAILURE' AND "failure_evidence" IS NOT NULL AND "success_evidence" IS NULL)\n\t\tOR ("status" = 'SKIP' AND "success_evidence" IS NULL AND "failure_evidence" IS NULL)\n\t);\n \n[INFO] Execute SQL script: 08-uq__tb_egress_delivery__success.sql\n[TRACE] \nCREATE UNIQUE INDEX "uq__tb_egress_delivery__success"\nON "runtime"."tb_egress_delivery" ("message_id", "egress_id")\nWHERE "status" = 'SUCCESS';\n\nCOMMENT ON INDEX "runtime"."uq__tb_egress_delivery__success"\nIS 'Only one success message for an egress.';\n\n[TRACE] \nCREATE UNIQUE INDEX "uq__tb_egress_delivery__success"\nON "runtime"."tb_egress_delivery" ("message_id", "egress_id")\nWHERE "status" = 'SUCCESS';\n\nCOMMENT ON INDEX "runtime"."uq__tb_egress_delivery__success"\nIS 'Only one success message for an egress.';\n
5	v0005	2024-09-04 08:29:17.55622	[INFO] Execute JS script: 01-guards.js\n[TRACE] \nconst EXPECTED_PREVIOUS_VERSION = "v0004"; // change by you own\n\nasync function migration(cancellationToken, sqlConnection, logger) {\n\t{ // Database name guard\n\t\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\t\tif (dbName !== "edgebus-local") {\n\t\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t\t}\n\t}\n\n\t{ // Migration user guard\n\t\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\t\tif (dbUser !== "edgebus-local-owner") {\n\t\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t\t}\n\t}\n\n\t{ // Version guard\n\t\tconst versionRow = await sqlConnection\n\t\t\t.statement('SELECT "version", "utc_deployed_at" FROM "public"."__migration" ORDER BY "version" DESC LIMIT 1')\n\t\t\t.executeSingleOrNull(cancellationToken);\n\n\t\tif (versionRow === null) {\n\t\t\tthrow new Error(`Wrong database! No any migrations found. Expected previous version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\n\t\tconst version = versionRow.get("version").asString;\n\t\tconst deployedAt = versionRow.get("utc_deployed_at").asDate;\n\n\t\tif (version !== EXPECTED_PREVIOUS_VERSION) {\n\t\t\tthrow new Error(`Wrong database! Database version is "${version}" (deployed at ${deployedAt.toISOString()}). Expected version: "${EXPECTED_PREVIOUS_VERSION}". Cannot continue.`);\n\t\t}\n\t}\n}\n\n[INFO] Execute SQL script: 03-modify-tb_ingress_httphost.sql\n[TRACE] \nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_status_code" TO "response_static_status_code";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_status_message" TO "response_static_status_message";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_headers" TO "response_static_headers";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_body" TO "response_static_body";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tALTER COLUMN "response_static_status_code" DROP NOT NULL;\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_kind" VARCHAR(32) NOT NULL;\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_dynamic_handler_kind" VARCHAR(32);\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD CONSTRAINT "ck_response_kind"\n\tCHECK ("response_kind" = 'STATIC' OR "response_kind" = 'DYNAMIC');\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_dynamic_handler_external_script_path" VARCHAR(2048);\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD CONSTRAINT "ck_response_handler_kind"\n\tCHECK (\n\t\t(\n\t\t\t"response_kind" = 'STATIC'\n\t\t\tAND\n\t\t\t"response_static_status_code" IS NOT NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_kind" IS NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_external_script_path" IS NULL\n\t\t)\n\t\tOR\n\t\t(\n\t\t\t"response_kind" = 'DYNAMIC'\n\t\t\tAND\n\t\t\t"response_static_status_code" IS NULL\n\t\t\tAND\n\t\t\t"response_static_status_message" IS NULL\n\t\t\tAND\n\t\t\t"response_static_headers" IS NULL\n\t\t\tAND\n\t\t\t"response_static_body" IS NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_kind" = 'EXTERNAL_PROCESS'\n\t\t\tAND\n\t\t\t"response_dynamic_handler_external_script_path" IS NOT NULL\n\t\t)\n\t);\n\n[TRACE] \nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_status_code" TO "response_static_status_code";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_status_message" TO "response_static_status_message";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_headers" TO "response_static_headers";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_body" TO "response_static_body";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tALTER COLUMN "response_static_status_code" DROP NOT NULL;\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_kind" VARCHAR(32) NOT NULL;\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_dynamic_handler_kind" VARCHAR(32);\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD CONSTRAINT "ck_response_kind"\n\tCHECK ("response_kind" = 'STATIC' OR "response_kind" = 'DYNAMIC');\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD COLUMN "response_dynamic_handler_external_script_path" VARCHAR(2048);\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tADD CONSTRAINT "ck_response_handler_kind"\n\tCHECK (\n\t\t(\n\t\t\t"response_kind" = 'STATIC'\n\t\t\tAND\n\t\t\t"response_static_status_code" IS NOT NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_kind" IS NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_external_script_path" IS NULL\n\t\t)\n\t\tOR\n\t\t(\n\t\t\t"response_kind" = 'DYNAMIC'\n\t\t\tAND\n\t\t\t"response_static_status_code" IS NULL\n\t\t\tAND\n\t\t\t"response_static_status_message" IS NULL\n\t\t\tAND\n\t\t\t"response_static_headers" IS NULL\n\t\t\tAND\n\t\t\t"response_static_body" IS NULL\n\t\t\tAND\n\t\t\t"response_dynamic_handler_kind" = 'EXTERNAL_PROCESS'\n\t\t\tAND\n\t\t\t"response_dynamic_handler_external_script_path" IS NOT NULL\n\t\t)\n\t);\n
\.


--
-- Data for Name: __migration_rollback_script; Type: TABLE DATA; Schema: public; Owner: edgebus-local-owner
--

COPY public.__migration_rollback_script (id, version_id, name, kind, file, content) FROM stdin;
1	1	50-schemas-rollback.sql	SQL	/data/v0001/rollback/50-schemas-rollback.sql	DROP SCHEMA "runtime";\n\n
2	1	99-guards.js	JAVASCRIPT	/data/v0001/rollback/99-guards.js	async function migration(cancellationToken, sqlConnection, log) {\n\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\tif (dbName !== "edgebus-local") {\n\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t}\n\n\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\tif (dbUser !== "edgebus-local-owner") {\n\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t}\n}\n
3	2	10-tb_topic.sql	SQL	/data/v0002/rollback/10-tb_topic.sql	DROP TABLE "runtime"."tb_topic";\n
4	2	20-INGRESS_KIND.sql	SQL	/data/v0002/rollback/20-INGRESS_KIND.sql	DROP TYPE "runtime"."INGRESS_KIND";\n
5	2	21-tb_ingress.sql	SQL	/data/v0002/rollback/21-tb_ingress.sql	DROP TABLE "runtime"."tb_ingress";\n
6	2	22-tb_ingress_httphost.sql	SQL	/data/v0002/rollback/22-tb_ingress_httphost.sql	DROP TABLE "runtime"."tb_ingress_httphost";\n
7	2	23-tb_ingress_websocketclient.sql	SQL	/data/v0002/rollback/23-tb_ingress_websocketclient.sql	DROP TABLE "runtime"."tb_ingress_websocketclient";\n
8	2	30-EGRESS_KIND.sql	SQL	/data/v0002/rollback/30-EGRESS_KIND.sql	DROP TYPE "runtime"."EGRESS_KIND";\n
9	2	31-tb_egress.sql	SQL	/data/v0002/rollback/31-tb_egress.sql	DROP TABLE "runtime"."tb_egress";\n
10	2	32-tb_egress_webhook.sql	SQL	/data/v0002/rollback/32-tb_egress_webhook.sql	DROP TABLE "runtime"."tb_egress_webhook";\n
11	2	33-tb_egress_websockethost.sql	SQL	/data/v0002/rollback/33-tb_egress_websockethost.sql	DROP TABLE "runtime"."tb_egress_websockethost";\n
12	2	40-tb_egress_topic.sql	SQL	/data/v0002/rollback/40-tb_egress_topic.sql	DROP TABLE "runtime"."tb_egress_topic";\n
13	2	60-tb_message.sql	SQL	/data/v0002/rollback/60-tb_message.sql	DROP TABLE "runtime"."tb_message";\n
14	2	65-tb_egress_message_queue.sql	SQL	/data/v0002/rollback/65-tb_egress_message_queue.sql	DROP TABLE "runtime"."tb_egress_message_queue";\n
15	2	75-vw_message.sql	SQL	/data/v0002/rollback/75-vw_message.sql	DROP VIEW "runtime"."vw_message";\n
16	2	80-DELIVERY_STATUS.sql	SQL	/data/v0002/rollback/80-DELIVERY_STATUS.sql	DROP TYPE "runtime"."DELIVERY_STATUS";\n
17	2	81-tb_egress_delivery.sql	SQL	/data/v0002/rollback/81-tb_egress_delivery.sql	DROP TABLE "runtime"."tb_egress_delivery";\n
18	2	82-ck__tb_egress_delivery__evidence.sql	SQL	/data/v0002/rollback/82-ck__tb_egress_delivery__evidence.sql	ALTER TABLE "runtime"."tb_egress_delivery"\nDROP CONSTRAINT "ck__tb_egress_delivery__evidence";\n
19	2	83-uq__tb_egress_delivery__success.sql	SQL	/data/v0002/rollback/83-uq__tb_egress_delivery__success.sql	DROP INDEX "runtime"."uq__tb_egress_delivery__success";\n
20	2	99-guards.js	JAVASCRIPT	/data/v0002/rollback/99-guards.js	async function migration(cancellationToken, sqlConnection, log) {\n\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\tif (dbName !== "edgebus-local") {\n\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t}\n\n\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\tif (dbUser !== "edgebus-local-owner") {\n\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t}\n}\n
21	3	04-tb_label.sql	SQL	/data/v0003/rollback/04-tb_label.sql	DROP TABLE "runtime"."tb_label";\n
22	3	06-tb_message_label.sql	SQL	/data/v0003/rollback/06-tb_message_label.sql	DROP TABLE "runtime"."tb_message_label";\n
23	3	08-LABEL_HANDLER_KIND.sql	SQL	/data/v0003/rollback/08-LABEL_HANDLER_KIND.sql	DROP TYPE "runtime"."LABEL_HANDLER_KIND";\n
24	3	10-tb_label_handler.sql	SQL	/data/v0003/rollback/10-tb_label_handler.sql	DROP TABLE "runtime"."tb_label_handler";\n
25	3	12-tb_label_handler_external_process.sql	SQL	/data/v0003/rollback/12-tb_label_handler_external_process.sql	DROP TABLE "runtime"."tb_label_handler_external_process";\n
26	3	99-guards.js	JAVASCRIPT	/data/v0003/rollback/99-guards.js	async function migration(cancellationToken, sqlConnection, log) {\n\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\tif (dbName !== "edgebus-local") {\n\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t}\n\n\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\tif (dbUser !== "edgebus-local-owner") {\n\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t}\n}\n
27	4	03-uq__tb_egress_delivery__success.sql	SQL	/data/v0004/rollback/03-uq__tb_egress_delivery__success.sql	CREATE UNIQUE INDEX "uq__tb_egress_delivery__success"\nON "runtime"."tb_egress_delivery" ("message_id", "egress_id")\nWHERE "status" = 'SUCCESS';\n\nCOMMENT ON INDEX "runtime"."uq__tb_egress_delivery__success"\nIS 'Only one success message for an egress.';\n
28	4	04-ck__tb_egress_delivery__evidence.sql	SQL	/data/v0004/rollback/04-ck__tb_egress_delivery__evidence.sql	ALTER TABLE "runtime"."tb_egress_delivery"\nADD CONSTRAINT "ck__tb_egress_delivery__evidence"\nCHECK (\n\t("status" = 'SUCCESS' AND "success_evidence" IS NOT NULL) \n\tOR\n\t("status" = 'FAILURE' AND "failure_evidence" IS NOT NULL)\n);\n\n
29	4	05-tb_message_label.sql	SQL	/data/v0004/rollback/05-tb_message_label.sql	DROP TABLE "runtime"."tb_egress_label";\n
30	4	06-extand-DELIVERY_STATUS.sql	SQL	/data/v0004/rollback/06-extand-DELIVERY_STATUS.sql	ALTER TYPE "runtime"."DELIVERY_STATUS" RENAME TO "DELIVERY_STATUS_OLD";\nCREATE TYPE "runtime"."DELIVERY_STATUS" AS ENUM('SUCCESS', 'FAILURE');\nALTER TABLE "runtime"."tb_egress_delivery" \n\tALTER COLUMN "status" TYPE "runtime"."DELIVERY_STATUS"\n\tUSING ("status"::TEXT::"runtime"."DELIVERY_STATUS");\nDROP TYPE "runtime"."DELIVERY_STATUS_OLD";\n
31	4	07-drop-uq__tb_egress_delivery__success.sql	SQL	/data/v0004/rollback/07-drop-uq__tb_egress_delivery__success.sql	DROP INDEX "runtime"."uq__tb_egress_delivery__success";\n
32	4	08-drop-ck__tb_egress_delivery__evidence.sql	SQL	/data/v0004/rollback/08-drop-ck__tb_egress_delivery__evidence.sql	ALTER TABLE "runtime"."tb_egress_delivery"\n\tDROP CONSTRAINT "ck__tb_egress_delivery__evidence";\n
33	4	99-guards.js	JAVASCRIPT	/data/v0004/rollback/99-guards.js	async function migration(cancellationToken, sqlConnection, log) {\n\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\tif (dbName !== "edgebus-local") {\n\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t}\n\n\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\tif (dbUser !== "edgebus-local-owner") {\n\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t}\n}\n
34	5	03-restore-tb_ingress_httphost.sql	SQL	/data/v0005/rollback/03-restore-tb_ingress_httphost.sql	ALTER TABLE "runtime"."tb_ingress_httphost"\n\tDROP CONSTRAINT "ck_response_handler_kind";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tDROP COLUMN "response_dynamic_handler_external_script_path";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tDROP CONSTRAINT "ck_response_kind";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tDROP COLUMN "response_dynamic_handler_kind";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tDROP COLUMN "response_kind";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tALTER COLUMN "response_static_status_code" SET NOT NULL;\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_static_body" TO "response_body";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_static_headers" TO "response_headers";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_static_status_message" TO "response_status_message";\n\nALTER TABLE "runtime"."tb_ingress_httphost"\n\tRENAME COLUMN "response_static_status_code" TO "response_status_code";\n
35	5	99-guards.js	JAVASCRIPT	/data/v0005/rollback/99-guards.js	async function migration(cancellationToken, sqlConnection, log) {\n\tconst dbName = (await sqlConnection.statement("SELECT current_database()").executeScalar()).asString;\n\tif (dbName !== "edgebus-local") {\n\t\tthrow new Error(`Wrong database! Current database '${dbName}' is not equals to expected database 'edgebus-local'`);\n\t}\n\n\tconst dbUser = (await sqlConnection.statement("SELECT current_user").executeScalar()).asString;\n\tif (dbUser !== "edgebus-local-owner") {\n\t\tthrow new Error(`Wrong database user! Current database user '${dbUser}' is not equals to expected user 'edgebus-local-owner'`);\n\t}\n}\n
\.


--
-- Data for Name: tb_egress; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress (id, kind, api_uuid, filter_label_policy, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_egress_delivery; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_delivery (id, api_uuid, egress_id, topic_id, message_id, egress_topic_id, status, success_evidence, failure_evidence, utc_created_date) FROM stdin;
\.


--
-- Data for Name: tb_egress_label; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_label (label_id, egress_id, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_egress_message_queue; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_message_queue (id, topic_id, egress_id, message_id) FROM stdin;
\.


--
-- Data for Name: tb_egress_topic; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_topic (id, egress_id, topic_id, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_egress_webhook; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_webhook (id, kind, http_url, http_method) FROM stdin;
\.


--
-- Data for Name: tb_egress_websockethost; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_egress_websockethost (id, kind) FROM stdin;
\.


--
-- Data for Name: tb_ingress; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_ingress (id, kind, api_uuid, topic_id, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_ingress_httphost; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_ingress_httphost (id, kind, path, response_static_status_code, response_static_status_message, response_static_headers, response_static_body, response_kind, response_dynamic_handler_kind, response_dynamic_handler_external_script_path) FROM stdin;
\.


--
-- Data for Name: tb_ingress_websocketclient; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_ingress_websocketclient (id, kind, url) FROM stdin;
\.


--
-- Data for Name: tb_label; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_label (id, api_uuid, value, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_label_handler; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_label_handler (id, api_uuid, kind, topic_id, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_label_handler_external_process; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_label_handler_external_process (id, path) FROM stdin;
\.


--
-- Data for Name: tb_message; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_message (id, api_uuid, topic_id, ingress_id, media_type, body, original_body, headers, utc_created_at) FROM stdin;
\.


--
-- Data for Name: tb_message_label; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_message_label (label_id, message_id, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Data for Name: tb_topic; Type: TABLE DATA; Schema: runtime; Owner: edgebus-local-owner
--

COPY runtime.tb_topic (id, api_uuid, domain, name, description, media_type, utc_created_date, utc_deleted_date) FROM stdin;
\.


--
-- Name: __migration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('public.__migration_id_seq', 5, true);


--
-- Name: __migration_rollback_script_id_seq; Type: SEQUENCE SET; Schema: public; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('public.__migration_rollback_script_id_seq', 35, true);


--
-- Name: tb_egress_delivery_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_egress_delivery_id_seq', 1, false);


--
-- Name: tb_egress_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_egress_id_seq', 1, false);


--
-- Name: tb_egress_message_queue_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_egress_message_queue_id_seq', 1, false);


--
-- Name: tb_egress_topic_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_egress_topic_id_seq', 1, false);


--
-- Name: tb_ingress_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_ingress_id_seq', 1, false);


--
-- Name: tb_label_handler_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_label_handler_id_seq', 1, false);


--
-- Name: tb_label_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_label_id_seq', 1, false);


--
-- Name: tb_message_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_message_id_seq', 1, false);


--
-- Name: tb_topic_id_seq; Type: SEQUENCE SET; Schema: runtime; Owner: edgebus-local-owner
--

SELECT pg_catalog.setval('runtime.tb_topic_id_seq', 1, false);


--
-- Name: __migration __migration_pkey; Type: CONSTRAINT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration
    ADD CONSTRAINT __migration_pkey PRIMARY KEY (id);


--
-- Name: __migration_rollback_script __migration_rollback_script_pkey; Type: CONSTRAINT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration_rollback_script
    ADD CONSTRAINT __migration_rollback_script_pkey PRIMARY KEY (id);


--
-- Name: __migration __migration_version_key; Type: CONSTRAINT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration
    ADD CONSTRAINT __migration_version_key UNIQUE (version);


--
-- Name: tb_egress pk__tb_egress; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress
    ADD CONSTRAINT pk__tb_egress PRIMARY KEY (id);


--
-- Name: tb_egress pk__tb_egress__kind__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress
    ADD CONSTRAINT pk__tb_egress__kind__integrity UNIQUE (id, kind);


--
-- Name: tb_egress_delivery pk__tb_egress_delivery; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT pk__tb_egress_delivery PRIMARY KEY (id);


--
-- Name: tb_egress_webhook pk__tb_egress_http_client; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_webhook
    ADD CONSTRAINT pk__tb_egress_http_client PRIMARY KEY (id);


--
-- Name: tb_egress_label pk__tb_egress_label__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_label
    ADD CONSTRAINT pk__tb_egress_label__integrity UNIQUE (label_id, egress_id);


--
-- Name: tb_egress_message_queue pk__tb_egress_message_queue; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue
    ADD CONSTRAINT pk__tb_egress_message_queue PRIMARY KEY (id);


--
-- Name: tb_egress_topic pk__tb_egress_topic; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_topic
    ADD CONSTRAINT pk__tb_egress_topic PRIMARY KEY (id);


--
-- Name: tb_egress_topic pk__tb_egress_topic__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_topic
    ADD CONSTRAINT pk__tb_egress_topic__integrity UNIQUE (id, egress_id, topic_id);


--
-- Name: tb_egress_websockethost pk__tb_egress_websockethost; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_websockethost
    ADD CONSTRAINT pk__tb_egress_websockethost PRIMARY KEY (id);


--
-- Name: tb_ingress pk__tb_ingress; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress
    ADD CONSTRAINT pk__tb_ingress PRIMARY KEY (id);


--
-- Name: tb_ingress pk__tb_ingress__kind__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress
    ADD CONSTRAINT pk__tb_ingress__kind__integrity UNIQUE (id, kind);


--
-- Name: tb_ingress pk__tb_ingress__topic__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress
    ADD CONSTRAINT pk__tb_ingress__topic__integrity UNIQUE (id, topic_id);


--
-- Name: tb_label pk__tb_label; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label
    ADD CONSTRAINT pk__tb_label PRIMARY KEY (id);


--
-- Name: tb_label_handler pk__tb_label_handler; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler
    ADD CONSTRAINT pk__tb_label_handler PRIMARY KEY (id);


--
-- Name: tb_label_handler_external_process pk__tb_label_handler_external_process; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler_external_process
    ADD CONSTRAINT pk__tb_label_handler_external_process PRIMARY KEY (id);


--
-- Name: tb_message_label pk__tb_massage_label__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message_label
    ADD CONSTRAINT pk__tb_massage_label__integrity UNIQUE (label_id, message_id);


--
-- Name: tb_message pk__tb_message; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT pk__tb_message PRIMARY KEY (id);


--
-- Name: tb_message pk__tb_message__topic__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT pk__tb_message__topic__integrity UNIQUE (id, topic_id);


--
-- Name: tb_message pk__tb_message__topic_ingress__integrity; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT pk__tb_message__topic_ingress__integrity UNIQUE (id, topic_id, ingress_id);


--
-- Name: tb_ingress_httphost tb_ingress_httphost_pkey; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_httphost
    ADD CONSTRAINT tb_ingress_httphost_pkey PRIMARY KEY (id);


--
-- Name: tb_ingress_websocketclient tb_ingress_websocketclient_pkey; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_websocketclient
    ADD CONSTRAINT tb_ingress_websocketclient_pkey PRIMARY KEY (id);


--
-- Name: tb_topic tb_topic_pkey; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_topic
    ADD CONSTRAINT tb_topic_pkey PRIMARY KEY (id);


--
-- Name: tb_egress uq__tb_egress__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress
    ADD CONSTRAINT uq__tb_egress__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_egress_delivery uq__tb_egress_delivery__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT uq__tb_egress_delivery__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_ingress uq__tb_ingress__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress
    ADD CONSTRAINT uq__tb_ingress__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_label uq__tb_label__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label
    ADD CONSTRAINT uq__tb_label__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_label_handler uq__tb_label_handler__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler
    ADD CONSTRAINT uq__tb_label_handler__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_message uq__tb_message__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT uq__tb_message__api_uuid UNIQUE (api_uuid);


--
-- Name: tb_topic uq__tb_topic__api_uuid; Type: CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_topic
    ADD CONSTRAINT uq__tb_topic__api_uuid UNIQUE (api_uuid);


--
-- Name: uq__tb_egress_delivery__success; Type: INDEX; Schema: runtime; Owner: edgebus-local-owner
--

CREATE UNIQUE INDEX uq__tb_egress_delivery__success ON runtime.tb_egress_delivery USING btree (message_id, egress_id) WHERE (status = 'SUCCESS'::runtime."DELIVERY_STATUS");


--
-- Name: INDEX uq__tb_egress_delivery__success; Type: COMMENT; Schema: runtime; Owner: edgebus-local-owner
--

COMMENT ON INDEX runtime.uq__tb_egress_delivery__success IS 'Only one success message for an egress.';


--
-- Name: uq__tb_egress_topic__success; Type: INDEX; Schema: runtime; Owner: edgebus-local-owner
--

CREATE UNIQUE INDEX uq__tb_egress_topic__success ON runtime.tb_egress_topic USING btree (topic_id, egress_id) WHERE (utc_deleted_date IS NULL);


--
-- Name: uq__tb_label__value; Type: INDEX; Schema: runtime; Owner: edgebus-local-owner
--

CREATE UNIQUE INDEX uq__tb_label__value ON runtime.tb_label USING btree (value) WHERE (utc_deleted_date IS NULL);


--
-- Name: uq__tb_topic__doman_name; Type: INDEX; Schema: runtime; Owner: edgebus-local-owner
--

CREATE UNIQUE INDEX uq__tb_topic__doman_name ON runtime.tb_topic USING btree (domain, name) WHERE ((domain IS NOT NULL) AND (utc_deleted_date IS NULL));


--
-- Name: uq__tb_topic__name; Type: INDEX; Schema: runtime; Owner: edgebus-local-owner
--

CREATE UNIQUE INDEX uq__tb_topic__name ON runtime.tb_topic USING btree (name) WHERE ((domain IS NULL) AND (utc_deleted_date IS NULL));


--
-- Name: __migration_rollback_script fk____migration_rollback_script____migration; Type: FK CONSTRAINT; Schema: public; Owner: edgebus-local-owner
--

ALTER TABLE ONLY public.__migration_rollback_script
    ADD CONSTRAINT fk____migration_rollback_script____migration FOREIGN KEY (version_id) REFERENCES public.__migration(id);


--
-- Name: tb_egress_delivery fk__tb_egress_delivery__tb_topic__integrity_1; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_delivery__tb_topic__integrity_1 FOREIGN KEY (message_id, topic_id) REFERENCES runtime.tb_message(id, topic_id);


--
-- Name: tb_egress_delivery fk__tb_egress_delivery__tb_topic__integrity_2; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_delivery__tb_topic__integrity_2 FOREIGN KEY (egress_topic_id, egress_id, topic_id) REFERENCES runtime.tb_egress_topic(id, egress_id, topic_id);


--
-- Name: tb_egress_webhook fk__tb_egress_http_client__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_webhook
    ADD CONSTRAINT fk__tb_egress_http_client__tb_egress FOREIGN KEY (id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_label fk__tb_egress_label__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_label
    ADD CONSTRAINT fk__tb_egress_label__tb_egress FOREIGN KEY (egress_id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_message_queue fk__tb_egress_message_queue__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_egress FOREIGN KEY (egress_id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_delivery fk__tb_egress_message_queue__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_egress FOREIGN KEY (egress_id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_delivery fk__tb_egress_message_queue__tb_egress_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_egress_topic FOREIGN KEY (egress_topic_id) REFERENCES runtime.tb_egress_topic(id);


--
-- Name: tb_egress_message_queue fk__tb_egress_message_queue__tb_message; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_message FOREIGN KEY (message_id) REFERENCES runtime.tb_message(id);


--
-- Name: tb_egress_delivery fk__tb_egress_message_queue__tb_message; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_message FOREIGN KEY (message_id) REFERENCES runtime.tb_message(id);


--
-- Name: tb_egress_message_queue fk__tb_egress_message_queue__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_egress_delivery fk__tb_egress_message_queue__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_delivery
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_egress_message_queue fk__tb_egress_message_queue__tb_topic__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_message_queue
    ADD CONSTRAINT fk__tb_egress_message_queue__tb_topic__integrity FOREIGN KEY (message_id, topic_id) REFERENCES runtime.tb_message(id, topic_id);


--
-- Name: tb_egress_topic fk__tb_egress_topic__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_topic
    ADD CONSTRAINT fk__tb_egress_topic__tb_egress FOREIGN KEY (egress_id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_topic fk__tb_egress_topic__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_topic
    ADD CONSTRAINT fk__tb_egress_topic__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_egress_websockethost fk__tb_egress_websockethost__tb_egress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_websockethost
    ADD CONSTRAINT fk__tb_egress_websockethost__tb_egress FOREIGN KEY (id) REFERENCES runtime.tb_egress(id);


--
-- Name: tb_egress_websockethost fk__tb_egress_websockethost__tb_ingress__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_websockethost
    ADD CONSTRAINT fk__tb_egress_websockethost__tb_ingress__integrity FOREIGN KEY (id, kind) REFERENCES runtime.tb_egress(id, kind);


--
-- Name: tb_ingress fk__tb_ingress__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress
    ADD CONSTRAINT fk__tb_ingress__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_ingress_httphost fk__tb_ingress_httphost__tb_ingress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_httphost
    ADD CONSTRAINT fk__tb_ingress_httphost__tb_ingress FOREIGN KEY (id) REFERENCES runtime.tb_ingress(id);


--
-- Name: tb_ingress_websocketclient fk__tb_ingress_httphost__tb_ingress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_websocketclient
    ADD CONSTRAINT fk__tb_ingress_httphost__tb_ingress FOREIGN KEY (id) REFERENCES runtime.tb_ingress(id);


--
-- Name: tb_ingress_httphost fk__tb_ingress_httphost__tb_ingress__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_httphost
    ADD CONSTRAINT fk__tb_ingress_httphost__tb_ingress__integrity FOREIGN KEY (id, kind) REFERENCES runtime.tb_ingress(id, kind);


--
-- Name: tb_ingress_websocketclient fk__tb_ingress_httphost__tb_ingress__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_ingress_websocketclient
    ADD CONSTRAINT fk__tb_ingress_httphost__tb_ingress__integrity FOREIGN KEY (id, kind) REFERENCES runtime.tb_ingress(id, kind);


--
-- Name: tb_egress_webhook fk__tb_ingress_httphost__tb_ingress__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_webhook
    ADD CONSTRAINT fk__tb_ingress_httphost__tb_ingress__integrity FOREIGN KEY (id, kind) REFERENCES runtime.tb_egress(id, kind);


--
-- Name: tb_message fk__tb_message__tb_ingress; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT fk__tb_message__tb_ingress FOREIGN KEY (ingress_id) REFERENCES runtime.tb_ingress(id);


--
-- Name: tb_message fk__tb_message__tb_ingress__integrity; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT fk__tb_message__tb_ingress__integrity FOREIGN KEY (ingress_id, topic_id) REFERENCES runtime.tb_ingress(id, topic_id);


--
-- Name: tb_message fk__tb_message__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message
    ADD CONSTRAINT fk__tb_message__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_message_label fk__tb_message_label__tb_label; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message_label
    ADD CONSTRAINT fk__tb_message_label__tb_label FOREIGN KEY (label_id) REFERENCES runtime.tb_label(id);


--
-- Name: tb_egress_label fk__tb_message_label__tb_label; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_egress_label
    ADD CONSTRAINT fk__tb_message_label__tb_label FOREIGN KEY (label_id) REFERENCES runtime.tb_label(id);


--
-- Name: tb_message_label fk__tb_message_label__tb_message; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_message_label
    ADD CONSTRAINT fk__tb_message_label__tb_message FOREIGN KEY (message_id) REFERENCES runtime.tb_message(id);


--
-- Name: tb_label_handler fk__tb_message_label__tb_topic; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler
    ADD CONSTRAINT fk__tb_message_label__tb_topic FOREIGN KEY (topic_id) REFERENCES runtime.tb_topic(id);


--
-- Name: tb_label_handler_external_process uq__tb_label_handler_external_process__tb_label_handler; Type: FK CONSTRAINT; Schema: runtime; Owner: edgebus-local-owner
--

ALTER TABLE ONLY runtime.tb_label_handler_external_process
    ADD CONSTRAINT uq__tb_label_handler_external_process__tb_label_handler FOREIGN KEY (id) REFERENCES runtime.tb_label_handler(id);


--
-- Name: TABLE tb_egress; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress TO "edgebus-local-api";


--
-- Name: COLUMN tb_egress.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_egress TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_delivery; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress_delivery TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_label; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress_label TO "edgebus-local-api";


--
-- Name: COLUMN tb_egress_label.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_egress_label TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_message_queue; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT,DELETE ON TABLE runtime.tb_egress_message_queue TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_topic; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress_topic TO "edgebus-local-api";


--
-- Name: COLUMN tb_egress_topic.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_egress_topic TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_webhook; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress_webhook TO "edgebus-local-api";


--
-- Name: TABLE tb_egress_websockethost; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_egress_websockethost TO "edgebus-local-api";


--
-- Name: TABLE tb_ingress; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_ingress TO "edgebus-local-api";


--
-- Name: COLUMN tb_ingress.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_ingress TO "edgebus-local-api";


--
-- Name: TABLE tb_ingress_httphost; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_ingress_httphost TO "edgebus-local-api";


--
-- Name: TABLE tb_ingress_websocketclient; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_ingress_websocketclient TO "edgebus-local-api";


--
-- Name: TABLE tb_label; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_label TO "edgebus-local-api";


--
-- Name: COLUMN tb_label.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_label TO "edgebus-local-api";


--
-- Name: TABLE tb_label_handler; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_label_handler TO "edgebus-local-api";


--
-- Name: COLUMN tb_label_handler.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_label_handler TO "edgebus-local-api";


--
-- Name: TABLE tb_label_handler_external_process; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_label_handler_external_process TO "edgebus-local-api";


--
-- Name: TABLE tb_message; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_message TO "edgebus-local-api";


--
-- Name: TABLE tb_message_label; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_message_label TO "edgebus-local-api";


--
-- Name: COLUMN tb_message_label.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_message_label TO "edgebus-local-api";


--
-- Name: TABLE tb_topic; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT,INSERT ON TABLE runtime.tb_topic TO "edgebus-local-api";


--
-- Name: COLUMN tb_topic.description; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(description) ON TABLE runtime.tb_topic TO "edgebus-local-api";


--
-- Name: COLUMN tb_topic.utc_deleted_date; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT UPDATE(utc_deleted_date) ON TABLE runtime.tb_topic TO "edgebus-local-api";


--
-- Name: TABLE vw_message; Type: ACL; Schema: runtime; Owner: edgebus-local-owner
--

GRANT SELECT ON TABLE runtime.vw_message TO "edgebus-local-api";


--
-- PostgreSQL database dump complete
--

