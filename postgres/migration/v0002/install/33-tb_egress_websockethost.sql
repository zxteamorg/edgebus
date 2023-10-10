CREATE TABLE "{{database.schema.runtime.name}}"."tb_egress_websockethost" (
	"id" INT NOT NULL,
	"kind" "{{database.schema.runtime.name}}"."EGRESS_KIND" NOT NULL,

	CONSTRAINT "pk__tb_egress_websockethost"
	PRIMARY KEY ("id"),

	CONSTRAINT "ck__tb_egress_websockethost__kind"
	CHECK ("kind" = 'WEB_SOCKET_HOST'),
	
	CONSTRAINT "fk__tb_egress_websockethost__tb_egress"
	FOREIGN KEY ("id")
	REFERENCES "{{database.schema.runtime.name}}"."tb_egress" ("id"),

	CONSTRAINT "fk__tb_egress_websockethost__tb_ingress__integrity"
	FOREIGN KEY ("id", "kind")
	REFERENCES "{{database.schema.runtime.name}}"."tb_egress" ("id", "kind")
);

GRANT INSERT ON TABLE "{{database.schema.runtime.name}}"."tb_egress_websockethost" TO "{{database.user.api}}";
GRANT SELECT ON TABLE "{{database.schema.runtime.name}}"."tb_egress_websockethost" TO "{{database.user.api}}";
