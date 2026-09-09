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

has_migrations() {
  [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]
}

if has_migrations; then
  echo ">> applying migrations"
  npx prisma migrate deploy
fi

if [ -n "$DATABASE_URL_TEST" ]; then
  echo ">> ensuring test database"
  node -e '
    const { Client } = require("pg");
    const url = new URL(process.env.DATABASE_URL_TEST);
    const dbName = url.pathname.slice(1);
    url.pathname = "/postgres";
    url.search = "";
    const c = new Client({ connectionString: url.toString() });
    c.connect().then(async () => {
      const r = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
      if (r.rowCount === 0) await c.query(`CREATE DATABASE "${dbName}"`);
      await c.end();
    }).catch((e) => { console.error(e); process.exit(1); });
  '
  if has_migrations; then
    DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
  fi
fi

exec "$@"
