#!/bin/bash
#

SOURCE=${BASH_SOURCE[0]}
while [ -L "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )
  SOURCE=$(readlink "$SOURCE")
  [[ $SOURCE != /* ]] && SOURCE=$DIR/$SOURCE # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR=$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )

export BUILD_CONFIGURATION="${1}"

if [ -z "${BUILD_CONFIGURATION}" ]; then
  export BUILD_CONFIGURATION="local"
fi

docker run --interactive --tty --rm \
  --mount type=bind,source="${DIR}",target=/data \
  --env BUILD_CONFIGURATION="${BUILD_CONFIGURATION}" \
  --env SOURCE_PATH=migration \
  theanurin/sqlmigrationbuilder:2.0
