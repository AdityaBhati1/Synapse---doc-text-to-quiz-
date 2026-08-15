# Doc → Quiz

Turn any document into a graded exam. Upload a PDF or paste text, choose your question types and counts, and get two separate downloadable PDFs — an exam paper and an answer key — with every answer sourced strictly from your document.

## Features

- **Flexible input** — upload a `.pdf` / `.txt` file (parsed entirely in-browser) or paste text directly.
- **Configurable question spec** — pick any mix of multiple choice, short answer, and long answer, with a separate count for each.
- **Strictly sourced answers** — the model is instructed to use only the supplied document, never outside knowledge, and to write fewer questions rather than pad with invented content if the source material runs thin.
- **Two clean PDF outputs**:
  - an exam paper with blank space to write answers (no answer key included)
  - an answer key with the correct answer *and* the exact line/quote from the document it was sourced from, so you can spot-check it

## How it works

This version calls the Anthropic API directly from the browser using an API key you paste into the page. It's the fastest way to get this running (no backend to deploy) — good for a hackathon demo, not for a public production release. See **Security note** below.

```
your browser (index.html + styles.css + script.js)
        │
        │  your API key + document text + question spec
        ▼
Anthropic API → generates questions + sourced answers
        │
        ▼
jsPDF renders the two PDFs, downloadable locally
```

## Setup

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Push `index.html`, `styles.css`, and `script.js` to a GitHub repo (same folder), then enable **Settings → Pages** (branch `main`, folder `/(root)`) for a free public link — or just open `index.html` locally, or use any static host.
3. Open the page, paste your API key into the field at the top, upload/paste your document, set your question spec, and generate.

## Security note

Because the key is entered and used entirely client-side, it's visible to anyone who opens the browser's dev tools while the page is loaded. For a hackathon this is a reasonable tradeoff for speed, but take these precautions:

- **Keep the GitHub repo private** until after judging (a public repo doesn't expose the key itself, since it's typed in at runtime, not committed — but keep the habit anyway).
- **Set a low spending limit** on the API key in the Anthropic console, so a leaked key can't run up a large bill.
- **Rotate or delete the key** right after the hackathon.
- If you ever want to share this tool more broadly afterward, move the API call behind a small backend (e.g. a Cloudflare Worker) so visitors never see the key at all — happy to help set that up later.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure/markup — upload/paste, config, preview, and download buttons. |
| `styles.css` | All styling for the page. |
| `script.js` | All behavior — PDF parsing, calling the Anthropic API directly, rendering the preview, and generating the two output PDFs. |

## Notes & limitations

- Very long documents are truncated to roughly the first 60,000 characters before being sent for question generation.
- PDF text extraction relies on [pdf.js](https://mozilla.github.io/pdf.js/); scanned/image-only PDFs with no embedded text layer won't extract text.

## Tech stack

- Vanilla HTML/CSS/JS (no build step)
- [pdf.js](https://mozilla.github.io/pdf.js/) for in-browser PDF text extraction
- [jsPDF](https://github.com/parallax/jsPDF) for generating the output PDFs
- Anthropic API (Claude) for question generation
