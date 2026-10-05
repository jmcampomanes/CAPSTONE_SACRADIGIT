/* ============================================
   SacraDigit Media — Content Calendar Scripts
   Backed by the ContentCalendarEntry model
   (date, title, platform, status, notes), so the
   whole Media team and the Head Admin see the same
   calendar, live. Changes are recorded in Activity
   Logs automatically (../activity-log.js).
   ============================================ */

import { client } from '../amplify-init.js';
import { importLocalEntries } from './media-local-import.js';

// Read by Sacradigit/announcements.js to prefill (and schedule) a new post
const ANNOUNCEMENT_PREFILL_KEY = 'sacradigit_announcement_prefill';
const STATUSES = ['draft', 'scheduled', 'published'];

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

const statusOf = (e) => (STATUSES.includes(e.status) ? e.status : 'draft');

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('calendar-tbody');
  const modal = document.getElementById('entry-modal');
  const addBtn = document.getElementById('add-entry-btn');
  const saveBtn = document.getElementById('save-entry-btn');
  const modalTitle = document.getElementById('entry-modal-title');

  const idField = document.getElementById('entry-id');
  const dateField = document.getElementById('entry-date');
  const titleField = document.getElementById('entry-title');
  const platformField = document.getElementById('entry-platform');
  const statusField = document.getElementById('entry-status');
  const notesField = document.getElementById('entry-notes');

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

  const model = client.models.ContentCalendarEntry;
  if (!model) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">The content calendar isn\'t connected to the database yet.</td></tr>';
    addBtn.disabled = true;
    return;
  }

  let entries = [];

  function render() {
    const sorted = entries.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 text-sm py-8">No content planned yet. Click "New Entry" to add one.</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(e => {
      const status = statusOf(e);
      return `
      <tr data-id="${e.id}">
        <td>${formatDate(e.date)}</td>
        <td>${escapeHtml(e.title)}</td>
        <td>${escapeHtml(e.platform)}</td>
        <td><span class="badge badge-${status}">${capitalize(status)}</span></td>
        <td class="text-right whitespace-nowrap">
          ${status !== 'published' ? `<button type="button" class="row-action" data-announce="${e.id}" title="Open the announcement composer with this entry, scheduled for its date">Schedule as Announcement</button>` : ''}
          <button type="button" class="row-action" data-edit="${e.id}">Edit</button>
          <button type="button" class="row-action row-action-danger" data-delete="${e.id}">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  model.observeQuery().subscribe({
    next: ({ items }) => { entries = items; render(); },
    error: (err) => {
      console.error('Failed to load the content calendar:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">Couldn\'t load the content calendar.</td></tr>';
    },
  });

  // Entries added before the calendar used the database (kept in this browser only)
  importLocalEntries('sacradigit_media_calendar', 'ContentCalendarEntry', (e) => ({
    date: e.date, title: e.title, platform: e.platform || 'Facebook', status: e.type || e.status || 'draft', notes: e.notes || '',
  })).then(n => { if (n) showToast(`Moved ${n} entr${n === 1 ? 'y' : 'ies'} from this browser into the shared calendar.`); });

  function openModalForNew() {
    modalTitle.textContent = 'New Content Entry';
    idField.value = '';
    dateField.value = new Date().toLocaleDateString('en-CA');
    titleField.value = '';
    platformField.value = 'Facebook';
    statusField.value = 'draft';
    notesField.value = '';
    modal.classList.remove('hidden');
  }

  function openModalForEdit(entry) {
    modalTitle.textContent = 'Edit Content Entry';
    idField.value = entry.id;
    dateField.value = entry.date;
    titleField.value = entry.title;
    platformField.value = entry.platform || 'Facebook';
    statusField.value = statusOf(entry);
    notesField.value = entry.notes || '';
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  addBtn.addEventListener('click', openModalForNew);

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', async () => {
    const title = titleField.value.trim();
    if (!title) {
      showToast('Please give this entry a title.', true);
      return;
    }
    if (!dateField.value) {
      showToast('Please choose a date.', true);
      return;
    }

    const id = idField.value;
    const fields = {
      date: dateField.value,
      title,
      platform: platformField.value,
      status: statusField.value,
      notes: notesField.value.trim(),
    };

    saveBtn.disabled = true;
    try {
      const { errors } = id ? await model.update({ id, ...fields }) : await model.create(fields);
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      showToast(id ? `"${title}" updated.` : `"${title}" added to the calendar.`);
      closeModal();
    } catch (err) {
      console.error('Failed to save calendar entry:', err);
      showToast(err.message || "Couldn't save the entry.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  tbody.addEventListener('click', async (e) => {
    const announceId = e.target.closest('[data-announce]')?.dataset.announce;
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    // Hands the entry to the announcement composer. With a future date,
    // "Schedule Post" there makes it go live automatically on that day.
    if (announceId) {
      const entry = entries.find(x => x.id === announceId);
      if (!entry) return;
      try {
        sessionStorage.setItem(ANNOUNCEMENT_PREFILL_KEY, JSON.stringify({
          title: entry.title,
          body: entry.notes || '',
          startDate: entry.date,
        }));
      } catch {
        showToast("Couldn't hand the entry over — your browser is blocking storage.", true);
        return;
      }
      window.location.href = 'announcements.html';
      return;
    }

    if (editId) {
      const entry = entries.find(x => x.id === editId);
      if (entry) openModalForEdit(entry);
    }

    if (deleteId) {
      const entry = entries.find(x => x.id === deleteId);
      if (!entry) return;
      if (!confirm(`Remove "${entry.title}" from the calendar?`)) return;
      try {
        const { errors } = await model.delete({ id: deleteId });
        if (errors) throw new Error(errors.map(er => er.message).join('; '));
        showToast(`"${entry.title}" removed.`);
      } catch (err) {
        console.error('Failed to delete calendar entry:', err);
        showToast(err.message || "Couldn't remove the entry.", true);
      }
    }
  });
});
