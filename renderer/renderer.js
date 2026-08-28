import { analyzeTitle } from './analysis/titleOptimizer.js';
import { suggestKeywords } from './analysis/keywordSuggester.js';
import { analyzeDescription } from './analysis/descriptionChecker.js';

const titleInput = document.getElementById('title-input');
const descriptionInput = document.getElementById('description-input');
const specificsRows = document.getElementById('specifics-rows');
const listingForm = document.getElementById('listing-form');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = {
  link: document.getElementById('tab-link'),
  manual: document.getElementById('tab-manual'),
  csv: document.getElementById('tab-csv')
};

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(tabPanels).forEach((panel) => panel.classList.add('hidden'));
    tabPanels[btn.dataset.tab].classList.remove('hidden');
  });
});

function addSpecificRow(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'specific-row';
  row.innerHTML = `
    <input type="text" class="specific-key" placeholder="Attribute (e.g. Brand)" value="${escapeHtml(key)}" />
    <input type="text" class="specific-value" placeholder="Value (e.g. Nike)" value="${escapeHtml(value)}" />
    <button type="button" class="remove-btn" title="Remove">&times;</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  specificsRows.appendChild(row);
}

document.getElementById('add-specific-btn').addEventListener('click', () => addSpecificRow());

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getItemSpecificsFromForm() {
  const specifics = {};
  specificsRows.querySelectorAll('.specific-row').forEach((row) => {
    const key = row.querySelector('.specific-key').value.trim();
    const value = row.querySelector('.specific-value').value.trim();
    if (key && value) specifics[key] = value;
  });
  return specifics;
}

function setItemSpecificsInForm(specifics) {
  specificsRows.innerHTML = '';
  Object.entries(specifics || {}).forEach(([key, value]) => addSpecificRow(key, value));
  if (Object.keys(specifics || {}).length === 0) addSpecificRow();
}

setItemSpecificsInForm({});

// ---- Paste-link tab ----
const listingUrlInput = document.getElementById('listing-url');
const fetchBtn = document.getElementById('fetch-btn');
const fetchStatus = document.getElementById('fetch-status');

fetchBtn.addEventListener('click', async () => {
  const url = listingUrlInput.value.trim();
  if (!url) {
    fetchStatus.textContent = 'Paste an eBay listing URL first.';
    fetchStatus.className = 'status error';
    return;
  }

  fetchBtn.disabled = true;
  fetchStatus.textContent = 'Fetching listing...';
  fetchStatus.className = 'status';

  const result = await window.api.fetchListing(url);

  fetchBtn.disabled = false;

  if (!result.ok) {
    fetchStatus.textContent = result.error;
    fetchStatus.className = 'status error';
    return;
  }

  titleInput.value = result.data.title || '';
  descriptionInput.value = result.data.description || '';
  setItemSpecificsInForm(result.data.itemSpecifics || {});

  fetchStatus.textContent = result.data.warning
    ? `Loaded title/description. ${result.data.warning}`
    : 'Listing loaded. Review the fields below, then click Analyze.';
  fetchStatus.className = 'status success';
});

// ---- CSV tab ----
const importCsvBtn = document.getElementById('import-csv-btn');
const csvStatus = document.getElementById('csv-status');
const csvList = document.getElementById('csv-list');

importCsvBtn.addEventListener('click', async () => {
  const result = await window.api.importCsv();

  if (result.canceled) return;

  if (!result.ok) {
    csvStatus.textContent = result.error;
    csvStatus.className = 'status error';
    return;
  }

  csvStatus.textContent = `Loaded ${result.rows.length} listing(s) from ${result.fileName}.`;
  csvStatus.className = 'status success';

  csvList.innerHTML = '';
  result.rows.forEach((row) => {
    const li = document.createElement('li');
    li.textContent = row.title;
    li.addEventListener('click', () => {
      titleInput.value = row.title || '';
      descriptionInput.value = row.description || '';
      setItemSpecificsInForm(row.itemSpecifics || {});
    });
    csvList.appendChild(li);
  });
});

// ---- Analysis ----
const emptyState = document.getElementById('empty-state');
const results = document.getElementById('results');

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

function renderIssues(container, issues) {
  container.innerHTML = '';
  issues.forEach((issue) => {
    const li = document.createElement('li');
    li.className = issue.severity;
    li.innerHTML = `<span class="badge">${issue.severity}</span>${escapeHtml(issue.message)}`;
    container.appendChild(li);
  });
}

listingForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const itemSpecifics = getItemSpecificsFromForm();

  const titleResult = analyzeTitle(title, itemSpecifics);
  const keywordSuggestions = suggestKeywords(title, description, itemSpecifics);
  const descResult = analyzeDescription(description, title);

  emptyState.classList.add('hidden');
  results.classList.remove('hidden');

  const titleScoreEl = document.getElementById('title-score');
  titleScoreEl.textContent = `${titleResult.score}/100`;
  titleScoreEl.className = `score ${scoreClass(titleResult.score)}`;
  document.getElementById('title-charcount').textContent = `${titleResult.charCount}/80 characters`;
  renderIssues(document.getElementById('title-issues'), titleResult.issues);

  const keywordEl = document.getElementById('keyword-suggestions');
  keywordEl.innerHTML = '';
  if (keywordSuggestions.length === 0) {
    const li = document.createElement('li');
    li.className = 'good';
    li.innerHTML = `<span class="badge">good</span>No obvious gaps found.`;
    keywordEl.appendChild(li);
  } else {
    keywordSuggestions.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'tip';
      li.innerHTML = `<span class="badge">add</span><strong>${escapeHtml(s.keyword)}</strong> — ${escapeHtml(s.reason)}`;
      keywordEl.appendChild(li);
    });
  }

  const descScoreEl = document.getElementById('desc-score');
  descScoreEl.textContent = `${descResult.score}/100`;
  descScoreEl.className = `score ${scoreClass(descResult.score)}`;
  document.getElementById('desc-wordcount').textContent = `${descResult.wordCount} words`;
  renderIssues(document.getElementById('desc-issues'), descResult.issues);

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
