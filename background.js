const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_NMT_URL = "http://127.0.0.1:11888";
const DEFAULT_MODEL = "qwen3:8b";
const DEFAULT_PROVIDER = "auto";

async function translateToChinese(text) {
  const results = await translateBatchToChinese([text]);
  return results[0] || "";
}

async function translateBatchToChinese(texts) {
  const cleanTexts = texts.map((text) => String(text || "").trim()).filter(Boolean);
  if (!cleanTexts.length) return [];

  const settings = await chrome.storage.sync.get(["translatorProvider", "nmtUrl", "ollamaUrl", "model"]);
  const provider = settings.translatorProvider || DEFAULT_PROVIDER;
  const nmtUrl = normalizeBaseUrl(settings.nmtUrl || DEFAULT_NMT_URL, DEFAULT_NMT_URL);
  const baseUrl = normalizeBaseUrl(settings.ollamaUrl || DEFAULT_OLLAMA_URL);
  const model = settings.model || DEFAULT_MODEL;

  if (provider === "nmt" || provider === "auto") {
    try {
      return await translateBatchWithNmt(cleanTexts, nmtUrl);
    } catch (error) {
      if (provider === "nmt") throw error;
      console.warn("NMT translate failed, falling back to Ollama:", error);
    }
  }

  return translateBatchWithOllama(cleanTexts, baseUrl, model);
}

async function translateBatchWithNmt(texts, nmtUrl) {
  const response = await fetchWithTimeout(`${nmtUrl}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "en",
      target: "zh",
      texts
    })
  }, 8000);

  if (!response.ok) {
    throw new Error(`本机 NMT HTTP ${response.status}`);
  }

  const data = await response.json();
  const translations = Array.isArray(data.translations) ? data.translations : [];
  if (translations.length !== texts.length) {
    throw new Error("本机 NMT 返回数量不匹配");
  }
  return translations.map((translation) => String(translation || "").trim());
}

async function translateBatchWithOllama(texts, baseUrl, model) {
  const items = texts.map((text, index) => `[${index + 1}] ${text}`).join("\n\n");
  const prompt = [
    "把下面编号文本逐条翻译成简体中文。",
    "只输出编号译文，每行格式：[编号] 译文。不要解释，不要合并条目。",
    "",
    items
  ].join("\n");

  const response = await fetchWithTimeout(`${baseUrl}/api/generate`, {
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
  }, 60000);

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const data = await response.json();
  const translated = String(data.response || "").trim();
  if (!translated) throw new Error("Ollama 没有返回译文");
  return parseNumberedTranslations(translated, texts.length);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["enabled", "inlineMode", "translatorProvider", "nmtUrl", "ollamaUrl", "model"]);
  const nmtUrl = normalizeBaseUrl(existing.nmtUrl || DEFAULT_NMT_URL, DEFAULT_NMT_URL);
  const ollamaUrl = normalizeBaseUrl(existing.ollamaUrl || DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_URL);
  await chrome.storage.sync.set({
    enabled: existing.enabled ?? true,
    inlineMode: existing.inlineMode ?? true,
    translatorProvider: existing.translatorProvider || DEFAULT_PROVIDER,
    nmtUrl,
    ollamaUrl,
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

function normalizeBaseUrl(url, fallback = DEFAULT_OLLAMA_URL) {
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

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
