#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="${EXTENSION_ID:-cplehmmdegoebbhfonddkfeefboonpdb}"
MODEL="${MODEL:-qwen3:8b}"
OLLAMA_HOST_VALUE="${OLLAMA_HOST_VALUE:-127.0.0.1:11434}"
OLLAMA_ORIGINS_VALUE="${OLLAMA_ORIGINS_VALUE:-chrome-extension://${EXTENSION_ID},http://127.0.0.1,http://localhost}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_SUPPORT_DIR="${HOME}/Library/Application Support/ChromeZhTranslator"
LAUNCH_AGENT_LABEL="com.evenyoung.chrome-zh-translator.ollama"
LAUNCH_AGENT_FILE="${HOME}/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"
PERSISTENT_STARTER="${APP_SUPPORT_DIR}/start-ollama.sh"
LOG_FILE="${LOG_FILE:-${APP_SUPPORT_DIR}/ollama-extension.log}"
ERR_LOG_FILE="${ERR_LOG_FILE:-${APP_SUPPORT_DIR}/ollama-extension.err.log}"

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

xml_escape() {
  printf '%s' "$1" \
    | sed -e 's/&/\&amp;/g' \
          -e 's/</\&lt;/g' \
          -e 's/>/\&gt;/g' \
          -e 's/"/\&quot;/g' \
          -e "s/'/\&apos;/g"
}

install_launch_agent() {
  local ollama_bin
  ollama_bin="$(command -v ollama)"

  mkdir -p "${APP_SUPPORT_DIR}" "${HOME}/Library/LaunchAgents"

  cat > "${PERSISTENT_STARTER}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

export OLLAMA_HOST="${OLLAMA_HOST_VALUE}"
export OLLAMA_ORIGINS="${OLLAMA_ORIGINS_VALUE}"

server_pids="\$(/usr/sbin/lsof -nP -tiTCP:11434 -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "\${server_pids}" ]]; then
  kill \${server_pids} 2>/dev/null || true
  sleep 2
fi

exec "${ollama_bin}" serve
EOF
  chmod +x "${PERSISTENT_STARTER}"

  cat > "${LAUNCH_AGENT_FILE}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$(xml_escape "${LAUNCH_AGENT_LABEL}")</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml_escape "${PERSISTENT_STARTER}")</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$(xml_escape "${LOG_FILE}")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "${ERR_LOG_FILE}")</string>
</dict>
</plist>
EOF

  launchctl setenv OLLAMA_HOST "${OLLAMA_HOST_VALUE}"
  launchctl setenv OLLAMA_ORIGINS "${OLLAMA_ORIGINS_VALUE}"
  launchctl bootout "gui/${UID}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
  launchctl unload "${LAUNCH_AGENT_FILE}" >/dev/null 2>&1 || true

  if launchctl bootstrap "gui/${UID}" "${LAUNCH_AGENT_FILE}" >/dev/null 2>&1; then
    launchctl kickstart -k "gui/${UID}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
  else
    launchctl load -w "${LAUNCH_AGENT_FILE}"
  fi
}

stop_macos_app_server() {
  osascript -e 'tell application "Ollama" to quit' >/dev/null 2>&1 || true
  pkill -x Ollama 2>/dev/null || true

  local app_server_pids
  app_server_pids="$(pgrep -f '/Applications/Ollama.app/Contents/Resources/ollama serve' 2>/dev/null || true)"
  if [[ -n "${app_server_pids}" ]]; then
    kill ${app_server_pids} 2>/dev/null || true
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

ensure_model() {
  if ollama list | awk 'NR > 1 { print $1 }' | grep -Fxq "${MODEL}"; then
    echo "Model already installed: ${MODEL}"
    return
  fi

  echo "Pulling model: ${MODEL}"
  ollama pull "${MODEL}"
}

install_ollama

echo "Stopping Ollama.app background server if it is running..."
stop_macos_app_server

echo "Installing persistent Ollama launcher for this extension..."
install_launch_agent

wait_for_ollama

ensure_model

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
LaunchAgent: ${LAUNCH_AGENT_FILE}
EOF
