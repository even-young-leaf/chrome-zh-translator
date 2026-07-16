const enabled = document.querySelector("#enabled");
const inlineMode = document.querySelector("#inlineMode");
const ollamaUrl = document.querySelector("#ollamaUrl");
const model = document.querySelector("#model");

chrome.storage.sync.get(["enabled", "inlineMode", "ollamaUrl", "model"], (settings) => {
  enabled.checked = true;
  inlineMode.checked = settings.inlineMode !== false;
  ollamaUrl.value = settings.ollamaUrl || "http://127.0.0.1:11434";
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
  chrome.storage.sync.set({ ollamaUrl: ollamaUrl.value.trim() || "http://127.0.0.1:11434" });
});

model.addEventListener("change", () => {
  chrome.storage.sync.set({ model: model.value.trim() || "qwen3:8b" });
});
