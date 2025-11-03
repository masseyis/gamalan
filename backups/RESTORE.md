# Database Backup & Restore Instructions

## Backup Information

**Latest Backup:** `gamalan-backup-20251029-174349.sql`
**Size:** 484 KB
**Tables:** 27
**Created:** October 29, 2025 at 17:43:49

## Restore Instructions

### Option 1: Full Database Restore (drops existing database)

```bash
# WARNING: This will destroy the current database!

# Drop and recreate database
psql "postgres://postgres:password@localhost:5432/postgres" <<EOF
DROP DATABASE IF EXISTS gamalan;
CREATE DATABASE gamalan;
EOF

# Restore from backup
/opt/homebrew/opt/postgresql@15/bin/psql \
  "postgres://postgres:password@localhost:5432/gamalan" \
  < ./backups/gamalan-backup-20251029-174349.sql
```

### Option 2: Restore to a Test Database

```bash
# Create test database
psql "postgres://postgres:password@localhost:5432/postgres" <<EOF
CREATE DATABASE gamalan_test_restore;
EOF

# Restore to test database
/opt/homebrew/opt/postgresql@15/bin/psql \
  "postgres://postgres:password@localhost:5432/gamalan_test_restore" \
  < ./backups/gamalan-backup-20251029-174349.sql

# Verify restore
psql "postgres://postgres:password@localhost:5432/gamalan_test_restore" \
  -c "SELECT COUNT(*) FROM stories;"
```

### Option 3: Quick Restore Script

```bash
#!/bin/bash
# restore-db.sh

set -e

BACKUP_FILE="${1:-./backups/gamalan-backup-20251029-174349.sql}"

echo "🔄 Restoring database from: $BACKUP_FILE"
echo "⚠️  This will drop the current 'gamalan' database!"
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  psql "postgres://postgres:password@localhost:5432/postgres" <<EOF
DROP DATABASE IF EXISTS gamalan;
CREATE DATABASE gamalan;
EOF

  /opt/homebrew/opt/postgresql@15/bin/psql \
    "postgres://postgres:password@localhost:5432/gamalan" \
    < "$BACKUP_FILE"

  echo "✅ Database restored successfully!"
else
  echo "❌ Restore cancelled"
  exit 1
fi
```

## Verification

After restore, verify key tables:

```bash
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
```

## Backup Retention

- Keep backups for at least 7 days before agent runs
- Create new backup before each major sprint
- Archive backups after successful sprint completion
