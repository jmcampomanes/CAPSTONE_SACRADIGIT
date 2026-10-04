/* ============================================
   SacraDigit Media — Post Templates Scripts
   Backed by the PostTemplate model (title,
   category, body), so the whole Media team and the
   Head Admin share the same templates, live.
   Changes are recorded in Activity Logs
   automatically (../activity-log.js).
   ============================================ */

import { client } from '../amplify-init.js';
import { importLocalEntries } from './media-local-import.js';

// Read by Sacradigit/announcements.js to prefill a new post
const ANNOUNCEMENT_PREFILL_KEY = 'sacradigit_announcement_prefill';

// Offered (once, for everyone) while there are no templates yet
const STARTER_TEMPLATES = [
  {
    title: 'Weekly Mass Schedule',
    category: 'Mass Schedule',
    body: 'MASS SCHEDULE this week 🙏\n\nWeekdays: 6:30 AM | 6:00 PM\nSunday: 7:30 AM | 9:00 AM | 12:00 NN | 4:30 PM | 6:00 PM\n\nSee you at Mass!',
  },
  {
    title: 'Feast Day Greeting',
    category: 'Feast Day Greeting',
    body: 'Today we celebrate the Feast of [SAINT/OCCASION]. Join us in prayer and thanksgiving as we honor this special day in our parish calendar. 🕯️',
  },
  {
    title: 'Novena Reminder',
    category: 'Novena Reminder',
    body: 'Join us for the Novena to [DEVOTION] starting [DATE] at [TIME]. Bring your intentions — all are welcome. 🙏',
  },
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('templates-grid');
  const modal = document.getElementById('template-modal');
  const addBtn = document.getElementById('add-template-btn');
  const saveBtn = document.getElementById('save-template-btn');
  const modalTitle = document.getElementById('template-modal-title');

  const idField = document.getElementById('template-id');
  const titleField = document.getElementById('template-title');
  const categoryField = document.getElementById('template-category');
  const bodyField = document.getElementById('template-body');

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

  const model = client.models.PostTemplate;
  if (!model) {
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Post templates aren\'t connected to the database yet.</div>';
    addBtn.disabled = true;
    return;
  }

  let templates = [];

  function render() {
    if (templates.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          No templates yet. Click "New Template" to create one.
          <div class="mt-3"><button type="button" class="btn-secondary" data-load-starters>Load starter templates</button></div>
        </div>`;
      return;
    }

    const sorted = templates.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.title || '').localeCompare(b.title || ''));
    grid.innerHTML = sorted.map(t => `
      <div class="template-card" data-id="${t.id}">
        <span class="template-card-category">${escapeHtml(t.category)}</span>
        <p class="template-card-title">${escapeHtml(t.title)}</p>
        <p class="template-card-body">${escapeHtml(t.body)}</p>
        <div class="template-card-actions">
          <button type="button" class="btn-lavender" data-use="${t.id}" title="Start a new announcement with this caption">Use in Announcement</button>
          <button type="button" class="btn-secondary" data-copy="${t.id}">Copy</button>
          <button type="button" class="btn-secondary" data-edit="${t.id}">Edit</button>
          <button type="button" class="btn-danger" data-delete="${t.id}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  model.observeQuery().subscribe({
    next: ({ items }) => { templates = items; render(); },
    error: (err) => {
      console.error('Failed to load post templates:', err);
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Couldn\'t load the post templates.</div>';
    },
  });

  // Templates made before this page used the database (kept in this browser only)
  importLocalEntries('sacradigit_media_templates', 'PostTemplate', (t) => ({
    title: t.title, category: t.category || 'Other', body: t.body || '',
  })).then(n => { if (n) showToast(`Moved ${n} template${n === 1 ? '' : 's'} from this browser into the shared list.`); });

  function openModalForNew() {
    modalTitle.textContent = 'New Template';
    idField.value = '';
    titleField.value = '';
    categoryField.value = 'Mass Schedule';
    bodyField.value = '';
    modal.classList.remove('hidden');
  }

  function openModalForEdit(t) {
    modalTitle.textContent = 'Edit Template';
    idField.value = t.id;
    titleField.value = t.title;
    categoryField.value = t.category;
    bodyField.value = t.body;
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
    const body = bodyField.value.trim();
    if (!title) {
      showToast('Please name this template.', true);
      return;
    }
    if (!body) {
      showToast('Please write the caption text.', true);
      return;
    }

    const id = idField.value;
    const fields = { title, category: categoryField.value, body };

    saveBtn.disabled = true;
    try {
      const { errors } = id ? await model.update({ id, ...fields }) : await model.create(fields);
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      showToast(id ? `"${title}" updated.` : `"${title}" saved.`);
      closeModal();
    } catch (err) {
      console.error('Failed to save template:', err);
      showToast(err.message || "Couldn't save the template.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  grid.addEventListener('click', async (e) => {
    const useId = e.target.closest('[data-use]')?.dataset.use;
    const copyId = e.target.closest('[data-copy]')?.dataset.copy;
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    const loadStarters = e.target.closest('[data-load-starters]');

    if (loadStarters) {
      loadStarters.disabled = true;
      try {
        for (const t of STARTER_TEMPLATES) {
          const { errors } = await model.create(t);
          if (errors) throw new Error(errors.map(er => er.message).join('; '));
        }
        showToast('Starter templates added.');
      } catch (err) {
        console.error('Failed to add starter templates:', err);
        showToast(err.message || "Couldn't add the starter templates.", true);
        loadStarters.disabled = false;
      }
      return;
    }

    if (useId) {
      const t = templates.find(x => x.id === useId);
      if (!t) return;
      try {
        sessionStorage.setItem(ANNOUNCEMENT_PREFILL_KEY, JSON.stringify({ title: t.title, body: t.body }));
      } catch {
        showToast("Couldn't hand the template over — your browser is blocking storage.", true);
        return;
      }
      window.location.href = 'announcements.html';
      return;
    }

    if (copyId) {
      const t = templates.find(x => x.id === copyId);
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t.body);
        showToast(`"${t.title}" caption copied.`);
      } catch {
        showToast("Couldn't copy — your browser may be blocking clipboard access.", true);
      }
    }

    if (editId) {
      const t = templates.find(x => x.id === editId);
      if (t) openModalForEdit(t);
    }

    if (deleteId) {
      const t = templates.find(x => x.id === deleteId);
      if (!t) return;
      if (!confirm(`Delete the "${t.title}" template?`)) return;
      try {
        const { errors } = await model.delete({ id: deleteId });
        if (errors) throw new Error(errors.map(er => er.message).join('; '));
        showToast(`"${t.title}" deleted.`);
      } catch (err) {
        console.error('Failed to delete template:', err);
        showToast(err.message || "Couldn't delete the template.", true);
      }
    }
  });
});
