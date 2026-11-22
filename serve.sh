#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8762}"
if [[ "${1:-}" == "--port" && -n "${2:-}" ]]; then PORT="$2"; fi
# One server per page: an earlier one from this folder would keep the port and serve beside this one.
for pid in $(pgrep -f "tools/serve.py" || true); do
  [[ "$(readlink "/proc/$pid/cwd")" == "$PWD" ]] && kill "$pid" && sleep 0.3
done
exec python3 tools/serve.py --host 0.0.0.0 --port "$PORT"
