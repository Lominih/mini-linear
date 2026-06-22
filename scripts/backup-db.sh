#!/bin/bash
# Database backup script for Mini Linear
# Usage: ./scripts/backup-db.sh

set -e

DB_PATH="${DATABASE_URL:-file:./prisma/dev.db}"
DB_FILE="${DB_PATH#file:}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$BACKUP_FILE"
  echo "✅ Backup created: $BACKUP_FILE"
  echo "   Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "❌ Database file not found: $DB_FILE"
  exit 1
fi

# Keep only last 10 backups
cd "$BACKUP_DIR"
ls -t backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm
echo "🧹 Old backups cleaned (keeping last 10)"