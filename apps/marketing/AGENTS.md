# apps/marketing — Agent Overlay

> **Baseline**: Read [CLAUDE.md](../../CLAUDE.md) first.

---

## Purpose

`apps/marketing` is a static marketing site (plain HTML, CSS, and vanilla JavaScript). No framework, no build pipeline, no bundler.

---

## Code structure

```
apps/marketing/
├── index.html     ← Human marketing homepage
├── agents.html    ← Agent page and agent-readable copy
├── for/           ← Audience pages (/for/ai-agents, /for/local, /for/self-employed)
├── styles.css     ← All styles
├── script.js      ← All interactivity
└── public/        ← Static assets (images, icons)
```

Audience pages live in `for/` so relative assets (`../styles.css`) work when you open the HTML file, on a static host, and at the pretty `/for/*` URL. Do not use root-absolute `/styles.css`.

Public URLs omit `.html`. Each page, including every file under `for/`, needs both a rewrite and a permanent redirect in `vercel.json`. See [README.md](README.md).

---

## How to work on it

Edit files directly. There is no build step. To preview locally, open `index.html` in a browser or use a simple static file server:

```bash
cd apps/marketing && npx serve .
```

### Agent-readable copy

Agents should scrape **`https://moatfinance.ai/agents`** only — never the human homepage. `/llms`, `/llms.txt`, and `/?for=agents` redirect there.

Edit the agent summary directly in [`agents.html`](agents.html). Do not put that copy in `index.html`.

---

## Anti-patterns

- **Don't add a framework** (React, Vue, etc.) to this app without a deliberate decision. It's intentionally simple.
- **Don't add a build step** unless absolutely necessary.
- **Don't add client-side auth or user data.** This is a public marketing site only.
