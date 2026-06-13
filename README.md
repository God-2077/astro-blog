# astro-blog

个人博客引擎源码。文章与私密页面存档在私有仓库，CI 自动合并构建后推送到公开部署仓库，由 Vercel / Cloudflare Pages 静态托管。

> 基于 [cosZone/astro-koharu](https://github.com/cosZone/astro-koharu) 主题二次开发。萌系/二次元/粉蓝配色。

---

## 三层仓库架构

| 仓库 | 可见性 | 用途 |
|------|--------|------|
| [God-2077/astro-blog](https://github.com/God-2077/astro-blog) | **公开** | 博客引擎源码（本仓库），不含文章 |
| [God-2077/astro-blog-content](https://github.com/God-2077/astro-blog-content) | **私有** | `src/content/blog/**/*.md` + `src/pages/*.md` 私密页面 |
| [God-2077/astro-blog-deploy](https://github.com/God-2077/astro-blog-deploy) | **公开** | CI 构建产物 (`dist/`)，Vercel / Cloudflare Pages Git 集成自动部署 |

**触发流程：** push 任一源仓库 → GitHub Actions 拉取私有内容合并 → `pnpm build` → push `dist/` 到 deploy 仓库 → Vercel / CF Pages 自动部署

> 并发控制：新 push 触发时会自动取消正在进行的旧构建。

### astro-blog-content 目录结构

私有内容仓库需保持与引擎仓库一致的目录布局，CI 构建时将整体复制合并：

```
astro-blog-content/
└── src/
    ├── content/
    │   └── blog/                 ← 文章（映射到引擎 src/content/blog/）
    │       └── hello-world.md    ← 文章
    └── pages/                    
        └── about.md              ← 关于我页面（映射到引擎 src/pages/about.md）
```

---

## 技术栈

- **框架：** Astro 5.x + React 19
- **样式：** Tailwind CSS v4，深色/浅色切换
- **包管理：** pnpm
- **搜索：** Pagefind（无后端全站搜索）
- **评论：** Waline / Giscus / Remark42 / Twikoo 可切换
- **统计：** Umami PV 展示 (无统计跟踪代码，需手动配置)
- **多语言：** 内置 i18n（zh / en / ja）
- **Markdown：** Shoka 兼容语法、GFM、Mermaid 图表、KaTeX 数学公式
- **图片：** LQIP 渐变色占位

---

## 本地开发

```bash
# 1. 克隆引擎仓库
git clone git@github.com:God-2077/astro-blog.git
cd astro-blog

# 2. 克隆私有内容仓库
git clone git@github.com:God-2077/astro-blog-content.git ../astro-blog-content

# 3. 将内容链接到引擎目录
# Linux/macOS:
CONTENT="$(cd ../astro-blog-content && pwd)"
ln -s "$CONTENT/src/content/blog" src/content/blog
for f in "$CONTENT/src/pages"/*.md; do ln -s "$f" src/pages/; done

# Windows:
#   前置：先删除已有目录（仓库自带的 .gitkeep）
rmdir /s /q src\content\blog
#   mklink /J 无需管理员；文件软链接需管理员权限或开启开发者模式
mklink /J src\content\blog ..\astro-blog-content\src\content\blog
for %f in (..\astro-blog-content\src\pages\*.md) do mklink src\pages\%~nxf %~ff

# 4. 安装依赖并启动
pnpm install
pnpm dev
```

---

## 鸣谢

- 基于 [cosZone/astro-koharu](https://github.com/cosZone/astro-koharu) 主题二次开发。
- 设计灵感来自 Hexo 主题 [Shoka](https://shoka.lostyu.me/)
- 字体 [寒蝉全圆体](https://chinese-font.netlify.app/zh-cn/fonts/hcqyt/ChillRoundFRegular)
- 参考项目：mx-space、yfi.moe、纸鹿摸鱼处 等

---

## License

GNU Affero General Public License v3 (AGPL-3.0)
