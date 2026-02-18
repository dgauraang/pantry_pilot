#!/usr/bin/env sh
set -eu

MODE="${1:-dev}"
PREP_ONLY="${2:-}"

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    sqlite:/*)
      export DATABASE_URL="file:${DATABASE_URL#sqlite:}"
      ;;
  esac
fi

WAIT_COUNT=0
while [ ! -d "/data" ] && [ "$WAIT_COUNT" -lt 30 ]; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  sleep 1
done

mkdir -p /data

if [ "$MODE" = "prod" ]; then
  npx prisma generate >/dev/null 2>&1 || true
  npx prisma migrate deploy
else
  # In containerized/non-interactive environments, migrate dev can fail.
  # Use deploy first, then sync schema safely for local development.
  npx prisma migrate deploy || true
  npx prisma db push
fi

if [ "$PREP_ONLY" = "--prepare-only" ]; then
  exit 0
fi

if [ "$MODE" = "prod" ]; then
  npm run start
else
  npm run dev
fi
