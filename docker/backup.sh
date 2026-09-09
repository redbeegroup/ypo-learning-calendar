#!/bin/sh
# Nightly pg_dump into /backups, pruning files older than BACKUP_KEEP_DAYS.
set -e
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups
while true; do
  STAMP=$(date -u +%Y%m%d-%H%M%S)
  FILE="/backups/${PGDATABASE}-${STAMP}.sql.gz"
  if pg_dump --no-owner --no-privileges | gzip > "$FILE"; then
    echo "backup written: $FILE"
  else
    echo "backup FAILED at $STAMP" >&2
    rm -f "$FILE"
  fi
  find /backups -name "*.sql.gz" -mtime +"$KEEP" -delete
  sleep 86400
done
