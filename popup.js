const enabled = document.querySelector("#enabled");
const inlineMode = document.querySelector("#inlineMode");
const ollamaUrl = document.querySelector("#ollamaUrl");
const model = document.querySelector("#model");

chrome.storage.sync.get(["enabled", "inlineMode", "ollamaUrl", "model"], (settings) => {
  enabled.checked = true;
  inlineMode.checked = settings.inlineMode !== false;
  ollamaUrl.value = normalizeOllamaUrl(settings.ollamaUrl || "http://127.0.0.1:11434");
  model.value = settings.model || "qwen3:8b";
  chrome.storage.sync.set({
    enabled: true,
    inlineMode: inlineMode.checked,
    ollamaUrl: ollamaUrl.value,
    model: model.value
  });
});

enabled.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabled.checked });
});

inlineMode.addEventListener("change", () => {
  chrome.storage.sync.set({ inlineMode: inlineMode.checked });
});

ollamaUrl.addEventListener("change", () => {
  const normalized = normalizeOllamaUrl(ollamaUrl.value);
  ollamaUrl.value = normalized;
  chrome.storage.sync.set({ ollamaUrl: normalized });
});

model.addEventListener("change", () => {
  chrome.storage.sync.set({ model: model.value.trim() || "qwen3:8b" });
});

function normalizeOllamaUrl(url) {
  const fallback = "http://127.0.0.1:11434";
  const raw = String(url || fallback).trim() || fallback;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.hostname === "localhost" || parsed.hostname === "::1" || parsed.hostname === "[::1]") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}
