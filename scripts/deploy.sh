#!/usr/bin/env bash
# Every deploy is a release. Rules and steps for all Arrow apps: ../pi-ops/docs/deploy-conventions.md
#
#   scripts/deploy.sh          # 0.1.1-SNAPSHOT -> release 0.1.1, then 0.1.2-SNAPSHOT
#   scripts/deploy.sh 0.2.0    # minor/major only on request
set -euo pipefail

cd "$(dirname "$0")/.."
PI_OPS_PATH="${PI_OPS_PATH:-../pi-ops}"
exec "$PI_OPS_PATH/scripts/release-maven.sh" dash "$@"
