# EdgeBus PostgreSQL Database

## Quick Start

1. Ensure your have been started **deployment-local** Docker Compose (see separate repo for `deployment-local`) that provides PostgreSQL server.
1. Use `./postgres/migration-up.sh local` script to migrate up to latest version
1. Use `./postgres/migration-down.sh` script to migrate down to current production version
1. Use `./postgres/seed.sh` script to apply seed scripts
1. Also you may use `./postgres/migration-build.sh` script to build migration scripts (but this call included by default into `migration-up.sh`)

---
