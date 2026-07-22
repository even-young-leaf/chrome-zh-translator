const enabled = document.querySelector("#enabled");
const inlineMode = document.querySelector("#inlineMode");
const translatorProvider = document.querySelector("#translatorProvider");
const nmtUrl = document.querySelector("#nmtUrl");
const ollamaUrl = document.querySelector("#ollamaUrl");
const model = document.querySelector("#model");

chrome.storage.sync.get(["enabled", "inlineMode", "translatorProvider", "nmtUrl", "ollamaUrl", "model"], (settings) => {
  enabled.checked = true;
  inlineMode.checked = settings.inlineMode !== false;
  translatorProvider.value = settings.translatorProvider || "auto";
  nmtUrl.value = normalizeLocalUrl(settings.nmtUrl || "http://127.0.0.1:11888", "http://127.0.0.1:11888");
  ollamaUrl.value = normalizeLocalUrl(settings.ollamaUrl || "http://127.0.0.1:11434", "http://127.0.0.1:11434");
  model.value = settings.model || "qwen3:8b";
  chrome.storage.sync.set({
    enabled: true,
    inlineMode: inlineMode.checked,
    translatorProvider: translatorProvider.value,
    nmtUrl: nmtUrl.value,
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

nmtUrl.addEventListener("change", () => {
  const normalized = normalizeLocalUrl(nmtUrl.value, "http://127.0.0.1:11888");
  nmtUrl.value = normalized;
  chrome.storage.sync.set({ nmtUrl: normalized });
});

ollamaUrl.addEventListener("change", () => {
  const normalized = normalizeLocalUrl(ollamaUrl.value, "http://127.0.0.1:11434");
  ollamaUrl.value = normalized;
  chrome.storage.sync.set({ ollamaUrl: normalized });
});

translatorProvider.addEventListener("change", () => {
  chrome.storage.sync.set({ translatorProvider: translatorProvider.value });
});

model.addEventListener("change", () => {
  chrome.storage.sync.set({ model: model.value.trim() || "qwen3:8b" });
});

function normalizeLocalUrl(url, fallback) {
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
