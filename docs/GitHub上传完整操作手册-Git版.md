# GitHub 上传完整操作手册（Git 版）

> 目标：把 `publish-site\` 里的 233 个文件（首页 + 高中 91+91 张 + 深圳 7+7 张 + 原有素材）发布到
> **https://gf199lin.github.io/personal-homepage/**
>
> 全程只在一个 PowerShell 窗口里粘贴 2 条命令 + 在浏览器点几下，**不需要拖拽任何文件**。

---

## 一次性准备（只做这一次，以后上传都不用再做）

### 第 1 步：装 Git

1. 按 `Win` 键，输入 `powershell`，回车，打开 **Windows PowerShell** 窗口。
2. 复制下面这一整行，粘进去，回车：

```
winget install --id Git.Git -e --source winget
```

3. 如果弹出「是否允许此应用对你的设备进行更改」，点 **是**。
4. 等到出现 **`Successfully installed`** 字样。
5. **关掉这个 PowerShell 窗口，重新开一个新的**（必须，让新命令生效）。

> 如果提示 winget 不认识：说明系统太旧，去 https://git-scm.com/download/win 手动下载安装，一路点 Next。

### 第 2 步：确认 Git 装好了

在**新开的** PowerShell 里粘这一行，回车：

```
git --version
```

看到类似 `git version 2.51.0.windows.1` 就成功了。

### 第 3 步：生成访问令牌（Token）

1. 浏览器打开：**`https://github.com/settings/tokens`**
2. 点右上 **`Generate new token`** → 下拉里选 **`Generate new token (classic)`**
3. `Note`（备注）随便填：`personal-homepage`
4. `Expiration`（有效期）选 **`90 days`**
5. `Select scopes` 里**只勾最上面那个大项 `repo`**（勾它会自动带上下面几个子项）
6. 拉到页面最底部，点绿色 **`Generate token`**
7. 页面上会出现一串 `ghp_XXXXXXXXXXXXXXXX` —— **这串只显示这一次**
   → 点复制按钮，先粘到记事本里（例如文件名 `token.txt`）备用。

> Token = 一次性的钥匙，等于"允许推送代码"的密码。用完可以随时回来点 `Revoke` 删掉。

---

## 正式上传

### 第 4 步：关闭网页上的操作

上传期间**不要在浏览器里对仓库做任何操作**（不要上传、不要删文件），避免和脚本冲突。

### 第 5 步：跑一键上传脚本

在 PowerShell 里粘这一整行，回车：

```
powershell -ExecutionPolicy Bypass -File "C:\Users\BayMax\Desktop\个人主页\.deepworks\tmp\fix_github.ps1"
```

脚本会依次做 6 件事，你会看到：

| 屏幕提示 | 含义 |
|---|---|
| `=== 1/6 检查 git ===` + `git version ...` | 找到 Git |
| `=== 2/6 输入 GitHub Token ===` 然后停在 `Token:` | **把第 3 步复制的 `ghp_...` 粘进来，回车**（粘贴时屏幕不显示字符，是正常的） |
| `=== 3/6 下载仓库 ===` | 把线上仓库下到本地临时目录 |
| `=== 4/6 清理上传错位的目录 ===` + 几行 `删除 xxx\ (错位)` | 清掉上次传错位置的文件夹 |
| `=== 5/6 把正确内容放进去 ===` + `现在 assets\ 下共 233 个文件` | 把正确文件放对位置 |
| `=== 6/6 提交并上传 ===` | 推送回 GitHub |

看到最后一行绿色 **`全部完成！`** 就是成功了。

> 首次运行要下载约 27 MB，视网速等 1~3 分钟。

### 第 6 步：检查仓库结构（可选，自己看一眼）

浏览器打开下面两个地址，应分别看到 **91 个文件 + 一个 `full` 文件夹**、**7 个文件 + 一个 `full` 文件夹**：

- `https://github.com/gf199lin/personal-homepage/tree/main/assets/highschool`
- `https://github.com/gf199lin/personal-homepage/tree/main/assets/shenzhen`

### 第 7 步：看线上效果

等 1~2 分钟（GitHub 在后台构建），然后打开并**强制刷新**：

- `https://gf199lin.github.io/personal-homepage/`
- 强制刷新 = `Ctrl` + `F5`（手机上是清缓存后重开）
- 顺手滚到"深圳"板块和高中照片墙，点开图片确认不裂图

---

## 以后更新页面（同样只需 2 条命令）

1. 我改完 `homepage\lcy homepage.html` 并同步进 `publish-site\` 后会告诉你；
2. 你直接在 PowerShell 里**再跑一次第 5 步那一行命令**（Token 还是那个，90 天内有效）；
3. 等 1~2 分钟刷新站点即可。

> 如果 90 天后 Token 过期，重复第 3 步生成一个新的就行。

---

## 出问题对照表

| 屏幕出现 | 原因 / 怎么办 |
|---|---|
| `没检测到 git` | 第 1 步刚装完但窗口是旧的 → **关掉 PowerShell 重开一个**再跑 |
| `Token:` 粘完回车，提示 `推送失败` | ① token 没勾 `repo` ② 复制时少了字符（注意别带空格）③ token 已过期 → 回到第 3 步重新生成一个 |
| `clone 失败` / `SSL` 报错 | 网络到 GitHub 不通 → 稍等 1 分钟重跑；若用了代理/VPN，先确保能正常打开 github.com |
| `push` 提示 `rejected` / `non-fast-forward` | 脚本下载仓库之后、推送之前，网页上又改过仓库 → 直接**重跑一次脚本**即可 |
| `没有需要提交的变化` | 说明线上已经是对的，属于正常情况，继续看后面的推送结果 |
| 脚本窗口一闪就没了 | 用上面的完整命令（`powershell -ExecutionPolicy Bypass -File "..."`），不要双击文件 |

---

## 文件位置速查

- 要发布的成品目录：`C:\Users\BayMax\Desktop\个人主页\publish-site\`
- 一键上传脚本：`C:\Users\BayMax\Desktop\个人主页\.deepworks\tmp\fix_github.ps1`
- 站点地址：https://gf199lin.github.io/personal-homepage/
- 仓库地址：https://github.com/gf199lin/personal-homepage
