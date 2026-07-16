#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="cplehmmdegoebbhfonddkfeefboonpdb"
OLLAMA_BIN="${OLLAMA_BIN:-ollama}"
LOG_FILE="${LOG_FILE:-./ollama-extension.log}"

pkill -x ollama 2>/dev/null || true
pkill -f "/Applications/Ollama.app/Contents/Resources/llama-server" 2>/dev/null || true
sleep 2

OLLAMA_HOST="127.0.0.1:11434" \
OLLAMA_ORIGINS="chrome-extension://${EXTENSION_ID},http://127.0.0.1,http://localhost" \
nohup "${OLLAMA_BIN}" serve > "${LOG_FILE}" 2>&1 &

echo "Ollama started for Chrome translator extension: chrome-extension://${EXTENSION_ID}"
