#!/usr/bin/env bash
# Recreates the splitty dev database from schema.sql.
# Usage: ./recreate_db.sh [--seed]
#   --seed  also load test_data.sql after creating the schema

set -euo pipefail

DB="splitty"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SEED=false
for arg in "$@"; do
    case "$arg" in
        --seed|-s) SEED=true ;;
        *) echo "Unknown argument: $arg" >&2; exit 1 ;;
    esac
done

echo "Dropping database '$DB' (if it exists)..."
dropdb --if-exists "$DB"

echo "Creating database '$DB'..."
createdb "$DB"

echo "Applying schema..."
psql -d "$DB" -f "$SCRIPT_DIR/schema.sql"

if $SEED; then
    echo "Inserting test data..."
    psql -d "$DB" -f "$SCRIPT_DIR/test_data.sql"
fi

echo "Done."
