/* ============================================
   SacraDigit Admin — Scan Document screen
   (Digital Archives). Full-screen view beside
   the sidebar: the document on the left with a
   box around every word the scanner read (amber
   = please check), the results on the right.

   Saving uploads the original file, stores the
   transcript beside it as "<file>.scan.json",
   and creates the ParishRecord — so no backend
   schema change is needed for the scanned text.
   ============================================ */

import { client } from '../../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';
import { readNameFields, setNameFields, nameFieldsFilled, formatFullName } from '../../name-utils.js';
import { DOC_TYPES, extractFields } from './scan-engine.js';
import { openDocument, rotateCanvas, scanPage, warmUpOcr, isPdf } from './document-scanner.js';

const LOW_CONF = 60;          // below this, a word/field is flagged "please check"
const MAX_BYTES = 20 * 1024 * 1024;
const ZOOMS = [1, 1.5, 2, 3];

export const SCAN_SUFFIX = '.scan.json';

export function initScanScreen({ showToast }) {
  const $ = (id) => document.getElementById(id);
  const screen      = $('scan-screen');
  const fileInput   = $('scan-file');
  const dropzone    = $('scan-dropzone');
  const stage       = $('scan-stage');
  const stageInner  = $('scan-stage-inner');
  const canvas      = $('scan-canvas');
  const overlay     = $('scan-overlay');
  const tools       = $('scan-tools');
  const pager       = $('scan-pager');
  const docFoot     = $('scan-doc-foot');
  const docTypeSel  = $('scan-doc-type');
  const recTypeSel  = $('scan-record-type');
  const runBtn      = $('scan-run');
  const runLabel    = $('scan-run-label');
  const progress    = $('scan-progress');
  const progressBar = $('scan-progress-bar');
  const progressTxt = $('scan-progress-text');
  const emptyNote   = $('scan-empty');
  const results     = $('scan-results');
  const summary     = $('scan-summary');
  const fieldsWrap  = $('scan-fields');
  const fieldsSect  = $('scan-fields-section');
  const textArea    = $('scan-text');
  const saveBtn     = $('scan-save');
  const thresholdCb = $('scan-threshold');
  const showBoxesCb = $('scan-show-boxes');

  docTypeSel.innerHTML = Object.entries(DOC_TYPES)
    .map(([key, t]) => `<option value="${key}">${t.label}</option>`).join('');

  // Per-open state
  let file = null;
  let doc = null;            // { pageCount, renderPage }
  let pageNo = 1;
  const pages = new Map();   // pageNo → { turns, source, scan }
  let zoomIdx = 0;
  let busy = false;
  let lastFocused = null;    // input/textarea that receives clicked words

  /* ---------- open / close ---------- */

  function open() {
    reset();
    screen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('scan-screen-open');
    warmUpOcr(); // start downloading the text reader while the admin picks a file
  }

  function close() {
    if (screen.classList.contains('hidden') || busy) return;
    document.body.classList.remove('scan-screen-open');
    const finish = () => { screen.classList.add('hidden'); reset(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    screen.classList.add('is-closing');
    screen.addEventListener('animationend', () => { screen.classList.remove('is-closing'); finish(); }, { once: true });
  }

  function reset() {
    file = null; doc = null; pageNo = 1; pages.clear(); zoomIdx = 0; lastFocused = null;
    fileInput.value = '';
    dropzone.classList.remove('hidden');
    [stage, tools, docFoot, results, progress].forEach(el => el.classList.add('hidden'));
    emptyNote.classList.remove('hidden');
    runBtn.disabled = true; saveBtn.disabled = true;
    runLabel.textContent = 'Scan Document';
    docTypeSel.value = 'birth';
    recTypeSel.value = DOC_TYPES.birth.archiveAs;
    thresholdCb.checked = false;
    clearResultInputs();
    applyZoom();
  }

  function clearResultInputs() {
    setNameFields('scan-name', null);
    setNameFields('scan-spouse', null);
    $('scan-date').value = '';
    $('scan-officiant').value = '';
    fieldsWrap.innerHTML = '';
    textArea.value = '';
    summary.innerHTML = '';
  }

  $('scan-back').addEventListener('click', close);
  $('scan-cancel').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !screen.classList.contains('hidden')) close(); });

  /* ---------- choosing a file ---------- */

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'dragend'].forEach(evt => dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  $('scan-replace').addEventListener('click', () => { if (!busy) fileInput.click(); });

  async function loadFile(f) {
    if (!(f.type.startsWith('image/') || isPdf(f))) { showToast('Please choose a JPG, PNG, or PDF file.', true); return; }
    if (f.size > MAX_BYTES) { showToast('That file is over 20 MB. Please use a smaller scan.', true); return; }
    try {
      setBusy(true, 'Opening file…');
      const d = await openDocument(f);
      file = f; doc = d; pageNo = 1; pages.clear();
      clearResultInputs();
      results.classList.add('hidden');
      emptyNote.classList.remove('hidden');
      saveBtn.disabled = true;
      dropzone.classList.add('hidden');
      [stage, tools, docFoot].forEach(el => el.classList.remove('hidden'));
      pager.classList.toggle('hidden', d.pageCount < 2);
      await showPage(1);
    } catch (err) {
      console.error('Could not open document:', err);
      showToast("Couldn't open that file. Try a JPG or PNG photo of the page.", true);
    } finally {
      setBusy(false);
      fileInput.value = '';
    }
  }

  async function pageState(n) {
    if (!pages.has(n)) pages.set(n, { turns: 0, original: await doc.renderPage(n), scan: null });
    return pages.get(n);
  }

  async function showPage(n) {
    pageNo = n;
    const st = await pageState(n);
    $('scan-page-label').textContent = `Page ${n} of ${doc.pageCount}`;
    $('scan-prev-page').disabled = n <= 1;
    $('scan-next-page').disabled = n >= doc.pageCount;
    runLabel.textContent = st.scan ? 'Scan Again' : (doc.pageCount > 1 ? `Scan Page ${n}` : 'Scan Document');
    runBtn.disabled = false;
    draw(st);
  }

  function currentSource(st) {
    return rotateCanvas(st.original, st.turns);
  }

  /** Paints the page: the cleaned image + word boxes once scanned, else the original. */
  function draw(st) {
    const img = st.scan ? st.scan.canvas : currentSource(st);
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    overlay.setAttribute('viewBox', `0 0 ${img.width} ${img.height}`);
    overlay.innerHTML = st.scan ? st.scan.rows.flatMap(r => r.words).map((w, i) => `
      <rect class="scan-word ${w.conf < LOW_CONF ? 'low' : 'ok'}" data-i="${i}"
        x="${w.x0 - 3}" y="${w.y0 - 3}" width="${w.x1 - w.x0 + 6}" height="${w.y1 - w.y0 + 6}" rx="4">
        <title>${escapeXml(w.text)} · ${w.conf}% sure</title>
      </rect>`).join('') : '';
    overlay.classList.toggle('hidden', !showBoxesCb.checked);
  }

  $('scan-prev-page').addEventListener('click', () => { if (!busy && pageNo > 1) showPage(pageNo - 1); });
  $('scan-next-page').addEventListener('click', () => { if (!busy && pageNo < doc.pageCount) showPage(pageNo + 1); });

  async function rotate(delta) {
    if (busy || !doc) return;
    const st = await pageState(pageNo);
    st.turns += delta;
    st.scan = null; // boxes no longer line up — scan again
    runLabel.textContent = doc.pageCount > 1 ? `Scan Page ${pageNo}` : 'Scan Document';
    draw(st);
  }
  $('scan-rotate-left').addEventListener('click', () => rotate(-1));
  $('scan-rotate-right').addEventListener('click', () => rotate(1));

  function applyZoom() {
    stageInner.style.width = `${ZOOMS[zoomIdx] * 100}%`;
    $('scan-zoom-out').disabled = zoomIdx === 0;
    $('scan-zoom-in').disabled = zoomIdx === ZOOMS.length - 1;
  }
  $('scan-zoom-in').addEventListener('click', () => { zoomIdx = Math.min(ZOOMS.length - 1, zoomIdx + 1); applyZoom(); });
  $('scan-zoom-out').addEventListener('click', () => { zoomIdx = Math.max(0, zoomIdx - 1); applyZoom(); });

  showBoxesCb.addEventListener('change', () => overlay.classList.toggle('hidden', !showBoxesCb.checked));

  /* ---------- document type ---------- */

  docTypeSel.addEventListener('change', () => {
    const t = DOC_TYPES[docTypeSel.value];
    if (t && t.archiveAs) recTypeSel.value = t.archiveAs;
    $('scan-spouse-group').classList.toggle('hidden', docTypeSel.value !== 'marriage');
    // Re-read the fields from what's already been scanned — no need to OCR again.
    const scanned = [...pages.values()].filter(p => p.scan);
    if (scanned.length) fillFromScans(true);
  });

  /* ---------- scanning ---------- */

  function setBusy(on, text = '') {
    busy = on;
    runBtn.disabled = on || !doc;
    saveBtn.disabled = on || !hasScan();
    tools.querySelectorAll('button').forEach(b => { b.disabled = on; });
    if (!on) { applyZoom(); if (doc) { $('scan-prev-page').disabled = pageNo <= 1; $('scan-next-page').disabled = pageNo >= doc.pageCount; } }
    progress.classList.toggle('hidden', !on);
    if (on) { progressBar.style.width = '0%'; progressTxt.textContent = text; }
  }

  const hasScan = () => [...pages.values()].some(p => p.scan);

  runBtn.addEventListener('click', async () => {
    if (!doc || busy) return;
    const st = await pageState(pageNo);
    setBusy(true, 'Cleaning up the image…');
    try {
      const scan = await scanPage(currentSource(st), {
        threshold: thresholdCb.checked,
        onProgress: ({ stage: s, progress: p }) => {
          if (s === 'enhance') { progressTxt.textContent = 'Straightening and cleaning up the image…'; progressBar.style.width = '8%'; }
          if (s === 'load') { progressTxt.textContent = 'Loading the text reader (first scan only)…'; progressBar.style.width = `${8 + p * 12}%`; }
          if (s === 'ocr') { progressTxt.textContent = `Reading text… ${Math.round(p * 100)}%`; progressBar.style.width = `${20 + p * 80}%`; }
        },
      });
      st.scan = scan;
      draw(st);
      fillFromScans(false);
      emptyNote.classList.add('hidden');
      results.classList.remove('hidden');
      runLabel.textContent = 'Scan Again';
      if (!scan.words.length) showToast('No text was found. Try rotating the page or a sharper photo.', true);
    } catch (err) {
      console.error('Scan failed:', err);
      showToast("The scan didn't finish. Check your internet connection (the text reader downloads on first use) and try again.", true);
    } finally {
      setBusy(false);
    }
  });

  /**
   * Puts the scan results into the form. Only fills boxes that are still
   * empty (unless `overwrite`), so re-scanning never wipes the admin's edits.
   */
  function fillFromScans(overwrite) {
    const scanned = [...pages.entries()].filter(([, p]) => p.scan).sort((a, b) => a[0] - b[0]);
    if (!scanned.length) return;

    // Full text: every scanned page, in page order.
    const text = scanned.map(([n, p]) => (scanned.length > 1 || doc.pageCount > 1 ? `--- Page ${n} ---\n` : '') + p.scan.text).join('\n\n');
    textArea.value = text;

    // Fields: first match wins, walking pages in order.
    const spec = DOC_TYPES[docTypeSel.value];
    const found = {};
    for (const [, p] of scanned) {
      const f = extractFields(p.scan.rows, docTypeSel.value);
      for (const [k, v] of Object.entries(f)) if (!found[k]) found[k] = v;
    }

    const conf = Math.round(scanned.reduce((a, [, p]) => a + p.scan.confidence, 0) / scanned.length);
    const skew = scanned.find(([n]) => n === pageNo)?.[1].scan.skew || 0;
    const tone = conf >= 75 ? 'good' : conf >= LOW_CONF ? 'fair' : 'poor';
    summary.innerHTML = `
      <span class="scan-chip scan-chip-${tone}">${conf}% read clearly</span>
      <span class="scan-summary-text">${
        tone === 'good' ? 'Clear scan. Still give every field a quick check.'
        : tone === 'fair' ? 'Some words were hard to read — they’re marked in amber.'
        : 'Hard to read. Try “Boost faint ink”, a flatter photo, or type the details in.'
      }${skew ? ` Straightened by ${Math.abs(skew)}°.` : ''}</span>`;

    // Archive-record boxes
    const primary = spec.fields.find(f => f.target === 'fullName' && found[f.key]);
    if (primary && (overwrite || !nameFieldsFilled('scan-name'))) setNameFields('scan-name', found[primary.key].value);
    if (docTypeSel.value === 'marriage' && found.wifeName && (overwrite || !nameFieldsFilled('scan-spouse'))) setNameFields('scan-spouse', found.wifeName.value);
    const dateField = spec.fields.find(f => f.target === 'dateOfEvent' && found[f.key]);
    if (dateField && /^\d{4}-\d{2}-\d{2}$/.test(found[dateField.key].value) && (overwrite || !$('scan-date').value)) $('scan-date').value = found[dateField.key].value;
    const offField = spec.fields.find(f => f.target === 'officiant' && found[f.key]);
    if (offField && (overwrite || !$('scan-officiant').value)) $('scan-officiant').value = found[offField.key].text;
    flagLow($('scan-name-first'), primary && found[primary.key].conf);
    flagLow($('scan-date'), dateField && found[dateField.key].conf);
    flagLow($('scan-officiant'), offField && found[offField.key].conf);

    // Every field for this document type, editable
    const prev = {};
    fieldsWrap.querySelectorAll('input[data-key]').forEach(i => { prev[i.dataset.key] = i.value; });
    fieldsWrap.innerHTML = spec.fields.map(f => {
      const hit = found[f.key];
      let val = hit ? displayValue(f, hit) : '';
      if (!overwrite && prev[f.key]) val = prev[f.key];
      const low = hit && hit.conf < LOW_CONF;
      return `
        <div class="scan-field${low ? ' is-low' : ''}">
          <label class="form-label" for="scan-f-${f.key}">${escapeXml(f.label)}${hit ? ` <span class="scan-field-conf">${hit.conf}%</span>` : ''}</label>
          <input type="text" id="scan-f-${f.key}" class="form-input" data-key="${f.key}" value="${escapeXml(val)}" placeholder="${hit ? '' : 'Not found — type it or click words'}" />
        </div>`;
    }).join('');
    fieldsSect.classList.toggle('hidden', !spec.fields.length);
    saveBtn.disabled = false;
  }

  function displayValue(field, hit) {
    if (field.kind === 'name') return formatFullName(hit.value);
    if (field.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(hit.value)) {
      return new Date(hit.value + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return hit.text;
  }

  function flagLow(input, conf) {
    input.classList.toggle('scan-input-low', conf !== undefined && conf !== null && conf < LOW_CONF);
  }

  /* ---------- click a word to copy it into the focused box ---------- */

  results.addEventListener('focusin', (e) => {
    if (e.target.matches('input[type="text"], textarea')) lastFocused = e.target;
  });

  overlay.addEventListener('mousedown', (e) => {
    // keep focus in the form box while clicking the document
    if (e.target.closest('.scan-word')) e.preventDefault();
  });

  overlay.addEventListener('click', (e) => {
    const rect = e.target.closest('.scan-word');
    if (!rect) return;
    const st = pages.get(pageNo);
    const word = st && st.scan ? st.scan.rows.flatMap(r => r.words)[+rect.dataset.i] : null;
    if (!word) return;
    if (!lastFocused || !document.body.contains(lastFocused)) {
      showToast(`“${word.text}” — click a box on the right first, then click words to copy them in.`);
      return;
    }
    const cur = lastFocused.value;
    lastFocused.value = cur && !/\s$/.test(cur) ? `${cur} ${word.text}` : cur + word.text;
    lastFocused.classList.remove('scan-input-low');
    lastFocused.focus();
    rect.classList.add('used');
  });

  $('scan-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(textArea.value); showToast('Full text copied.'); }
    catch { textArea.select(); document.execCommand('copy'); showToast('Full text copied.'); }
  });

  /* ---------- saving ---------- */

  saveBtn.addEventListener('click', async () => {
    if (!file || busy) return;
    const type = recTypeSel.value;
    const name = readNameFields('scan-name');
    if (!type) { showToast('Please choose which record type to save this as.', true); recTypeSel.focus(); return; }
    if (!nameFieldsFilled('scan-name')) { showToast('Please enter at least the first and last name.', true); $('scan-name-first').focus(); return; }

    let fullName = formatFullName(name);
    if (docTypeSel.value === 'marriage' && nameFieldsFilled('scan-spouse')) fullName += ` & ${formatFullName(readNameFields('scan-spouse'))}`;

    const fields = {};
    fieldsWrap.querySelectorAll('input[data-key]').forEach(i => {
      const spec = DOC_TYPES[docTypeSel.value].fields.find(f => f.key === i.dataset.key);
      if (i.value.trim()) fields[spec ? spec.label : i.dataset.key] = i.value.trim();
    });
    const scanned = [...pages.entries()].filter(([, p]) => p.scan);
    const transcript = {
      version: 1,
      documentType: DOC_TYPES[docTypeSel.value].label,
      scannedAt: new Date().toISOString(),
      confidence: Math.round(scanned.reduce((a, [, p]) => a + p.scan.confidence, 0) / Math.max(1, scanned.length)),
      fields,
      text: textArea.value,
    };

    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = 'Saving…';
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `cloudFiles/parishRecords/${Date.now()}_${safeName}`;
      await uploadData({ path, data: file, options: { contentType: file.type || undefined } }).result;
      await uploadData({
        path: path + SCAN_SUFFIX,
        data: new Blob([JSON.stringify(transcript, null, 2)], { type: 'application/json' }),
        options: { contentType: 'application/json' },
      }).result;

      const date = $('scan-date').value;
      const officiant = $('scan-officiant').value.trim();
      const result = await client.models.ParishRecord.create({
        fullName,
        type,
        dateOfEvent: date || undefined,
        officiant: officiant || undefined,
        addedByName: 'Admin User', // TODO: pull from signed-in Cognito user once auth UI exists
        status: 'digitized',
        fileURL: path,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      showToast(`“${fullName}” scanned and saved to the archive.`);
      busy = false;
      close();
    } catch (err) {
      console.error('Failed to save scanned record:', err);
      showToast(err.message || "Couldn't save the record.", true);
      saveBtn.disabled = false;
    } finally {
      saveBtn.textContent = label;
    }
  });

  return { open };
}

function escapeXml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
