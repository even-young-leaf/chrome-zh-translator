#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="${EXTENSION_ID:-cplehmmdegoebbhfonddkfeefboonpdb}"
MODEL="${MODEL:-qwen3:8b}"
OLLAMA_HOST_VALUE="${OLLAMA_HOST_VALUE:-127.0.0.1:11434}"
OLLAMA_ORIGINS_VALUE="${OLLAMA_ORIGINS_VALUE:-chrome-extension://${EXTENSION_ID},http://127.0.0.1,http://localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${LOG_FILE:-${EXTENSION_DIR}/ollama-extension.log}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is for macOS. Use scripts/install-linux.sh on Linux."
  exit 1
fi

install_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    return
  fi

  echo "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh

  if ! command -v ollama >/dev/null 2>&1; then
    echo "Ollama was installed, but the ollama command is not in PATH yet."
    echo "Open a new terminal and run this script again."
    exit 1
  fi
}

wait_for_ollama() {
  for _ in $(seq 1 40); do
    if curl -fsS "http://${OLLAMA_HOST_VALUE}/api/tags" >/dev/null 2>&1; then
      return
    fi
    sleep 0.5
  done

  echo "Ollama did not become ready on http://${OLLAMA_HOST_VALUE}."
  echo "Check ${LOG_FILE} for details."
  exit 1
}

install_ollama

echo "Stopping existing Ollama processes so Chrome extension access can be enabled..."
pkill -x ollama 2>/dev/null || true
pkill -f "/Applications/Ollama.app/Contents/Resources/llama-server" 2>/dev/null || true
sleep 2

echo "Starting Ollama for this extension..."
OLLAMA_HOST="${OLLAMA_HOST_VALUE}" \
OLLAMA_ORIGINS="${OLLAMA_ORIGINS_VALUE}" \
nohup ollama serve > "${LOG_FILE}" 2>&1 &

wait_for_ollama

echo "Pulling model: ${MODEL}"
ollama pull "${MODEL}"

open -a "Google Chrome" "chrome://extensions/" >/dev/null 2>&1 || true

cat <<EOF

Done.

1. Chrome has been opened to chrome://extensions/ when possible.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder:
   ${EXTENSION_DIR}

Ollama API: http://${OLLAMA_HOST_VALUE}
Model: ${MODEL}
Log: ${LOG_FILE}
EOF
