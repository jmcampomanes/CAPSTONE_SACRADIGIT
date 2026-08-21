/* ============================================
   SacraDigit Admin — Digital Archives Scripts (AWS Amplify)
   Backed by the ParishRecord model.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  let records = []; // kept in sync via observeQuery, each has .id

  const tbody         = document.getElementById('records-tbody');
  const emptyState     = document.getElementById('empty-state');
  const resultsCount   = document.getElementById('results-count');
  const searchInput    = document.getElementById('search-input');
  const typeFilter      = document.getElementById('type-filter');
  const dateFilter      = document.getElementById('date-filter');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');

  // Schema stores status as lowercase enum values; UI shows Title Case
  const statusLabel = { digitized: 'Digitized', processing: 'Processing', queued: 'Queued' };
  const badgeClass  = { digitized: 'badge-green', processing: 'badge-amber', queued: 'badge-gray' };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* --- Live data --- */
  client.models.ParishRecord.observeQuery().subscribe({
    next: ({ items }) => {
      records = items;
      renderStats();
      renderRecords();
    },
    error: (err) => {
      console.error('Failed to load records:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load records.</td></tr>`;
    },
  });

  /* ------------------------------------------
     STAT COUNTERS
  ------------------------------------------ */
  function renderStats() {
    const digitized = records.filter(r => r.status === 'digitized').length;
    const pending    = records.filter(r => r.status === 'processing' || r.status === 'queued').length;

    document.getElementById('stat-total').textContent      = records.length.toLocaleString();
    document.getElementById('stat-digitized').textContent  = digitized.toLocaleString();
    document.getElementById('stat-pending').textContent    = pending.toLocaleString();
    document.getElementById('stat-digitized-sub').textContent =
      records.length ? `${Math.round((digitized / records.length) * 100)}% of total archive` : 'of total archive';
  }

  /* ------------------------------------------
     STAT CARDS AS QUICK FILTERS
     Total clears the status quick-filter (and search/type/date, so the
     count on screen always matches the card you clicked); Digitized /
     Pending jump straight to those rows.
  ------------------------------------------ */
  let statusQuickFilter = ''; // '', 'digitized', or 'pending'

  const statCardsByStatus = [
    { card: document.getElementById('stat-total').closest('.stat-card'),     status: '' },
    { card: document.getElementById('stat-digitized').closest('.stat-card'), status: 'digitized' },
    { card: document.getElementById('stat-pending').closest('.stat-card'),   status: 'pending' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const activate = () => {
      statusQuickFilter = status;
      updateActiveStatCard();
      renderRecords();
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusQuickFilter === status);
    });
  }

  function renderRecords() {
    const query   = searchInput.value.trim().toLowerCase();
    const typeVal = typeFilter.value;
    const dateVal = dateFilter.value;
    const now = new Date();

    const filtered = records.filter(r => {
      const matchesQuery = !query ||
        (r.fullName || '').toLowerCase().includes(query) ||
        (r.type || '').toLowerCase().includes(query);

      const matchesType = !typeVal || r.type === typeVal.toLowerCase();

      let matchesDate = true;
      if (dateVal && dateVal !== 'all') {
        const days = parseInt(dateVal, 10);
        const recordDate = new Date(r.createdAt);
        const diffDays = (now - recordDate) / (1000 * 60 * 60 * 24);
        matchesDate = diffDays <= days;
      }

      const matchesStatus = !statusQuickFilter ||
        (statusQuickFilter === 'pending'
          ? (r.status === 'processing' || r.status === 'queued')
          : r.status === statusQuickFilter);

      return matchesQuery && matchesType && matchesDate && matchesStatus;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      const sorted = filtered.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sorted.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-medium text-gray-900">${escapeHtml(r.fullName)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${formatDate(r.createdAt)}</td>
          <td>${escapeHtml(r.addedByName)}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${statusLabel[r.status] || r.status}</span></td>
          <td class="text-right"><button type="button" class="row-action" data-id="${r.id}">View ›</button></td>
        `;
        tbody.appendChild(tr);
      });
    }

    resultsCount.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
  }

  searchInput.addEventListener('input', renderRecords);
  typeFilter.addEventListener('change', renderRecords);
  dateFilter.addEventListener('change', renderRecords);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    dateFilter.value = '';
    renderRecords();
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (!btn) return;
    openViewModal(btn.dataset.id);
  });


  /* --- Modals --- */
  const uploadModal    = document.getElementById('upload-modal');
  const newRecordModal = document.getElementById('new-record-modal');
  const viewRecordModal = document.getElementById('view-record-modal');
  const viewRecordBody   = document.getElementById('view-record-body');

  document.getElementById('btn-upload').addEventListener('click', () => openModal(uploadModal));
  document.getElementById('btn-new-record').addEventListener('click', () => openModal(newRecordModal));

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(uploadModal); closeModal(newRecordModal); closeModal(viewRecordModal); });
  });

  [uploadModal, newRecordModal, viewRecordModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(uploadModal); closeModal(newRecordModal); closeModal(viewRecordModal); }
  });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  function openViewModal(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;

    viewRecordBody.innerHTML = `
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Full Name</p><p class="so-detail-value">${escapeHtml(r.fullName)}</p></div>
        <div><p class="so-detail-label">Record Type</p><p class="so-detail-value">${escapeHtml(r.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${statusLabel[r.status] || r.status}</p></div>
        <div><p class="so-detail-label">Date of Event</p><p class="so-detail-value">${formatDate(r.dateOfEvent)}</p></div>
        <div><p class="so-detail-label">Officiant</p><p class="so-detail-value">${escapeHtml(r.officiant) || '—'}</p></div>
        <div><p class="so-detail-label">Added By</p><p class="so-detail-value">${escapeHtml(r.addedByName) || '—'}</p></div>
        <div><p class="so-detail-label">Date Added</p><p class="so-detail-value">${formatDate(r.createdAt)}</p></div>
      </div>
      ${r.fileURL ? `<div class="mt-3"><a href="${r.fileURL}" target="_blank" rel="noopener" class="certificate-chip">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4"/></svg>
          View scanned file
        </a></div>` : ''}
    `;

    openModal(viewRecordModal);
  }


  /* --- Upload modal (file picker only creates a record; actual file
     storage would follow the same uploadData() pattern as
     cloud-access.js if you want the scanned file itself stored) --- */
  const dropzone       = document.getElementById('upload-dropzone');
  const fileInput       = document.getElementById('upload-file-input');
  const uploadFilename   = document.getElementById('upload-filename');

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
    const type = document.getElementById('upload-type').value;
    const name = document.getElementById('upload-name').value.trim();

    if (!fileInput.files.length) { showToast('Please select a file to upload.', true); return; }
    if (!type || !name) { showToast('Please fill in record type and name.', true); return; }

    try {
      const result = await client.models.ParishRecord.create({
        fullName: name,
        type: type.toLowerCase(),
        addedByName: 'Admin User', // TODO: pull from signed-in Cognito user once auth UI exists
        status: 'processing',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(uploadModal);
      showToast(`"${name}" uploaded and queued for processing.`);
      fileInput.value = '';
      uploadFilename.classList.add('hidden');
      document.getElementById('upload-type').value = '';
      document.getElementById('upload-name').value = '';
    } catch (err) {
      console.error('Failed to save record:', err);
      showToast(err.message || "Couldn't save the record.", true);
    }
  });


  /* --- New Record modal (manual entry) --- */
  document.getElementById('new-record-submit').addEventListener('click', async () => {
    const name      = document.getElementById('new-name').value.trim();
    const type      = document.getElementById('new-type').value;
    const date      = document.getElementById('new-date').value;
    const officiant = document.getElementById('new-officiant').value.trim();

    if (!name || !type || !date) { showToast('Please fill in name, type, and date.', true); return; }

    try {
      const result = await client.models.ParishRecord.create({
        fullName: name,
        type: type.toLowerCase(),
        dateOfEvent: date,
        officiant: officiant || undefined,
        addedByName: 'Admin User',
        status: 'digitized',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(newRecordModal);
      showToast(`Record for "${name}" saved.`);
      ['new-name', 'new-officiant', 'new-notes'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('new-type').value = '';
      document.getElementById('new-date').value = '';
    } catch (err) {
      console.error('Failed to save record:', err);
      showToast(err.message || "Couldn't save the record.", true);
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