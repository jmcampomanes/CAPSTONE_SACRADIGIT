/* ============================================
   SacraDigit Media — Post Templates Scripts
   Client-side prototype: stores templates in
   localStorage under 'sacradigit_media_templates'.
   Same swap-to-backend note as content-calendar.js —
   add a PostTemplate model to the Amplify schema when
   ready to make this shared across devices/team members.
   ============================================ */

const STORAGE_KEY = 'sacradigit_media_templates';

function readTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function seedIfMissing() {
  if (localStorage.getItem(STORAGE_KEY) !== null) return;
  writeTemplates([
    {
      id: 't1',
      title: 'Weekly Mass Schedule',
      category: 'Mass Schedule',
      body: 'MASS SCHEDULE this week 🙏\n\nWeekdays: 6:30 AM | 6:00 PM\nSunday: 7:30 AM | 9:00 AM | 12:00 NN | 4:30 PM | 6:00 PM\n\nSee you at Mass!',
    },
    {
      id: 't2',
      title: 'Feast Day Greeting',
      category: 'Feast Day Greeting',
      body: 'Today we celebrate the Feast of [SAINT/OCCASION]. Join us in prayer and thanksgiving as we honor this special day in our parish calendar. 🕯️',
    },
    {
      id: 't3',
      title: 'Novena Reminder',
      category: 'Novena Reminder',
      body: 'Join us for the Novena to [DEVOTION] starting [DATE] at [TIME]. Bring your intentions — all are welcome. 🙏',
    },
  ]);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  seedIfMissing();

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

  function render() {
    const templates = readTemplates();

    if (templates.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No templates yet. Click "New Template" to create one.</div>';
      return;
    }

    grid.innerHTML = templates.map(t => `
      <div class="template-card" data-id="${t.id}">
        <span class="template-card-category">${escapeHtml(t.category)}</span>
        <p class="template-card-title">${escapeHtml(t.title)}</p>
        <p class="template-card-body">${escapeHtml(t.body)}</p>
        <div class="template-card-actions">
          <button type="button" class="btn-secondary" data-copy="${t.id}">Copy</button>
          <button type="button" class="btn-secondary" data-edit="${t.id}">Edit</button>
          <button type="button" class="btn-danger" data-delete="${t.id}">Delete</button>
        </div>
      </div>
    `).join('');
  }

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

  saveBtn.addEventListener('click', () => {
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

    const templates = readTemplates();
    const id = idField.value;

    if (id) {
      const idx = templates.findIndex(t => t.id === id);
      if (idx !== -1) {
        templates[idx] = { ...templates[idx], title, category: categoryField.value, body };
      }
      showToast(`"${title}" updated.`);
    } else {
      templates.push({ id: 't' + Date.now(), title, category: categoryField.value, body });
      showToast(`"${title}" saved.`);
    }

    writeTemplates(templates);
    render();
    closeModal();
  });

  grid.addEventListener('click', async (e) => {
    const copyId = e.target.closest('[data-copy]')?.dataset.copy;
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    if (copyId) {
      const t = readTemplates().find(x => x.id === copyId);
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t.body);
        showToast(`"${t.title}" caption copied.`);
      } catch {
        showToast("Couldn't copy — your browser may be blocking clipboard access.", true);
      }
    }

    if (editId) {
      const t = readTemplates().find(x => x.id === editId);
      if (t) openModalForEdit(t);
    }

    if (deleteId) {
      const templates = readTemplates();
      const t = templates.find(x => x.id === deleteId);
      if (!t) return;
      if (!confirm(`Delete the "${t.title}" template?`)) return;
      writeTemplates(templates.filter(x => x.id !== deleteId));
      render();
      showToast(`"${t.title}" deleted.`);
    }
  });

  render();
});
