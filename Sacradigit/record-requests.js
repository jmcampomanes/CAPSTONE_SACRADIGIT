/* ============================================
   SacraDigit Admin — Record Requests Scripts (AWS Amplify)
   Backed by the CertificateRequest model
   (requesterName, certificateType, purpose, status,
   linkedRecordId, createdAt). Status flow:
   pending -> approved -> released, or -> rejected.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

document.addEventListener('DOMContentLoaded', () => {

  let requests = []; // kept in sync via observeQuery, each has .id

  const badgeClass = {
    pending:  'badge-amber',
    approved: 'badge-green',
    released: 'badge-blue',
    rejected: 'badge-red',
  };
  const statusLabel = {
    pending: 'Pending', approved: 'Approved', released: 'Released', rejected: 'Rejected',
  };

  /* ------------------------------------------
     1. DOM REFERENCES
     Resolved up front, before any function that
     might use them can possibly run — avoids
     "used before initialization" errors when
     renderRequests() fires on first paint.
  ------------------------------------------ */
  const tbody          = document.getElementById('requests-tbody');
  const emptyState      = document.getElementById('empty-state');
  const resultsCount    = document.getElementById('results-count');
  const searchInput     = document.getElementById('search-input');
  const statusFilter     = document.getElementById('status-filter');
  const typeFilter        = document.getElementById('type-filter');
  const clearFiltersBtn    = document.getElementById('btn-clear-filters');

  const uploadModal      = document.getElementById('upload-modal');
  const newRequestModal   = document.getElementById('new-request-modal');
  const rejectModal        = document.getElementById('reject-modal');
  const viewModal            = document.getElementById('view-modal');
  const generateCertModal      = document.getElementById('generate-cert-modal');

  const dropzone         = document.getElementById('upload-dropzone');
  const fileInput          = document.getElementById('upload-file-input');
  const uploadFilename       = document.getElementById('upload-filename');
  const uploadRequestSelect    = document.getElementById('upload-request');

  const rejectTargetName  = document.getElementById('reject-target-name');

  const viewName            = document.getElementById('view-name');
  const viewStatusBadge      = document.getElementById('view-status-badge');
  const viewType                = document.getElementById('view-type');
  const viewDate                  = document.getElementById('view-date');
  const viewPurpose                 = document.getElementById('view-purpose');
  const viewLinkedWrap                = document.getElementById('view-linked-wrap');

  const toast = document.getElementById('toast');

  let rejectTargetId = null;
  let toastTimer = null;

  /* ------------------------------------------
     2. HELPERS
  ------------------------------------------ */
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

  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    [uploadModal, newRequestModal, rejectModal, viewModal, generateCertModal].forEach(closeModal);
  }

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

  /* ------------------------------------------
     3. LIVE DATA
  ------------------------------------------ */
  client.models.CertificateRequest.observeQuery().subscribe({
    next: ({ items }) => {
      requests = items;
      renderStats();
      renderRequests();
    },
    error: (err) => {
      console.error('Failed to load requests:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load requests.</td></tr>`;
    },
  });

  /* ------------------------------------------
     4. STAT COUNTERS
     "Approved" counts requests that are approved
     but not yet released — released ones still
     count toward Total, and show their own status
     badge in the table, just not a dedicated card.
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-total').textContent    = requests.length;
    document.getElementById('stat-pending').textContent  = requests.filter(r => r.status === 'pending').length;
    document.getElementById('stat-approved').textContent = requests.filter(r => r.status === 'approved').length;
    document.getElementById('stat-rejected').textContent = requests.filter(r => r.status === 'rejected').length;
  }

  /* ------------------------------------------
     4b. STAT CARDS AS QUICK FILTERS
     Total clears the status filter (and search
     query, so the count on screen always matches
     the card you clicked); Pending / Approved /
     Rejected jump straight to those rows.
  ------------------------------------------ */
  const statCardsByStatus = [
    { card: document.getElementById('stat-total').closest('.stat-card'),    status: '' },
    { card: document.getElementById('stat-pending').closest('.stat-card'),  status: 'pending' },
    { card: document.getElementById('stat-approved').closest('.stat-card'), status: 'approved' },
    { card: document.getElementById('stat-rejected').closest('.stat-card'), status: 'rejected' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const activate = () => {
      searchInput.value = '';
      statusFilter.value = status;
      renderRequests();
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusFilter.value === status);
    });
  }

  /* ------------------------------------------
     5. RENDER TABLE based on current filters
  ------------------------------------------ */
  function renderRequests() {
    const query      = searchInput.value.trim().toLowerCase();
    const statusVal  = statusFilter.value;
    const typeVal    = typeFilter.value;

    updateActiveStatCard();

    const sorted = requests.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = sorted.filter(r => {
      const matchesQuery  = !query || (r.requesterName || '').toLowerCase().includes(query) || (r.certificateType || '').toLowerCase().includes(query);
      const matchesStatus = !statusVal || r.status === statusVal;
      const matchesType   = !typeVal || r.certificateType === typeVal;
      return matchesQuery && matchesStatus && matchesType;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach((r) => {
        const tr = document.createElement('tr');

        const certBtn = r.certificateType === 'Baptismal Certificate'
          ? `<button type="button" class="row-cert" data-id="${r.id}">Generate Certificate</button>`
          : '';

        let actionsHtml = '';
        if (r.status === 'pending') {
          actionsHtml = `
            <div class="row-actions">
              ${certBtn}
              <button type="button" class="row-approve" data-id="${r.id}">Approve</button>
              <button type="button" class="row-reject" data-id="${r.id}">Reject</button>
            </div>`;
        } else if (r.status === 'approved') {
          actionsHtml = `
            <div class="row-actions">
              ${certBtn}
              <button type="button" class="row-approve" data-id="${r.id}" data-release="1">Release</button>
              <button type="button" class="row-view" data-id="${r.id}">View ›</button>
            </div>`;
        } else {
          actionsHtml = `<div class="row-actions">${certBtn}<button type="button" class="row-view" data-id="${r.id}">View ›</button></div>`;
        }

        tr.innerHTML = `
          <td class="font-medium text-gray-900">${escapeHtml(r.requesterName)}</td>
          <td>${escapeHtml(r.certificateType)}</td>
          <td>${formatDate(r.createdAt)}</td>
          <td class="purpose-cell" title="${escapeHtml(r.purpose)}">${escapeHtml(r.purpose) || '—'}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${statusLabel[r.status] || r.status}</span></td>
          <td class="text-right">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    resultsCount.textContent = `${filtered.length} request${filtered.length === 1 ? '' : 's'}`;
    refreshUploadDropdown();
  }

  function refreshUploadDropdown() {
    const approved = requests.filter(r => r.status === 'approved');
    uploadRequestSelect.innerHTML = '<option value="">Select an approved request</option>' +
      approved.map(r => `<option value="${r.id}">${escapeHtml(r.requesterName)} — ${escapeHtml(r.certificateType)}</option>`).join('');
  }

  /* ------------------------------------------
     6. ROW ACTIONS (delegated — table is
        re-rendered on every filter/update)
  ------------------------------------------ */
  tbody.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('.row-approve');
    const rejectBtn  = e.target.closest('.row-reject');
    const viewBtn    = e.target.closest('.row-view');
    const certBtn    = e.target.closest('.row-cert');

    if (certBtn) openGenerateCertModal(certBtn.dataset.id);

    if (approveBtn) {
      const id = approveBtn.dataset.id;
      const r = requests.find(x => x.id === id);
      const nextStatus = approveBtn.dataset.release ? 'released' : 'approved';
      try {
        const result = await client.models.CertificateRequest.update({ id, status: nextStatus });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`Request for ${r ? r.requesterName : 'requester'} marked ${statusLabel[nextStatus].toLowerCase()}.`);
      } catch (err) {
        console.error('Failed to update request:', err);
        showToast(err.message || "Couldn't update the request.", true);
      }
    }

    if (rejectBtn) openRejectModal(rejectBtn.dataset.id);
    if (viewBtn) openViewModal(viewBtn.dataset.id);
  });

  /* ------------------------------------------
     7. FILTER WIRING
  ------------------------------------------ */
  searchInput.addEventListener('input', renderRequests);
  statusFilter.addEventListener('change', renderRequests);
  typeFilter.addEventListener('change', renderRequests);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = '';
    typeFilter.value = '';
    renderRequests();
  });

  /* ------------------------------------------
     8. MODAL OPEN BUTTONS
  ------------------------------------------ */
  document.getElementById('btn-upload').addEventListener('click', () => {
    fileInput.value = '';
    uploadFilename.classList.add('hidden');
    uploadRequestSelect.value = '';
    refreshUploadDropdown();
    openModal(uploadModal);
  });

  document.getElementById('btn-new-request').addEventListener('click', () => {
    ['new-requester', 'new-purpose', 'new-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('new-type').value = '';
    document.getElementById('new-date').value = '';
    ['new-requester', 'new-type', 'new-date'].forEach(id => clearFieldError(document.getElementById(id)));
    openModal(newRequestModal);
  });

  /* ------------------------------------------
     9. MODAL CLOSE WIRING
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  [uploadModal, newRequestModal, rejectModal, viewModal, generateCertModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
  }

  /* ------------------------------------------
     10. UPLOAD MODAL — attach a signed certificate
         (real S3 upload) to an approved request,
         marks it Released
  ------------------------------------------ */
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFilename.textContent = `Selected: ${fileInput.files[0].name}`;
      uploadFilename.classList.remove('hidden');
    }
  });

  ['dragover', 'dragenter'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover'));
  });

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
    const linkedId = uploadRequestSelect.value;

    if (!fileInput.files.length) {
      showToast('Please select a certificate file to upload.', true);
      return;
    }
    if (!linkedId) {
      showToast('Please select which request this certificate belongs to.', true);
      return;
    }

    const r = requests.find(x => x.id === linkedId);
    const submitBtn = document.getElementById('upload-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';

    try {
      const file = fileInput.files[0];
      const path = `certificateUploads/${Date.now()}_${file.name}`;
      await uploadData({ path, data: file }).result;

      const result = await client.models.CertificateRequest.update({ id: linkedId, status: 'released' });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(uploadModal);
      showToast(`Certificate uploaded — ${r ? r.requesterName : 'request'}'s request marked Released.`);

      fileInput.value = '';
      uploadFilename.classList.add('hidden');
      uploadRequestSelect.value = '';
    } catch (err) {
      console.error('Failed to release request:', err);
      showToast(err.message || "Couldn't upload the certificate.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Mark as Released';
    }
  });

  /* ------------------------------------------
     11. NEW REQUEST MODAL — manual entry
         (walk-in / phone request)
  ------------------------------------------ */
  ['new-requester', 'new-type', 'new-date'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => clearFieldError(el));
    el.addEventListener('change', () => clearFieldError(el));
  });

  document.getElementById('new-request-submit').addEventListener('click', async () => {
    const requesterInput = document.getElementById('new-requester');
    const typeInput       = document.getElementById('new-type');
    const dateInput        = document.getElementById('new-date');

    const requester = requesterInput.value.trim();
    const type       = typeInput.value;
    const purpose    = document.getElementById('new-purpose').value.trim();

    [requesterInput, typeInput, dateInput].forEach(clearFieldError);

    let hasError = false;
    if (!requester) { setFieldError(requesterInput, 'Requester name is required.'); hasError = true; }
    if (!type)       { setFieldError(typeInput, 'Please select a certificate type.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    try {
      const result = await client.models.CertificateRequest.create({
        requesterName: requester,
        certificateType: type,
        purpose: purpose || undefined,
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(newRequestModal);
      showToast(`Request logged for ${requester}.`);

      ['new-requester', 'new-purpose', 'new-notes'].forEach(id => {
        document.getElementById(id).value = '';
      });
      document.getElementById('new-type').value = '';
      document.getElementById('new-date').value = '';
    } catch (err) {
      console.error('Failed to log request:', err);
      showToast(err.message || "Couldn't log the request.", true);
    }
  });

  /* ------------------------------------------
     12. REJECT CONFIRM MODAL
         (the schema has no rejection-reason
         field, so this is a plain confirm step —
         not a form)
  ------------------------------------------ */
  function openRejectModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;
    rejectTargetId = id;
    rejectTargetName.textContent = r.requesterName;
    openModal(rejectModal);
  }

  document.getElementById('reject-submit').addEventListener('click', async () => {
    if (rejectTargetId === null) return;
    const r = requests.find(x => x.id === rejectTargetId);

    try {
      const result = await client.models.CertificateRequest.update({ id: rejectTargetId, status: 'rejected' });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(rejectModal);
      showToast(`Request for ${r ? r.requesterName : 'requester'} rejected.`);
      rejectTargetId = null;
    } catch (err) {
      console.error('Failed to reject request:', err);
      showToast(err.message || "Couldn't reject the request.", true);
    }
  });

  /* ------------------------------------------
     13. VIEW DETAILS MODAL — read-only summary
  ------------------------------------------ */
  function openViewModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    viewName.textContent = r.requesterName;
    viewType.textContent = r.certificateType;
    viewDate.textContent = formatDate(r.createdAt);
    viewPurpose.textContent = r.purpose || '—';

    viewStatusBadge.textContent = statusLabel[r.status] || r.status;
    viewStatusBadge.className = `badge ${badgeClass[r.status] || 'badge-gray'}`;

    viewLinkedWrap.classList.toggle('hidden', !r.linkedRecordId);

    openModal(viewModal);
  }

  /* ------------------------------------------
     14. GENERATE BAPTISMAL CERTIFICATE MODAL
         The CertificateRequest model only tracks
         requester/purpose/status, so the rest of
         the certificate's content (parents, sponsors,
         Bk/Page/Line, etc.) is entered here each time
         rather than stored — there's no backend field
         for it. Submitting stashes the filled-in data
         in sessionStorage and opens the print-ready
         certificate in a new tab.
  ------------------------------------------ */
  const CERT_STORAGE_KEY = 'sacradigit_baptismal_cert_draft';
  const certFieldIds = [
    'cert-child-name', 'cert-father-name', 'cert-mother-name', 'cert-birthplace',
    'cert-birth-date', 'cert-baptism-date', 'cert-priest',
    'cert-sponsor-1', 'cert-sponsor-2', 'cert-book-no', 'cert-page', 'cert-line', 'cert-dated',
  ];

  let generateCertTargetId = null;

  // Maps the fields collected on the parishioner's request form
  // (user-request-certificate.js, Baptismal Certificate) to this
  // modal's matching print-output field — so whatever the requester
  // already told us doesn't have to be retyped here. Bk./Page/Line,
  // the officiating priest, and the issue date aren't collected from
  // the requester, since those come from the parish register.
  const requestDetailsToCertField = {
    'baptized-name': 'cert-child-name',
    'birth-date':    'cert-birth-date',
    'birthplace':    'cert-birthplace',
    'baptism-date':  'cert-baptism-date',
    'father-name':   'cert-father-name',
    'mother-name':   'cert-mother-name',
    'sponsor-1':     'cert-sponsor-1',
    'sponsor-2':     'cert-sponsor-2',
  };

  function openGenerateCertModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    generateCertTargetId = id;
    certFieldIds.forEach(fid => { document.getElementById(fid).value = ''; });

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    Object.entries(requestDetailsToCertField).forEach(([detailKey, certFieldId]) => {
      if (details[detailKey]) document.getElementById(certFieldId).value = details[detailKey];
    });

    document.getElementById('cert-child-name').value = document.getElementById('cert-child-name').value || r.requesterName || '';
    document.getElementById('cert-priest').value = 'Fredrick Edward C. Simon';
    document.getElementById('cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateCertModal);
  }

  document.getElementById('cert-generate-submit').addEventListener('click', () => {
    const childNameInput = document.getElementById('cert-child-name');
    if (!childNameInput.value.trim()) {
      showToast('Please enter the full name of the baptized person.', true);
      childNameInput.focus();
      return;
    }

    const data = { requestId: generateCertTargetId };
    certFieldIds.forEach(fid => {
      data[fid] = document.getElementById(fid).value.trim();
    });

    try {
      sessionStorage.setItem(CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    window.open('baptismal-certificate-print.html', '_blank');
    closeModal(generateCertModal);
  });

});