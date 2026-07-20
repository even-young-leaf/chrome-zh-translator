#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="${EXTENSION_ID:-cplehmmdegoebbhfonddkfeefboonpdb}"
MODEL="${MODEL:-qwen3:8b}"
OLLAMA_HOST_VALUE="${OLLAMA_HOST_VALUE:-127.0.0.1:11434}"
OLLAMA_ORIGINS_VALUE="${OLLAMA_ORIGINS_VALUE:-chrome-extension://${EXTENSION_ID},http://127.0.0.1,http://localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${LOG_FILE:-${EXTENSION_DIR}/ollama-extension.log}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script is for Linux. Use scripts/install-macos.sh on macOS."
  exit 1
fi

SUDO=""
if [[ "${EUID}" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
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
  echo "If systemd is not available, check ${LOG_FILE}."
  exit 1
}

ensure_model() {
  if ollama list | awk 'NR > 1 { print $1 }' | grep -Fxq "${MODEL}"; then
    echo "Model already installed: ${MODEL}"
    return
  fi

  echo "Pulling model: ${MODEL}"
  ollama pull "${MODEL}"
}

configure_systemd() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi

  if ! systemctl cat ollama.service >/dev/null 2>&1; then
    return 1
  fi

  if [[ -z "${SUDO}" && "${EUID}" -ne 0 ]]; then
    return 1
  fi

  echo "Configuring Ollama systemd service for Chrome extension access..."
  ${SUDO} mkdir -p /etc/systemd/system/ollama.service.d
  printf '[Service]\nEnvironment="OLLAMA_HOST=%s"\nEnvironment="OLLAMA_ORIGINS=%s"\n' \
    "${OLLAMA_HOST_VALUE}" "${OLLAMA_ORIGINS_VALUE}" \
    | ${SUDO} tee /etc/systemd/system/ollama.service.d/chrome-zh-translator.conf >/dev/null
  ${SUDO} systemctl daemon-reload
  ${SUDO} systemctl enable ollama >/dev/null 2>&1 || true
  ${SUDO} systemctl restart ollama
}

start_user_ollama() {
  echo "Starting Ollama for this extension..."
  pkill -x ollama 2>/dev/null || true
  sleep 2
  OLLAMA_HOST="${OLLAMA_HOST_VALUE}" \
  OLLAMA_ORIGINS="${OLLAMA_ORIGINS_VALUE}" \
  nohup ollama serve > "${LOG_FILE}" 2>&1 &
}

install_ollama

if ! configure_systemd; then
  start_user_ollama
fi

wait_for_ollama

ensure_model

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "chrome://extensions/" >/dev/null 2>&1 || true
fi

cat <<EOF

Done.

1. Open chrome://extensions/ in Chrome or Chromium.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder:
   ${EXTENSION_DIR}

Ollama API: http://${OLLAMA_HOST_VALUE}
Model: ${MODEL}
Log: ${LOG_FILE}
EOF
