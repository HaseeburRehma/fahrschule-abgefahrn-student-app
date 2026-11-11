#!/usr/bin/env bash
# Applies every migration to a fresh Postgres database and runs the SQL test
# suite (RLS, privilege escalation, IDOR, rate limits, audit log ...).
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/db-test.sh
#
# Needs a Postgres 15+ server you may create databases on (CI uses a service container).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-fahrschule_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -d "$DB" -f "$f"
done
# Re-applying the newest migrations must be safe (idempotent migrations).
for f in $(ls supabase/migrations/*.sql | tail -2); do
  echo "re-apply $(basename "$f")"
  PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -d "$DB" -f "$f"
done
shopt -s nullglob
for t in supabase/tests/[1-9]*.sql; do
  echo "test     $(basename "$t")"
  "${PSQL[@]}" -d "$DB" -o /dev/null -f "$t"
done
echo "database tests passed"
