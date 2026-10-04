/* ============================================
   SacraDigit Media — Event Coverage & Approvals
   Backed by the EventCoverageRequest model
   (eventName, date, location, contact, requestedBy,
   notes, status 'pending' | 'approved' | 'rejected'),
   so requests are shared with the whole Media team
   and the Head Admin, live. Changes are recorded in
   Activity Logs automatically (../activity-log.js).
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUserName } from '../auth.js';
import { importLocalEntries } from './media-local-import.js';

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

  const model = client.models.EventCoverageRequest;
  if (!model) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Event coverage isn\'t connected to the database yet.</td></tr>';
    addBtn.disabled = true;
    return;
  }

  let requests = [];

  function render() {
    const filter = statusFilter.value;
    let shown = requests.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (filter !== 'all') {
      shown = shown.filter(r => (r.status || 'pending') === filter);
    }

    if (shown.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 text-sm py-8">No requests here.</td></tr>';
      return;
    }

    tbody.innerHTML = shown.map(r => {
      const status = r.status || 'pending';
      return `
      <tr data-id="${r.id}">
        <td>
          <p class="font-medium text-gray-900">${escapeHtml(r.eventName)}</p>
          ${r.notes ? `<p class="text-xs text-gray-400">${escapeHtml(r.notes)}</p>` : ''}
        </td>
        <td>${formatDate(r.date)}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${escapeHtml(r.contact)}</td>
        <td><span class="badge badge-${status}">${capitalize(status)}</span></td>
        <td class="text-right whitespace-nowrap">
          ${status === 'pending' ? `
            <button type="button" class="row-action row-action-approve" data-approve="${r.id}">Approve</button>
            <button type="button" class="row-action row-action-reject" data-reject="${r.id}">Reject</button>
          ` : `
            <button type="button" class="row-action row-action-delete" data-delete="${r.id}">Remove</button>
          `}
        </td>
      </tr>`;
    }).join('');
  }

  model.observeQuery().subscribe({
    next: ({ items }) => { requests = items; render(); },
    error: (err) => {
      console.error('Failed to load coverage requests:', err);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn\'t load the coverage requests.</td></tr>';
    },
  });

  // Requests added before this page used the database (kept in this browser only)
  importLocalEntries('sacradigit_media_coverage', 'EventCoverageRequest', (r) => ({
    eventName: r.eventName, date: r.date, location: r.location || '', contact: r.contact || 'Unspecified',
    notes: r.notes || '', status: r.status || 'pending', requestedBy: currentUserName() || 'Media Team',
  })).then(n => { if (n) showToast(`Moved ${n} request${n === 1 ? '' : 's'} from this browser into the shared list.`); });

  function openModal() {
    eventField.value = '';
    dateField.value = new Date().toLocaleDateString('en-CA');
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

  saveBtn.addEventListener('click', async () => {
    const eventName = eventField.value.trim();
    if (!eventName) {
      showToast('Please enter the event name.', true);
      return;
    }
    if (!dateField.value) {
      showToast('Please choose a date.', true);
      return;
    }

    saveBtn.disabled = true;
    try {
      const { errors } = await model.create({
        eventName,
        date: dateField.value,
        location: locationField.value.trim(),
        contact: contactField.value.trim() || 'Unspecified',
        notes: notesField.value.trim(),
        status: 'pending',
        requestedBy: currentUserName() || 'Media Team',
      });
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      closeModal();
      showToast(`Coverage request for "${eventName}" submitted.`);
    } catch (err) {
      console.error('Failed to submit coverage request:', err);
      showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function setStatus(r, status) {
    try {
      const { errors } = await model.update({ id: r.id, status });
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      showToast(`"${r.eventName}" ${status}.`, status === 'rejected');
    } catch (err) {
      console.error('Failed to update coverage request:', err);
      showToast(err.message || "Couldn't update the request.", true);
    }
  }

  tbody.addEventListener('click', async (e) => {
    const approveId = e.target.closest('[data-approve]')?.dataset.approve;
    const rejectId = e.target.closest('[data-reject]')?.dataset.reject;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    if (approveId) {
      const r = requests.find(x => x.id === approveId);
      if (r) await setStatus(r, 'approved');
    }

    if (rejectId) {
      const r = requests.find(x => x.id === rejectId);
      if (r) await setStatus(r, 'rejected');
    }

    if (deleteId) {
      const r = requests.find(x => x.id === deleteId);
      if (!r) return;
      if (!confirm(`Remove "${r.eventName}" from the list?`)) return;
      try {
        const { errors } = await model.delete({ id: deleteId });
        if (errors) throw new Error(errors.map(er => er.message).join('; '));
        showToast(`"${r.eventName}" removed.`);
      } catch (err) {
        console.error('Failed to remove coverage request:', err);
        showToast(err.message || "Couldn't remove the request.", true);
      }
    }
  });
});
