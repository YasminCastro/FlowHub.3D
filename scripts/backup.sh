#!/usr/bin/env bash
# Dumps the FlowHub postgres database (hosted in the 3d-print-helper-postgres
# container) and archives the uploads volume, uploads both to Google Drive via
# rclone, and prunes old backups.
#
# Intended to run from the HOST via cron (not inside a container), e.g.:
#   15 3 * * * /path/to/FlowHub.3D/scripts/backup.sh >> ~/backups/flowhub-backup.log 2>&1
#
# Requires:
#   - docker (postgres container running; uploads volume created by docker compose)
#   - rclone installed and configured with a remote

set -euo pipefail

# --- Config -----------------------------------------------------------------
CONTAINER_NAME="3d-print-helper-postgres"
DB_USER="postgres"
DB_NAME="flowhub-dev"

UPLOADS_VOLUME="flowhub3d_uploads"          # docker volume mounted at /app/uploads

RCLONE_REMOTE="gdrive"                      # name of the rclone remote (rclone config)
RCLONE_FOLDER="flowhub-backups"             # folder inside the remote

LOCAL_BACKUP_DIR="${HOME}/backups/flowhub"
KEEP_COUNT=7                                 # how many most-recent backups of each kind to keep, locally and on the remote

# --- Run ---------------------------------------------------------------------
mkdir -p "$LOCAL_BACKUP_DIR"

timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
db_file="${LOCAL_BACKUP_DIR}/flowhub-db_${timestamp}.sql.gz"
uploads_file="${LOCAL_BACKUP_DIR}/flowhub-uploads_${timestamp}.tar.gz"

echo "[$(date -Iseconds)] Starting backup -> ${LOCAL_BACKUP_DIR} (${timestamp})"

# --- Database ------------------------------------------------------------------
if ! docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$db_file"; then
  echo "[$(date -Iseconds)] ERROR: pg_dump failed" >&2
  rm -f "$db_file"
  exit 1
fi

if [ ! -s "$db_file" ]; then
  echo "[$(date -Iseconds)] ERROR: dump file is empty" >&2
  rm -f "$db_file"
  exit 1
fi

echo "[$(date -Iseconds)] Database dump created ($(du -h "$db_file" | cut -f1))."

# --- Uploads -------------------------------------------------------------------
# Reads the volume through a throwaway container, so it works even if the backend is down.
if ! docker run --rm -v "${UPLOADS_VOLUME}:/data:ro" alpine tar czf - -C /data . > "$uploads_file"; then
  echo "[$(date -Iseconds)] ERROR: uploads archive failed" >&2
  rm -f "$db_file" "$uploads_file"
  exit 1
fi

echo "[$(date -Iseconds)] Uploads archive created ($(du -h "$uploads_file" | cut -f1)). Uploading to ${RCLONE_REMOTE}:${RCLONE_FOLDER}"

for f in "$db_file" "$uploads_file"; do
  if ! rclone copy "$f" "${RCLONE_REMOTE}:${RCLONE_FOLDER}" --quiet; then
    echo "[$(date -Iseconds)] ERROR: rclone upload failed for ${f}, keeping local copy" >&2
    exit 1
  fi
done

echo "[$(date -Iseconds)] Upload complete."

# --- Prune old backups, keeping only the KEEP_COUNT most recent of each kind -----
for prefix in flowhub-db_ flowhub-uploads_; do
  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name "${prefix}*" | sort | head -n -"$KEEP_COUNT" | while IFS= read -r old; do
    echo "[$(date -Iseconds)] Removing old local backup: ${old}"
    rm -f "$old"
  done

  rclone lsf "${RCLONE_REMOTE}:${RCLONE_FOLDER}" --files-only --include "${prefix}*" | sort | head -n -"$KEEP_COUNT" | while IFS= read -r old; do
    echo "[$(date -Iseconds)] Removing old remote backup: ${old}"
    rclone deletefile "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${old}"
  done
done

echo "[$(date -Iseconds)] Backup finished successfully."
