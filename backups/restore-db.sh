#!/bin/bash
# restore-db.sh - Restore PostgreSQL database from backup

set -e

BACKUP_FILE="${1:-./backups/gamalan-backup-20251029-174349.sql}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  echo "Usage: ./restore-db.sh <backup-file>"
  exit 1
fi

echo "🔄 Restoring database from: $BACKUP_FILE"
echo "⚠️  This will drop the current 'gamalan' database!"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Dropping existing database..."
  psql "postgres://postgres:password@localhost:5432/postgres" <<EOF
DROP DATABASE IF EXISTS gamalan;
CREATE DATABASE gamalan;
EOF

  echo "Restoring from backup..."
  /opt/homebrew/opt/postgresql@15/bin/psql \
    "postgres://postgres:password@localhost:5432/gamalan" \
    < "$BACKUP_FILE"

  echo ""
  echo "✅ Database restored successfully!"
  echo ""
  echo "Verifying restore..."
  psql "postgres://postgres:password@localhost:5432/gamalan" <<EOF
SELECT 'stories' as table_name, COUNT(*) as count FROM stories
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'acceptance_criteria', COUNT(*) FROM acceptance_criteria
UNION ALL
SELECT 'api_keys', COUNT(*) FROM api_keys
UNION ALL
SELECT 'users', COUNT(*) FROM users;
EOF
else
  echo "❌ Restore cancelled"
  exit 1
fi
