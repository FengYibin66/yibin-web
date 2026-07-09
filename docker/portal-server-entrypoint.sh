#!/bin/sh
set -e
cd /app

mkdir -p "${UPLOADS_DIR:-/app/uploads}"
if [ ! -f "${UPLOADS_DIR:-/app/uploads}/avatar.jpg" ] && [ -f /app/default-avatar.jpg ]; then
  cp /app/default-avatar.jpg "${UPLOADS_DIR:-/app/uploads}/avatar.jpg"
fi

node dist/db/migrate.js
node dist/db/seed.js
exec node dist/index.js
