#!/usr/bin/env bash
# Load + concurrency test against the test database built by scripts/db-test.sh.
#   PGHOST=… PGPORT=… PGUSER=postgres scripts/db-load.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-fahrschule_test}"
psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -o /dev/null -f scripts/db-load/seed.sql
echo "== admin performance RPC: 10 parallel admins, 20 s"
pgbench -n -c 10 -j 4 -T 20 -f scripts/db-load/admin-performance.sql "$DB" | grep -E "tps|latency|failed"
echo "== rate limiter race: 50 clients x 10 calls on one key (limit 100)"
psql -q -X -d "$DB" -c "delete from public.rate_limits where key = 'race:test'"
pgbench -n -c 50 -j 8 -t 10 -f scripts/db-load/rate-limit-race.sql "$DB" | grep -E "tps|failed"
hits=$(psql -At -X -d "$DB" -c "select hits from public.rate_limits where key = 'race:test'")
echo "recorded hits: $hits (expected 500); allowed = min(hits, 100) = 100"
[ "$hits" = "500" ] || { echo "RACE: lost updates"; exit 1; }
