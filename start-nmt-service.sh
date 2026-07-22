#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv-nmt"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the local NMT service." >&2
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip >/dev/null
"$VENV_DIR/bin/python" -m pip install "argostranslate==1.11.0" >/dev/null

exec "$VENV_DIR/bin/python" "$ROOT_DIR/scripts/nmt_service.py"
