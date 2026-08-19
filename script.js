// Paste your Gemini API key here (get one free at aistudio.google.com/apikey).
// Hardcoded for hackathon speed — no input field, no backend. Anyone who
// opens this file or the browser's dev tools can see this key, so keep the
// repo private and delete/rotate the key after judging.

// Documents longer than this are truncated before being sent — see the
// truncation notice shown to the user below when this kicks in.
const DOC_CHAR_LIMIT = 200000;

// Non-repetition memory: remembers past questions per-document (by a
// fingerprint of its text) in this browser's localStorage only — never
// sent anywhere, never shared across devices.
const MEMORY_STORAGE_KEY = 'docQuizMemory_v1';
const MEMORY_PER_DOC_CAP = 50;      // most-recent questions kept per document
const MEMORY_DOC_CAP = 30;          // most-recent documents tracked at all
const MEMORY_PROMPT_SAMPLE = 40;    // how many past questions get shown to the model
const MEMORY_SIMILARITY_THRESHOLD = 0.6; // Jaccard word-overlap treated as "duplicate"

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let docText = '';
let docName = '';
let quizData = null;

// ---- tabs ----
const tabUpload = document.getElementById('tabUpload');
const tabPaste = document.getElementById('tabPaste');
const paneUpload = document.getElementById('paneUpload');
const panePaste = document.getElementById('panePaste');
tabUpload.onclick = () => { tabUpload.classList.add('active'); tabPaste.classList.remove('active'); paneUpload.classList.remove('hidden'); panePaste.classList.add('hidden'); updateMemoryBadge(); };
tabPaste.onclick = () => { tabPaste.classList.add('active'); tabUpload.classList.remove('active'); panePaste.classList.remove('hidden'); paneUpload.classList.add('hidden'); updateMemoryBadge(); };

function getCurrentSourceText() {
  const pasteText = document.getElementById('pasteArea').value.trim();
  return panePaste.classList.contains('hidden') ? docText : pasteText;
}

// ---- file upload ----
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filepillWrap = document.getElementById('filepillWrap');

dropzone.onclick = () => fileInput.click();
dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag'); };
dropzone.ondragleave = () => dropzone.classList.remove('drag');
dropzone.ondrop = (e) => { e.preventDefault(); dropzone.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
fileInput.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };

async function handleFile(file) {
  setStatus('Reading ' + file.name + '...', false);
  try {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n\n';
      }
      docText = text.trim();
    } else {
      docText = await file.text();
    }
    docName = file.name;
    filepillWrap.innerHTML = '';
    const pill = document.createElement('div');
    pill.className = 'filepill';
    pill.innerHTML = '<span>' + file.name + ' · ' + docText.split(/\s+/).length + ' words</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => { docText = ''; docName = ''; filepillWrap.innerHTML = ''; updateMemoryBadge(); };
    pill.appendChild(closeBtn);
    filepillWrap.appendChild(pill);
    clearStatus();
    updateMemoryBadge();
  } catch (err) {
    setStatus('Could not read that file: ' + err.message, true);
  }
}

document.getElementById('pasteArea').addEventListener('input', updateMemoryBadge);

// ---- difficulty ----
let selectedDifficulty = 'medium';
const difficultyTabs = document.querySelectorAll('#difficultyTabs .tab');
difficultyTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    difficultyTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedDifficulty = tab.dataset.difficulty;
  });
});

// ---- type rows ----
const typeRows = document.querySelectorAll('.type-row');
function updateTotal() {
  let total = 0;
  typeRows.forEach(row => {
    const on = row.querySelector('.typeCheck').checked;
    row.classList.toggle('on', on);
    if (on) total += parseInt(row.querySelector('.typeCount').value || '0', 10);
  });
  document.getElementById('totalCount').innerHTML = 'Total: <b>' + total + '</b> questions';
  return total;
}
typeRows.forEach(row => {
  row.querySelector('.typeCheck').addEventListener('change', updateTotal);
  row.querySelector('.typeCount').addEventListener('input', updateTotal);
});
updateTotal();

// ---- status ----
function setStatus(msg, isErr) {
  const line = document.getElementById('statusLine');
  const text = document.getElementById('statusText');
  line.classList.add('show');
  line.classList.toggle('err', !!isErr);
  line.classList.toggle('ok', !isErr);
  text.textContent = msg;
}
function clearStatus() {
  document.getElementById('statusLine').classList.remove('show');
}

// ---- non-repetition memory ----
// A lightweight, non-cryptographic hash — good enough to key documents
// consistently, not meant to be collision-proof.
function hashText(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16);
}

function loadMemoryStore() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveMemoryStore(store) {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    // localStorage unavailable (private browsing, quota, disabled) —
    // fail silently; generation still works, it just won't remember
    // past questions this session.
  }
}
function enforceMemoryDocCap(store) {
  const keys = Object.keys(store);
  if (keys.length <= MEMORY_DOC_CAP) return;
  keys.sort((a, b) => (store[a].updatedAt || 0) - (store[b].updatedAt || 0));
  const toRemove = keys.length - MEMORY_DOC_CAP;
  for (let i = 0; i < toRemove; i++) delete store[keys[i]];
}

function normalizeWords(text) {
  return new Set(
    String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  );
}
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(w => { if (setB.has(w)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function currentDocFingerprint() {
  const sourceText = getCurrentSourceText();
  if (!sourceText || sourceText.length < 40) return null;
  return hashText(sourceText.slice(0, DOC_CHAR_LIMIT));
}

function updateMemoryBadge() {
  const badge = document.getElementById('memoryBadge');
  const textEl = document.getElementById('memoryText');
  const fp = currentDocFingerprint();
  if (!fp) { badge.classList.add('hidden'); return; }

  const store = loadMemoryStore();
  const entry = store[fp];
  const count = entry ? entry.questions.length : 0;

  if (count > 0) {
    textEl.innerHTML = '🧠 <strong>' + count + '</strong> previous question' + (count === 1 ? '' : 's') + ' remembered for this document — new ones will avoid repeating them.';
    badge.dataset.fingerprint = fp;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

document.getElementById('clearMemoryBtn').onclick = () => {
  const badge = document.getElementById('memoryBadge');
  const fp = badge.dataset.fingerprint;
  if (!fp) return;
  const store = loadMemoryStore();
  delete store[fp];
  saveMemoryStore(store);
  updateMemoryBadge();
  setStatus('History cleared for this document — the next generation starts fresh.', false);
};

// ---- generate ----
document.getElementById('genBtn').onclick = async () => {
  const sourceText = getCurrentSourceText();

  if (!sourceText || sourceText.length < 40) {
    setStatus('Add a document with enough text to write questions from.', true);
    return;
  }

  const truncateNote = document.getElementById('truncateNote');
  if (sourceText.length > DOC_CHAR_LIMIT) {
    truncateNote.textContent = 'Note: your document is ' + sourceText.length.toLocaleString() + ' characters — only the first ' + DOC_CHAR_LIMIT.toLocaleString() + ' were used to generate questions.';
    truncateNote.classList.remove('hidden');
  } else {
    truncateNote.classList.add('hidden');
  }

  const spec = [];
  typeRows.forEach(row => {
    if (row.querySelector('.typeCheck').checked) {
      spec.push({ type: row.dataset.type, count: parseInt(row.querySelector('.typeCount').value || '0', 10) });
    }
  });
  const total = spec.reduce((a, s) => a + s.count, 0);
  if (spec.length === 0 || total === 0) {
    setStatus('Select at least one question type with a count above zero.', true);
    return;
  }


  const genBtn = document.getElementById('genBtn');
  genBtn.disabled = true;
  setStatus('Reading the document and drafting questions...', false);

  const specText = spec.map(s => s.count + ' ' + s.type + ' question(s)').join(', ');

  const docFingerprint = hashText(sourceText.slice(0, DOC_CHAR_LIMIT));
  const memoryStore = loadMemoryStore();
  const memoryEntry = memoryStore[docFingerprint];
  const previousQuestions = memoryEntry ? memoryEntry.questions : [];
  const memoryInstruction = previousQuestions.length > 0
    ? '\n\nPREVIOUSLY GENERATED QUESTIONS FOR THIS DOCUMENT — do not repeat or closely rephrase any of these:\n' +
      previousQuestions.slice(-MEMORY_PROMPT_SAMPLE).map(q => '- ' + q).join('\n')
    : '';

  const difficultyInstruction = selectedDifficulty === 'mixed'
    ? 'Vary difficulty across the questions — roughly an even mix of easy, medium, and hard — and label each with its actual difficulty.'
    : `All questions should be ${selectedDifficulty} difficulty. Label each with "difficulty":"${selectedDifficulty}".`;

  const systemPrompt = `You are a strict exam-writing assistant. You write quiz questions and answers using ONLY the document text the user gives you. Never use outside knowledge, never invent facts not present in the document. If the document does not contain enough distinct material to support the requested count for a type, generate fewer high-quality questions of that type instead of padding with generic or outside content.

Question type definitions:
- mcq: multiple choice, exactly 4 options, one correct.
- short: a question answerable in one short sentence or phrase.
- long: a question requiring a multi-sentence explanatory answer, still fully grounded in the document.

Difficulty definitions:
- easy: the answer is a single fact stated directly and plainly in one place in the document.
- medium: the answer requires connecting two related pieces of information from the document.
- hard: the answer requires synthesis, inference, or reasoning across multiple parts of the document — still fully grounded in it, never outside knowledge.

${difficultyInstruction}

If the user message includes a "PREVIOUSLY GENERATED QUESTIONS FOR THIS DOCUMENT" list, never repeat or closely rephrase any question in that list — write genuinely new ones covering different material or angles from the document.

Respond with ONLY valid JSON (no markdown fences, no commentary, no preamble) matching exactly this schema:
{"questions":[{"id":1,"type":"mcq|short|long","difficulty":"easy|medium|hard","question":"...","options":["...","...","...","..."],"answer":"...","source_quote":"short quote or close paraphrase from the document that supports this answer"}]}
For non-mcq types, omit the "options" field entirely. The "answer" for mcq must exactly match one of the options. Keep "source_quote" under 25 words.
"CRITICAL: Escape all double quotes inside JSON string values with a backslash (\"). Do not include raw newlines inside string values."`;

  const userPrompt = `DOCUMENT TEXT:\n"""\n${sourceText.slice(0, DOC_CHAR_LIMIT)}\n"""\n\nGenerate: ${specText}. Return JSON only.${memoryInstruction}`;

  try {
    const model = 'gemini-3.5-flash';
    // Replace the Google fetch block with this:
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    systemPrompt: systemPrompt,
    userPrompt: userPrompt
  })
});
    const data = await response.json();
    if (!response.ok) {
      throw new Error((data && data.error && data.error.message) ? data.error.message : ('Request failed (' + response.status + ')'));
    }
    const raw = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts)
      ? data.candidates[0].content.parts.map(p => p.text || '').join('').trim()
      : '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.questions || !parsed.questions.length) throw new Error('No questions returned.');
    quizData = parsed.questions;
    docName = docName || 'Pasted text';

    // Filter out questions that duplicate this document's remembered
    // history, or duplicate each other within this same batch.
    const historySets = previousQuestions.map(q => normalizeWords(q));
    const accepted = [];
    const acceptedSets = [];
    let filteredCount = 0;
    quizData.forEach(q => {
      const qSet = normalizeWords(q.question);
      const dupInHistory = historySets.some(hSet => jaccardSimilarity(qSet, hSet) >= MEMORY_SIMILARITY_THRESHOLD);
      const dupInBatch = acceptedSets.some(aSet => jaccardSimilarity(qSet, aSet) >= MEMORY_SIMILARITY_THRESHOLD);
      if (dupInHistory || dupInBatch) {
        filteredCount++;
      } else {
        accepted.push(q);
        acceptedSets.push(qSet);
      }
    });

    if (accepted.length === 0) {
      throw new Error('Every generated question matched your previous history for this document. Try again, or clear history below.');
    }
    quizData = accepted;

    // Remember these questions so future generations for this document
    // avoid repeating them — stored only in this browser.
    const updatedQuestions = previousQuestions.concat(accepted.map(q => q.question)).slice(-MEMORY_PER_DOC_CAP);
    memoryStore[docFingerprint] = { questions: updatedQuestions, updatedAt: Date.now() };
    enforceMemoryDocCap(memoryStore);
    saveMemoryStore(memoryStore);
    updateMemoryBadge();

    renderPreview();
    setStatus(
      'Generated ' + quizData.length + ' question(s), sourced from the document.' +
      (filteredCount > 0 ? ' Filtered ' + filteredCount + ' near-duplicate of your previous questions.' : ''),
      false
    );
  } catch (err) {
    const hint = (err.message === 'Failed to fetch')
      ? ' — check your internet connection and that GEMINI_API_KEY in script.js is correct.'
      : '';
    setStatus('Generation failed: ' + err.message + hint, true);
  } finally {
    genBtn.disabled = false;
  }
};

// ---- preview ----
function renderPreview() {
  const qList = document.getElementById('qList');
  const aList = document.getElementById('aList');
  qList.innerHTML = '';
  aList.innerHTML = '';
  document.getElementById('sourceMeta').textContent = docName ? ('Source: ' + docName) : '';

  quizData.forEach((q, idx) => {
    const n = idx + 1;
    const qDiv = document.createElement('div');
    qDiv.className = 'qitem';
    let inner = '<span class="qnum">Q' + n + '.</span><span class="qtype">' + q.type + '</span><span class="qtype">' + (q.difficulty || selectedDifficulty) + '</span><div class="qtext">' + escapeHtml(q.question) + '</div>';
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      inner += '<ul class="opts">' + q.options.map((o, i) => '<li data-letter="' + String.fromCharCode(65 + i) + '">' + escapeHtml(o) + '</li>').join('') + '</ul>';
    } else {
      inner += '<div class="blank-line"></div>' + (q.type === 'long' ? '<div class="blank-line"></div><div class="blank-line"></div>' : '');
    }
    qDiv.innerHTML = inner;
    qList.appendChild(qDiv);

    const aDiv = document.createElement('div');
    aDiv.className = 'qitem';
    aDiv.innerHTML = '<span class="qnum">Q' + n + '.</span><span class="qtype">' + q.type + '</span><span class="qtype">' + (q.difficulty || selectedDifficulty) + '</span>' +
      '<div class="ans">' + escapeHtml(q.answer) + '</div>' +
      (q.source_quote ? '<div class="src">Source: "' + escapeHtml(q.source_quote) + '"</div>' : '');
    aList.appendChild(aDiv);
  });

  document.getElementById('previewSection').classList.remove('hidden');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---- PDF export ----
function newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'pt', format: 'a4' });
}
function addHeader(doc, title, sub) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('courier', 'bold'); doc.setFontSize(16); doc.setTextColor(27, 58, 47);
  doc.text(title, 48, 54);
  doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  doc.text(sub, 48, 70);
  doc.setDrawColor(200, 195, 174); doc.line(48, 80, w - 48, 80);
  return 104;
}
function pageBreakIfNeeded(doc, y, margin) {
  if (y > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    return 56;
  }
  return y;
}

function buildQuestionDoc() {
  const doc = newDoc();
  let y = addHeader(doc, 'EXAM', 'Source: ' + (docName || 'Pasted text') + '  ·  ' + quizData.length + ' questions');
  const marginBottom = 60, left = 48, width = doc.internal.pageSize.getWidth() - 96;
  quizData.forEach((q, idx) => {
    y = pageBreakIfNeeded(doc, y, marginBottom);
    doc.setFont('courier', 'bold'); doc.setFontSize(11); doc.setTextColor(31, 42, 36);
    doc.text('Q' + (idx + 1) + '. [' + q.type.toUpperCase() + ' · ' + (q.difficulty || selectedDifficulty).toUpperCase() + ']', left, y);
    y += 16;
    doc.setFont('times', 'normal'); doc.setFontSize(11);
    const lines = doc.splitTextToSize(q.question, width);
    lines.forEach(line => { y = pageBreakIfNeeded(doc, y, marginBottom); doc.text(line, left, y); y += 15; });
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      q.options.forEach((o, i) => {
        y = pageBreakIfNeeded(doc, y, marginBottom);
        const optLines = doc.splitTextToSize(String.fromCharCode(65 + i) + ') ' + o, width - 16);
        optLines.forEach(l => { doc.text(l, left + 16, y); y += 14; });
      });
    } else {
      const blanks = q.type === 'long' ? 3 : 1;
      for (let b = 0; b < blanks; b++) {
        y = pageBreakIfNeeded(doc, y, marginBottom);
        doc.setDrawColor(180); doc.line(left, y + 8, left + width, y + 8); y += 22;
      }
    }
    y += 12;
  });
  return doc;
}

function buildAnswerDoc() {
  const doc = newDoc();
  let y = addHeader(doc, 'ANSWER KEY', 'Source: ' + (docName || 'Pasted text') + '  ·  answers sourced from document');
  const marginBottom = 60, left = 48, width = doc.internal.pageSize.getWidth() - 96;
  quizData.forEach((q, idx) => {
    y = pageBreakIfNeeded(doc, y, marginBottom);
    doc.setFont('courier', 'bold'); doc.setFontSize(11); doc.setTextColor(31, 42, 36);
    doc.text('Q' + (idx + 1) + '. [' + q.type.toUpperCase() + ' · ' + (q.difficulty || selectedDifficulty).toUpperCase() + ']', left, y);
    y += 16;
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(142, 44, 44);
    const ansLines = doc.splitTextToSize(String(q.answer), width);
    ansLines.forEach(line => { y = pageBreakIfNeeded(doc, y, marginBottom); doc.text(line, left, y); y += 15; });
    if (q.source_quote) {
      doc.setFont('times', 'italic'); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
      const srcLines = doc.splitTextToSize('Source: "' + q.source_quote + '"', width);
      srcLines.forEach(line => { y = pageBreakIfNeeded(doc, y, marginBottom); doc.text(line, left, y); y += 13; });
    }
    y += 14;
  });
  return doc;
}

// Some sandboxed artifact environments silently block a programmatic
// doc.save() click. To be safe: try the auto-download, then ALWAYS also
// surface a visible link (blob URL) the user can click or right-click ->
// "Save link as", plus open it in a new tab as a second fallback.
function deliverPdf(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  try { window.open(url, '_blank'); } catch (e) { /* popup blocked, link fallback below still works */ }

  const fallback = document.getElementById('linkFallback');
  fallback.classList.remove('hidden');
  const existing = document.getElementById('link-' + filename);
  const linkHtml = 'If "' + filename + '" didn\'t download automatically, <a id="link-' + filename + '" href="' + url + '" download="' + filename + '" target="_blank" style="color:var(--red-dark);font-weight:600;">click here to open / save it</a>.';
  if (existing) {
    existing.parentElement.outerHTML = '<div>' + linkHtml + '</div>';
  } else {
    fallback.insertAdjacentHTML('beforeend', '<div>' + linkHtml + '</div>');
  }
}

document.getElementById('dlQ').onclick = () => {
  if (!quizData) return;
  deliverPdf(buildQuestionDoc(), 'exam-questions.pdf');
};

document.getElementById('dlA').onclick = () => {
  if (!quizData) return;
  deliverPdf(buildAnswerDoc(), 'exam-answer-key.pdf');
};
