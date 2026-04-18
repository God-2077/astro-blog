我结合你**专属的仓库地址、分支名**，给你整理**零门槛、直接复制执行**的完整流程！
先理清你的专属结构（超级清晰）：
- 🎯 **上游原仓库**：`cosZone/astro-koharu`（分支`main`）→ 代码源头
- 📢 **你的公开分支**：`God-2077/astro-blog`（分支`main`）→ Fork 自上游，公开、仅同步官方更新，不写私人修改
- 🔒 **你的私有分支**：`God-2077/astro-blog`（分支`blog`）→ 同一仓库内的私有分支，放你所有博客自定义修改

---

# 完整专属命令（直接复制用）
## 1. 首次配置（仅执行一次）
### ① 克隆你的公开 Fork 到本地
```bash
git clone git@github.com:God-2077/astro-blog.git
cd astro-blog
```

### ② 添加上游原仓库（拉取官方更新用）
```bash
git remote add upstream git@github.com:cosZone/astro-koharu.git
```

### ③ 切换到私有开发分支 `blog`
```bash
# 本地创建并切换到blog分支（对应你的私有分支）
git checkout -b blog
```

---

## 2. 日常使用（写博客/改代码）
所有**私人修改、博客配置**，**只在 `blog` 分支**操作：
```bash
# 1. 修改代码后提交
git add .
git commit -m "更新博客内容/自定义配置"

# 2. 推送到远程私有分支
git push origin blog
```

---

## 3. 同步上游更新（核心！解决补丁打不上问题）
原仓库更新后，执行这组命令，**自动把你的私有修改合并到最新代码**：
```bash
# 1. 拉取上游原仓库最新代码
git fetch upstream

# 2. 同步公开main分支（保持纯净，仅同步官方）
git checkout main
git merge upstream/main
git push origin main

# 3. 切换回私有blog分支，把你的修改「叠」在最新代码上
git checkout blog
git rebase main

# 👉 如果有冲突：手动改完 → 执行 git add . → git rebase --continue
# 👉 无冲突：直接下一步

# 4. 推送更新后的私有分支（rebase必须加--force，仅推blog分支！）
git push origin blog --force
```

---

# 关键规则（必看，避免出错）
1. **绝对不要**在公开的 `main` 分支写任何私人修改，它只用来同步上游原仓库
2. 所有私人内容**只在 `blog` 分支**操作
3. `rebase` 后强制推送（`--force`）**仅用于 `blog` 私有分支**，绝对不要推 `main` 分支

---

# 总结
1. 一套命令适配你的专属仓库，无需修改任何地址
2. `main` = 公开同步上游，`blog` = 私有开发写博客
3. 用 `rebase` 彻底解决上游更新多、补丁打不上的问题