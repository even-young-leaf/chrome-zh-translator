const STATE = {
  enabled: false,
  inlineMode: true,
  translated: new WeakSet(),
  queued: new WeakSet(),
  observer: null,
  popover: null,
  translateCache: new Map(),
  nativeTranslator: null,
  nativeUnavailable: false,
  translatorProvider: "auto",
  running: false
};

const LOCAL_TRANSLATIONS = new Map(Object.entries(globalThis.CODEX_ZH_DICTIONARY || {
  "home": "首页",
  "news": "新闻",
  "login": "登录",
  "log in": "登录",
  "sign in": "登录",
  "sign up": "注册",
  "register": "注册",
  "menu": "菜单",
  "search": "搜索",
  "sport": "体育",
  "sports": "体育",
  "business": "商业",
  "innovation": "创新",
  "culture": "文化",
  "travel": "旅行",
  "earth": "地球",
  "audio": "音频",
  "video": "视频",
  "live": "直播",
  "arts": "艺术",
  "subscribe": "订阅",
  "documentaries": "纪录片",
  "world": "世界",
  "world cup": "世界杯",
  "only from the bbc": "BBC独家",
  "recommended audio": "推荐音频",
  "us": "美国",
  "uk": "英国",
  "science": "科学",
  "tech": "科技",
  "reviews": "评测",
  "policy": "政策",
  "notifications": "通知",
  "technology": "科技",
  "health": "健康",
  "entertainment": "娱乐",
  "weather": "天气",
  "more": "更多",
  "save": "保存",
  "previous page": "上一页",
  "next page": "下一页",
  "latest": "最新",
  "watch": "观看",
  "listen": "收听",
  "read more": "阅读全文",
  "learn more": "了解更多",
  "new project": "新项目",
  "create project": "创建项目",
  "see how it was made": "查看制作过程",
  "spotlight": "焦点",
  "learn to make movies": "学习制作电影",
  "explore": "探索",
  "image": "图像",
  "academy": "学院",
  "new": "新",
  "supercomputer": "超级计算机",
  "mcp & cli": "MCP 与命令行",
  "cinema studio": "电影工作室",
  "plugins": "插件",
  "marketing studio": "营销工作室",
  "shorts studio": "短视频工作室",
  "explainer": "讲解",
  "originals": "原创",
  "canvas": "画布",
  "ai influencer": "AI网红",
  "apps": "应用",
  "pricing": "价格",
  "assets": "素材",
  "my generations": "我的生成",
  "my elements": "我的元素",
  "my favorites": "我的收藏",
  "community": "社区",
  "discount expires in": "优惠倒计时",
  "personal": "个人版",
  "off": "优惠",
  "generate": "生成",
  "create": "创建",
  "upload": "上传",
  "download": "下载",
  "settings": "设置",
  "profile": "个人资料",
  "notifications": "通知",
  "templates": "模板",
  "projects": "项目",
  "history": "历史",
  "favorites": "收藏"
}));

const TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header a",
  "header button",
  "footer a",
  "footer button",
  "footer h1",
  "footer h2",
  "footer h3",
  "footer h4",
  "footer h5",
  "footer h6",
  "nav a",
  "nav button",
  "button",
  "label",
  "[role='button']",
  "[role='tab']",
  "[role='heading']",
  "[aria-label]",
  "[role='navigation'] a",
  "[role='navigation'] button",
  "[role='banner'] a",
  "[role='banner'] button",
  "article h1",
  "article h2",
  "article h3",
  "article h4",
  "article p",
  "article li",
  "article a",
  "img[alt]",
  "svg[aria-label]",
  "[title]",
  "[class*='content-card'] a",
  "[class*='content-card'] p",
  "[class*='duet--article']",
  "[class*='duet--content-cards'] a",
  "[class*='duet--content-cards'] p",
  "main [class*='Headline']",
  "main [class*='Title']",
  "main [class*='Description']",
  "section [class*='Headline']",
  "section [class*='Title']",
  "section [class*='Description']",
  "main h1",
  "main h2",
  "main h3",
  "main h4",
  "main p",
  "main li",
  "main a",
  "section h1",
  "section h2",
  "section h3",
  "section h4",
  "section p",
  "section li",
  "section a",
  "figcaption",
  "[role='article'] h1",
  "[role='article'] h2",
  "[role='article'] h3",
  "[role='article'] h4",
  "[role='article'] p",
  "[role='article'] a"
].join(",");

const SKIP_SELECTOR = [
  "script",
  "style",
  "textarea",
  "input",
  "select",
  "code",
  "pre",
  "[contenteditable='true']",
  ".codex-zh-translation",
  ".codex-zh-popover"
].join(",");

init();

async function init() {
  const settings = await chrome.storage.sync.get(["enabled", "inlineMode", "translatorProvider"]);
  STATE.enabled = settings.enabled !== false;
  STATE.inlineMode = settings.inlineMode !== false;
  STATE.translatorProvider = settings.translatorProvider || "auto";

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.enabled) STATE.enabled = Boolean(changes.enabled.newValue);
    if (changes.inlineMode) STATE.inlineMode = Boolean(changes.inlineMode.newValue);
    if (changes.translatorProvider) {
      STATE.translatorProvider = changes.translatorProvider.newValue || "auto";
      STATE.nativeTranslator?.destroy?.();
      STATE.nativeTranslator = null;
      STATE.nativeUnavailable = false;
    }
    refresh();
  });

  document.addEventListener("mouseup", handleSelection);
  document.addEventListener("keyup", handleSelection);
  document.addEventListener("scroll", scheduleTranslate, { passive: true });

  refresh();
}

function refresh() {
  hidePopover();

  if (!STATE.enabled) {
    removeInlineTranslations();
    disconnectObserver();
    return;
  }

  if (STATE.inlineMode) {
    scheduleTranslate();
    connectObserver();
  } else {
    removeInlineTranslations();
    disconnectObserver();
  }
}

function connectObserver() {
  if (STATE.observer) return;
  STATE.observer = new MutationObserver(scheduleTranslate);
  STATE.observer.observe(document.body, { childList: true, subtree: true });
}

function disconnectObserver() {
  if (!STATE.observer) return;
  STATE.observer.disconnect();
  STATE.observer = null;
}

function scheduleTranslate() {
  window.clearTimeout(scheduleTranslate.timer);
  scheduleTranslate.timer = window.setTimeout(translateVisibleBlocks, 250);
}

function getCandidateBlocks() {
  const seenText = new Set();

  return [...document.querySelectorAll(TEXT_SELECTOR)]
    .filter((node) => !node.closest(SKIP_SELECTOR))
    .filter((node) => !node.closest("[data-codex-zh-local='true']"))
    .filter((node) => !node.querySelector("[data-codex-zh-local='true']"))
    .filter((node) => !STATE.translated.has(node) && !STATE.queued.has(node))
    .filter((node) => !node.nextElementSibling?.classList?.contains("codex-zh-translation"))
    .filter((node) => isVisibleNearViewport(node))
    .filter((node) => isLeafTextCandidate(node))
    .map((node) => ({ node, text: getCandidateText(node) }))
    .filter(({ node, text }) => shouldProcessText(text, node))
    .sort((a, b) => {
      const priority = getCandidatePriority(a.node, a.text) - getCandidatePriority(b.node, b.text);
      if (priority) return priority;
      return Math.abs(a.node.getBoundingClientRect().top) - Math.abs(b.node.getBoundingClientRect().top);
    })
    .filter(({ text }) => {
      const key = text.toLowerCase();
      if (seenText.has(key)) return false;
      seenText.add(key);
      return true;
    })
    .slice(0, 10);
}

async function translateVisibleBlocks() {
  if (!STATE.enabled || !STATE.inlineMode || STATE.running) return;

  applyLocalVisibleTranslations();

  const items = getCandidateBlocks().filter(({ text }) => !translateLocalText(text));
  if (!items.length) return;

  STATE.running = true;
  items.forEach(({ node }) => STATE.queued.add(node));

  try {
    const holders = items.map(({ node }) => {
      const holder = document.createElement("span");
      holder.className = "codex-zh-translation";
      holder.textContent = "正在翻译...";
      copyTextStyle(node, holder);
      node.insertAdjacentElement("afterend", holder);
      return holder;
    });

    const translations = await translateBatch(items.map(({ text }) => text));
    translations.forEach((translation, index) => {
      const item = items[index];
      const holder = holders[index];
      const node = item.node;
      STATE.translated.add(node);
      holder.textContent = sanitizeTranslation(translation) || "没有可显示的翻译结果";
    });
  } catch (error) {
    document.querySelectorAll(".codex-zh-translation").forEach((holder) => {
      if (holder.textContent !== "正在翻译...") return;
      holder.dataset.error = "true";
      holder.textContent = `翻译失败：${formatError(error)}`;
    });
  } finally {
    items.forEach(({ node }) => STATE.queued.delete(node));
    STATE.running = false;
    scheduleTranslate();
  }
}

async function handleSelection() {
  if (!STATE.enabled) return;

  const selection = window.getSelection();
  const text = cleanText(selection?.toString() || "");
  if (!text || text.length < 2 || !shouldTranslate(text)) {
    hidePopover();
    return;
  }

  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;

  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  showPopover("正在翻译...", rect);

  try {
    const translations = await translateBatch([text]);
    showPopover(sanitizeTranslation(translations[0]), rect);
  } catch (error) {
    showPopover(`翻译失败：${formatError(error)}`, rect);
  }
}

function showPopover(text, anchorRect) {
  if (!STATE.popover) {
    STATE.popover = document.createElement("div");
    STATE.popover.className = "codex-zh-popover";
    document.documentElement.appendChild(STATE.popover);
  }

  STATE.popover.textContent = text;
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 20);
  const left = Math.max(14, Math.min(anchorRect.left, window.innerWidth - 434));
  STATE.popover.style.top = `${top}px`;
  STATE.popover.style.left = `${left}px`;
}

function hidePopover() {
  STATE.popover?.remove();
  STATE.popover = null;
}

function removeInlineTranslations() {
  document.querySelectorAll(".codex-zh-translation").forEach((node) => node.remove());
}

async function translateBatch(texts) {
  const uncached = [];
  const translations = texts.map((text) => {
    const key = cacheKey(text);
    if (STATE.translateCache.has(key)) return STATE.translateCache.get(key);
    uncached.push({ key, text });
    return null;
  });

  if (uncached.length) {
    let remoteTranslations = [];
    if (STATE.translatorProvider === "native" || STATE.translatorProvider === "auto") {
      try {
        const nativeRequest = translateBatchWithNative(uncached.map((item) => item.text));
        remoteTranslations = STATE.translatorProvider === "auto"
          ? await withTimeout(nativeRequest, 900, "Chrome 原生翻译模型未就绪")
          : await nativeRequest;
      } catch (error) {
        if (STATE.translatorProvider === "native") throw error;
        STATE.nativeUnavailable = true;
      }
    }

    if (!remoteTranslations.length) {
      const response = await chrome.runtime.sendMessage({
        type: "TRANSLATE_BATCH",
        texts: uncached.map((item) => item.text)
      });

      if (!response?.ok) {
        throw new Error(response?.error || "未知错误");
      }
      remoteTranslations = response.translations || [];
    }

    remoteTranslations.forEach((translation, index) => {
      STATE.translateCache.set(uncached[index].key, sanitizeTranslation(translation));
    });
  }

  return texts.map((text) => STATE.translateCache.get(cacheKey(text)) || "");
}

async function translateBatchWithNative(texts) {
  const translator = await getNativeTranslator();
  const translations = [];
  for (const text of texts) {
    translations.push(await translator.translate(text));
  }
  return translations;
}

async function getNativeTranslator() {
  if (STATE.nativeTranslator) return STATE.nativeTranslator;
  if (STATE.nativeUnavailable) throw new Error("Chrome 原生翻译 API 当前不可用");

  const root = typeof self !== "undefined" ? self : window;
  const TranslatorCtor = root.Translator || window.Translator;
  if (!TranslatorCtor) {
    STATE.nativeUnavailable = true;
    throw new Error("Chrome 原生翻译 API 当前不可用");
  }

  const availability = await TranslatorCtor.availability({
    sourceLanguage: "en",
    targetLanguage: "zh"
  });
  if (availability !== "available") {
    STATE.nativeUnavailable = true;
    throw new Error("Chrome 原生翻译模型未就绪");
  }

  STATE.nativeTranslator = await TranslatorCtor.create({
    sourceLanguage: "en",
    targetLanguage: "zh"
  });
  return STATE.nativeTranslator;
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function getCandidateText(node) {
  const semanticText = cleanText(node.textContent || "");
  const renderedText = cleanText(node.innerText || semanticText);
  const visibleText = shouldPreferSemanticText(node, semanticText, renderedText) ? semanticText : renderedText;
  if (!visibleText || node.matches("img,svg")) {
    const accessible = getAccessibleText(node);
    if (accessible) return accessible;
  }
  if (node.matches("a")) {
    const heading = node.querySelector("h1,h2,h3,h4,[class*='Headline'],[class*='Title']");
    if (heading) return cleanText(heading.textContent || "");
  }
  return visibleText;
}

function shouldPreferSemanticText(node, semanticText, renderedText) {
  if (!semanticText || !renderedText || semanticText === renderedText) return false;
  if (!(node instanceof Element)) return false;
  const textTransform = window.getComputedStyle(node).textTransform;
  return textTransform && textTransform !== "none";
}

function getAccessibleText(node) {
  if (!(node instanceof Element)) return "";
  return cleanText(node.getAttribute("aria-label") || node.getAttribute("title") || node.getAttribute("alt") || "");
}

function cacheKey(text) {
  return cleanText(text).slice(0, 900).toLowerCase();
}

function shouldTranslate(text) {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
  return chineseChars / Math.max(text.length, 1) < 0.08;
}

function shouldProcessText(text, node) {
  if (!text || text.length > 520 || !shouldTranslate(text)) return false;
  if (translateLocalText(text)) return true;
  if (isLowValueText(text)) return false;
  if (text.length >= 18) return true;
  return isPriorityShortTextNode(node, text);
}

function isPriorityShortTextNode(node, text) {
  if (!(node instanceof Element)) return false;
  if (text.length < 3 || !/[A-Za-z]/.test(text)) return false;
  if (/^[A-Z0-9&.+#-]{2,8}$/.test(text)) return false;

  if (node.matches("h1,h2,h3,h4,h5,h6,[role='heading'],figcaption")) return true;
  if (node.matches("[class*='Headline'],[class*='headline'],[class*='Title'],[class*='title'],[class*='Heading'],[class*='heading']")) return true;
  if (node.closest("[class*='Headline'],[class*='headline'],[class*='Title'],[class*='title'],[class*='Heading'],[class*='heading']")) return true;

  const inReadableArea = Boolean(node.closest("article,main,section,[role='article']"));
  if (!inReadableArea) return false;

  if (node.matches("a")) return isTitleLikeText(node, text);
  return node.matches("p,li,span,div") && isTitleLikeText(node, text);
}

function getCandidatePriority(node, text) {
  if (!(node instanceof Element)) return 9;
  if (translateLocalText(text)) return 0;
  if (node.matches("h1,h2,h3,h4,h5,h6,[role='heading']")) return 1;
  if (node.matches("[class*='Headline'],[class*='headline'],[class*='Title'],[class*='title'],[class*='Heading'],[class*='heading']")) return 2;
  if (node.closest("[class*='Headline'],[class*='headline'],[class*='Title'],[class*='title'],[class*='Heading'],[class*='heading']")) return 3;
  if (node.matches("figcaption")) return 4;
  if (node.matches("a,button,[role='button'],[role='tab']")) return 5;
  return 6;
}

function isTitleLikeText(node, text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6) return false;

  const style = window.getComputedStyle(node);
  const fontSize = parseFloat(style.fontSize) || 0;
  const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
  const rect = node.getBoundingClientRect();
  return fontSize >= 14 && fontWeight >= 500 && rect.width >= 24 && rect.height >= 12;
}

function isVisibleNearViewport(node) {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight + 1400 && rect.bottom > -500 && style.visibility !== "hidden" && style.display !== "none";
}

function isLeafTextCandidate(node) {
  const text = cleanText(node.innerText || node.textContent || "");
  if (!text) return false;

  const childTextLength = [...node.children]
    .filter((child) => !child.classList?.contains("codex-zh-translation"))
    .reduce((sum, child) => sum + cleanText(child.textContent || "").length, 0);

  return childTextLength < Math.max(24, text.length * 0.55);
}

function applyLocalVisibleTranslations() {
  const localItems = [...document.querySelectorAll(TEXT_SELECTOR)]
    .filter((node) => !node.closest(SKIP_SELECTOR))
    .filter((node) => !STATE.translated.has(node) && !STATE.queued.has(node))
    .filter((node) => !node.closest("[data-codex-zh-local='true']"))
    .filter((node) => !node.querySelector("[data-codex-zh-local='true']"))
    .filter((node) => isVisibleNearViewport(node))
    .map((node) => ({ node, text: getCandidateText(node) }))
    .filter(({ text }) => translateLocalText(text))
    .sort((a, b) => getNodeDepth(b.node) - getNodeDepth(a.node))
    .slice(0, 40);

  localItems.forEach(({ node, text }) => {
    if (node.closest("[data-codex-zh-local='true']") || node.querySelector("[data-codex-zh-local='true']")) return;
    STATE.translated.add(node);
    applyInlineLocalTranslation(node, text, translateLocalText(text));
  });
}

function isLowValueText(text) {
  if (/^\d+\s*(mins?|hours?|days?)\s+ago\b/i.test(text)) return true;
  if (/^[\d\s:./-]+$/.test(text)) return true;
  return false;
}

function translateLocalText(text) {
  const key = cleanText(text).toLowerCase();
  if (LOCAL_TRANSLATIONS.has(key)) return LOCAL_TRANSLATIONS.get(key);

  const percentOff = key.match(/^(\d+%)\s*off$/);
  if (percentOff) return `${percentOff[1]}优惠`;

  if (key.endsWith("new")) {
    const base = key.slice(0, -3).trim();
    if (LOCAL_TRANSLATIONS.has(base)) return `${LOCAL_TRANSLATIONS.get(base)} 新`;
  }

  const discount = key.match(/^(.+?)(\d+%\s*off)$/);
  if (discount) {
    const base = cleanText(discount[1]);
    const baseTranslation = LOCAL_TRANSLATIONS.get(base) || base;
    return `${baseTranslation} ${discount[2].replace(/\s*off/i, "%优惠").replace("%%", "%")}`;
  }

  const football = key.match(/^football\s+(\d{4})$/);
  if (football) return `${football[1]}足球`;
  return "";
}

function applyInlineLocalTranslation(node, originalText, translation) {
  if (applyAccessibleTranslation(node, translation)) return;

  const current = cleanText(node.innerText || node.textContent || "");
  if (!current || current.includes(translation)) return;

  node.dataset.codexZhOriginal = originalText;
  node.dataset.codexZhLocal = "true";

  if (applyCompositeBadgeTranslation(node, originalText)) return;

  const textNodes = [...node.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE && cleanText(child.textContent));
  if (textNodes.length === 1) {
    textNodes[0].textContent = `${cleanText(textNodes[0].textContent)} ${translation}`;
    return;
  }

  node.append(document.createTextNode(` ${translation}`));
}

function applyAccessibleTranslation(node, translation) {
  if (!(node instanceof Element)) return false;

  let changed = false;
  for (const attr of ["aria-label", "title", "alt"]) {
    const value = cleanText(node.getAttribute(attr) || "");
    if (!value || value.includes(translation)) continue;
    node.setAttribute(attr, `${value} ${translation}`);
    changed = true;
  }

  if (!changed || cleanText(node.textContent || "")) return changed;

  const label = document.createElement("span");
  label.className = "codex-zh-translation codex-zh-accessible-label";
  label.textContent = translation;
  copyTextStyle(node, label);
  node.insertAdjacentElement("afterend", label);
  return true;
}

function copyTextStyle(source, target) {
  const style = window.getComputedStyle(source);
  [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "textDecoration",
    "color",
    "textAlign"
  ].forEach((property) => {
    target.style[property] = style[property];
  });
}

function applyCompositeBadgeTranslation(node, originalText) {
  const key = cleanText(originalText).toLowerCase();
  const newBase = key.endsWith("new") ? key.slice(0, -3).trim() : "";
  const discount = key.match(/^(.+?)(\d+%\s*off)$/);

  if (newBase && LOCAL_TRANSLATIONS.has(newBase)) {
    translateDirectTextNode(node, newBase, LOCAL_TRANSLATIONS.get(newBase));
    translateChildText(node, "new", "新");
    return true;
  }

  if (discount) {
    const base = cleanText(discount[1]);
    const baseTranslation = LOCAL_TRANSLATIONS.get(base);
    if (!baseTranslation) return false;
    translateDirectTextNode(node, base, baseTranslation);
    return true;
  }

  return false;
}

function translateDirectTextNode(node, original, translation) {
  const target = original.toLowerCase();
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const text = cleanText(child.textContent);
    if (text.toLowerCase() !== target || text.includes(translation)) continue;
    child.textContent = `${text} ${translation} `;
    return true;
  }
  node.append(document.createTextNode(` ${translation}`));
  return false;
}

function translateChildText(node, original, translation) {
  if (!translation) return;
  const target = original.toLowerCase();
  for (const child of node.children) {
    const text = cleanText(child.textContent || "");
    if (text.toLowerCase() !== target || text.includes(translation)) continue;
    child.append(document.createTextNode(` ${translation}`));
    child.dataset.codexZhLocal = "true";
    return;
  }
}

function getNodeDepth(node) {
  let depth = 0;
  let current = node;
  while (current?.parentElement) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

function sanitizeTranslation(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\/?think\b[:：]?\s*/gim, "")
    .replace(/\n\/?think\b[:：]?\s*/gim, "\n")
    .replace(/^(?:\[\d+\]|\d+[.)、：:])\s*/, "")
    .trim();
}

function formatError(error) {
  const message = error?.message || "未知错误";
  if (message.includes("Failed to fetch")) {
    return "无法连接本机翻译服务。请确认 NMT 服务或 Ollama 正在运行。";
  }
  if (message.includes("本机 NMT")) return "无法连接本机 NMT 服务，已尝试回退。请确认 start-nmt-service.sh 正在运行。";
  return message;
}
