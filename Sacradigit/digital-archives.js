/* ============================================
   SacraDigit Admin — Digital Archives Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     In production this would come from
     Firestore. dateAdded uses ISO format so
     the date filter can do real day-math.
  ------------------------------------------ */
  let records = [
    { name: 'Santos, Maria T.',     type: 'Baptismal',     dateAdded: '2026-06-18', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
    { name: 'Cruz, Jose R.',        type: 'Confirmation',  dateAdded: '2026-06-18', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
    { name: 'Reyes, Ana L.',        type: 'Marriage',      dateAdded: '2026-06-17', addedBy: 'Fr. Mark D.',   status: 'Processing' },
    { name: 'Garcia, Pedro M.',     type: 'Death',         dateAdded: '2026-06-17', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
    { name: 'Dela Cruz, Juan P.',   type: 'Baptismal',     dateAdded: '2026-06-16', addedBy: 'Fr. Mark D.',   status: 'Queued'     },
    { name: 'Villanueva, Rosa S.',  type: 'Marriage',      dateAdded: '2026-06-10', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
    { name: 'Bautista, Carlo M.',   type: 'Confirmation',  dateAdded: '2026-06-05', addedBy: 'Fr. Mark D.',   status: 'Digitized'  },
    { name: 'Ramos, Teresa A.',     type: 'Death',         dateAdded: '2026-05-29', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
    { name: 'Fernandez, Luis G.',   type: 'Baptismal',     dateAdded: '2026-05-12', addedBy: 'Fr. Mark D.',   status: 'Processing' },
    { name: 'Mendoza, Carmen P.',   type: 'Marriage',      dateAdded: '2026-04-22', addedBy: 'Sis. Elena R.', status: 'Digitized'  },
  ];

  const tbody         = document.getElementById('records-tbody');
  const emptyState     = document.getElementById('empty-state');
  const resultsCount   = document.getElementById('results-count');
  const searchInput    = document.getElementById('search-input');
  const typeFilter      = document.getElementById('type-filter');
  const dateFilter      = document.getElementById('date-filter');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');

  const badgeClass = {
    'Digitized':  'badge-green',
    'Processing': 'badge-amber',
    'Queued':     'badge-gray',
  };

  /* ------------------------------------------
     1. RENDER TABLE based on current filters
  ------------------------------------------ */
  function renderRecords() {
    const query   = searchInput.value.trim().toLowerCase();
    const typeVal = typeFilter.value;
    const dateVal = dateFilter.value;

    const now = new Date('2026-06-19'); // app "today" — matches dashboard

    const filtered = records.filter(r => {
      const matchesQuery = !query ||
        r.name.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query);

      const matchesType = !typeVal || r.type === typeVal;

      let matchesDate = true;
      if (dateVal && dateVal !== 'all') {
        const days = parseInt(dateVal, 10);
        const recordDate = new Date(r.dateAdded);
        const diffDays = (now - recordDate) / (1000 * 60 * 60 * 24);
        matchesDate = diffDays <= days;
      }

      return matchesQuery && matchesType && matchesDate;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-medium text-gray-900">${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${formatDate(r.dateAdded)}</td>
          <td>${escapeHtml(r.addedBy)}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${escapeHtml(r.status)}</span></td>
          <td class="text-right"><button type="button" class="row-action" data-record="${escapeHtml(r.name)}">View ›</button></td>
        `;
        tbody.appendChild(tr);
      });
    }

    resultsCount.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
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
  searchInput.addEventListener('input', renderRecords);
  typeFilter.addEventListener('change', renderRecords);
  dateFilter.addEventListener('change', renderRecords);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    dateFilter.value = '';
    renderRecords();
  });

  // Delegate "View" button clicks (rows are re-rendered, so use delegation)
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (btn) {
      showToast(`Opening record for ${btn.dataset.record}…`);
      // TODO: route to a record detail view once it exists.
    }
  });

  renderRecords(); // initial paint


  /* ------------------------------------------
     2. MODALS — Upload & New Record
  ------------------------------------------ */
  const uploadModal     = document.getElementById('upload-modal');
  const newRecordModal  = document.getElementById('new-record-modal');

  document.getElementById('btn-upload').addEventListener('click', () => openModal(uploadModal));
  document.getElementById('btn-new-record').addEventListener('click', () => openModal(newRecordModal));

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(uploadModal);
      closeModal(newRecordModal);
    });
  });

  // Click outside modal card to close
  [uploadModal, newRecordModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Escape key closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(uploadModal);
      closeModal(newRecordModal);
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
     3. UPLOAD MODAL — file picker + dropzone
  ------------------------------------------ */
  const dropzone        = document.getElementById('upload-dropzone');
  const fileInput        = document.getElementById('upload-file-input');
  const uploadFilename    = document.getElementById('upload-filename');

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
    const type = document.getElementById('upload-type').value;
    const name = document.getElementById('upload-name').value.trim();

    if (!fileInput.files.length) {
      showToast('Please select a file to upload.', true);
      return;
    }
    if (!type || !name) {
      showToast('Please fill in record type and name.', true);
      return;
    }

    records.unshift({
      name,
      type,
      dateAdded: '2026-06-19',
      addedBy: 'Admin User',
      status: 'Processing',
    });

    renderRecords();
    closeModal(uploadModal);
    showToast(`"${name}" uploaded and queued for processing.`);

    // Reset form
    fileInput.value = '';
    uploadFilename.classList.add('hidden');
    document.getElementById('upload-type').value = '';
    document.getElementById('upload-name').value = '';
  });


  /* ------------------------------------------
     4. NEW RECORD MODAL — manual entry form
  ------------------------------------------ */
  document.getElementById('new-record-submit').addEventListener('click', () => {
    const name      = document.getElementById('new-name').value.trim();
    const type      = document.getElementById('new-type').value;
    const date      = document.getElementById('new-date').value;
    const officiant = document.getElementById('new-officiant').value.trim();

    if (!name || !type || !date) {
      showToast('Please fill in name, type, and date.', true);
      return;
    }

    records.unshift({
      name,
      type,
      dateAdded: date,
      addedBy: officiant || 'Admin User',
      status: 'Digitized',
    });

    renderRecords();
    closeModal(newRecordModal);
    showToast(`Record for "${name}" saved.`);

    // Reset form
    ['new-name', 'new-officiant', 'new-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('new-type').value = '';
    document.getElementById('new-date').value = '';
  });


  /* ------------------------------------------
     5. TOAST NOTIFICATIONS
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