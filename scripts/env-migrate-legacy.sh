#!/usr/bin/env bash
# Extract secrets from a legacy env file → .env.shared.local
#
# Legacy sources (any one):
#   .env.production / .env.production.local
#   apps/auto-wechat/.env.development
#   CVM copy pasted to ~/legacy.env
#
# Usage:
#   ./scripts/env-migrate-legacy.sh path/to/old.env
#   ./scripts/env-migrate-legacy.sh path/to/old.env --write   # overwrite .env.shared.local

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-}"
WRITE=false
[[ "${2:-}" == "--write" ]] && WRITE=true

if [[ -z "$SOURCE" || ! -f "$SOURCE" ]]; then
  echo "Usage: $0 <legacy.env> [--write]" >&2
  echo "Example: $0 ~/Downloads/.env.production.local --write" >&2
  exit 1
fi

TEMPLATE="$ROOT/config/env.shared.example"
OUT="$ROOT/.env.shared.local"

# Keys in env.shared.example (order preserved)
mapfile -t KEYS < <(grep -E '^[A-Z][A-Z0-9_]*=' "$TEMPLATE" | cut -d= -f1)

declare -A LEGACY
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$line" || "$line" != *=* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  LEGACY["$key"]="$val"
done < "$SOURCE"

missing=0
found=0
buf=""

while IFS= read -r line; do
  if [[ "$line" =~ ^([A-Z][A-Z0-9_]*)= ]]; then
    key="${BASH_REMATCH[1]}"
    if [[ -n "${LEGACY[$key]:-}" ]]; then
      v="${LEGACY[$key]}"
      if [[ "$v" == *CHANGE_ME* || "$v" == *mock_* || "$v" == *_local ]]; then
        buf+="${key}=${v}"$'\n'
        ((missing++)) || true
      else
        buf+="${key}=${v}"$'\n'
        ((found++)) || true
      fi
    else
      buf+="${line}"$'\n'
      ((missing++)) || true
    fi
  else
    buf+="${line}"$'\n'
  fi
done < "$TEMPLATE"

echo "Source: $SOURCE"
echo "Found ${found} usable secret(s), ${missing} still placeholder/missing"
echo ""

if [[ "$WRITE" == true ]]; then
  printf '%s' "$buf" > "$OUT"
  echo "✅ Wrote $OUT"
  echo "Next: ./scripts/env-build.sh production --check"
else
  echo "Preview (values redacted):"
  while IFS= read -r line; do
    if [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.+)$ ]]; then
      v="${BASH_REMATCH[2]}"
      if [[ "$v" == *CHANGE_ME* || -z "$v" ]]; then
        echo "${BASH_REMATCH[1]}=<missing>"
      else
        echo "${BASH_REMATCH[1]}=<filled>"
      fi
    fi
  done <<< "$buf"
  echo ""
  echo "Run with --write to create .env.shared.local"
fi
