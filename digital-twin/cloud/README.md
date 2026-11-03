# 数字分身 · 腾讯云云函数部署说明

前端留在 GitHub Pages，只把对话后端放到腾讯云云函数。Key 只存在云端环境变量里。

## 0. 前置

- 腾讯云账号，并完成**实名认证**（个人身份证即可）
- 不需要服务器、不需要备案、不需要 Docker
- 建议先在「费用中心 → 预算管理」设一个每月 10 元的提醒

## 1. 生成本地发布包

```powershell
cd digital-twin
node scripts/build-cloud-function.mjs
```

产物：

- `dist/cloud-function/` —— 目录形式
- `dist/cloud-function.zip` —— **上传用这个**（约 32 KB）

包里只有 `index.js`、`app.mjs`、`lib/*.mjs`、`knowledge/*.md`、`package.json`，**不会包含 `.env`**。

## 2. 创建云函数

腾讯云控制台 → 云函数 SCF → 函数服务 → 新建：

| 配置项 | 值 |
|---|---|
| 创建方式 | 从头开始 / 空白函数 |
| 函数名称 | `gf-twin-chat` |
| 运行环境 | Nodejs18.15 或 Nodejs20 |
| 提交方法 | 上传本地 ZIP 包 → 选 `dist/cloud-function.zip` |
| 执行方法 | `index.main` |
| 内存 | 128 MB 足够 |
| 超时时间 | **30 秒**（默认 3 秒会超时，必须改） |

## 3. 配置环境变量

函数配置 → 环境变量，逐条添加：

| 变量名 | 值 |
|---|---|
| `DEEPSEEK_API_KEY` | 你的 `sk-...`（只在云端填，不要写进代码） |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `ALLOWED_ORIGINS` | `https://gf199lin.github.io`（本地联调可再加 `http://localhost:8787`，逗号分隔） |
| `MOCK_MODE` | `auto` |
| `RATE_LIMIT_PER_MIN` | `12` |

改完环境变量后点「保存」，函数会自动重启。

## 4. 开启函数 URL（拿到公网地址）

> 腾讯云 API 网关触发器已于 2025 年 6 月 30 日下线，控制台里会置灰不可选。现在用 **函数 URL** 替代，本项目的代码已经兼容它的请求格式。

函数详情 → 「函数 URL」→ 开启：

| 配置项 | 值 |
|---|---|
| 别名/版本 | 别名：`默认流量` |
| 公网访问 | **启用**（不勾外网访问不到） |
| 内网访问 | 不勾 |
| CORS | 关闭（代码里已经自己返回跨域头，平台再开会产生重复头） |
| 授权类型 | 开放（免鉴权，前端拿不到密钥） |
| 参数兼容 | **启用**（把请求转成 API 网关事件格式，`event.path`/`event.httpMethod`/`event.body` 才与代码一致） |

本项目当前地址：

```
https://1524567200-j8ax9tqsih.ap-guangzhou.tencentscf.com
```

**注意：函数 URL 没有 `/release/` 前缀**，路径就是函数内部路由，所以直接访问：

```
https://1524567200-j8ax9tqsih.ap-guangzhou.tencentscf.com/api/health
```

应返回：

```json
{"ok":true,"live":true,"mockMode":"auto","model":"deepseek-chat"}
```

`live:true` 说明 Key 生效；`live:false` 说明环境变量没配上或函数没重启。


## 5. 接到前端

拿到地址后，在 `publish-site/index.html` 里加一行（放在页面原有的 `TWIN_API` 逻辑之前即可，当前已写入）：

```html
<script>
  window.TWIN_API = 'https://1524567200-j8ax9tqsih.ap-guangzhou.tencentscf.com/api/chat';
</script>
```

页面本身已经支持这个覆盖（见 `publish-site/index.html` 中的 `TWIN_API` 定义），不需要改其它逻辑。

同时确认 `ALLOWED_ORIGINS` 里包含 `https://gf199lin.github.io`，否则浏览器会拦掉跨域请求。

## 6. 上线验收

1. 电脑浏览器打开个人主页 → 数字分身能正常回答
2. 手机 4G 网络再试一次（排除公司/校园网代理影响）
3. 开发者工具 Network 里 `/api/chat` 返回 200，无 CORS 报错
4. 连续快速提问 13 次，第 13 次应返回 429（限流生效）

## 7. 维护

- 改了知识库或提示词：重新 `node scripts/build-cloud-function.mjs`，控制台重新上传 zip 并「保存」
- 改了 Key：只改环境变量，不用重新上传代码
- 看日志：函数管理 → 日志查询，`[upstream]` 开头的是 DeepSeek 上游报错

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `/api/health` 返回 502 / 函数报错 | 入口写错或没上传成功 | 确认执行方法为 `index.main` |
| 对话 3 秒左右中断 | 函数超时太短 | 超时改成 30 秒 |
| 浏览器报 CORS | `ALLOWED_ORIGINS` 没配或少了协议头 | 填完整 `https://gf199lin.github.io` |
| `live:false` | 环境变量没生效 | 保存后等函数重启，重开 health |
| 502 且日志有 `401` | Key 错误 | 重新填 `DEEPSEEK_API_KEY` |
| 502 且日志有 `402` | 余额不足 | 充值 DeepSeek |

## 成本说明

- 云函数按调用次数 + 资源用量计费，个人主页的访问量基本落在免费额度内；具体额度以控制台「费用中心」当前政策为准
- DeepSeek 侧：每次对话约 9000 输入 tokens，但命中上下文缓存后实际计费大幅下降（实测 9330 tokens 中 9088 命中缓存）
