# Doc → Quiz

Turn any document into a graded exam. Upload a PDF or paste text, choose your question types and counts, and get two separate downloadable PDFs — an exam paper and an answer key — with every answer sourced strictly from your document.

## Features

- **Flexible input** — upload a `.pdf` / `.txt` file (parsed entirely in-browser) or paste text directly.
- **Configurable question spec** — pick any mix of multiple choice, short answer, and long answer, with a separate count for each.
- **Strictly sourced answers** — the model is instructed to use only the supplied document, never outside knowledge, and to write fewer questions rather than pad with invented content if the source material runs thin.
- **Two clean PDF outputs**:
  - an exam paper with blank space to write answers (no answer key included)
  - an answer key with the correct answer *and* the exact line/quote from the document it was sourced from, so you can spot-check it
- **No server-side storage** — nothing about your document or your quiz is saved anywhere; everything happens in your browser and your own backend request.

## How it works

```
your browser (doc-to-quiz.html)
        │
        │  sends only: document text + question spec
        ▼
your backend (quiz-proxy-worker.js on Cloudflare Workers)
        │
        │  holds your Anthropic API key as a secret
        ▼
Anthropic API → generates questions + sourced answers → returned to your browser
        │
        ▼
jsPDF renders the two PDFs, downloadable locally
```

The API key never reaches the browser or any visitor to the page — only your Worker holds it.

## Setup

### 1. Deploy the backend (`quiz-proxy-worker.js`)

You need a small server to hold your Anthropic API key so it's never exposed to visitors. This repo includes a ready-to-deploy [Cloudflare Worker](https://workers.cloudflare.com/) for that (free tier, no credit card required).

1. Sign up free at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Install Wrangler: `npm install -g wrangler`
3. `wrangler init quiz-proxy` (choose the "Hello World" template), then replace the generated `src/index.js` with the contents of `quiz-proxy-worker.js` from this repo.
4. Set your key as a secret — never commit it to the repo: `wrangler secret put ANTHROPIC_API_KEY`
5. Deploy: `wrangler deploy`
6. Copy the URL Wrangler prints, e.g. `https://quiz-proxy.your-subdomain.workers.dev`

### 2. Host the frontend (`doc-to-quiz.html`)

Any static host works — GitHub Pages is free and simplest:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**, set source to **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
3. Your page will be live at `https://yourname.github.io/<repo-name>/doc-to-quiz.html`.

### 3. Use it

Open the hosted page, paste your Worker URL into the **Backend URL** field at the top, and you're set. Anyone with the page link can use it — no account, install, or API key needed on their end.

## Files

| File | Purpose |
|---|---|
| `doc-to-quiz.html` | The full frontend — upload/paste, config, preview, and PDF export. Single self-contained file. |
| `quiz-proxy-worker.js` | Cloudflare Worker that proxies requests to the Anthropic API, keeping your API key server-side. |

## Notes & limitations

- The backend endpoint is open to anyone with your page's link — each use costs a small amount against your Anthropic API key. Fine for personal or small-group use; for wider public release, consider adding a shared secret or rate limit to the Worker.
- Very long documents are truncated to roughly the first 60,000 characters before being sent for question generation.
- PDF text extraction relies on [pdf.js](https://mozilla.github.io/pdf.js/); scanned/image-only PDFs with no embedded text layer won't extract text.

## Tech stack

- Vanilla HTML/CSS/JS (no build step)
- [pdf.js](https://mozilla.github.io/pdf.js/) for in-browser PDF text extraction
- [jsPDF](https://github.com/parallax/jsPDF) for generating the output PDFs
- Cloudflare Workers for the backend proxy
- Anthropic API (Claude) for question generation
