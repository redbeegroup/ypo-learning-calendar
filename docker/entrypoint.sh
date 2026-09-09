#!/bin/sh
set -e

if [ "$NODE_ENV" = "development" ]; then
  if [ ! -d node_modules/.bin ] || [ ! -f node_modules/.install-stamp ] || [ package-lock.json -nt node_modules/.install-stamp ]; then
    echo ">> installing dependencies"
    npm install
    touch node_modules/.install-stamp
  fi
  npx prisma generate
fi

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo ">> applying migrations"
  npx prisma migrate deploy
fi

exec "$@"
