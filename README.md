# WeChat Bot

一个基于 Wechaty、Ollama 和本地 Agent 架构的微信私聊自动回复机器人。

当前主流程：

```text
微信私聊消息
-> Wechaty message event
-> Data
-> ConversationManager
-> SingleClientAgent
-> OllamaClient
-> WechatStream
-> 微信回复
```

## 功能

- 监听微信私聊文本消息
- 跳过群聊、公众号等非个人会话
- 按联系人维护独立 Agent 和对话历史
- 每隔固定时间批量处理同一个人的消息
- 使用本地 Ollama 模型生成回复
- 回复文本会按标点拆分成多条微信消息
- 预留图片、语音、文件等 `Data` 类型
- 已加入本地语音转文字工具类 `AudioTranscriber`

## 环境要求

- Node.js 20+
- npm
- Ollama
- 一个可用的 Ollama 模型，例如：

```powershell
ollama pull qwen3.5:4b
```

语音转文字可选依赖：

- `sherpa-onnx-node`
- SenseVoice ONNX 模型
- 如果微信语音不是 wav，还需要 `ffmpeg` 做格式转换

## 安装依赖

普通安装：

```powershell
npm install
```

国内网络可以临时使用镜像源：

```powershell
npm --registry=https://registry.npmmirror.com install
```

## 启动 Ollama

先启动 Ollama 服务：

```powershell
ollama serve
```

如果你使用 Ollama 桌面版，打开 Ollama App 通常也会启动本地服务。

确认服务可用：

```powershell
ollama list
```

默认 API 地址：

```text
http://127.0.0.1:11434
```

## 配置

可以通过环境变量覆盖默认模型和 Ollama 地址：

```powershell
$env:OLLAMA_MODEL="qwen3.5:4b"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

默认值：

```text
OLLAMA_MODEL=qwen3.5:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

微信回复周期在 `src/main.ts` 中配置：

```ts
const REPLY_INTERVAL_SECONDS = 10
```

## 开发运行

直接运行 TypeScript：

```powershell
npm run dev
```

启动后会出现微信登录二维码，扫码登录即可。

## 构建

```powershell
npm run build
```

构建产物会输出到：

```text
dist/
```

## 生产运行

先构建：

```powershell
npm run build
```

再运行：

```powershell
npm run start
```

## 一键构建脚本

Windows：

```powershell
.\build.bat
```

Linux/macOS：

```sh
chmod +x ./build.sh
./build.sh
```

这些脚本会尝试：

1. 检查或安装 Ollama
2. 启动 Ollama 服务
3. 拉取 Ollama 模型
4. 下载并解压 SenseVoice 语音转文字模型
5. 安装 npm 依赖
6. 编译项目

## 语音转文字模型

推荐使用：

```text
sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17
```

默认模型目录：

```text
models/sherpa-onnx/
```

需要包含：

```text
model.int8.onnx
tokens.txt
```

运行 `build.bat` 或 `build.sh` 时会自动下载并解压这个模型。

代码入口：

```ts
import { AudioTranscriber } from "./util/AudioTranscriber.js"

const transcriber = new AudioTranscriber()
const text = await transcriber.transcribeFile("voice.wav")
```

注意：当前工具类主要读取 wav。微信语音接入时，需要先把微信语音文件转换成 wav，再调用 `transcribeFile()`。

## 项目结构

```text
src/
  agent/
    Agent.ts
    SingleClientAgent.ts
  client/
    Client.ts
    OllamaClient.ts
    TestClient.ts
  stream/
    IOStream.ts
    StandardStream.ts
    WechatStream.ts
  util/
    Conversation.ts
    Misc.ts
    AudioTranscriber.ts
  ConversationManager.ts
  main.ts
```

## 日志

当前只保留 `WechatBot` 相关日志：

```text
[HH:MM:SS WechatBot/INFO]: Received from ...
[HH:MM:SS WechatBot/INFO]: Sent to ...
```

## Git 忽略文件

`.gitignore` 已排除：

```text
dist/
.vscode/
node_modules/
wechat-bot.memory-card.json
```

## 常见问题

如果出现：

```text
connect ECONNREFUSED 127.0.0.1:11434
```

说明 Ollama 服务没有启动。先运行：

```powershell
ollama serve
```

如果模型回复很慢，通常是显卡或 CPU 正在满载。可以换更小模型，或者缩短 prompt、限制模型输出长度。
