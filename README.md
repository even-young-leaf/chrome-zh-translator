# 页面中文翻译助手

当前版本：`2.0.1`

一个给 Chrome / Chromium 浏览器使用的本地网页翻译扩展。它会在打开后自动把网页上的英文界面、标题、正文翻译成中文。2.0 版本优先使用快速翻译后端：Chrome 原生 Translator API、本机专业 NMT 服务，然后才回退到本机 Ollama 大模型，不需要 OpenAI API，也不会按调用次数付费。

## 功能

- 自动翻译当前网页，不需要手动选中文本。
- 自动选择快速翻译后端：Chrome 原生 Translator API 可用时优先使用。
- 内置本机 NMT 服务，基于 Argos Translate 的英译中专业翻译模型，默认监听 `127.0.0.1:11888`。
- Ollama 仍作为兜底后端，默认模型是 `qwen3:8b`。
- 内置独立词典文件 `dictionary.js`，常见按钮、菜单、导航词会本地秒翻。
- 译文尽量继承原文字体、字号、字重、颜色、行高和对齐方式。
- 支持翻译部分图标/图片的 `aria-label`、`title`、`alt` 文本。
- 选中文本时仍支持弹出翻译浮窗。

## 快速开始

先下载本仓库：

```bash
git clone https://github.com/even-young-leaf/chrome-zh-translator.git
cd chrome-zh-translator
```

如果你不会用 Git，也可以在 GitHub 页面点 `Code` -> `Download ZIP`，解压后进入解压目录。

### 启动本机 NMT 服务

2.0 默认推荐先启动本机 NMT 服务。第一次运行会创建 `.venv-nmt`、安装 `argostranslate`，并下载英译中模型；之后启动会快很多。

```bash
chmod +x start-nmt-service.sh
./start-nmt-service.sh
```

服务正常时可以用下面命令检查：

```bash
curl http://127.0.0.1:11888/health
```

打开扩展弹窗后，翻译后端保持“自动”即可。自动模式会按顺序尝试：

1. Chrome 原生 Translator API
2. 本机 NMT 服务
3. Ollama

### 可选：安装 Ollama 兜底

如果你希望 NMT 不可用时仍能靠本机大模型翻译，可以继续运行下面对应系统的一键脚本。

### macOS

```bash
chmod +x scripts/install-macos.sh
./scripts/install-macos.sh
```

低内存机器可以拉更小的模型：

```bash
MODEL=gemma3:4b ./scripts/install-macos.sh
```

### Linux

```bash
chmod +x scripts/install-linux.sh
./scripts/install-linux.sh
```

低内存机器可以拉更小的模型：

```bash
MODEL=gemma3:4b ./scripts/install-linux.sh
```

### Windows

在 PowerShell 里进入仓库目录后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

低内存机器可以拉更小的模型：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -Model gemma3:4b
```

### Ollama 脚本会做什么

- 如果本机没有 Ollama，会调用 Ollama 官方安装脚本安装。
- 配置 `OLLAMA_HOST=127.0.0.1:11434`。
- 配置 `OLLAMA_ORIGINS`，允许本扩展访问本机 Ollama，避免 `Ollama HTTP 403`。
- 启动 Ollama 服务，并尽量做成重启后仍然生效。
- 拉取默认模型 `qwen3:8b`，或你指定的 `MODEL` / `-Model`。
- 尝试打开 `chrome://extensions/`。

不同系统的持久化方式：

- macOS: 创建用户级 LaunchAgent，登录后自动用正确的 `OLLAMA_ORIGINS` 启动 Ollama。
- Linux: 优先写入 `ollama.service` 的 systemd drop-in 配置，然后重启服务。
- Windows: 写入用户环境变量，重启 Ollama 后继续生效。

macOS 上如果菜单栏里的 Ollama App 也在后台启动了自己的服务，可能会抢占 `localhost:11434` 并导致 403。新版扩展会自动把 `localhost` / `[::1]` 规范化成 `127.0.0.1`，安装脚本也会优先关闭这个额外的后台服务。

Chrome 不允许普通脚本静默安装未打包扩展，所以最后一步仍然需要手动做：

1. 打开 `chrome://extensions/`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本仓库目录。
5. 打开英文网页，扩展会自动翻译。

## 硬件要求

最低可用配置取决于你选择的翻译后端。

推荐配置：

- Apple Silicon Mac，16GB 以上统一内存更合适。
- 或者 Windows / Linux 机器，至少 16GB 内存。
- 磁盘预留 1GB 以上给本机 NMT 模型；如果启用 Ollama 兜底，额外预留 6GB 以上给 `qwen3:8b`。

较低配置：

- 8GB 内存机器优先使用本机 NMT 服务。
- 如果使用 Ollama，可以尝试更小模型，例如 `gemma3:4b`。

## 操作系统要求

推荐：

- macOS 14 Sonoma 或更新版本 + Google Chrome / Chromium。
- Windows 10 或更新版本 + Google Chrome / Edge / Chromium。
- 常见 Linux 发行版 + Google Chrome / Chromium。

已测试：

- macOS + Google Chrome + Ollama

只要浏览器能访问本机 `http://127.0.0.1:11888` 的 NMT 服务，或 `http://127.0.0.1:11434` 的 Ollama API，就可以使用。

## 翻译后端

点击浏览器右上角的扩展图标，可以设置：

- 翻译后端：默认“自动”
- NMT 地址：默认 `http://127.0.0.1:11888`
- Ollama 地址：默认 `http://127.0.0.1:11434`
- Ollama 模型：默认 `qwen3:8b`

后端说明：

- `自动`：先用 Chrome 原生 Translator API，再用本机 NMT，最后回退到 Ollama。
- `Chrome 原生`：只使用浏览器内置 Translator API；当前 Chrome 不支持时会报错。
- `本机 NMT`：只使用 `start-nmt-service.sh` 启动的本地专业翻译服务。
- `Ollama`：只使用本机 Ollama 大模型。

## 手动安装 Ollama 和模型

如果不想用一键脚本，可以手动安装 Ollama：

- macOS / Linux: https://ollama.com/download
- Windows: https://ollama.com/download/windows

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

一键安装脚本已经包含这一步。如果只想重新启动 Ollama，可以运行旧版启动脚本：

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

如果想让 Ollama 兜底更快，可以试试：

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

- 正文翻译请求优先发送到浏览器本地翻译能力或本机 `127.0.0.1` 翻译服务。
- 启用 Ollama 兜底时，正文翻译请求会发送到你本机的 Ollama。
- 不使用 OpenAI API。
- 不使用 Google Translate / DeepL / LibreTranslate。
- 不会把网页内容发送到外部翻译服务。

## 限制

- 真正烘焙在图片像素里的文字无法通过普通 DOM 读取，需要 OCR 或本地视觉模型。
- 扩展可以翻译图片或图标上的 `alt`、`title`、`aria-label` 文本。
- 本机 NMT 首次运行需要下载翻译模型。
- Ollama 速度取决于你的硬件和模型大小。
- 动态网页可能需要滚动后继续补翻。

## 常见问题

### 出现 `Ollama HTTP 403`

说明 Ollama 拒绝了 Chrome 扩展来源。最常见原因是：电脑重启后，Ollama 被系统自动启动了，但启动时没有带上 `OLLAMA_ORIGINS`。

另一个常见原因是：macOS 菜单栏 Ollama App 启动了自己的 `localhost:11434` 服务，而扩展访问的不是安装脚本创建的 `127.0.0.1:11434` 服务。请升级到 `1.4.2` 或更新版本，新版本会自动规避这个问题。

优先重新运行对应系统的一键安装脚本。

macOS:

```bash
./scripts/install-macos.sh
```

Linux:

```bash
./scripts/install-linux.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

手动排查时，请确认 Ollama 启动时带了：

```bash
OLLAMA_ORIGINS="chrome-extension://cplehmmdegoebbhfonddkfeefboonpdb,http://127.0.0.1,http://localhost"
```

macOS 用户如果仍然遇到 403，可以退出菜单栏里的 Ollama，再运行：

```bash
launchctl kickstart -k gui/$(id -u)/com.evenyoung.chrome-zh-translator.ollama
```

### 出现“无法连接本机翻译服务”

优先确认 NMT 服务正在运行：

```bash
curl http://127.0.0.1:11888/health
```

如果你选择了 Ollama 后端，再确认 Ollama 正在运行：


```bash
curl http://127.0.0.1:11434/api/tags
```

### 翻译慢

优先使用“自动”或“本机 NMT”后端。只有在使用 Ollama 后端时，才建议换小模型：

```bash
ollama pull gemma3:4b
```

然后在扩展弹窗里把模型改成：

```text
gemma3:4b
```

### 图片里的英文没有翻译

如果英文是图片像素的一部分，当前版本不能识别。后续可以接本地 OCR 或视觉模型来解决。
