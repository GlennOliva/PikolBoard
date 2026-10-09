#!/usr/bin/env bash
# Rebuilds a throwaway PostgreSQL database and applies every migration in order.
#
# The SQL suite and the migration files target Supabase, which needs Docker.
# This script runs the same files against a plain PostgreSQL cluster using
# supabase/tests/shim.sql for the auth schema, roles, and Realtime publication,
# so the RPC behaviour can be exercised offline.
#
#   scripts/db-local.sh reset      # drop, recreate, migrate
#   scripts/db-local.sh test       # reset, then run all SQL verification suites
#   scripts/db-local.sh psql       # open a shell against the rebuilt database
#
# Override the port with PGPORT_LOCAL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PGPORT_LOCAL:-55433}"
export PGHOST=127.0.0.1
export PGPORT="$PORT"
export PGUSER=postgres
DB=pickleboard_test

reset_db() {
  psql -d postgres -q -c "drop database if exists $DB;" -c "create database $DB;"
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/shim.sql"
  for file in "$ROOT"/supabase/migrations/*.sql; do
    echo "applying $(basename "$file")"
    psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$file" >/dev/null
  done
}

case "${1:-reset}" in
  reset) reset_db ;;
  test)
    reset_db
    for suite in rls_verification lineup-stages lineup-concurrency; do
      echo "--- supabase/tests/$suite.sql"
      psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/$suite.sql" 2>&1 |
        grep -E 'PASS:|FAIL:|ERROR|assertions passed' | sed 's/^psql.*NOTICE:  //'
    done
    ;;
  psql) psql -d "$DB" ;;
  *) echo "usage: $0 [reset|test|psql]" >&2; exit 2 ;;
esac
