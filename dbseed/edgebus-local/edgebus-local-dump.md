# Evaluate SQL dump

```shell
docker network create edgebus-local-tier
cd edgebus/deployment-local
docker run --rm --detach --publish 52000:5432 \
  --network edgebus-local-tier --name edgebus-dump-pg \
  --mount  type=bind,source="${PWD}/dbseed/11-edgebus-users.sql",target=/dbseed/11-edgebus-users.sql \
  --mount  type=bind,source="${PWD}/dbseed/12-edgebus-database.sql",target=/dbseed/12-edgebus-database.sql \
  --mount  type=bind,source="${PWD}/dbseed/edgebus-local/10-extensions.sql",target=/dbseed/edgebus-local/10-extensions.sql \
  theanurin/devel.postgres-15
```

```shell
#psql postgres://postgres@127.0.0.1:52000/devdb -c 'DROP TABLE "public"."emptytestflag"'


cd edgebus/database/postgres/
./migration-build.sh local

docker run --network=edgebus-local-tier \
  --rm --interactive --tty \
  --env "DB_URL=postgres://edgebus-local-owner@edgebus-dump-pg:5432/edgebus-local" \
  --env "DB_TARGET_VERSION=v9999" \
  --env LOG_LEVEL=info \
  --volume "${PWD}/.dist:/data" \
  theanurin/sqlmigrationrunner:1.0 \
    install --no-sleep

cd edgebus/deployment-local
pg_dump postgres://postgres@127.0.0.1:52000/edgebus-local > dbseed/edgebus-local/edgebus-local-dump.sql

docker stop edgebus-dump-pg
docker network rm edgebus-local-tier
```
