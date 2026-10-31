#!/usr/bin/env bash
# Build the static arena into dist/ and serve it in the foreground.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
DIST_DIR="$PROJECT_DIR/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"

timed() {
  local label="$1"
  shift
  local started finished status
  started="$(date +%s%3N)"
  printf '[start] %s ...\n' "$label" >&2
  if "$@"; then
    status=0
  else
    status=$?
  fi
  finished="$(date +%s%3N)"
  printf '[start] %s: %dms\n' "$label" "$((finished - started))" >&2
  return "$status"
}

write_deployment() {
  mkdir -p -- "$WEB_DIR"
  printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$DIST_DIR" > "$WEB_DIR/deployment-output.json"
}

# No package dependencies are required for this dependency-free canvas game.
# Install/build only when a package manifest is present, then refresh the
# static deployment output from the checked-in source files.
if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    timed "install dependencies" npm ci --no-audit --no-fund
  else
    timed "install dependencies" npm install --no-audit --no-fund
  fi
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" 2>/dev/null; then
    timed "build project" npm run build
  fi
fi

for entry in index.html styles.css game.js assets; do
  [[ -e "$entry" ]] || { echo "[start] missing required source: $entry" >&2; exit 1; }
done

timed "clean dist" rm -rf -- "$DIST_DIR"
timed "create dist" mkdir -p -- "$DIST_DIR"
timed "copy static app" cp -R -- index.html styles.css game.js assets "$DIST_DIR"/
timed "write deployment metadata" write_deployment

printf '[start] project=%s\n[start] dist=%s\n[start] deployment=%s/deployment-output.json\n' \
  "$PROJECT_DIR" "$DIST_DIR" "$WEB_DIR" >&2
cat "$WEB_DIR/deployment-output.json" >&2

printf '[start] serving on 0.0.0.0:%s (foreground)\n' "$PORT" >&2
exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIST_DIR"
