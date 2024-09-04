#!/bin/bash
#

set -e
set -o pipefail

# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

RUN_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yaml"

set +e

if [ -f "${RUN_COMPOSE_FILE}" ]; then
  echo "Looks like you have been bring up local deployment (docker-compose.yaml is presented). Try to execute 'down.sh' before or remove file docker-compose.yaml manually." >&2
  exit 1
fi


FORCE_PULL="no"

# Check args
while [ "$1" != "" ]; do
	case "$1" in
		--force-pull)
			FORCE_PULL="yes"
			;;
		--)
			shift
			break
			;;
		*)
			echo "Unexpected argument '$1'" >&2
			exit 1
			;;
	esac
	shift
done

if [ ! -f "${SCRIPT_DIR}/startup.config.local" ]; then
	cat <<EOF >> "${SCRIPT_DIR}/startup.config.local"
#
# Use this file for override startup configuration variables defined in the file startup.config
#

EOF
fi

if [ ! -f "${SCRIPT_DIR}/configs/edgebus/edgebus.local.toml" ]; then
	cat <<EOF >> "${SCRIPT_DIR}/configs/edgebus/edgebus.local.toml"
#
# Use this file for override EdgeBus configuration defined in the file configs/edgebus/edgebus.toml
#

#
# Example of add additional topic "my-topic-3-toml"
#
# Use all topics (my-topic-1, my-topic-2 and my-topic-3-toml)
#"edgebus.setup.topic.indexes" = "TOPC0730c8b1ebdd4761b90e82f59f140c32 TOPC950f617737c34befb2362bc1e7635ac1 TOPC201f5dddf40e4ef9b6b9de17ad37bb76"
#[[edgebus.setup.topic]]
#	index = "TOPC201f5dddf40e4ef9b6b9de17ad37bb76"
#	name = "my-topic-3-toml"
#	description = "Some messages 3 defined in edgebus.local.toml"
#	mediaType = "application/json"

EOF
fi

if [ ! -f "${SCRIPT_DIR}/configs/edgebus/edgebus.local.env" ]; then
	cat <<EOF >> "${SCRIPT_DIR}/configs/edgebus/edgebus.local.env"
#
# Use this file for override EdgeBus configuration defined in the files configs/edgebus/edgebus.toml and configs/edgebus/edgebus.local.toml
#

#
# Example of add additional topic "my-topic-3-env"
#
# Use all topics (my-topic-1, my-topic-2 and my-topic-3-env)
#edgebus.setup.topic.indexes=TOPC0730c8b1ebdd4761b90e82f59f140c32 TOPC950f617737c34befb2362bc1e7635ac1 TOPC201f5dddf40e4ef9b6b9de17ad37bb76
#edgebus.setup.topic.TOPC201f5dddf40e4ef9b6b9de17ad37bb76.name=my-topic-3-env
#edgebus.setup.topic.TOPC201f5dddf40e4ef9b6b9de17ad37bb76.description=Some messages 3 defined in edgebus.local.env
#edgebus.setup.topic.TOPC201f5dddf40e4ef9b6b9de17ad37bb76.mediaType=application/json

EOF
fi

set -e

# alias curl='docker run --rm --tty rancher/curl 2>/dev/null'
#alias jq='docker run --rm --tty ...'
#alias yq='docker run --rm --tty ...'

# set +e
# jq --version >/dev/null 2>&1
# if [ $? -ne 0 ]; then
# 	echo "You have to install 'jq' utility." >&2
# 	exit 1
# fi

# yq --version >/dev/null 2>&1
# if [ $? -ne 0 ]; then
# 	echo "You have to install 'yq' utility." >&2
# 	exit 1
# fi
# set -e

echo "Resolving startup.config* files ..."

# Resolve symlink case
if [ "$(uname)" = "Darwin" ]; then
	export IS_LINUX_HOST=""

	#  Mac OS X platform
	if [ -L "${SCRIPT_DIR}/startup.config.local" ]; then
		STARTUP_LOCAL_CONFIG_FILE=$(readlink "${SCRIPT_DIR}/startup.config.local")
	else
		STARTUP_LOCAL_CONFIG_FILE="${SCRIPT_DIR}/startup.config.local"
	fi
else
	export IS_LINUX_HOST="yes"

	STARTUP_LOCAL_CONFIG_FILE=$(readlink --canonicalize "${SCRIPT_DIR}/startup.config.local")
	STARTUP_SHARED_CONFIG_FILE=$(readlink --canonicalize "${SCRIPT_DIR}/startup.config.shared")
fi
export RUN_DOMAIN="$(hostname -d)"
export RUN_HOSTNAME="$(hostname -s)"


echo "Generating ${RUN_COMPOSE_FILE} ..."

cat "${SCRIPT_DIR}/docker-compose.yaml.mustache" | \
  docker run \
    --interactive --rm \
    --mount "type=bind,source=${SCRIPT_DIR}/startup.config,target=/tmp/startup.config" \
    --mount "type=bind,source=${STARTUP_LOCAL_CONFIG_FILE},target=/tmp/startup.config.local" \
    --env IS_LINUX_HOST --env RUN_DOMAIN --env RUN_HOSTNAME \
    theanurin/configuration-templates:20231204 \
      --engine mustache \
      --config-file=/tmp/startup.config \
      --config-env \
      --config-file=/tmp/startup.config.local \
    > "${RUN_COMPOSE_FILE}.tmp"
mv "${RUN_COMPOSE_FILE}.tmp" "${RUN_COMPOSE_FILE}"
echo

if [ "${FORCE_PULL}" == "yes" ]; then
	echo
	# echo "Pulling images with '--quiet'... Be patient..."
	#docker compose --project-name "edgebus-local-deployment" --file "${RUN_COMPOSE_FILE}" pull --quiet
	echo "Pulling images... Be patient..."
	docker compose --project-name "edgebus-local-deployment" --file "${RUN_COMPOSE_FILE}" pull
	echo
fi

echo
echo "Launching Docker Compose for ${RUN_COMPOSE_FILE} ..."
exec docker compose --project-name "edgebus-local-deployment" --file "${RUN_COMPOSE_FILE}" up "$@"
