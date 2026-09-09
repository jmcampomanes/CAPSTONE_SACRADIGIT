/* ============================================
   SacraDigit Media — Event Coverage & Approvals
   Scripts. Client-side prototype: stores requests
   in localStorage under 'sacradigit_media_coverage'.

   In a real deployment, ministries would submit
   these requests from their own view (or a shared
   form) and Media/Admin would approve/reject here —
   that split is exactly what an EventCoverageRequest
   model with a `status` enum and role-scoped
   authorization rules in amplify/data/resource.ts
   would give you once RBAC is restored.
   ============================================ */

const STORAGE_KEY = 'sacradigit_media_coverage';

function readRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRequests(requests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function seedIfMissing() {
  if (localStorage.getItem(STORAGE_KEY) !== null) return;
  writeRequests([
    { id: 'r1', eventName: 'Youth Ministry Recollection', date: '2026-09-20', location: 'Parish Hall', contact: 'Youth Ministry', notes: 'Need photos + short recap video', status: 'pending' },
    { id: 'r2', eventName: 'First Communion Batch 2', date: '2026-09-27', location: 'Main Church', contact: 'Catechism Office', notes: '', status: 'approved' },
    { id: 'r3', eventName: 'Choir Practice Highlight Reel', date: '2026-09-10', location: 'Choir Loft', contact: 'Music Ministry', notes: 'For social media only, not for bulletin', status: 'rejected' },
  ]);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
  seedIfMissing();

  const tbody = document.getElementById('coverage-tbody');
  const statusFilter = document.getElementById('status-filter');
  const modal = document.getElementById('request-modal');
  const addBtn = document.getElementById('add-request-btn');
  const saveBtn = document.getElementById('save-request-btn');

  const eventField = document.getElementById('request-event');
  const dateField = document.getElementById('request-date');
  const locationField = document.getElementById('request-location');
  const contactField = document.getElementById('request-contact');
  const notesField = document.getElementById('request-notes');

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

  function render() {
    const filter = statusFilter.value;
    let requests = [...readRequests()].sort((a, b) => a.date.localeCompare(b.date));
    if (filter !== 'all') {
      requests = requests.filter(r => r.status === filter);
    }

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 text-sm py-8">No requests here.</td></tr>';
      return;
    }

    tbody.innerHTML = requests.map(r => `
      <tr data-id="${r.id}">
        <td>
          <p class="font-medium text-gray-900">${escapeHtml(r.eventName)}</p>
          ${r.notes ? `<p class="text-xs text-gray-400">${escapeHtml(r.notes)}</p>` : ''}
        </td>
        <td>${formatDate(r.date)}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${escapeHtml(r.contact)}</td>
        <td><span class="badge badge-${r.status}">${capitalize(r.status)}</span></td>
        <td class="text-right whitespace-nowrap">
          ${r.status === 'pending' ? `
            <button type="button" class="row-action row-action-approve" data-approve="${r.id}">Approve</button>
            <button type="button" class="row-action row-action-reject" data-reject="${r.id}">Reject</button>
          ` : `
            <button type="button" class="row-action row-action-delete" data-delete="${r.id}">Remove</button>
          `}
        </td>
      </tr>
    `).join('');
  }

  function openModal() {
    eventField.value = '';
    dateField.value = new Date().toISOString().slice(0, 10);
    locationField.value = '';
    contactField.value = '';
    notesField.value = '';
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  addBtn.addEventListener('click', openModal);
  statusFilter.addEventListener('change', render);

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', () => {
    const eventName = eventField.value.trim();
    if (!eventName) {
      showToast('Please enter the event name.', true);
      return;
    }
    if (!dateField.value) {
      showToast('Please choose a date.', true);
      return;
    }

    const requests = readRequests();
    requests.push({
      id: 'r' + Date.now(),
      eventName,
      date: dateField.value,
      location: locationField.value.trim(),
      contact: contactField.value.trim() || 'Unspecified',
      notes: notesField.value.trim(),
      status: 'pending',
    });

    writeRequests(requests);
    render();
    closeModal();
    showToast(`Coverage request for "${eventName}" submitted.`);
  });

  tbody.addEventListener('click', (e) => {
    const approveId = e.target.closest('[data-approve]')?.dataset.approve;
    const rejectId = e.target.closest('[data-reject]')?.dataset.reject;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    const requests = readRequests();

    if (approveId) {
      const r = requests.find(x => x.id === approveId);
      if (r) {
        r.status = 'approved';
        writeRequests(requests);
        render();
        showToast(`"${r.eventName}" approved.`);
      }
    }

    if (rejectId) {
      const r = requests.find(x => x.id === rejectId);
      if (r) {
        r.status = 'rejected';
        writeRequests(requests);
        render();
        showToast(`"${r.eventName}" rejected.`, true);
      }
    }

    if (deleteId) {
      const r = requests.find(x => x.id === deleteId);
      if (!r) return;
      if (!confirm(`Remove "${r.eventName}" from the list?`)) return;
      writeRequests(requests.filter(x => x.id !== deleteId));
      render();
      showToast(`"${r.eventName}" removed.`);
    }
  });

  render();
});
