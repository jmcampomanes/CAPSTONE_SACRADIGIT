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
    { requester: 'Santos, Maria T.',    type: 'Baptismal',    dateRequested: '2026-06-18', purpose: 'School enrollment',       status: 'Pending',  certificateFile: null },
    { requester: 'Cruz, Jose R.',        type: 'Confirmation', dateRequested: '2026-06-18', purpose: 'Sponsor requirement',     status: 'Pending',  certificateFile: null },
    { requester: 'Reyes, Ana L.',        type: 'Marriage',     dateRequested: '2026-06-17', purpose: 'Marriage application',    status: 'Pending',  certificateFile: null },
    { requester: 'Garcia, Pedro M.',     type: 'Death',        dateRequested: '2026-06-17', purpose: 'Estate settlement',       status: 'Pending',  certificateFile: null },
    { requester: 'Villanueva, Rosa S.',  type: 'Marriage',     dateRequested: '2026-06-12', purpose: 'Visa application',        status: 'Approved', certificateFile: 'villanueva-marriage-cert.pdf' },
    { requester: 'Bautista, Carlo M.',   type: 'Confirmation', dateRequested: '2026-06-08', purpose: 'Employment requirement',  status: 'Approved', certificateFile: 'bautista-confirmation-cert.pdf' },
    { requester: 'Ramos, Teresa A.',     type: 'Death',        dateRequested: '2026-06-02', purpose: 'Insurance claim',         status: 'Approved', certificateFile: 'ramos-death-cert.pdf' },
    { requester: 'Fernandez, Luis G.',   type: 'Baptismal',    dateRequested: '2026-05-28', purpose: 'Confirmation sponsor',    status: 'Rejected', reason: 'Incomplete supporting documents' },
    { requester: 'Mendoza, Carmen P.',   type: 'Marriage',     dateRequested: '2026-05-20', purpose: 'Annulment proceedings',   status: 'Rejected', reason: 'Name mismatch with civil registry' },
  ];

  const badgeClass = {
    'Pending':  'badge-amber',
    'Approved': 'badge-green',
    'Rejected': 'badge-red',
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

  const dropzone         = document.getElementById('upload-dropzone');
  const fileInput          = document.getElementById('upload-file-input');
  const uploadFilename       = document.getElementById('upload-filename');
  const uploadRequestSelect    = document.getElementById('upload-request');

  const rejectTargetName  = document.getElementById('reject-target-name');
  const rejectReasonInput   = document.getElementById('reject-reason');

  const viewName            = document.getElementById('view-name');
  const viewStatusBadge      = document.getElementById('view-status-badge');
  const viewType                = document.getElementById('view-type');
  const viewDate                  = document.getElementById('view-date');
  const viewPurpose                 = document.getElementById('view-purpose');
  const viewCertificateWrap           = document.getElementById('view-certificate-wrap');
  const viewCertificateName             = document.getElementById('view-certificate-name');
  const viewReasonWrap                    = document.getElementById('view-reason-wrap');
  const viewReason                          = document.getElementById('view-reason');

  const toast = document.getElementById('toast');

  let rejectTargetIndex = null;
  let toastTimer = null;

  /* ------------------------------------------
     2. HELPERS
  ------------------------------------------ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

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
    [uploadModal, newRequestModal, rejectModal, viewModal].forEach(closeModal);
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.querySelector('.toast-message').textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

  /* ------------------------------------------
     3. STAT COUNTERS
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-total').textContent    = requests.length;
    document.getElementById('stat-pending').textContent  = requests.filter(r => r.status === 'Pending').length;
    document.getElementById('stat-approved').textContent = requests.filter(r => r.status === 'Approved').length;
    document.getElementById('stat-rejected').textContent = requests.filter(r => r.status === 'Rejected').length;
  }

  /* ------------------------------------------
     3b. STAT CARDS AS QUICK FILTERS
     Total clears the status filter (and search
     query, so the count on screen always matches
     the card you clicked); Pending / Approved /
     Rejected jump straight to those rows.
  ------------------------------------------ */
  const statCardsByStatus = [
    { card: document.getElementById('stat-total').closest('.stat-card'),    status: '' },
    { card: document.getElementById('stat-pending').closest('.stat-card'),  status: 'Pending' },
    { card: document.getElementById('stat-approved').closest('.stat-card'), status: 'Approved' },
    { card: document.getElementById('stat-rejected').closest('.stat-card'), status: 'Rejected' },
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
     4. RENDER TABLE based on current filters
  ------------------------------------------ */
  function renderRequests() {
    const query      = searchInput.value.trim().toLowerCase();
    const statusVal  = statusFilter.value;
    const typeVal    = typeFilter.value;

    updateActiveStatCard();

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
      filtered.forEach((r) => {
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
          actionsHtml = `<div class="row-actions"><button type="button" class="row-view" data-index="${realIndex}">View ›</button></div>`;
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

  function refreshUploadDropdown() {
    const pending = requests
      .map((r, idx) => ({ ...r, idx }))
      .filter(r => r.status === 'Pending');

    uploadRequestSelect.innerHTML = '<option value="">Select a pending request</option>' +
      pending.map(r => `<option value="${r.idx}">${escapeHtml(r.requester)} — ${escapeHtml(r.type)}</option>`).join('');
  }

  /* ------------------------------------------
     5. ROW ACTIONS (delegated — table is
        re-rendered on every filter/update)
  ------------------------------------------ */
  tbody.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.row-approve');
    const rejectBtn  = e.target.closest('.row-reject');
    const viewBtn    = e.target.closest('.row-view');

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
      openViewModal(idx);
    }
  });

  /* ------------------------------------------
     6. FILTER WIRING
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
     7. MODAL OPEN BUTTONS
  ------------------------------------------ */
  document.getElementById('btn-upload').addEventListener('click', () => {
    fileInput.value = '';
    uploadFilename.classList.add('hidden');
    uploadRequestSelect.value = '';
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
     8. MODAL CLOSE WIRING
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  [uploadModal, newRequestModal, rejectModal, viewModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  /* ------------------------------------------
     9. UPLOAD MODAL — link a signed certificate
        to a pending request, marks it Approved
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
    requests[idx].certificateFile = fileInput.files[0].name;

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
     10. NEW REQUEST MODAL — manual entry
         (walk-in / phone request)
  ------------------------------------------ */
  ['new-requester', 'new-type', 'new-date'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => clearFieldError(el));
    el.addEventListener('change', () => clearFieldError(el));
  });

  document.getElementById('new-request-submit').addEventListener('click', () => {
    const requesterInput = document.getElementById('new-requester');
    const typeInput       = document.getElementById('new-type');
    const dateInput        = document.getElementById('new-date');

    const requester = requesterInput.value.trim();
    const type       = typeInput.value;
    const date       = dateInput.value;
    const purpose    = document.getElementById('new-purpose').value.trim();

    [requesterInput, typeInput, dateInput].forEach(clearFieldError);

    let hasError = false;
    if (!requester) { setFieldError(requesterInput, 'Requester name is required.'); hasError = true; }
    if (!type)       { setFieldError(typeInput, 'Please select a certificate type.'); hasError = true; }
    if (!date)         { setFieldError(dateInput, 'Date requested is required.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    requests.unshift({
      requester,
      type,
      dateRequested: date,
      purpose: purpose || 'Not specified',
      status: 'Pending',
      certificateFile: null,
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
     11. REJECT MODAL — capture a reason, then
         mark the request Rejected
  ------------------------------------------ */
  function openRejectModal(idx) {
    rejectTargetIndex = idx;
    rejectTargetName.textContent = requests[idx].requester;
    rejectReasonInput.value = '';
    clearFieldError(rejectReasonInput);
    openModal(rejectModal);
  }

  rejectReasonInput.addEventListener('input', () => clearFieldError(rejectReasonInput));

  document.getElementById('reject-submit').addEventListener('click', () => {
    if (rejectTargetIndex === null) return;

    const reason = rejectReasonInput.value.trim();
    if (!reason) {
      setFieldError(rejectReasonInput, 'Please provide a reason for rejection.');
      showToast('Please fix the highlighted fields.', true);
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
     12. VIEW DETAILS MODAL — read-only summary
         for Approved / Rejected requests
  ------------------------------------------ */
  function openViewModal(idx) {
    const r = requests[idx];

    viewName.textContent = r.requester;
    viewType.textContent = r.type;
    viewDate.textContent = formatDate(r.dateRequested);
    viewPurpose.textContent = r.purpose;

    viewStatusBadge.textContent = r.status;
    viewStatusBadge.className = `badge ${badgeClass[r.status] || 'badge-gray'}`;

    if (r.status === 'Approved' && r.certificateFile) {
      viewCertificateName.textContent = r.certificateFile;
      viewCertificateWrap.classList.remove('hidden');
    } else {
      viewCertificateWrap.classList.add('hidden');
    }

    if (r.status === 'Rejected' && r.reason) {
      viewReason.textContent = r.reason;
      viewReasonWrap.classList.remove('hidden');
    } else {
      viewReasonWrap.classList.add('hidden');
    }

    openModal(viewModal);
  }

  /* ------------------------------------------
     13. INITIAL RENDER
         (runs last, after every element and
         handler above is safely wired up)
  ------------------------------------------ */
  renderStats();
  renderRequests();

});