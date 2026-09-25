/* ============================================
   Sacra ITech — Cloud Access
   (moved here from the Admin portal)
   - Storage Folders: the parish's named folders with
     live size + file count (CloudFile model); click a
     folder to see its files, open or delete them
   - Upload: real S3 upload via Amplify Storage to
     cloudFiles/{folder}/{timestamp}_{name}, tracked
     with a CloudFile record
   - Recent Uploads + links to the Access Log, Roles,
     Service Health and Backups pages (which replace the
     old admin page's read-only versions of those)
   Uploads and deletions are written to Activity Logs.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';
import {
  STORAGE_FOLDERS, folderName, isExternalUrl, userFiles,
  escapeHtml, formatBytes, formatDateTime, timeAgo, showToast, logItAction,
  openModal, closeModal, wireModals,
} from './itech-shell.js';

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 20 * 1024 * 1024;
const FOLDER_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>';

const uploadModal = $('upload-modal');
const folderModal = $('folder-modal');
wireModals(uploadModal, folderModal);

let files = [];
let openFolderKey = null;

/* ---------- Folders ---------- */

// Named folders always show (even when empty); any other folder in use shows after them
function folderKeys() {
  const extra = [...new Set(files.map(f => f.folder || ''))].filter(k => !STORAGE_FOLDERS.some(f => f.key === k)).sort();
  return [...STORAGE_FOLDERS.map(f => f.key), ...extra];
}

function renderFolders() {
  let totalBytes = 0;
  $('folders-list').innerHTML = folderKeys().map(key => {
    const inFolder = files.filter(f => (f.folder || '') === key);
    const bytes = inFolder.reduce((s, f) => s + (isExternalUrl(f.url) ? 0 : (f.bytes || 0)), 0);
    totalBytes += bytes;
    return `
      <li>
        <button type="button" class="folder-row" data-folder="${escapeHtml(key)}">
          <span class="folder-icon">${FOLDER_ICON}</span>
          <span class="folder-name">${escapeHtml(folderName(key))}</span>
          <span class="folder-meta"><b>${formatBytes(bytes)}</b> · ${inFolder.length} file${inFolder.length === 1 ? '' : 's'}</span>
          <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </li>`;
  }).join('');
  $('folders-total').textContent = `${formatBytes(totalBytes)} total`;

  $('upload-folder').innerHTML = STORAGE_FOLDERS.map(f => `<option value="${f.key}">${escapeHtml(f.name)}</option>`).join('');
}

function renderRecent() {
  const recent = files.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6);
  $('recent-uploads').innerHTML = recent.length === 0
    ? '<li class="empty-state">No uploads yet.</li>'
    : recent.map(f => `
      <li class="activity-row">
        <span class="folder-icon small">${FOLDER_ICON}</span>
        <div class="activity-main">
          <p class="activity-detail">${escapeHtml(f.name)}</p>
          <p class="activity-meta">${escapeHtml(folderName(f.folder))} · ${isExternalUrl(f.url) ? 'link' : formatBytes(f.bytes)} · ${timeAgo(f.createdAt)}</p>
        </div>
      </li>`).join('');
}

function renderFolderFiles() {
  if (openFolderKey === null) return;
  $('folder-modal-title').textContent = folderName(openFolderKey);
  const inFolder = files.filter(f => (f.folder || '') === openFolderKey)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  $('folder-files').innerHTML = inFolder.length === 0
    ? '<li class="empty-state">No files in this folder yet.</li>'
    : inFolder.map(f => `
      <li class="file-row">
        <div class="min-w-0 flex-1">
          <p class="file-row-name">${escapeHtml(f.name)}</p>
          <p class="file-row-meta">${isExternalUrl(f.url) ? 'External link' : formatBytes(f.bytes)} · ${escapeHtml(formatDateTime(f.createdAt))}</p>
        </div>
        <div class="file-actions">
          <button type="button" class="btn-link" data-open="${f.id}">Open</button>
          <button type="button" class="btn-link danger" data-delete="${f.id}">Delete</button>
        </div>
      </li>`).join('');
}

client.models.CloudFile.observeQuery().subscribe({
  next: ({ items }) => {
    files = userFiles(items);
    renderFolders();
    renderRecent();
    if (!folderModal.classList.contains('hidden')) renderFolderFiles();
  },
  error: (err) => {
    console.error('Failed to load files:', err);
    $('folders-list').innerHTML = '<li class="empty-state">Couldn’t load storage folders.</li>';
  },
});

$('folders-list').addEventListener('click', (e) => {
  const row = e.target.closest('[data-folder]');
  if (!row) return;
  openFolderKey = row.dataset.folder;
  renderFolderFiles();
  openModal(folderModal);
});

$('folder-files').addEventListener('click', async (e) => {
  const openId = e.target.closest('[data-open]')?.dataset.open;
  if (openId) {
    const f = files.find(x => x.id === openId);
    if (!f) return;
    const win = window.open('about:blank', '_blank'); // open now so popup blockers allow it
    try {
      const href = isExternalUrl(f.url) ? f.url : (await getUrl({ path: f.url, options: { expiresIn: 900 } })).url.toString();
      if (win) { win.opener = null; win.location.href = href; } else window.location.href = href;
      logItAction('View', `${f.name} (${folderName(f.folder)})`);
    } catch (err) {
      win?.close();
      console.error('Failed to open file:', err);
      showToast('Couldn’t open that file — it may be missing from storage.', true);
    }
    return;
  }

  const delId = e.target.closest('[data-delete]')?.dataset.delete;
  if (!delId) return;
  const f = files.find(x => x.id === delId);
  if (!f || !confirm(`Permanently delete “${f.name}”? This removes it for everyone and can’t be undone.`)) return;
  try {
    if (!isExternalUrl(f.url)) await remove({ path: f.url }).catch(err => console.warn('S3 object not removed (may already be gone):', err));
    const { errors } = await client.models.CloudFile.delete({ id: delId });
    if (errors?.length) throw new Error(errors[0].message);
    logItAction('Delete File', `${f.name} (${folderName(f.folder)}, ${formatBytes(f.bytes)})`);
    showToast(`“${f.name}” deleted.`);
  } catch (err) {
    console.error('Failed to delete file:', err);
    showToast(err.message || 'Couldn’t delete the file.', true);
  }
});

/* ---------- Upload ---------- */

const dropzone = $('upload-dropzone');
const fileInput = $('upload-file-input');
const fileNameEl = $('upload-filename');

function showPicked(file) {
  fileNameEl.textContent = file ? `Selected: ${file.name} (${formatBytes(file.size)})` : '';
  fileNameEl.classList.toggle('hidden', !file);
}

$('btn-upload').addEventListener('click', () => {
  fileInput.value = '';
  showPicked(null);
  $('upload-submit').disabled = false;
  $('upload-submit').textContent = 'Upload File';
  openModal(uploadModal);
});

fileInput.addEventListener('change', () => showPicked(fileInput.files[0]));
['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
['dragleave', 'dragend', 'drop'].forEach(evt => dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover')));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; showPicked(fileInput.files[0]); }
});

$('upload-submit').addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) { showToast('Please choose a file to upload.', true); return; }
  if (file.size > MAX_BYTES) { showToast('That file is larger than 20 MB.', true); return; }
  const key = $('upload-folder').value;
  const btn = $('upload-submit');
  btn.disabled = true;
  btn.textContent = 'Uploading…';
  try {
    const path = `cloudFiles/${key}/${Date.now()}_${file.name}`;
    await uploadData({ path, data: file, options: { contentType: file.type } }).result;
    const { errors } = await client.models.CloudFile.create({ name: file.name, url: path, folder: key, bytes: file.size });
    if (errors?.length) throw new Error(errors[0].message);
    logItAction('Upload', `${file.name} → ${folderName(key)} (${formatBytes(file.size)})`);
    closeModal(uploadModal);
    showToast(`Uploaded to “${folderName(key)}”.`);
  } catch (err) {
    console.error('Upload failed:', err);
    showToast(err.message || 'Upload failed.', true);
    btn.disabled = false;
    btn.textContent = 'Upload File';
  }
});
