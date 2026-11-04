#!/usr/bin/env bash
# ==============================================================================
# SmartBiz Accounting - Automated Database Backup Script
# Backs up smartbiz_db with gzip compression and 14-day retention.
# Recommended cron entry:
#   0 3 * * * /opt/smartbiz-accounting/scripts/backup-db.sh >> /var/log/smartbiz_backup.log 2>&1
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/smartbiz-db"
DB_NAME="smartbiz_db"
DB_USER="smartbiz_user"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Execute pg_dump
# If running on host:
if command -v pg_dump &> /dev/null; then
    pg_dump -U "${DB_USER}" -h localhost -d "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
else
    # Fallback to docker container if Postgres runs inside a container
    POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.Names}}" | head -n 1)
    if [ -n "${POSTGRES_CONTAINER}" ]; then
        docker exec -t "${POSTGRES_CONTAINER}" pg_dump -U postgres -d "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
    else
        echo "❌ ERROR: Neither pg_dump nor a running postgres container was found."
        exit 1
    fi
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Retention cleanup: remove backups older than 14 days
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup process finished."
