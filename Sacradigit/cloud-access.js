/* ============================================
   SacraDigit Admin — Cloud Access Scripts (AWS Amplify)
   Storage Folders + Upload: REAL — uses Amplify Storage (S3)
   and the CloudFile data model to track metadata.
   Access Log / Roles: real reads from the AccessLog / Role
   models (empty until you write to them).
   Service Health: static reference — needs a real backend
   monitoring setup to be genuinely live.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

document.addEventListener('DOMContentLoaded', () => {

  const folders = [
    { name: 'Baptismal Records',    key: 'baptism' },
    { name: 'Confirmation Records', key: 'confirmation' },
    { name: 'Marriage Records',     key: 'marriage' },
    { name: 'Death Records',        key: 'death' },
    { name: 'Parish Announcements', key: 'announcements' },
    { name: 'Financial Documents',  key: 'financial' },
  ];

  const actionTagClass = { 'View': 'action-view', 'Download': 'action-download', 'Edit': 'action-edit' };

  const services = [
    { name: 'DynamoDB',  status: 'ok', label: 'Operational', meta: 'Live — reachable' },
    { name: 'Cognito',   status: 'ok', label: 'Operational', meta: 'Live — reachable' },
    { name: 'S3',        status: 'ok', label: 'Operational', meta: 'See Storage Folders below' },
    { name: 'AppSync',   status: 'ok', label: 'Operational', meta: 'GraphQL API live' },
    { name: 'Amplify Hosting', status: 'ok', label: 'Not deployed yet', meta: 'Set up CI/CD when ready' },
    { name: 'Backup',    status: 'ok', label: 'Not configured', meta: 'DynamoDB point-in-time recovery' },
  ];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function renderHealth() {
    document.getElementById('health-grid').innerHTML = services.map(s => `
      <div class="health-card">
        <div class="health-icon ${s.status}">${healthIcon(s.status)}</div>
        <div class="min-w-0">
          <p class="health-name">${escapeHtml(s.name)}</p>
          <p class="health-status ${s.status}">${escapeHtml(s.label)}</p>
          <p class="health-meta">${escapeHtml(s.meta)}</p>
        </div>
      </div>`).join('');
  }

  function healthIcon(status) {
    if (status === 'ok') return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
    if (status === 'warn') return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.93 4.93h.01"/></svg>`;
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  }

  /* --- Storage Folders (live from CloudFile model) --- */
  let currentFiles = [];

  function renderFolders(files) {
    const list = document.getElementById('folders-list');
    let totalBytes = 0;

    list.innerHTML = folders.map(f => {
      const forFolder = files.filter(x => x.folder === f.key);
      const bytes = forFolder.reduce((sum, x) => sum + (x.bytes || 0), 0);
      totalBytes += bytes;
      return `
        <li>
          <div class="folder-row folder-row-clickable" data-folder-key="${escapeHtml(f.key)}" role="button" tabindex="0">
            <div class="folder-icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
            </div>
            <span class="folder-name">${escapeHtml(f.name)}</span>
            <span class="folder-meta">
              <span class="folder-size">${formatBytes(bytes)}</span>
              ${forFolder.length} file${forFolder.length === 1 ? '' : 's'}
            </span>
          </div>
        </li>`;
    }).join('');

    const totalEl = document.querySelector('.panel-header .text-xs.text-gray-400');
    if (totalEl) totalEl.textContent = `${formatBytes(totalBytes)} total`;
  }

  client.models.CloudFile.observeQuery().subscribe({
    next: ({ items }) => {
      currentFiles = items;
      renderFolders(items);
      if (activeFolderKey && !folderFilesModal.classList.contains('hidden')) {
        renderFolderFilesList(activeFolderKey);
      }
    },
    error: (err) => console.error('Failed to load files:', err),
  });

  /* --- Recent Access Log --- */
  client.models.AccessLog.observeQuery().subscribe({
    next: ({ items }) => {
      const tbody = document.getElementById('access-log-tbody');
      const recent = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
      tbody.innerHTML = recent.length === 0
        ? `<tr><td colspan="4" class="text-center text-gray-400 text-sm py-8">No access log entries yet.</td></tr>`
        : recent.map(a => `
            <tr>
              <td class="font-medium text-gray-900">${escapeHtml(a.userName)}</td>
              <td class="text-gray-500">${escapeHtml(a.fileName)}</td>
              <td><span class="action-tag ${actionTagClass[a.action] || ''}">${escapeHtml(a.action)}</span></td>
              <td class="text-gray-400">${new Date(a.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
            </tr>`).join('');
    },
    error: (err) => console.error('Failed to load access log:', err),
  });

  /* --- Access Roles & Permissions --- */
  client.models.Role.observeQuery().subscribe({
    next: ({ items }) => {
      const tbody = document.getElementById('roles-tbody');
      tbody.innerHTML = items.length === 0
        ? `<tr><td colspan="3" class="text-center text-gray-400 text-sm py-8">No roles defined yet.</td></tr>`
        : items.map(r => `
            <tr>
              <td class="font-semibold text-gray-900">${escapeHtml(r.role)}</td>
              <td>${(r.permissions ? JSON.parse(r.permissions) : []).map(p => `<span class="permission-tag ${p.granted ? 'granted' : ''}">${p.granted ? '✓' : '–'} ${escapeHtml(p.label)}</span>`).join('')}</td>
              <td class="assigned-users">${escapeHtml(r.users)}</td>
            </tr>`).join('');
    },
    error: (err) => console.error('Failed to load roles:', err),
  });

  renderHealth();

  /* --- Upload Modal — real S3 upload via Amplify Storage --- */
  const uploadModal = document.getElementById('upload-modal');
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('upload-file-input');
  const uploadFilename = document.getElementById('upload-filename');
  const uploadFolderSelect = document.getElementById('upload-folder');

  uploadFolderSelect.innerHTML = folders.map(f => `<option value="${escapeHtml(f.key)}">${escapeHtml(f.name)}</option>`).join('');

  document.getElementById('btn-upload').addEventListener('click', () => openModal(uploadModal));

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFilename.textContent = `Selected: ${fileInput.files[0].name}`;
      uploadFilename.classList.remove('hidden');
    }
  });

  ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'dragend'].forEach(evt => dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      uploadFilename.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
      uploadFilename.classList.remove('hidden');
    }
  });

  document.getElementById('upload-submit').addEventListener('click', async () => {
    if (!fileInput.files.length) { showToast('Please select a file to upload.', true); return; }

    const file = fileInput.files[0];
    const key = uploadFolderSelect.value;
    const folder = folders.find(f => f.key === key);
    const submitBtn = document.getElementById('upload-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';

    try {
      const path = `cloudFiles/${key}/${Date.now()}_${file.name}`;
      await uploadData({ path, data: file }).result;

      const createResult = await client.models.CloudFile.create({
        name: file.name,
        url: path, // resolve to a viewable URL later via getUrl({ path })
        folder: key,
        bytes: file.size,
      });
      if (createResult.errors) throw new Error(createResult.errors.map(e => e.message).join('; '));

      closeModal(uploadModal);
      showToast(`File uploaded to "${folder ? folder.name : key}".`);
      fileInput.value = '';
      uploadFilename.classList.add('hidden');
    } catch (err) {
      console.error('Upload failed:', err);
      showToast(err.message || 'Upload failed.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload File';
    }
  });

  /* --- Folder Files Modal --- */
  const folderFilesModal = document.getElementById('folder-files-modal');
  const folderFilesTitle = document.getElementById('folder-files-title');
  const folderFilesList  = document.getElementById('folder-files-list');
  let activeFolderKey = null;

  function renderFolderFilesList(key) {
    const folder = folders.find(f => f.key === key);
    folderFilesTitle.textContent = folder ? folder.name : 'Folder Files';

    const forFolder = currentFiles
      .filter(x => x.folder === key)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    folderFilesList.innerHTML = forFolder.length === 0
      ? `<li class="file-row-empty">No files in this folder yet.</li>`
      : forFolder.map(f => `
          <li class="file-row">
            <div class="file-row-info">
              <p class="file-row-name">${escapeHtml(f.name)}</p>
              <p class="file-row-meta">${formatBytes(f.bytes)} · ${f.createdAt ? new Date(f.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</p>
            </div>
            <button type="button" class="file-row-delete" data-file-id="${escapeHtml(f.id)}">Delete</button>
          </li>`).join('');
  }

  function openFolderFilesModal(key) {
    activeFolderKey = key;
    renderFolderFilesList(key);
    openModal(folderFilesModal);
  }

  document.getElementById('folders-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-folder-key]');
    if (!row) return;
    openFolderFilesModal(row.dataset.folderKey);
  });

  folderFilesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-row-delete');
    if (!btn) return;
    openFileDeleteModal(btn.dataset.fileId);
  });

  /* --- Delete File Confirmation Modal --- */
  const fileDeleteModal      = document.getElementById('file-delete-modal');
  const fileDeleteTargetName = document.getElementById('file-delete-target-name');
  let fileDeleteTargetId = null;

  function openFileDeleteModal(id) {
    const f = currentFiles.find(x => x.id === id);
    if (!f) return;
    fileDeleteTargetId = id;
    fileDeleteTargetName.textContent = f.name;
    openModal(fileDeleteModal);
  }

  document.getElementById('file-delete-confirm-submit').addEventListener('click', async () => {
    if (fileDeleteTargetId === null) return;
    const f = currentFiles.find(x => x.id === fileDeleteTargetId);

    try {
      const result = await client.models.CloudFile.delete({ id: fileDeleteTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(fileDeleteModal);
      showToast(`"${f ? f.name : 'File'}" deleted.`);
      fileDeleteTargetId = null;
    } catch (err) {
      console.error('Failed to delete file:', err);
      showToast(err.message || "Couldn't delete the file.", true);
    }
  });

  /* --- Modal helpers: close button / backdrop / Escape (all modals) --- */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(uploadModal);
      closeModal(folderFilesModal);
      closeModal(fileDeleteModal);
    });
  });

  [uploadModal, folderFilesModal, fileDeleteModal].forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(uploadModal);
      closeModal(folderFilesModal);
      closeModal(fileDeleteModal);
    }
  });

  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});