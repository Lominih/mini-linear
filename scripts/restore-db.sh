#!/bin/bash
# Database restore script for Mini Linear
# Usage: ./scripts/restore-db.sh backups/backup_20260622_120000.db

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file>"
  echo "Available backups:"
  ls -la ./backups/backup_*.db 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"
DB_PATH="${DATABASE_URL:-file:./prisma/dev.db}"
DB_FILE="${DB_PATH#file:}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Create a safety backup of current DB
if [ -f "$DB_FILE" ]; then
  SAFETY_BACKUP="./backups/pre_restore_$(date +%Y%m%d_%H%M%S).db"
  mkdir -p ./backups
  cp "$DB_FILE" "$SAFETY_BACKUP"
  echo "🛡️  Current DB backed up to: $SAFETY_BACKUP"
fi

cp "$BACKUP_FILE" "$DB_FILE"
echo "✅ Database restored from: $BACKUP_FILE"
echo "   Run 'npx prisma generate' if needed"