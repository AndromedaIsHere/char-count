/* CountDraft — script.js */

const textInput        = document.getElementById('textInput');
const wordCountEl      = document.getElementById('wordCount');
const charCountEl      = document.getElementById('charCount');
const charNoSpaceEl    = document.getElementById('charNoSpaceCount');
const sentenceCountEl  = document.getElementById('sentenceCount');
const paragraphCountEl = document.getElementById('paragraphCount');
const readTimeEl       = document.getElementById('readTime');
const keywordList      = document.getElementById('keywordList');
const btnClear         = document.getElementById('btnClear');
const btnCopy          = document.getElementById('btnCopy');
const btnPaste         = document.getElementById('btnPaste');
const restoreStatus    = document.getElementById('restoreStatus');
const saveStatus       = document.getElementById('saveStatus');

// Goal / limit elements
const goalSelect       = document.getElementById('goalSelect');
const goalCustom       = document.getElementById('goalCustom');
const goalProgressWrap = document.getElementById('goalProgressWrap');
const goalFill         = document.getElementById('goalFill');
const goalCounter      = document.getElementById('goalCounter');

const STORAGE_KEY = 'charcount-pro-text';

// ── Analytics helper ─────────────────────────────────────

function trackEvent(name, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', name, params);
  }
}

// Fire once per session at 50 / 200 / 500 / 1000 chars
const milestones = new Set();
function trackMilestones(chars) {
  [50, 200, 500, 1000].forEach(n => {
    if (chars >= n && !milestones.has(n)) {
      milestones.add(n);
      trackEvent('typing_milestone', { chars_reached: n });
    }
  });
}

// ── Text analysis helpers ────────────────────────────────

function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
  const matches = text.match(/[^.!?\n]+[.!?]+/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

function countParagraphs(text) {
  if (!text.trim()) return 0;
  return text.trim().split(/\n{2,}/).filter(line => line.trim().length > 0).length;
}

function readingTime(words) {
  if (words === 0) return '—';
  const minutes = Math.round(words / 200);
  if (minutes < 1) return '< 1 min';
  return `${minutes} min`;
}

const STOP_WORDS = new Set([
  'the','and','for','with','that','this','from','your','you','are',
  'not','but','all','can','has','have','was','were','its','our',
  'their','they','will','what','when','there','into','also','just',
  'more','been','about','who','which','one','would','her','his',
]);

function topKeywords(text, maxItems = 8) {
  const words = text
    .toLowerCase()
    .replace(/[''""]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const counts = {};
  for (const w of words) {
    if (!w) continue;
    counts[w] = (counts[w] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);
}

// ── Goal / limit tracking ────────────────────────────────

let goalLimit = 0;

function getGoalLimit() {
  const sel = goalSelect.value;
  if (sel === '') return 0;
  if (sel === 'custom') {
    const v = parseInt(goalCustom.value, 10);
    return v > 0 ? v : 0;
  }
  return parseInt(sel, 10);
}

function updateGoalBar(chars) {
  goalLimit = getGoalLimit();

  if (goalLimit === 0) {
    goalProgressWrap.hidden = true;
    return;
  }

  goalProgressWrap.hidden = false;

  const pct  = Math.min((chars / goalLimit) * 100, 100);
  const over = chars > goalLimit;
  const warn = !over && pct >= 80;

  goalFill.style.width = pct + '%';
  goalFill.classList.toggle('warn', warn);
  goalFill.classList.toggle('over', over);

  const remaining = goalLimit - chars;
  if (over) {
    goalCounter.textContent = `${Math.abs(remaining)} over`;
    goalCounter.classList.add('over');
  } else {
    goalCounter.textContent = `${chars.toLocaleString()} / ${goalLimit.toLocaleString()}`;
    goalCounter.classList.remove('over');
  }

  goalFill.parentElement.setAttribute('aria-valuenow', Math.round(pct));
}

goalSelect.addEventListener('change', () => {
  const isCustom = goalSelect.value === 'custom';
  goalCustom.classList.toggle('visible', isCustom);
  if (!isCustom) goalCustom.value = '';
  updateGoalBar(textInput.value.length);
  // Track which preset was selected
  if (goalSelect.value && goalSelect.value !== 'custom') {
    trackEvent('limit_preset_selected', {
      preset: goalSelect.options[goalSelect.selectedIndex].text
    });
  }
});

goalCustom.addEventListener('input', () => {
  updateGoalBar(textInput.value.length);
});

// ── Main metrics update ──────────────────────────────────

function updateMetrics() {
  const text  = textInput.value;
  const words = countWords(text);
  const chars = text.length;

  wordCountEl.textContent      = words.toLocaleString();
  charCountEl.textContent      = chars.toLocaleString();
  charNoSpaceEl.textContent    = text.replace(/\s/g, '').length.toLocaleString();
  sentenceCountEl.textContent  = countSentences(text).toLocaleString();
  paragraphCountEl.textContent = countParagraphs(text).toLocaleString();
  readTimeEl.textContent       = readingTime(words);

  updateGoalBar(chars);
  renderKeywords(text);
}

function renderKeywords(text) {
  const keywords = topKeywords(text);
  keywordList.innerHTML = '';

  if (keywords.length === 0) {
    const li = document.createElement('li');
    li.className = 'keyword-empty';
    li.textContent = 'Start typing to see keywords…';
    keywordList.appendChild(li);
    return;
  }

  for (const [word, count] of keywords) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="kw-word">${escapeHtml(word)}</span><span class="kw-count">${count}×</span>`;
    keywordList.appendChild(li);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Auto-save / restore ──────────────────────────────────

function saveText() {
  localStorage.setItem(STORAGE_KEY, textInput.value);
  saveStatus.textContent = 'Auto-saved locally';
}

function flash(msg, ms = 2500) {
  saveStatus.textContent = msg;
  setTimeout(() => { saveStatus.textContent = 'Auto-saved locally'; }, ms);
}

function restoreText() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved.length > 0) {
    textInput.value = saved;
    restoreStatus.textContent = 'Restored your last draft';
    setTimeout(() => { restoreStatus.textContent = ''; }, 3200);
    updateMetrics();
    trackEvent('draft_restored', { char_count: saved.length });
  } else {
    updateMetrics();
  }
}

// ── Button actions ───────────────────────────────────────

btnClear.addEventListener('click', () => {
  if (textInput.value === '') return;
  trackEvent('text_cleared', { char_count: textInput.value.length });
  textInput.value = '';
  updateMetrics();
  saveText();
  textInput.focus();
});

btnCopy.addEventListener('click', async () => {
  if (!textInput.value) { flash('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(textInput.value);
    flash('✔ Copied to clipboard');
    trackEvent('text_copied', { char_count: textInput.value.length });
  } catch {
    flash('Copy failed — use Ctrl+C instead');
  }
});

btnPaste.addEventListener('click', async () => {
  try {
    const text  = await navigator.clipboard.readText();
    const start = textInput.selectionStart ?? textInput.value.length;
    const end   = textInput.selectionEnd   ?? textInput.value.length;
    textInput.setRangeText(text, start, end, 'end');
    updateMetrics();
    saveText();
    textInput.focus();
    trackEvent('paste_used', { char_count: textInput.value.length });
  } catch {
    flash('Paste failed — use Ctrl+V instead');
  }
});

// ── Live updates ─────────────────────────────────────────

textInput.addEventListener('input', () => {
  updateMetrics();
  saveText();
  trackMilestones(textInput.value.length);
});

// ── Init ─────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', restoreText);
