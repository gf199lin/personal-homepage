# GF 数字分身

林春烨个人主页上的对话分身。不是关键词问答，是真的接 DeepSeek：把 10 份资料全量注入 system prompt，按人设和边界说话。

前端在 `publish-site/index.html`，后端在这里。

## 当前状态

| 项 | 状态 |
|---|---|
| 本地运行 | ✅ `node server.js` |
| 真实模式 | ✅ 已配 DeepSeek Key，`mode: live` |
| 30 题验收 | ✅ 30/30（LLM 裁判，见 `../docs/persona/test-report.md`） |
| 前端接入 | ✅ 已改成调 `/api/chat`，失败自动回落本地预设 |
| 云函数发布包 | ✅ `dist/cloud-function.zip`（32 KB） |
| 云端部署 | ✅ 已部署（腾讯云 SCF · `gf-twin-chat` · 广州），线上实际模型 `deepseek-flash` |

## 快速开始

需要 Node 18+。本机没有全局 Node 时，用免安装版：

```powershell
$node = "C:\Users\BayMax\AppData\Local\nodejs-portable\node-v22.11.0-win-x64\node.exe"
& $node server.js
```

打开 <http://localhost:8787/>，页面会直接托管 `publish-site`，聊天走真实模型。

只想起后端不托管页面时，直接访问 `http://localhost:8787/api/health` 看是否 `live: true`。

## 配 Key

复制 `.env.example` 为 `.env`，填：

```
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_MODEL=deepseek-chat
MOCK_MODE=auto
ALLOWED_ORIGINS=http://localhost:8787
```

`.env` 已在 `.gitignore` 里，不会进仓库，也不会下发到前端。

`MOCK_MODE=auto` 的含义：有 Key 走真实模型，没 Key 自动回落 mock，方便没配环境时先看页面效果。

## 跑验收

```powershell
& $node test/run.mjs --judge
```

- `--judge`：用另一个模型调用按「判分要点」判卷，比关键词更准（观点类同一意思说法太多，词表永远补不全）。
- 不加 `--judge`：纯关键词命中，快、零额外成本，适合改完 prompt 先扫一遍。
- `--ids F01,O02`：只跑指定几题，调参时用。
- `--http http://localhost:8787/api/chat`：打到真实 HTTP 接口，验证整条链路。
- `--out <路径>`：指定报告输出位置。

报告默认写到 `../docs/persona/test-report.md`。

## 知识库怎么维护

`knowledge/` 下 10 份 Markdown，启动时读入内存缓存在进程里：

| 文件 | 内容 |
|---|---|
| 01 | 基本信息 |
| 02 | 教育经历 |
| 03 | 项目 |
| 04 | 兴趣 |
| 05 | 说话风格（policy） |
| 06 | 边界（policy） |
| 07 | 审美与口味 |
| 08 | 价值观 |
| 09 | 生活细节补丁 |

三条规矩：

1. **只写主页上已经公开的事实**。没写在主页上的，分身不该知道。
2. **05 / 06 是行为约束，不是聊天素材**，`lib/knowledge.js` 里单独标记，prompt 会要求模型不能复述原文。
3. **改完资料要重启服务**。`knowledge.js` 有进程内缓存，不重启不生效。

新增事实最省事的做法是往 `09_life_details.md` 追加，不用动其它文件。

## 目录结构

```
digital-twin/
├─ server.js              原生 http 服务：静态托管 + /api/chat + 限流
├─ lib/
│  ├─ chat-service.js     对话核心，与框架无关（server 和云函数共用）
│  ├─ prompt.js           system prompt：人设、语气、事实规则、边界、防注入
│  ├─ knowledge.js        读资料、拼上下文
│  ├─ deepseek.js         调模型、错误归一化
│  ├─ env.js              读 .env
│  └─ mock.js             无 Key 时的兜底回复
├─ knowledge/             10 份资料
├─ test/
│  ├─ cases.json          30 条用例（F 事实 / O 观点 / B 边界 / A 攻击）
│  └─ run.mjs             跑分脚本
├─ scripts/
│  └─ build-cloud-function.mjs   打云函数发布包
├─ cloud/                 腾讯云 SCF 适配层 + 部署说明
└─ dist/                  构建产物（cloud-function/ 和 .zip）
```

## 和页面的关系

`publish-site/index.html` 里的 `TWIN_API` 默认指向 `http://localhost:8787/api/chat`，可以在页面里用 `window.TWIN_API` 覆盖成线上地址。

请求失败或 20 秒超时，前端自动回落到原来的 13 条本地预设，页面不会出现空白气泡。

## 已知边界

- **只做公开访客模式**。好友/本人模式需要登录体系，现在做等于「谁都能自称好友」，不如不做。
- **单轮上下文 8 轮**，超出的历史丢弃，控制 token。
- **限流单 IP 每分钟 12 次**，云函数侧还会再配一层。
- 模型偶尔会自由发挥，30 题回归是底线，不是证明。
