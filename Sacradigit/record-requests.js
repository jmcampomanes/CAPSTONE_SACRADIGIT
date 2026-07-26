/* ============================================
   SacraDigit Admin — Record Requests Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     In production this would come from
     Firestore. dateRequested uses ISO format.
  ------------------------------------------ */
  let requests = [
    { requester: 'Santos, Maria T.',    type: 'Baptismal',    dateRequested: '2026-06-18', purpose: 'School enrollment',       status: 'Pending'  },
    { requester: 'Cruz, Jose R.',        type: 'Confirmation', dateRequested: '2026-06-18', purpose: 'Sponsor requirement',     status: 'Pending'  },
    { requester: 'Reyes, Ana L.',        type: 'Marriage',     dateRequested: '2026-06-17', purpose: 'Marriage application',    status: 'Pending'  },
    { requester: 'Garcia, Pedro M.',     type: 'Death',        dateRequested: '2026-06-17', purpose: 'Estate settlement',       status: 'Pending'  },
    { requester: 'Villanueva, Rosa S.',  type: 'Marriage',     dateRequested: '2026-06-12', purpose: 'Visa application',        status: 'Approved' },
    { requester: 'Bautista, Carlo M.',   type: 'Confirmation', dateRequested: '2026-06-08', purpose: 'Employment requirement',  status: 'Approved' },
    { requester: 'Ramos, Teresa A.',     type: 'Death',        dateRequested: '2026-06-02', purpose: 'Insurance claim',         status: 'Approved' },
    { requester: 'Fernandez, Luis G.',   type: 'Baptismal',    dateRequested: '2026-05-28', purpose: 'Confirmation sponsor',    status: 'Rejected', reason: 'Incomplete supporting documents' },
    { requester: 'Mendoza, Carmen P.',   type: 'Marriage',     dateRequested: '2026-05-20', purpose: 'Annulment proceedings',   status: 'Rejected', reason: 'Name mismatch with civil registry' },
  ];

  const tbody         = document.getElementById('requests-tbody');
  const emptyState     = document.getElementById('empty-state');
  const resultsCount   = document.getElementById('results-count');
  const searchInput    = document.getElementById('search-input');
  const statusFilter    = document.getElementById('status-filter');
  const typeFilter      = document.getElementById('type-filter');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');

  const badgeClass = {
    'Pending':  'badge-amber',
    'Approved': 'badge-green',
    'Rejected': 'badge-red',
  };

  /* ------------------------------------------
     1. STAT COUNTERS
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-total').textContent    = requests.length;
    document.getElementById('stat-pending').textContent  = requests.filter(r => r.status === 'Pending').length;
    document.getElementById('stat-approved').textContent = requests.filter(r => r.status === 'Approved').length;
    document.getElementById('stat-rejected').textContent = requests.filter(r => r.status === 'Rejected').length;
  }

  /* ------------------------------------------
     2. RENDER TABLE based on current filters
  ------------------------------------------ */
  function renderRequests() {
    const query      = searchInput.value.trim().toLowerCase();
    const statusVal  = statusFilter.value;
    const typeVal    = typeFilter.value;

    const filtered = requests.filter(r => {
      const matchesQuery  = !query || r.requester.toLowerCase().includes(query) || r.type.toLowerCase().includes(query);
      const matchesStatus = !statusVal || r.status === statusVal;
      const matchesType   = !typeVal || r.type === typeVal;
      return matchesQuery && matchesStatus && matchesType;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach((r, idx) => {
        const realIndex = requests.indexOf(r);
        const tr = document.createElement('tr');

        let actionsHtml = '';
        if (r.status === 'Pending') {
          actionsHtml = `
            <div class="row-actions">
              <button type="button" class="row-approve" data-index="${realIndex}">Approve</button>
              <button type="button" class="row-reject" data-index="${realIndex}">Reject</button>
            </div>`;
        } else {
          actionsHtml = `<div class="row-actions"><button type="button" class="row-action" data-index="${realIndex}">View ›</button></div>`;
        }

        tr.innerHTML = `
          <td class="font-medium text-gray-900">${escapeHtml(r.requester)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${formatDate(r.dateRequested)}</td>
          <td class="purpose-cell" title="${escapeHtml(r.purpose)}">${escapeHtml(r.purpose)}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${escapeHtml(r.status)}</span></td>
          <td class="text-right">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    resultsCount.textContent = `${filtered.length} request${filtered.length === 1 ? '' : 's'}`;
    refreshUploadDropdown();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Wire up filter controls
  searchInput.addEventListener('input', renderRequests);
  statusFilter.addEventListener('change', renderRequests);
  typeFilter.addEventListener('change', renderRequests);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = '';
    typeFilter.value = '';
    renderRequests();
  });

  // Delegate row button clicks (table is re-rendered, so use delegation)
  tbody.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.row-approve');
    const rejectBtn  = e.target.closest('.row-reject');
    const viewBtn    = e.target.closest('.row-action');

    if (approveBtn) {
      const idx = parseInt(approveBtn.dataset.index, 10);
      requests[idx].status = 'Approved';
      renderStats();
      renderRequests();
      showToast(`Request for ${requests[idx].requester} approved.`);
    }

    if (rejectBtn) {
      const idx = parseInt(rejectBtn.dataset.index, 10);
      openRejectModal(idx);
    }

    if (viewBtn) {
      const idx = parseInt(viewBtn.dataset.index, 10);
      const r = requests[idx];
      const extra = r.status === 'Rejected' && r.reason ? ` Reason: ${r.reason}` : '';
      showToast(`${r.requester} — ${r.status}.${extra}`);
    }
  });

  renderStats();
  renderRequests(); // initial paint


  /* ------------------------------------------
     3. MODALS — Upload, New Request, Reject
  ------------------------------------------ */
  const uploadModal      = document.getElementById('upload-modal');
  const newRequestModal  = document.getElementById('new-request-modal');
  const rejectModal       = document.getElementById('reject-modal');

  document.getElementById('btn-upload').addEventListener('click', () => openModal(uploadModal));
  document.getElementById('btn-new-request').addEventListener('click', () => openModal(newRequestModal));

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(uploadModal);
      closeModal(newRequestModal);
      closeModal(rejectModal);
    });
  });

  // Click outside modal card to close
  [uploadModal, newRequestModal, rejectModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Escape key closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(uploadModal);
      closeModal(newRequestModal);
      closeModal(rejectModal);
    }
  });

  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }


  /* ------------------------------------------
     4. UPLOAD MODAL — link a signed certificate
        to a pending request, marks it Approved
  ------------------------------------------ */
  const dropzone      = document.getElementById('upload-dropzone');
  const fileInput      = document.getElementById('upload-file-input');
  const uploadFilename = document.getElementById('upload-filename');
  const uploadRequestSelect = document.getElementById('upload-request');

  function refreshUploadDropdown() {
    const pending = requests
      .map((r, idx) => ({ ...r, idx }))
      .filter(r => r.status === 'Pending');

    uploadRequestSelect.innerHTML = '<option value="">Select a pending request</option>' +
      pending.map(r => `<option value="${r.idx}">${escapeHtml(r.requester)} — ${escapeHtml(r.type)}</option>`).join('');
  }

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

  document.getElementById('upload-submit').addEventListener('click', () => {
    const linkedIdx = uploadRequestSelect.value;

    if (!fileInput.files.length) {
      showToast('Please select a certificate file to upload.', true);
      return;
    }
    if (linkedIdx === '') {
      showToast('Please select which request this certificate belongs to.', true);
      return;
    }

    const idx = parseInt(linkedIdx, 10);
    requests[idx].status = 'Approved';

    renderStats();
    renderRequests();
    closeModal(uploadModal);
    showToast(`Certificate uploaded — ${requests[idx].requester}'s request marked Approved.`);

    // Reset form
    fileInput.value = '';
    uploadFilename.classList.add('hidden');
    uploadRequestSelect.value = '';
  });


  /* ------------------------------------------
     5. NEW REQUEST MODAL — manual entry
        (walk-in / phone request)
  ------------------------------------------ */
  document.getElementById('new-request-submit').addEventListener('click', () => {
    const requester = document.getElementById('new-requester').value.trim();
    const type       = document.getElementById('new-type').value;
    const date       = document.getElementById('new-date').value;
    const purpose    = document.getElementById('new-purpose').value.trim();

    if (!requester || !type || !date) {
      showToast('Please fill in requester name, type, and date.', true);
      return;
    }

    requests.unshift({
      requester,
      type,
      dateRequested: date,
      purpose: purpose || 'Not specified',
      status: 'Pending',
    });

    renderStats();
    renderRequests();
    closeModal(newRequestModal);
    showToast(`Request logged for ${requester}.`);

    // Reset form
    ['new-requester', 'new-purpose', 'new-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('new-type').value = '';
    document.getElementById('new-date').value = '';
  });


  /* ------------------------------------------
     6. REJECT MODAL — capture a reason, then
        mark the request Rejected
  ------------------------------------------ */
  let rejectTargetIndex = null;
  const rejectTargetName = document.getElementById('reject-target-name');
  const rejectReasonInput = document.getElementById('reject-reason');

  function openRejectModal(idx) {
    rejectTargetIndex = idx;
    rejectTargetName.textContent = requests[idx].requester;
    rejectReasonInput.value = '';
    openModal(rejectModal);
  }

  document.getElementById('reject-submit').addEventListener('click', () => {
    if (rejectTargetIndex === null) return;

    const reason = rejectReasonInput.value.trim();
    if (!reason) {
      showToast('Please provide a reason for rejection.', true);
      return;
    }

    requests[rejectTargetIndex].status = 'Rejected';
    requests[rejectTargetIndex].reason = reason;

    renderStats();
    renderRequests();
    closeModal(rejectModal);
    showToast(`Request for ${requests[rejectTargetIndex].requester} rejected.`);

    rejectTargetIndex = null;
  });


  /* ------------------------------------------
     7. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});