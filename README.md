# Doc → Quiz

Turn any document into a graded exam. Upload a PDF or paste text, choose your question types and counts, and get two separate downloadable PDFs — an exam paper and an answer key — with every answer sourced strictly from your document.

## Features

- **Flexible input** — upload a `.pdf` / `.txt` file (parsed entirely in-browser) or paste text directly.
- **Configurable question spec** — pick any mix of multiple choice, short answer, and long answer, with a separate count for each.
- **Strictly sourced answers** — the model is instructed to use only the supplied document, never outside knowledge, and to write fewer questions rather than pad with invented content if the source material runs thin.
- **Two clean PDF outputs**:
  - an exam paper with blank space to write answers (no answer key included)
  - an answer key with the correct answer *and* the exact line/quote from the document it was sourced from, so you can spot-check it

## Setup (hackathon-speed version)

No backend, no input field — the API key is pasted straight into the code. Fastest possible path to a working demo:

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Open `script.js` and find this line near the top:
   ```js
   const GEMINI_API_KEY = 'PASTE_YOUR_GEMINI_API_KEY_HERE';
   ```
   Replace the placeholder with your actual key.
3. Push `index.html`, `styles.css`, and `script.js` to a GitHub repo (same folder), then enable **Settings → Pages** (branch `main`, folder `/(root)`) for a free public link — or just open `index.html` locally.
4. Open the page and go straight to uploading/pasting your document — no key field, no setup step.

## Security note

Because the key is hardcoded into a file the browser loads, it's visible to anyone who views the page source or opens dev tools — and if you push it to a **public** GitHub repo, it's visible to anyone who visits the repo too. For a hackathon this tradeoff is usually fine, but:

- **Keep the repo private** until after judging.
- **Delete or rotate the key** at aistudio.google.com right after judging ends.
- Don't reuse this key for anything else afterward.
- If you want this shareable beyond judging without exposing the key, move the API call behind a small backend instead — happy to set that up when you're ready.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure/markup — upload/paste, config, preview, and download buttons. |
| `styles.css` | All styling for the page. |
| `script.js` | All behavior — PDF parsing, calling the Gemini API directly with the hardcoded key, rendering the preview, and generating the two output PDFs. |

## Notes & limitations

- Documents longer than 200,000 characters are truncated before being sent for question generation — only the first 200,000 characters are used. The page shows a visible notice when this happens, so it's never a silent truncation.
- PDF text extraction relies on [pdf.js](https://mozilla.github.io/pdf.js/); scanned/image-only PDFs with no embedded text layer won't extract text.

## Tech stack

- Vanilla HTML/CSS/JS (no build step)
- [pdf.js](https://mozilla.github.io/pdf.js/) for in-browser PDF text extraction
- [jsPDF](https://github.com/parallax/jsPDF) for generating the output PDFs
- Google Gemini API for question generation
