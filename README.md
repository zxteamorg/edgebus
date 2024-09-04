|                  | `docs` | `service-typescript`                                                                                                   |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Branch `#dev`    | TBD    | [![Badge - TypeScript Service Snapshot (#dev)][service-typescript#dev-badge]][service-typescript#dev-actions]          |
| Branch `#master` | TBD    | [![Badge - TypeScript Service Snapshot (#master)][service-typescript#master-badge]][service-typescript#master-actions] |
| Tag              | TBD    | [![Badge - TypeScript Service Release][service-typescript-tag-badge]][service-typescript-tag-actions]                  |

# EdgeBus

[EdgeBus](https://docs.edgebus.io) is an application level network edge bus that adds connectivity, auditability, and observability to your apps with no code changes.

## Get Started

1. **!IMPORTANT!** Read about how Git [manages multiple working trees](https://git-scm.com/docs/git-worktree). This repository uses multiple trees approach based on [orphan](https://git-scm.com/docs/git-checkout#Documentation/git-checkout.txt---orphanltnew-branchgt) branches.
1. Clone the repository
   ```shell
   git clone --branch workspace git@github.com:edgebus/edgebus.git
   cd edgebus
   ```
1. Initialize [worktree](https://git-scm.com/docs/git-worktree) by execute following commands
   ```shell
   git worktree add database              "database#master"
   git worktree add docs                  "docs#master"
   git worktree add console-dart          "console-dart#master"
   git worktree add sdk-dart              "sdk-dart#master"
   git worktree add service-typescript    "service-typescript#master"
   ```
1. Open VSCode Workspace
   ```shell
   code "EdgeBus.code-workspace"
   ```

## Local Deployment

**Local Deployment** - is a set of shell scripts to generate `docker-compose.yaml` file and launch the project using [Docker Compose](https://docs.docker.com/compose/) especially for local development.

- [ ] Login Docker to GitHub Container Registry with scope at least `read:packages`. See how to [Authenticating with a personal access token](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-with-a-personal-access-token-classic).
- [ ] (Optionally) Create a file `startup.config.local`. Use this file for override startup configuration variables defined in the file `startup.config`.
- [ ] Up local deployment zone by call one of
  - in foreground
    - (force pull new images): `./up.sh --force-pull; sleep 1; ./down.sh`
    - `./up.sh; sleep 1; ./down.sh`
  - in background
    - start (force pull new images): `./up.sh --force-pull -- --detach`
    - start : `./up.sh -- --detach`
    - stop: `./down.sh`

Note: for `up.sh` all arguments after `--` are passing to `docker compose`)

![Local Deployment Diagram](local-deployment-diagram.drawio.svg)

### Resources over port mapping

#### Infra (on Docker host)

- [52010 pgAdmin](http://127.0.0.1:52010)
- [52011 Redis Commander](http://127.0.0.1:52011)
- 52000 PostgreSQL endpoint `postgres://devadmin@127.0.0.1:52000/devdb`
- 52001 Redis Endpoint `redis://127.0.0.1:52001`
- 52003 HTTP Dump

#### Runtime (on Docker host)

- [12001 EdgeBus Management Endpoint](http://127.0.0.1:12001)
  - [EdgeBus Bull Dashboard](http://127.0.0.1:12001/admin/queues/)
- [12003 EdgeBus Egress Endpoint](http://127.0.0.1:12003)
- [12010 EdgeBus Ingress 0](http://127.0.0.1:12010)
- [12011 EdgeBus Ingress 1](http://127.0.0.1:12011)

## Workspace

| Branch                                                             | Description                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| [workspace](./tree/workspace)                                      | Current branch                                               |
| [docs](../../tree/docs)                                            | Sources of [EdgeBus documentation](https://docs.edgebus.io). |
| [src-dart-console](../../tree/src-dart-console#master)             | Dart sources of an Administrator Console Web Application.    |
| [src-typescript-service](../../tree/src-typescript-service#master) | TypeScript sources of a Service Application.                 |

## Known Issues

- pgAdmin does not setup servers list if stop initial launch

## Notes

### Add new orphan branch to the worktree

```shell
NEW_BRANCH=...
git worktree add --detach "./${NEW_BRANCH}"
cd "./${NEW_BRANCH}"
git checkout --orphan "${NEW_BRANCH}"
git reset --hard
git commit --allow-empty -m "Initial Commit"
git push origin "${NEW_BRANCH}"
```

### Docker

- Cleanup Docker volumes
  ```shell
  docker volume prune
  ```
- Cleanup Docker all (images, networks, volumes)
  ```shell
  docker system prune --all --volumes
  ```

### Follow Logs

```shell
docker logs --follow edgebus-local-deployment-edgebus-1
```

[service-typescript#master-badge]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-snapshot.yml/badge.svg?branch=service-typescript%23master
[service-typescript#master-actions]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-snapshot.yml?query=branch%3Aservice-typescript%23master
[service-typescript#dev-badge]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-snapshot.yml/badge.svg?branch=service-typescript%23dev
[service-typescript#dev-actions]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-snapshot.yml?query=branch%3Aservice-typescript%23dev
[service-typescript-tag-badge]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-release.yml/badge.svg
[service-typescript-tag-actions]: https://github.com/edgebus/edgebus/actions/workflows/service-typescript-docker-image-release.yml
