/* ============================================
   SacraDigit Admin — Record Requests Scripts (AWS Amplify)
   Backed by the CertificateRequest model
   (requesterName, certificateType, purpose, status,
   linkedRecordId, createdAt). Status flow:
   pending -> approved -> released, or -> rejected.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';
import { setNameFields, readNameFields, nameFieldsFilled, isNameEmpty, formatFullName } from '../name-utils.js';
import { notifyCertificateUpdate } from '../email-notify.js';
import { createMarriageForm, MARRIAGE_STEPS } from '../marriage-request-form.js';
import { createCertStepForm } from '../certificate-step-forms.js';
import { showToast, confirmDialog, reportEmail } from './admin-ui.js';

// CertificateRequest has no dedicated email field — a parishioner's own
// request carries their address in the Cognito "owner" field as
// `${sub}::${email}` (identityClaim is cognito:username = email), same
// convention as Sacradigit/blessings.js.
const recipientEmail = (r) => r?.email || ''; // saved when the parishioner submits; never the owner (staff for office-made requests)
const certEmail = (r, status, reason) => notifyCertificateUpdate({ to: recipientEmail(r), name: r.requesterName, certificateType: r.certificateType, status, reason });

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

  // Certificate types that have a print-ready template + "Generate Certificate" flow.
  const GENERATABLE_CERT_TYPES = new Set(['Baptismal Certificate', 'Confirmation Certificate', 'First Communion Certificate', 'Marriage Certificate', 'Death Certificate']);

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
  const generateConfirmationCertModal = document.getElementById('generate-confirmation-cert-modal');
  const generateFirstCommunionCertModal = document.getElementById('generate-first-communion-cert-modal');
  const generateMarriageCertModal = document.getElementById('generate-marriage-cert-modal');
  const generateDeathCertModal = document.getElementById('generate-death-cert-modal');

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


  const bulkBar = document.getElementById('req-bulk-bar');
  const selectAll = document.getElementById('req-select-all');

  let rejectTargetId = null;
  const selectedIds = new Set();   // pending requests ticked for "Approve selected"
  let shownPendingIds = [];

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
    [uploadModal, newRequestModal, rejectModal, viewModal, generateCertModal, generateConfirmationCertModal, generateFirstCommunionCertModal, generateMarriageCertModal, generateDeathCertModal].forEach(closeModal);
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
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 text-sm py-8">Couldn't load requests.</td></tr>`;
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
    shownPendingIds = filtered.filter(r => r.status === 'pending').map(r => r.id);
    selectedIds.forEach(id => { if (!shownPendingIds.includes(id)) selectedIds.delete(id); });

    if (filtered.length === 0) {
      paintEmptyState(query, statusVal, typeVal);
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach((r) => {
        const tr = document.createElement('tr');
        const who = escapeHtml(r.requesterName);

        // Every row can be opened. The Head Admin and the Secretary can both
        // approve / reject pending ones and release approved ones.
        // Generate sits on the row once a request is approved (print, then Release);
        // before that it's inside View, so pending rows keep to View / Approve / Reject.
        const certBtn = r.status === 'approved' && GENERATABLE_CERT_TYPES.has(r.certificateType)
          ? `<button type="button" class="row-btn row-cert" data-id="${r.id}" data-cert-type="${escapeHtml(r.certificateType)}">Generate</button>`
          : '';
        const viewBtn = `<button type="button" class="row-btn row-view" data-id="${r.id}" aria-label="View ${who}'s request">View</button>`;
        let decision = '';
        if (r.status === 'pending') {
          decision = `
            <button type="button" class="row-btn row-approve" data-id="${r.id}">Approve</button>
            <button type="button" class="row-btn row-reject" data-id="${r.id}">Reject…</button>`;
        } else if (r.status === 'approved') {
          decision = `<button type="button" class="row-btn row-release row-approve" data-id="${r.id}" data-release="1">Release</button>`;
        }

        const label = statusLabel[r.status] || r.status;
        const select = r.status === 'pending'
          ? `<input type="checkbox" class="row-check req-check" data-id="${r.id}" aria-label="Select ${who}'s request" ${selectedIds.has(r.id) ? 'checked' : ''} />`
          : '';

        tr.innerHTML = `
          <td class="col-select">${select}</td>
          <td class="font-medium text-gray-900">${who}</td>
          <td>${escapeHtml(r.certificateType)}</td>
          <td>${formatDate(r.createdAt)}</td>
          <td class="purpose-cell" title="${escapeHtml(r.purpose)}">${escapeHtml(r.purpose) || '—'}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${label}</span></td>
          <td class="text-right"><div class="row-actions">${certBtn}${viewBtn}${decision}</div></td>
        `;
        tbody.appendChild(tr);
      });
    }

    resultsCount.textContent = `${filtered.length} request${filtered.length === 1 ? '' : 's'}`;
    paintBulkBar();
    refreshUploadDropdown();
  }

  /* No results: say what was searched for, and offer the way out. */
  function paintEmptyState(query, statusVal, typeVal) {
    const filtersOn = !!(query || statusVal || typeVal);
    const title = document.getElementById('empty-title');
    const hint = document.getElementById('empty-hint');
    document.getElementById('empty-clear').classList.toggle('hidden', !filtersOn);
    if (!filtersOn) {
      title.textContent = 'No certificate requests yet';
      hint.textContent = 'Requests from parishioners appear here. To log one made in person or by phone, use “New walk-in request”.';
      return;
    }
    const status = statusVal ? `${(statusLabel[statusVal] || statusVal).toLowerCase()} ` : '';
    const type = typeVal ? `${typeVal.replace(/ Certificate$/, '')} ` : '';
    title.textContent = `No ${status}${type}requests${query ? ` for “${searchInput.value.trim()}”` : ''}`;
    hint.textContent = query ? 'Check the spelling, or search all statuses and types.' : 'Try another status or type.';
  }

  /* ------------------------------------------
     5b. HEAD ADMIN: APPROVE SEVERAL AT ONCE
  ------------------------------------------ */
  function paintBulkBar() {
    const n = selectedIds.size;
    bulkBar.classList.toggle('hidden', n === 0);
    document.getElementById('req-bulk-count').textContent = `${n} selected`;
    document.getElementById('req-bulk-approve').textContent = `Approve ${n}…`;
    selectAll.checked = shownPendingIds.length > 0 && shownPendingIds.every(id => selectedIds.has(id));
    selectAll.indeterminate = n > 0 && !selectAll.checked;
    selectAll.disabled = shownPendingIds.length === 0;
  }

  tbody.addEventListener('change', (e) => {
    const box = e.target.closest('.req-check');
    if (!box) return;
    box.checked ? selectedIds.add(box.dataset.id) : selectedIds.delete(box.dataset.id);
    paintBulkBar();
  });
  selectAll.addEventListener('change', () => {
    shownPendingIds.forEach(id => (selectAll.checked ? selectedIds.add(id) : selectedIds.delete(id)));
    tbody.querySelectorAll('.req-check').forEach(b => { b.checked = selectedIds.has(b.dataset.id); });
    paintBulkBar();
  });
  document.getElementById('req-bulk-clear').addEventListener('click', () => { selectedIds.clear(); renderRequests(); });
  document.getElementById('req-bulk-approve').addEventListener('click', async () => {
    const picked = requests.filter(r => selectedIds.has(r.id) && r.status === 'pending');
    if (!picked.length) return;
    const sure = await confirmDialog({
      title: `Approve ${picked.length} request${picked.length === 1 ? '' : 's'}?`,
      message: 'Each requester gets an email that their request was approved and is being prepared.',
      detail: picked.slice(0, 8).map(r => `• ${r.requesterName} — ${r.certificateType}`).join('\n') + (picked.length > 8 ? `\n…and ${picked.length - 8} more` : ''),
      confirmLabel: `Approve ${picked.length} & email`,
      tone: 'approve',
    });
    if (!sure) return;
    const results = await Promise.all(picked.map(r => approveRequest(r, { quiet: true })));
    const done = results.filter(Boolean).length;
    const notEmailed = picked.filter((r, i) => results[i] && results[i] !== 'sent').map(r => r.requesterName);
    selectedIds.clear();
    renderRequests();
    if (done < picked.length) showToast(`${done} of ${picked.length} approved. The rest couldn’t be updated — please try them again.`, true);
    else if (notEmailed.length) showToast(`${done} approved, but these weren’t emailed (no email on file or sending failed): ${notEmailed.join(', ')}. Please let them know another way.`, true);
    else showToast(`${done} request${done === 1 ? '' : 's'} approved.`);
  });

  async function approveRequest(r, { quiet = false } = {}) {
    try {
      const result = await client.models.CertificateRequest.update({ id: r.id, status: 'approved' });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      const email = certEmail(r, 'approved');
      if (quiet) return email; // the bulk action reports emails for all of them at once
      reportEmail(email, r.requesterName, `${r.requesterName}’s ${r.certificateType} approved.`);
      return true;
    } catch (err) {
      console.error('Failed to approve request:', err);
      if (!quiet) showToast(err.message || "Couldn't approve the request.", true);
      return false;
    }
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

    if (certBtn) openGenerateFor(certBtn.dataset.id, certBtn.dataset.certType);


    // Approving emails the parishioner, and neither step can be undone here — check first.
    if (approveBtn) {
      const r = requests.find(x => x.id === approveBtn.dataset.id);
      if (!r) return;
      if (!approveBtn.dataset.release) {
        const to = recipientEmail(r);
        const sure = await confirmDialog({
          title: `Approve ${r.requesterName}’s ${r.certificateType}?`,
          message: to ? `We’ll email ${to} that it’s approved and being prepared.` : 'There’s no email on file for this requester, so they won’t be emailed.',
          detail: r.purpose ? `Purpose: ${r.purpose}` : '',
          confirmLabel: to ? 'Approve & email' : 'Approve',
          tone: 'approve',
        });
        if (sure) await approveRequest(r);
        return;
      }
      const sure = await confirmDialog({
        title: `Mark ${r.requesterName}’s ${r.certificateType} as released?`,
        message: 'Do this once the certificate has been handed over or picked up.',
        confirmLabel: 'Mark released',
      });
      if (!sure) return;
      try {
        const result = await client.models.CertificateRequest.update({ id: r.id, status: 'released' });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        reportEmail(certEmail(r, 'released'), r.requesterName, `${r.requesterName}’s ${r.certificateType} marked released.`);
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

  const clearFilters = () => {
    searchInput.value = '';
    statusFilter.value = '';
    typeFilter.value = '';
    renderRequests();
  };
  clearFiltersBtn.addEventListener('click', clearFilters);
  document.getElementById('empty-clear').addEventListener('click', () => { clearFilters(); searchInput.focus(); });

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
    setWalkInForm('');
    openModal(newRequestModal);
  });

  /* ------------------------------------------
     9. MODAL CLOSE WIRING
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  [uploadModal, newRequestModal, rejectModal, viewModal, generateCertModal, generateConfirmationCertModal, generateFirstCommunionCertModal, generateMarriageCertModal, generateDeathCertModal].forEach(modal => {
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
      const doneMsg = `Certificate uploaded — ${r ? r.requesterName : 'request'}'s request marked Released.`;
      if (r) reportEmail(certEmail(r, 'released'), r.requesterName, doneMsg); else showToast(doneMsg);

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

  /* Walk-ins for Baptismal, Confirmation, First Communion and Marriage use
     the same step-by-step forms as the parishioner's Request a Certificate
     page (../certificate-step-forms.js, ../marriage-request-form.js), so the
     details are stored the same way and Generate Certificate can prefill
     them. Purpose/Notes move into the last step, "Confirm", and Log Request
     only shows there. (Death certificates have no parishioner form — they
     keep the simple fields.) */
  const WALK_IN_FORMS = {
    'Baptismal Certificate': 'baptismal',
    'Confirmation Certificate': 'confirmation',
    'First Communion Certificate': 'first-communion',
    'Marriage Certificate': 'marriage',
  };
  const newMarriageWrap = document.getElementById('new-marriage-form'); // holds whichever step form is open
  const newCommonFields = document.getElementById('new-common-fields');
  const newCommonHome = document.createComment('purpose/notes home'); // where Purpose/Notes go back to
  newCommonFields.before(newCommonHome);
  const newSubmitBtn = document.getElementById('new-request-submit');
  let walkInForm = null; // { form, labels } for the open step form, else null

  /** Opens the step form for a certificate type name ('' / Death → none). */
  function setWalkInForm(typeName) {
    // Put Purpose/Notes back and clear any form that's open
    newCommonHome.after(newCommonFields);
    newCommonFields.classList.add('mt-3');
    newMarriageWrap.innerHTML = '';
    walkInForm = null;
    newSubmitBtn.classList.remove('hidden');

    const kind = WALK_IN_FORMS[typeName];
    newRequestModal.querySelector('.modal-card').classList.toggle('modal-card-wide', !!kind);
    newMarriageWrap.classList.toggle('hidden', !kind);
    if (!kind) return;

    const opts = {
      toast: showToast,
      lastStepBack: true,
      confirmHint: 'Add the purpose and any notes, then log the request.',
      onStepChange: (step, isLast) => newSubmitBtn.classList.toggle('hidden', !isLast),
    };
    const form = kind === 'marriage' ? createMarriageForm(newMarriageWrap, opts) : createCertStepForm(newMarriageWrap, kind, opts);
    walkInForm = { form, labels: kind === 'marriage' ? MARRIAGE_STEPS.map(s => s.label) : form.labels };
    form.slot.appendChild(newCommonFields);
    newCommonFields.classList.remove('mt-3');
  }

  document.getElementById('new-type').addEventListener('change', (e) => setWalkInForm(e.target.value));

  document.getElementById('new-request-submit').addEventListener('click', async () => {
    const requesterInput = document.getElementById('new-requester');
    const typeInput       = document.getElementById('new-type');
    const dateInput        = document.getElementById('new-date');

    const requester = requesterInput.value.trim();
    const type       = typeInput.value;
    const purpose    = document.getElementById('new-purpose').value.trim();
    const notes      = document.getElementById('new-notes').value.trim();

    [requesterInput, typeInput, dateInput].forEach(clearFieldError);

    let hasError = false;
    if (!requester) { setFieldError(requesterInput, 'Requester name is required.'); hasError = true; }
    if (!type)       { setFieldError(typeInput, 'Please select a certificate type.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      requesterInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Step forms: everything on the steps must be filled in first.
    let details;
    if (walkInForm) {
      const unfinished = walkInForm.form.firstUnfinished();
      if (unfinished !== undefined) {
        walkInForm.form.go(unfinished);
        showToast(`Please finish the ${walkInForm.labels[unfinished]} step first.`, true);
        return;
      }
      details = walkInForm.form.collect().details;
    }

    newSubmitBtn.disabled = true;
    try {
      const result = await client.models.CertificateRequest.create({
        requesterName: requester,
        certificateType: type,
        purpose: purpose || undefined,
        notes: notes || undefined,
        details: details ? JSON.stringify(details) : undefined,
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
      setWalkInForm('');
    } catch (err) {
      console.error('Failed to log request:', err);
      showToast(err.message || "Couldn't log the request.", true);
    } finally {
      newSubmitBtn.disabled = false;
    }
  });

  /* ------------------------------------------
     12. REJECT CONFIRM MODAL
         The reason is required and saved to
         rejectionReason, which the requester
         sees on their My Requests page.
  ------------------------------------------ */
  const rejectReason = document.getElementById('reject-reason');

  function openRejectModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;
    rejectTargetId = id;
    rejectTargetName.textContent = r.requesterName;
    rejectReason.value = '';
    clearFieldError(rejectReason);
    openModal(rejectModal);
  }

  rejectReason.addEventListener('input', () => clearFieldError(rejectReason));

  document.getElementById('reject-submit').addEventListener('click', async () => {
    if (rejectTargetId === null) return;
    const r = requests.find(x => x.id === rejectTargetId);
    const reason = rejectReason.value.trim();
    if (!reason) {
      setFieldError(rejectReason, 'Please give a reason for rejecting this request.');
      rejectReason.focus();
      return;
    }

    try {
      const result = await client.models.CertificateRequest.update({
        id: rejectTargetId,
        status: 'rejected',
        rejectionReason: reason,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(rejectModal);
      const doneMsg = `Request for ${r ? r.requesterName : 'requester'} rejected.`;
      if (r) reportEmail(certEmail(r, 'rejected', reason), r.requesterName, doneMsg); else showToast(doneMsg);
      rejectTargetId = null;
    } catch (err) {
      console.error('Failed to reject request:', err);
      showToast(err.message || "Couldn't reject the request.", true);
    }
  });

  /* ------------------------------------------
     13. VIEW DETAILS MODAL — read-only summary
  ------------------------------------------ */
  function openGenerateFor(id, certType) {
    if (certType === 'Confirmation Certificate') openGenerateConfirmationCertModal(id);
    else if (certType === 'First Communion Certificate') openGenerateFirstCommunionCertModal(id);
    else if (certType === 'Marriage Certificate') openGenerateMarriageCertModal(id);
    else if (certType === 'Death Certificate') openGenerateDeathCertModal(id);
    else openGenerateCertModal(id);
  }

  // "Generate certificate" inside View — for pending and approved requests.
  const viewGenerateBtn = document.getElementById('view-generate');
  viewGenerateBtn?.addEventListener('click', () => {
    closeModal(viewModal);
    openGenerateFor(viewGenerateBtn.dataset.id, viewGenerateBtn.dataset.certType);
  });

  function openViewModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    const canGenerate = (r.status === 'pending' || r.status === 'approved') && GENERATABLE_CERT_TYPES.has(r.certificateType);
    viewGenerateBtn?.classList.toggle('hidden', !canGenerate);
    if (viewGenerateBtn) { viewGenerateBtn.dataset.id = r.id; viewGenerateBtn.dataset.certType = r.certificateType; }

    viewName.textContent = r.requesterName;
    viewType.textContent = r.certificateType;
    viewDate.textContent = formatDate(r.createdAt);
    viewPurpose.textContent = r.purpose || '—';

    const showReason = r.status === 'rejected' && !!r.rejectionReason;
    document.getElementById('view-rejection-wrap').classList.toggle('hidden', !showReason);
    document.getElementById('view-rejection').textContent = showReason ? r.rejectionReason : '';

    viewStatusBadge.textContent = statusLabel[r.status] || r.status;
    viewStatusBadge.className = `badge ${badgeClass[r.status] || 'badge-gray'}`;

    viewLinkedWrap.classList.toggle('hidden', !r.linkedRecordId);

    openModal(viewModal);
  }

  /* ------------------------------------------
     Shared helpers for every "Generate Certificate"
     modal below. Each modal mixes plain fields (dates,
     places, Bk./Page/Line) with name-group fields
     (first/middle/last/extension in 4 separate boxes) —
     nameFieldIds lists which field ids in that modal are
     name groups so the same clear/prefill/collect logic
     works for all five certificate types.
  ------------------------------------------ */
  function clearCertFields(fieldIds, nameFieldIds) {
    fieldIds.forEach(fid => {
      if (nameFieldIds.includes(fid)) { setNameFields(fid, null); return; }
      const el = document.getElementById(fid);
      if (el) el.value = '';
    });
  }

  function prefillCertFieldsFromDetails(mapping, details, nameFieldIds) {
    Object.entries(mapping).forEach(([detailKey, certFieldId]) => {
      const value = details[detailKey];
      if (!value) return;
      if (nameFieldIds.includes(certFieldId)) { setNameFields(certFieldId, value); return; }
      const el = document.getElementById(certFieldId);
      if (el) el.value = value;
    });
  }

  /* --- Certificate Preview: its own screen here, not a new browser tab ---
     "Generate & Preview" stashes the draft in sessionStorage (as before) and
     shows the print page in a frame beside the sidebar. That page's own
     toolbar (Save as Official Copy, Print) works unchanged; its "Back to
     Record Requests" link is hidden since we're already here. "Back to Edit"
     reopens the same Generate window with every field still filled in. */
  const previewScreen = document.getElementById('cert-preview-screen');
  const previewFrame  = document.getElementById('cert-preview-frame');
  const previewLoading = document.getElementById('cert-preview-loading');
  let previewFromModal = null;

  function openCertPreview({ page, modal, title }) {
    previewFromModal = modal;
    closeModal(modal);
    const src = `${page}?preview=${Date.now()}`; // fresh load every time
    document.getElementById('cert-preview-title').textContent = title;
    document.getElementById('cert-preview-newtab').href = src;
    previewLoading.classList.remove('hidden');
    previewFrame.classList.add('is-loading');
    previewFrame.src = src;
    previewScreen.classList.remove('hidden');
    previewScreen.classList.remove('view-enter');
    void previewScreen.offsetWidth;
    previewScreen.classList.add('view-enter');
    document.body.classList.add('cert-preview-open');
    document.getElementById('cert-preview-title').focus({ preventScroll: true });
  }

  previewFrame.addEventListener('load', () => {
    if (!previewFrame.src || previewFrame.src === 'about:blank') return;
    try {
      // Same site, so we can tidy the embedded page: no "Back to Record Requests" inside the frame.
      previewFrame.contentDocument?.querySelector('.toolbar-back')?.remove();
    } catch { /* not reachable — leave it as is */ }
    previewLoading.classList.add('hidden');
    previewFrame.classList.remove('is-loading');
  });

  function closeCertPreview({ backToEdit = false } = {}) {
    if (previewScreen.classList.contains('hidden')) return;
    previewScreen.classList.add('hidden');
    document.body.classList.remove('cert-preview-open');
    previewFrame.src = 'about:blank';
    if (backToEdit && previewFromModal) openModal(previewFromModal);
    previewFromModal = null;
  }

  document.getElementById('cert-preview-back').addEventListener('click', () => closeCertPreview({ backToEdit: true }));
  document.getElementById('cert-preview-done').addEventListener('click', () => closeCertPreview());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewScreen.classList.contains('hidden')) closeCertPreview();
  });

  /** "Marriage Certificate — Juan Santos & Ana Reyes" style title for the preview bar. */
  const previewTitle = (type, ...nameFieldIds) => {
    const names = nameFieldIds.map(id => formatFullName(readNameFields(id))).filter(Boolean);
    return names.length ? `${type} — ${names.join(' & ')}` : type;
  };

  function collectCertFieldsData(fieldIds, nameFieldIds) {
    const data = {};
    fieldIds.forEach(fid => {
      data[fid] = nameFieldIds.includes(fid) ? readNameFields(fid) : document.getElementById(fid).value.trim();
    });
    return data;
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
  const certNameFieldIds = ['cert-child-name', 'cert-father-name', 'cert-mother-name', 'cert-sponsor-1', 'cert-sponsor-2'];

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
    clearCertFields(certFieldIds, certNameFieldIds);

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    prefillCertFieldsFromDetails(requestDetailsToCertField, details, certNameFieldIds);

    // Fallback if the requester's own name wasn't captured as the
    // baptized person's name (e.g. a draft with no linked request).
    if (isNameEmpty(readNameFields('cert-child-name')) && r.requesterName) {
      setNameFields('cert-child-name', { firstName: r.requesterName });
    }
    document.getElementById('cert-priest').value = 'Fredrick Edward C. Simon';
    document.getElementById('cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateCertModal);
  }

  document.getElementById('cert-generate-submit').addEventListener('click', () => {
    if (!nameFieldsFilled('cert-child-name')) {
      showToast('Please enter the full name of the baptized person.', true);
      document.getElementById('cert-child-name-first').focus();
      return;
    }

    const data = { requestId: generateCertTargetId, ...collectCertFieldsData(certFieldIds, certNameFieldIds) };

    try {
      sessionStorage.setItem(CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    openCertPreview({ page: 'baptismal-certificate-print.html', modal: generateCertModal, title: previewTitle('Baptismal Certificate', 'cert-child-name') });
  });

  /* ------------------------------------------
     15. GENERATE CONFIRMATION CERTIFICATE MODAL
         Same pattern as the Baptismal Certificate
         flow above — the rest of the certificate's
         content isn't stored on the model, so it's
         entered here each time, pre-filled from
         whatever the requester already submitted.
  ------------------------------------------ */
  const CONFIRMATION_CERT_STORAGE_KEY = 'sacradigit_confirmation_cert_draft';
  const confirmationCertFieldIds = [
    'confirm-cert-name', 'confirm-cert-father-name', 'confirm-cert-mother-name',
    'confirm-cert-baptism-date', 'confirm-cert-baptism-church', 'confirm-cert-received-name',
    'confirm-cert-date', 'confirm-cert-bishop', 'confirm-cert-sponsor', 'confirm-cert-dated',
  ];
  const confirmationCertNameFieldIds = ['confirm-cert-name', 'confirm-cert-father-name', 'confirm-cert-mother-name', 'confirm-cert-sponsor'];

  let generateConfirmationCertTargetId = null;

  // Maps the fields collected on the parishioner's request form
  // (user-request-certificate.js, Confirmation Certificate) to this
  // modal's matching print-output field. The confirming bishop and
  // the certificate's issue date aren't collected from the requester,
  // since those come from the parish register.
  const requestDetailsToConfirmationCertField = {
    'confirmed-name':    'confirm-cert-name',
    'father-name':       'confirm-cert-father-name',
    'mother-name':       'confirm-cert-mother-name',
    'baptism-date':      'confirm-cert-baptism-date',
    'baptism-church':    'confirm-cert-baptism-church',
    'confirmation-name': 'confirm-cert-received-name',
    'confirmation-date': 'confirm-cert-date',
    'sponsor-name':      'confirm-cert-sponsor',
  };

  function openGenerateConfirmationCertModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    generateConfirmationCertTargetId = id;
    clearCertFields(confirmationCertFieldIds, confirmationCertNameFieldIds);

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    prefillCertFieldsFromDetails(requestDetailsToConfirmationCertField, details, confirmationCertNameFieldIds);

    if (isNameEmpty(readNameFields('confirm-cert-name')) && r.requesterName) {
      setNameFields('confirm-cert-name', { firstName: r.requesterName });
    }
    document.getElementById('confirm-cert-bishop').value = document.getElementById('confirm-cert-bishop').value || 'Honesto F. Ongtioco';
    document.getElementById('confirm-cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateConfirmationCertModal);
  }

  document.getElementById('confirm-cert-generate-submit').addEventListener('click', () => {
    if (!nameFieldsFilled('confirm-cert-name')) {
      showToast('Please enter the full name of the confirmand.', true);
      document.getElementById('confirm-cert-name-first').focus();
      return;
    }

    const data = { requestId: generateConfirmationCertTargetId, ...collectCertFieldsData(confirmationCertFieldIds, confirmationCertNameFieldIds) };

    try {
      sessionStorage.setItem(CONFIRMATION_CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    openCertPreview({ page: 'confirmation-certificate-print.html', modal: generateConfirmationCertModal, title: previewTitle('Confirmation Certificate', 'confirm-cert-name') });
  });

  /* ------------------------------------------
     16. GENERATE FIRST COMMUNION CERTIFICATE MODAL
         Same pattern as the two flows above. Catechist,
         Officiating Priest, Book/Page/Line, and the issue
         date come from the parish register, not the
         requester — Purpose is pulled from the request's
         own purpose field rather than asked twice.
  ------------------------------------------ */
  const FIRST_COMMUNION_CERT_STORAGE_KEY = 'sacradigit_first_communion_cert_draft';
  const firstCommunionCertFieldIds = [
    'fc-cert-name', 'fc-cert-communion-date', 'fc-cert-catechist', 'fc-cert-priest',
    'fc-cert-book-no', 'fc-cert-page', 'fc-cert-line', 'fc-cert-purpose', 'fc-cert-dated',
  ];
  const firstCommunionCertNameFieldIds = ['fc-cert-name'];

  let generateFirstCommunionCertTargetId = null;

  // Maps the fields collected on the parishioner's request form
  // (user-request-certificate.js, First Communion Certificate) to
  // this modal's matching print-output field.
  const requestDetailsToFirstCommunionCertField = {
    'fc-name':           'fc-cert-name',
    'fc-communion-date': 'fc-cert-communion-date',
  };

  function openGenerateFirstCommunionCertModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    generateFirstCommunionCertTargetId = id;
    clearCertFields(firstCommunionCertFieldIds, firstCommunionCertNameFieldIds);

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    prefillCertFieldsFromDetails(requestDetailsToFirstCommunionCertField, details, firstCommunionCertNameFieldIds);

    if (isNameEmpty(readNameFields('fc-cert-name')) && r.requesterName) {
      setNameFields('fc-cert-name', { firstName: r.requesterName });
    }
    document.getElementById('fc-cert-priest').value = 'Fredrick Edward C. Simon';
    document.getElementById('fc-cert-purpose').value = r.purpose || '';
    document.getElementById('fc-cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateFirstCommunionCertModal);
  }

  document.getElementById('fc-cert-generate-submit').addEventListener('click', () => {
    if (!nameFieldsFilled('fc-cert-name')) {
      showToast('Please enter the full name of the communicant.', true);
      document.getElementById('fc-cert-name-first').focus();
      return;
    }

    const data = { requestId: generateFirstCommunionCertTargetId, ...collectCertFieldsData(firstCommunionCertFieldIds, firstCommunionCertNameFieldIds) };

    try {
      sessionStorage.setItem(FIRST_COMMUNION_CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    openCertPreview({ page: 'first-communion-certificate-print.html', modal: generateFirstCommunionCertModal, title: previewTitle('First Communion Certificate', 'fc-cert-name') });
  });

  /* ------------------------------------------
     17. GENERATE MARRIAGE CERTIFICATE MODAL
         Same pattern as the flows above — a streamlined
         parish-style certificate (not the full PSA civil
         registrar form). Officiating priest, Bk./Page/Line,
         and the issue date come from the parish register,
         not the requester.
  ------------------------------------------ */
  const MARRIAGE_CERT_STORAGE_KEY = 'sacradigit_marriage_cert_draft';
  const marriageCertFieldIds = [
    'marriage-cert-groom-name', 'marriage-cert-bride-name',
    'marriage-cert-groom-father', 'marriage-cert-groom-mother',
    'marriage-cert-bride-father', 'marriage-cert-bride-mother',
    'marriage-cert-marriage-date', 'marriage-cert-marriage-place',
    'marriage-cert-witness-1', 'marriage-cert-witness-2', 'marriage-cert-priest',
    'marriage-cert-book-no', 'marriage-cert-page', 'marriage-cert-line', 'marriage-cert-dated',
  ];
  const marriageCertNameFieldIds = [
    'marriage-cert-groom-name', 'marriage-cert-bride-name',
    'marriage-cert-groom-father', 'marriage-cert-groom-mother',
    'marriage-cert-bride-father', 'marriage-cert-bride-mother',
    'marriage-cert-witness-1', 'marriage-cert-witness-2',
  ];

  let generateMarriageCertTargetId = null;

  // Maps the fields collected on the parishioner's request form
  // (user-request-certificate.js, Marriage Certificate) to this
  // modal's matching print-output field.
  const requestDetailsToMarriageCertField = {
    'groom-name':     'marriage-cert-groom-name',
    'bride-name':     'marriage-cert-bride-name',
    'groom-father':   'marriage-cert-groom-father',
    'groom-mother':   'marriage-cert-groom-mother',
    'bride-father':   'marriage-cert-bride-father',
    'bride-mother':   'marriage-cert-bride-mother',
    'marriage-date':  'marriage-cert-marriage-date',
    'marriage-place': 'marriage-cert-marriage-place',
    'witness-1':      'marriage-cert-witness-1',
    'witness-2':      'marriage-cert-witness-2',
  };

  function openGenerateMarriageCertModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    generateMarriageCertTargetId = id;
    clearCertFields(marriageCertFieldIds, marriageCertNameFieldIds);

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    prefillCertFieldsFromDetails(requestDetailsToMarriageCertField, details, marriageCertNameFieldIds);

    document.getElementById('marriage-cert-priest').value = 'Fredrick Edward C. Simon';
    document.getElementById('marriage-cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateMarriageCertModal);
  }

  document.getElementById('marriage-cert-generate-submit').addEventListener('click', () => {
    const groomFilled = nameFieldsFilled('marriage-cert-groom-name');
    const brideFilled = nameFieldsFilled('marriage-cert-bride-name');
    if (!groomFilled || !brideFilled) {
      showToast("Please enter both the groom's and bride's full names.", true);
      document.getElementById(groomFilled ? 'marriage-cert-bride-name-first' : 'marriage-cert-groom-name-first').focus();
      return;
    }

    const data = { requestId: generateMarriageCertTargetId, ...collectCertFieldsData(marriageCertFieldIds, marriageCertNameFieldIds) };

    try {
      sessionStorage.setItem(MARRIAGE_CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    openCertPreview({ page: 'marriage-certificate-print.html', modal: generateMarriageCertModal, title: previewTitle('Marriage Certificate', 'marriage-cert-groom-name', 'marriage-cert-bride-name') });
  });

  /* ------------------------------------------
     SECTION 18 — Death Certificate generation
     Same pattern as the flows above. No physical
     template was supplied for this cert type, so the
     print output (death-certificate-print.html) is
     designed in the existing blue-ink cursive style
     shared with the Baptismal/Confirmation certificates.
     Officiating priest, Bk./Page/Line, and the issue
     date come from the parish register, not the requester.
  ------------------------------------------ */
  const DEATH_CERT_STORAGE_KEY = 'sacradigit_death_cert_draft';
  const deathCertFieldIds = [
    'death-cert-name', 'death-cert-age', 'death-cert-death-date', 'death-cert-place-of-death',
    'death-cert-burial-date', 'death-cert-burial-place', 'death-cert-priest',
    'death-cert-book-no', 'death-cert-page', 'death-cert-line', 'death-cert-dated',
  ];
  const deathCertNameFieldIds = ['death-cert-name'];

  let generateDeathCertTargetId = null;

  // Maps the fields collected on the parishioner's request form
  // (user-request-certificate.js, Death Certificate) to this
  // modal's matching print-output field. "requester-rel" is
  // intake-only (helps the office verify the request) and isn't
  // printed on the certificate, so it's deliberately left out.
  const requestDetailsToDeathCertField = {
    'deceased-name':   'death-cert-name',
    'age':             'death-cert-age',
    'death-date':      'death-cert-death-date',
    'place-of-death':  'death-cert-place-of-death',
    'burial-date':     'death-cert-burial-date',
    'burial-place':    'death-cert-burial-place',
  };

  function openGenerateDeathCertModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    generateDeathCertTargetId = id;
    clearCertFields(deathCertFieldIds, deathCertNameFieldIds);

    let details = {};
    if (r.details) {
      try { details = JSON.parse(r.details); } catch { details = {}; }
    }
    prefillCertFieldsFromDetails(requestDetailsToDeathCertField, details, deathCertNameFieldIds);

    document.getElementById('death-cert-priest').value = 'Fredrick Edward C. Simon';
    document.getElementById('death-cert-dated').value = new Date().toISOString().slice(0, 10);

    openModal(generateDeathCertModal);
  }

  document.getElementById('death-cert-generate-submit').addEventListener('click', () => {
    if (!nameFieldsFilled('death-cert-name')) {
      showToast('Please enter the full name of the deceased.', true);
      document.getElementById('death-cert-name-first').focus();
      return;
    }

    const data = { requestId: generateDeathCertTargetId, ...collectCertFieldsData(deathCertFieldIds, deathCertNameFieldIds) };

    try {
      sessionStorage.setItem(DEATH_CERT_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to stash certificate draft:', err);
      showToast("Couldn't prepare the certificate preview.", true);
      return;
    }

    openCertPreview({ page: 'death-certificate-print.html', modal: generateDeathCertModal, title: previewTitle('Death Certificate', 'death-cert-name') });
  });

  /* ------------------------------------------
     Generate Certificate pages — same flow as the
     parishioner's Request a Certificate: the five
     Generate windows open as a page (.gen-page in
     record-requests.css), the fields read as a
     table, and "Review" shows everything as a
     read-only table before "Generate & Preview".
     Built from each window's own fields, so the
     five Generate handlers above are unchanged.
  ------------------------------------------ */
  const GENERATE_PAGES = [
    ['generate-cert-modal', 'cert-generate-submit'],
    ['generate-confirmation-cert-modal', 'confirm-cert-generate-submit'],
    ['generate-first-communion-cert-modal', 'fc-cert-generate-submit'],
    ['generate-marriage-cert-modal', 'marriage-cert-generate-submit'],
    ['generate-death-cert-modal', 'death-cert-generate-submit'],
  ];

  const longDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  /* Reads the window's field grid into [section, [[label, value], …]] — headings
     (.cert-form-group) start a new section; name boxes are joined into one name. */
  function reviewSections(grid, fallbackTitle) {
    const sections = [];
    let current = null;
    const startSection = (title) => { current = [title, []]; sections.push(current); };
    for (const row of grid.children) {
      if (row.classList.contains('cert-form-group')) { startSection(row.textContent.trim()); continue; }
      const label = row.querySelector('label, .form-label')?.textContent.trim();
      if (!label) continue;
      let value;
      const nameRow = row.querySelector('.name-field-row');
      if (nameRow) {
        value = [...nameRow.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean).join(' ');
      } else {
        const field = row.querySelector('input, select, textarea');
        if (!field) continue;
        value = field.tagName === 'SELECT' ? (field.selectedOptions[0]?.textContent || '') : field.value.trim();
        if (value && field.type === 'date') value = longDate(value);
      }
      if (!current) startSection(fallbackTitle);
      current[1].push([label, value]);
    }
    return sections;
  }

  GENERATE_PAGES.forEach(([modalId, submitId]) => {
    const modal = document.getElementById(modalId);
    const submitBtn = document.getElementById(submitId);
    if (!modal || !submitBtn) return;
    const body = modal.querySelector('.modal-body');
    const grid = body.querySelector(':scope > .grid');
    const intro = body.querySelector(':scope > p');
    const footer = modal.querySelector('.modal-footer');
    const cancelBtn = footer.querySelector('[data-close-modal]');
    const title = modal.querySelector('.modal-title').textContent.replace(/^Generate\s+/, '');

    const review = document.createElement('div');
    review.className = 'gen-review hidden';
    review.innerHTML = `
      <p class="gen-review-intro">Check everything below before generating. Anything marked — was left blank.</p>
      <div class="confirm-table-wrap"><table class="confirm-table"></table></div>`;
    body.appendChild(review);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-secondary gen-back hidden';
    backBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg> Back to Edit';
    footer.prepend(backBtn);

    let reviewing = false;
    function setMode(toReview) {
      reviewing = toReview;
      grid.classList.toggle('hidden', toReview);
      intro?.classList.toggle('hidden', toReview);
      review.classList.toggle('hidden', !toReview);
      backBtn.classList.toggle('hidden', !toReview);
      cancelBtn?.classList.toggle('hidden', toReview);
      submitBtn.textContent = toReview ? 'Generate & Preview' : 'Review';
      body.scrollTop = 0;
    }

    function showReview() {
      review.querySelector('table').innerHTML = reviewSections(grid, title).map(([section, rows]) => `
        <tbody>
          <tr class="confirm-section"><th colspan="2" scope="colgroup">${escapeHtml(section)}</th></tr>
          ${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${value ? escapeHtml(value) : '<span class="gen-empty">—</span>'}</td></tr>`).join('')}
        </tbody>`).join('');
      setMode(true);
    }

    // "Review" first; in review, the button lets the original Generate handler run.
    submitBtn.addEventListener('click', (e) => {
      if (!reviewing) { e.stopImmediatePropagation(); showReview(); return; }
      // Back to the fields first, so if a required name is missing the
      // original handler's message and focus land on a visible field.
      setMode(false);
    }, true);
    backBtn.addEventListener('click', () => setMode(false));

    // Every time the page opens (fresh, or "Back to Edit" from the preview): start on the fields.
    new MutationObserver(() => { if (!modal.classList.contains('hidden')) setMode(false); })
      .observe(modal, { attributes: true, attributeFilter: ['class'] });
    setMode(false);
  });

});