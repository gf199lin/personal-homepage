# GitHub 上传完整操作手册（网页版·不装任何软件）

> 目标：把 233 个文件发布到 **https://gf199lin.github.io/personal-homepage/**
> 全程只在浏览器里操作，**不需要安装任何软件**。

---

## 0. 准备

我已经在桌面打开了文件夹 **`.deepworks\tmp\upload2`**，里面有 4 个批次文件夹：

| 批次文件夹 | 里面装着 | 文件数 |
|---|---|---|
| `1-网格图` | 一个 `assets` 文件夹 | 91 |
| `2-大图` | 一个 `assets` 文件夹 | 91 |
| `3-深圳图` | 一个 `assets` 文件夹 | 14 |
| `4-首页` | 一个 `index.html` | 1 |

> 如果桌面上还开着上次那个含 `A-highschool-grid` 的窗口，**关掉它，只认这次的 `upload2` 窗口**。

### 三条铁律（照做就不会再错）

1. **所有批次都在同一个页面操作**：仓库根页 `https://github.com/gf199lin/personal-homepage`
2. 每个批次，**只把批次文件夹里那一个 `assets`（或 `index.html`）拖进去** —— 不要拖批次文件夹本身
3. 拖完先看上传区的列表：每项左边应带**完整路径**（如 `assets/highschool/hs-001.jpg`）；确认无误再滚到**页面最底部**点 `Commit changes`

---

## 第 1 批：高中网格图（91 张）

1. 浏览器打开 → **`https://github.com/gf199lin/personal-homepage`**
2. 点页面中上部 **`Add file`** → 选 **`Upload files`**
3. 切到 `upload2` 窗口，**打开 `1-网格图`**，把里面的 **`assets` 文件夹**拖进网页上传区
4. 看上传区列表：应有 **91 项**，形如 `assets/highschool/hs-001.jpg` ✅
5. 滚到页面**最底部** → 点绿色 **`Commit changes`**
6. 等页面跳转完成（约 5~20 秒）

## 第 2 批：高中大图（91 张）

1. 还是**同一个页面**（仓库根），再点 `Add file` → `Upload files`
2. 这次打开 **`2-大图`**，把里面的 **`assets` 文件夹**拖进去
3. 列表应是 **91 项**，形如 `assets/highschool/full/hs-001.jpg` ✅
4. 滚到最底 → `Commit changes`

## 第 3 批：深圳（14 张）

1. 还是同一个页面，`Add file` → `Upload files`
2. 打开 **`3-深圳图`**，拖里面的 **`assets` 文件夹**
3. 列表应是 **14 项**，形如 `assets/shenzhen/sz-01.jpg` + `assets/shenzhen/full/sz-01.jpg` ✅
4. 滚到最底 → `Commit changes`

## 第 4 批：首页文件（1 个）

1. 还是同一个页面，`Add file` → `Upload files`
2. 打开 **`4-首页`**，拖里面的 **`index.html`**
3. 列表只应有 1 项：`index.html` ✅
4. 滚到最底 → `Commit changes`

> 首页**最后**传：如果先传它、图片还没上来，访客会看到裂图。

---

## 第 5 步：删掉上次传错位置的 3 个目录

上次的图片落在了仓库根下的这 3 个位置，属于多余副本，删掉：

1. 打开 → `https://github.com/gf199lin/personal-homepage/tree/main/A-highschool-grid`
2. 点右上角 **`...`** 菜单 → **`Delete directory`**
3. 在确认页点绿色 **`Commit changes`**
4. 同样处理第二个：`https://github.com/gf199lin/personal-homepage/tree/main/highschool`
5. 同样处理第三个：`https://github.com/gf199lin/personal-homepage/tree/main/shenzhen`

> ⚠️ 删的是**仓库根下面**的 `highschool`、`shenzhen`。
> **千万不要**去动 `assets/highschool`、`assets/shenzhen` —— 那是刚传好的正确位置。
> 从地址栏看：`.../tree/main/highschool` 是要删的；`.../tree/main/assets/highschool` 是要留的。

---

## 第 6 步：看线上效果

等 **1~2 分钟**（GitHub 在后台构建），打开：

**`https://gf199lin.github.io/personal-homepage/`**

按 **`Ctrl + F5`** 强制刷新，滚到高中照片墙和深圳板块，点开图片确认不裂图。

---

## 上传后自查（可选）

浏览器打开下面 4 个地址，数字对得上就成功：

| 地址 | 应看到 |
|---|---|
| `.../tree/main/assets/highschool` | 91 个 `hs-0NN.jpg` + 一个 `full` 文件夹 |
| `.../tree/main/assets/highschool/full` | 91 个 `hs-0NN.jpg` |
| `.../tree/main/assets/shenzhen` | 7 个 `sz-0N.jpg` + 一个 `full` 文件夹 |
| `.../tree/main/assets/shenzhen/full` | 7 个 `sz-0N.jpg` |

---

## 出问题对照表

| 现象 | 原因 / 怎么办 |
|---|---|
| 上传区列表里没有 `assets/` 前缀（只有 `hs-001.jpg`） | 说明不在仓库根页，或拖错了东西 → 点 `Cancel`，回到仓库根页重来 |
| 提示 "Yowza, that's a lot of files… fewer than 100" | 一次拖多了 → `Cancel`，只拖那一个 `assets` 文件夹（每批都 < 100） |
| 找不到 `Commit changes` 按钮 | 页面拉到**最底部**，绿色按钮在最下面 |
| 传完网站还是旧样子 / 图片裂 | 正常延迟 → 等 2 分钟再 `Ctrl + F5`；手机上看要清一下缓存 |
| `Add file` 找不到 | 确认你是登录状态，且在 `gf199lin/personal-homepage` 这个仓库页面上 |
| 拖进去后想换一批 | 上传区右上角有 `Cancel`，可以整批取消 |

---

## 位置速查

- 批次文件夹：`C:\Users\BayMax\Desktop\个人主页\.deepworks\tmp\upload2\`
- 成品目录：`C:\Users\BayMax\Desktop\个人主页\publish-site\`
- 站点：https://gf199lin.github.io/personal-homepage/
- 仓库：https://github.com/gf199lin/personal-homepage
