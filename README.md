# 页面中文翻译助手

一个给 Chrome / Chromium 浏览器使用的本地网页翻译扩展。它会在打开后自动把网页上的英文界面、标题、正文翻译成中文，并优先使用本机 Ollama 大模型，不需要 OpenAI API，也不会按调用次数付费。

## 功能

- 自动翻译当前网页，不需要手动选中文本。
- 使用本机 Ollama 模型翻译正文内容，默认模型是 `qwen3:8b`。
- 内置独立词典文件 `dictionary.js`，常见按钮、菜单、导航词会本地秒翻。
- 译文尽量继承原文字体、字号、字重、颜色、行高和对齐方式。
- 支持翻译部分图标/图片的 `aria-label`、`title`、`alt` 文本。
- 选中文本时仍支持弹出翻译浮窗。

## 硬件要求

最低可用配置取决于你选择的 Ollama 模型。

推荐配置：

- Apple Silicon Mac，16GB 以上统一内存更合适。
- 或者 Windows / Linux 机器，至少 16GB 内存。
- 磁盘预留 6GB 以上给 `qwen3:8b` 模型。

较低配置：

- 8GB 内存机器可以尝试更小模型，例如 `gemma3:4b`。
- 小模型速度可能更快，但翻译质量通常不如 `qwen3:8b`。

## 操作系统要求

已测试：

- macOS + Google Chrome + Ollama

理论支持：

- Windows + Chrome / Edge / Chromium + Ollama
- Linux + Chrome / Chromium + Ollama

只要浏览器能访问本机 `http://127.0.0.1:11434` 的 Ollama API，就可以使用。

## 安装 Ollama 和模型

先安装 Ollama：

https://ollama.com/

然后拉取推荐模型：

```bash
ollama pull qwen3:8b
```

如果机器内存较小，可以改用：

```bash
ollama pull gemma3:4b
```

## 允许 Chrome 扩展访问 Ollama

Ollama 默认可能会拒绝 Chrome 扩展请求，表现为：

```text
Ollama HTTP 403
```

本扩展固定扩展 ID 为：

```text
cplehmmdegoebbhfonddkfeefboonpdb
```

### macOS

仓库里提供了启动脚本：

```bash
./start-ollama-for-chrome-translator.sh
```

如果你是从本仓库目录运行，也可以手动启动：

```bash
OLLAMA_HOST=127.0.0.1:11434 \
OLLAMA_ORIGINS="chrome-extension://cplehmmdegoebbhfonddkfeefboonpdb,http://127.0.0.1,http://localhost" \
ollama serve
```

### Windows PowerShell

```powershell
$env:OLLAMA_HOST="127.0.0.1:11434"
$env:OLLAMA_ORIGINS="chrome-extension://cplehmmdegoebbhfonddkfeefboonpdb,http://127.0.0.1,http://localhost"
ollama serve
```

### Linux

```bash
OLLAMA_HOST=127.0.0.1:11434 \
OLLAMA_ORIGINS="chrome-extension://cplehmmdegoebbhfonddkfeefboonpdb,http://127.0.0.1,http://localhost" \
ollama serve
```

## 安装 Chrome 扩展

1. 下载或克隆本仓库。
2. 打开 Chrome，进入：

```text
chrome://extensions/
```

3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库目录。
6. 打开英文网页，扩展会自动翻译。

## 配置模型

点击浏览器右上角的扩展图标，可以设置：

- Ollama 地址：默认 `http://127.0.0.1:11434`
- 模型：默认 `qwen3:8b`

如果想更快，可以试试：

```text
gemma3:4b
```

如果想更准，继续使用：

```text
qwen3:8b
```

## 词典

常见 UI 词汇在 `dictionary.js` 中维护，例如：

- Home -> 首页
- Search -> 搜索
- Pricing -> 价格
- My generations -> 我的生成

要增加词条，编辑 `dictionary.js`：

```js
globalThis.CODEX_ZH_DICTIONARY = {
  "your english text": "你的中文翻译"
};
```

扩展重新加载后生效。

## 隐私

- 正文翻译请求发送到你本机的 Ollama。
- 不使用 OpenAI API。
- 不使用 Google Translate / DeepL / LibreTranslate。
- 不会把网页内容发送到外部翻译服务。

## 限制

- 真正烘焙在图片像素里的文字无法通过普通 DOM 读取，需要 OCR 或本地视觉模型。
- 扩展可以翻译图片或图标上的 `alt`、`title`、`aria-label` 文本。
- 本地大模型速度取决于你的硬件和模型大小。
- 动态网页可能需要滚动后继续补翻。

## 常见问题

### 出现 `Ollama HTTP 403`

说明 Ollama 拒绝了 Chrome 扩展来源。请确认启动 Ollama 时设置了：

```bash
OLLAMA_ORIGINS="chrome-extension://cplehmmdegoebbhfonddkfeefboonpdb,http://127.0.0.1,http://localhost"
```

### 出现“无法连接本机 Ollama”

确认 Ollama 正在运行：

```bash
curl http://127.0.0.1:11434/api/tags
```

### 翻译慢

可以换小模型：

```bash
ollama pull gemma3:4b
```

然后在扩展弹窗里把模型改成：

```text
gemma3:4b
```

### 图片里的英文没有翻译

如果英文是图片像素的一部分，当前版本不能识别。后续可以接本地 OCR 或视觉模型来解决。
