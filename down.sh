#!/bin/bash
#

set -e

# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

RUN_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yaml"

if [ ! -f "${RUN_COMPOSE_FILE}" ]; then
  echo "Looks like local deployment is not started (docker-compose.yaml is exist). Nothing to to. Exiting." >&2
  exit 1
fi

docker compose --project-name "edgebus-local-deployment" --file "${RUN_COMPOSE_FILE}" down $*

rm "${RUN_COMPOSE_FILE}"
