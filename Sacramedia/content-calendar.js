/* ============================================
   SacraDigit Media — Content Calendar Scripts
   Client-side prototype: stores entries in
   localStorage under 'sacradigit_media_calendar'.

   To wire this up to a real backend later, add a
   ContentCalendarEntry model to amplify/data/resource.ts
   (fields: date, title, platform, status, notes) and
   swap the readEntries()/writeEntries() calls below for
   client.models.ContentCalendarEntry.list()/create()/
   update()/delete(), the same pattern already used in
   Sacradigit/announcements.js.
   ============================================ */

const STORAGE_KEY = 'sacradigit_media_calendar';
// Read by Sacradigit/announcements.js to prefill (and schedule) a new post
const ANNOUNCEMENT_PREFILL_KEY = 'sacradigit_announcement_prefill';

function readEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function seedIfMissing() {
  if (localStorage.getItem(STORAGE_KEY) !== null) return;
  writeEntries([
    { id: 'c1', date: '2026-09-13', title: 'Sunday Mass Schedule Graphic', platform: 'Facebook', type: 'scheduled', notes: '' },
    { id: 'c2', date: '2026-09-14', title: 'Feast of the Exaltation of the Cross — greeting', platform: 'Facebook', type: 'draft', notes: 'Waiting on final art' },
    { id: 'c3', date: '2026-09-19', title: 'Recollection reminder', platform: 'Instagram', type: 'scheduled', notes: '' },
    { id: 'c4', date: '2026-09-06', title: '22nd Sunday reflection post', platform: 'Facebook', type: 'published', notes: '' },
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

  function render() {
    const entries = readEntries().sort((a, b) => a.date.localeCompare(b.date));

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 text-sm py-8">No content planned yet. Click "New Entry" to add one.</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(e => `
      <tr data-id="${e.id}">
        <td>${formatDate(e.date)}</td>
        <td>${escapeHtml(e.title)}</td>
        <td>${escapeHtml(e.platform)}</td>
        <td><span class="badge badge-${e.type}">${capitalize(e.type)}</span></td>
        <td class="text-right whitespace-nowrap">
          ${e.type !== 'published' ? `<button type="button" class="row-action" data-announce="${e.id}" title="Open the announcement composer with this entry, scheduled for its date">Schedule as Announcement</button>` : ''}
          <button type="button" class="row-action" data-edit="${e.id}">Edit</button>
          <button type="button" class="row-action row-action-danger" data-delete="${e.id}">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  function openModalForNew() {
    modalTitle.textContent = 'New Content Entry';
    idField.value = '';
    dateField.value = new Date().toISOString().slice(0, 10);
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
    platformField.value = entry.platform;
    statusField.value = entry.type;
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

  saveBtn.addEventListener('click', () => {
    const title = titleField.value.trim();
    if (!title) {
      showToast('Please give this entry a title.', true);
      return;
    }
    if (!dateField.value) {
      showToast('Please choose a date.', true);
      return;
    }

    const entries = readEntries();
    const id = idField.value;

    if (id) {
      const idx = entries.findIndex(e => e.id === id);
      if (idx !== -1) {
        entries[idx] = {
          ...entries[idx],
          date: dateField.value,
          title,
          platform: platformField.value,
          type: statusField.value,
          notes: notesField.value.trim(),
        };
      }
      showToast(`"${title}" updated.`);
    } else {
      entries.push({
        id: 'c' + Date.now(),
        date: dateField.value,
        title,
        platform: platformField.value,
        type: statusField.value,
        notes: notesField.value.trim(),
      });
      showToast(`"${title}" added to the calendar.`);
    }

    writeEntries(entries);
    render();
    closeModal();
  });

  tbody.addEventListener('click', (e) => {
    const announceId = e.target.closest('[data-announce]')?.dataset.announce;
    const editId = e.target.closest('[data-edit]')?.dataset.edit;

    // Hands the entry to the announcement composer. With a future date,
    // "Schedule Post" there makes it go live automatically on that day.
    if (announceId) {
      const entry = readEntries().find(x => x.id === announceId);
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
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    if (editId) {
      const entry = readEntries().find(x => x.id === editId);
      if (entry) openModalForEdit(entry);
    }

    if (deleteId) {
      const entries = readEntries();
      const entry = entries.find(x => x.id === deleteId);
      if (!entry) return;
      if (!confirm(`Remove "${entry.title}" from the calendar?`)) return;
      writeEntries(entries.filter(x => x.id !== deleteId));
      render();
      showToast(`"${entry.title}" removed.`);
    }
  });

  render();
});
