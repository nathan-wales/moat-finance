# Marketing site

Static HTML, CSS, and vanilla JavaScript. No framework and no build step. Preview with `npx serve .` from this directory.

## Clean URLs

Public URLs never include `.html`. Files on disk still do (`privacy.html`, `for/local.html`).

Every page needs both entries in `vercel.json`:

1. A **rewrite** from the public path to the file: `/privacy` → `/privacy.html`
2. A **permanent redirect** from the file path back to the public path: `/privacy.html` → `/privacy`

The rewrite serves the file while the address bar stays clean. The redirect is what strips `.html` when someone opens the file path or follows an `href` that still ends in `.html`. In-page links keep the `.html` suffix on purpose, same as `privacy.html` and `download.html`. Canonicals and `sitemap.xml` use the extensionless URL.

Audience pages under `for/` follow the same pair. A rewrite alone is not enough:

| Public URL | Rewrite destination | Redirect source |
|------------|---------------------|-----------------|
| `/for/ai-agents` | `/for/ai-agents.html` | `/for/ai-agents.html` |
| `/for/local` | `/for/local.html` | `/for/local.html` |
| `/for/self-employed` | `/for/self-employed.html` | `/for/self-employed.html` |

Skipping the redirect leaves `moatfinance.ai/for/local.html` in the address bar.

When you add a page, add the rewrite and the redirect together. Keep relative asset paths (`../styles.css` from `for/`). Do not use root-absolute `/styles.css`.
