const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3:8b";

async function translateToChinese(text) {
  const results = await translateBatchToChinese([text]);
  return results[0] || "";
}

async function translateBatchToChinese(texts) {
  const settings = await chrome.storage.sync.get(["ollamaUrl", "model"]);
  const baseUrl = normalizeBaseUrl(settings.ollamaUrl || DEFAULT_OLLAMA_URL);
  const model = settings.model || DEFAULT_MODEL;
  const items = texts.map((text, index) => `[${index + 1}] ${text}`).join("\n\n");
  const prompt = [
    "把下面编号文本逐条翻译成简体中文。",
    "只输出编号译文，每行格式：[编号] 译文。不要解释，不要合并条目。",
    "",
    items
  ].join("\n");

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      think: false,
      options: {
        temperature: 0,
        num_predict: Math.min(900, Math.max(220, 110 * texts.length))
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const data = await response.json();
  const translated = String(data.response || "").trim();
  if (!translated) throw new Error("Ollama 没有返回译文");
  return parseNumberedTranslations(translated, texts.length);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["enabled", "inlineMode", "ollamaUrl", "model"]);
  await chrome.storage.sync.set({
    enabled: existing.enabled ?? true,
    inlineMode: existing.inlineMode ?? true,
    ollamaUrl: existing.ollamaUrl || DEFAULT_OLLAMA_URL,
    model: existing.model || DEFAULT_MODEL
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRANSLATE_BATCH") {
    translateBatchToChinese(message.texts || [])
      .then((translations) => sendResponse({ ok: true, translations }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type !== "TRANSLATE_TEXT") return false;

  translateToChinese(message.text)
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, "");
}

function parseNumberedTranslations(raw, count) {
  const clean = stripThinking(raw);
  const results = Array(count).fill("");
  const pattern = /(?:^|\n)\s*(?:\[(\d+)\]|(\d+)[.)、：:])\s*([\s\S]*?)(?=\n\s*(?:\[\d+\]|\d+[.)、：:])\s*|$)/g;
  let match;

  while ((match = pattern.exec(clean))) {
    const index = Number(match[1] || match[2]) - 1;
    if (index >= 0 && index < count) {
      results[index] = stripThinking(match[3]).trim();
    }
  }

  if (results.some(Boolean)) return results;

  const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < count; index += 1) {
    results[index] = stripThinking(lines[index] || clean).trim();
  }
  return results;
}

function stripThinking(text) {
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\/?think\b[:：]?\s*/gim, "")
    .replace(/\n\/?think\b[:：]?\s*/gim, "\n")
    .trim();
}
