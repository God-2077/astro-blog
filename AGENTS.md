# AGENTS.md

## Quick commands

- `pnpm dev` — dev server (localhost:4321)
- `pnpm build` — production build
- `pnpm check` — Astro type-check
- `pnpm lint:fix` — Biome auto-fix（严禁运行！会污染整个项目的格式化）
- `pnpm knip` — find dead code/deps

**All commands use `pnpm`, not npm/yarn.**

After changing `config/site.yaml`, restart the dev server. YAML config is cached at build.

## Content

Posts live in `src/content/blog/`. For the **default locale (zh)**, posts go directly under category subdirectories:
```plain
src/content/blog/<categorySlug>/<filename>.md
```
For **non-default locales (en, ja)**, posts go under a locale prefix:
```plain
src/content/blog/<locale>/<categorySlug>/<filename>.md
```

Category slugs come from `categoryMap` in `config/site.yaml` (e.g., `碎碎念` → `ssn`, `文章` → `post`).

Frontmatter fields defined in `src/content/config.ts`. Key fields:
- `title` (required), `date` (required)
- `categories`: `['碎碎念']` or `['笔记', '前端']` (nested categories)
- `tags`: `['tag1', 'tag2']`
- `draft: true` excludes from production
- `sticky: true` pins post to top
- `password` enables encrypted post
- `link` sets canonical URL (from Hexo legacy `link` field)

**Date handling**: gray-matter parses frontmatter dates as UTC. The content schema reinterprets them to the site timezone (`Asia/Shanghai`). Write dates as `2025-12-29 21:55:00` in frontmatter — it will be treated as site-local time.

## i18n

- Default locale (zh) has **no URL prefix**.
- Other locales use `/<locale>/` prefix in URLs.
- Non-default-locale pages show translated posts **plus** untranslated default-locale posts as fallback.
- Translation UI strings: `zh.ts` is source-of-truth (~170 keys); `en.ts`/`ja.ts` are partial overrides.

## Remark/rehype plugin order is critical

Do NOT reorder remark plugins in `astro.config.mjs`. `remarkShokaPreprocess` MUST be first (re-parses raw text to fix GFM conflicts). `remarkMath` MUST run before `remarkShokaRuby`/`remarkShokaSpoiler` (so `$...$` is parsed before text-scanning plugins touch it). Encrypted block/post plugins MUST be last in the rehype pipeline.

## Tech stack gotchas

- **Tailwind v4** via `@tailwindcss/vite` plugin (NOT PostCSS). Uses CSS-first config.
- **Biome** for lint + format (NOT ESLint/Prettier). Config at `biome.json`.
- **Motion** (Framer Motion successor) for animations, NOT framer-motion.
- **Nanostores** for shared state.
- **Astro i18n**: Do NOT enable `fallback` routing — it breaks `[seriesSlug].astro` dynamic routes.
- **Christmass/snowfall** uses Three.js. When disabled in config, the Vite plugin replaces SnowfallCanvas with a noop, saving ~879KB.
- Build analysis: `ANALYZE=true pnpm build` (enables Sonda bundle analyzer).
- `BLOG_PORT=4321` in `.env` to change dev port.
- `.cache/og-data.json` is **committed** to Git (build cache). Do NOT add to `.gitignore`.

## Sub-projects

- `cms/` — Decap CMS admin (separate pnpm project, `pnpm cms`)
- `blog-translation/` — Translation tooling (separate pnpm project, `pnpm translation:start`)

## Pre-commit

Husky runs `lint-staged` which runs Biome on `*.{js,jsx,ts,tsx,json,astro}` and `lint-md` on `*.{md,mdx}`.

## Full architecture reference

See `CLAUDE.md` for comprehensive module structure, component patterns, state management rules, and performance guidelines.


## Git Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/). Format:

```plain

<type>[optional scope]: <description>

[optional body]

[optional footer]

```

### Rules

- Write commit messages in **Chinese**, no trailing period.