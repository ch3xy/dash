#!/usr/bin/env bash
# Every deploy is a release: releases the current snapshot (0.1.1-SNAPSHOT -> 0.1.1) or the given
# version, commits "Release <version>", tags v<version> and builds the production jar from that commit.
# Then pom.xml moves on to the next patch snapshot (0.1.2-SNAPSHOT) and the jar is deployed to the Pi
# via pi-ops. Requires a committed working tree; pushing stays a separate step.
#
#   scripts/deploy.sh          # 0.1.1-SNAPSHOT -> release 0.1.1, then 0.1.2-SNAPSHOT
#   scripts/deploy.sh 0.2.0    # minor/major only on request
set -euo pipefail

APP_NAME=dash
cd "$(dirname "$0")/.."
PI_OPS_PATH="${PI_OPS_PATH:-../pi-ops}"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uncommitted changes: commit them first, a release must match a commit." >&2
  exit 1
fi

current="$(./mvnw -q help:evaluate -Dexpression=project.version -DforceStdout)"

if [ $# -gt 0 ]; then
  next="$1"
elif [[ "$current" == *-SNAPSHOT ]]; then
  next="${current%-SNAPSHOT}"
else
  IFS=. read -r major minor patch <<< "$current"
  next="$major.$minor.$((patch + 1))"
fi

IFS=. read -r major minor patch <<< "$next"
snapshot="$major.$minor.$((patch + 1))-SNAPSHOT"

echo "Release $current -> $next"
./mvnw -q versions:set -DnewVersion="$next" -DgenerateBackupPoms=false
git commit -q -m "Release $next" pom.xml
git tag "v$next"

# Tests run before committing; the release build only packages
./mvnw -q -Pprod clean package -DskipTests

./mvnw -q versions:set -DnewVersion="$snapshot" -DgenerateBackupPoms=false
git commit -q -m "Prepare next development version $snapshot" pom.xml

staging=target/deploy
rm -rf "$staging"
mkdir -p "$staging"
cp "target/$APP_NAME-$next.jar" "$staging/app.jar"
APP_NAME="$APP_NAME" APP_LOCAL_PATH="$PWD/$staging" "$PI_OPS_PATH/scripts/deploy-app.sh"

echo "Deployed $APP_NAME $next ($(git rev-parse --short "v$next")), pom.xml is now $snapshot"
