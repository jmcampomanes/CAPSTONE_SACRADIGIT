/* ============================================
   SacraDigit Media — Media Library Scripts
   Client-side prototype: stores metadata in
   localStorage under 'sacradigit_media_library'.
   The "Link" field is a placeholder for wherever
   the real file lives until this is wired to
   Amplify Storage (S3) the way Digital Archives
   and Cloud Access are on the admin side.
   ============================================ */

const STORAGE_KEY = 'sacradigit_media_library';

function readItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function seedIfMissing() {
  if (localStorage.getItem(STORAGE_KEY) !== null) return;
  writeItems([
    { id: 'm1', title: 'Parish Fiesta 2026 — Album 1', tag: 'Event', type: 'photo', dateAdded: '2026-08-20', uploadedBy: 'Media Team', url: '' },
    { id: 'm2', title: 'Sunday Homily — Sept 7', tag: 'Homily', type: 'video', dateAdded: '2026-09-07', uploadedBy: 'Media Team', url: '' },
    { id: 'm3', title: 'First Communion Batch 1 — Group Photo', tag: 'Sacraments', type: 'photo', dateAdded: '2026-08-30', uploadedBy: 'Media Team', url: '' },
  ]);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ICON_PHOTO = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"/></svg>';
const ICON_VIDEO = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';

document.addEventListener('DOMContentLoaded', () => {
  seedIfMissing();

  const grid = document.getElementById('library-grid');
  const modal = document.getElementById('media-modal');
  const addBtn = document.getElementById('add-media-btn');
  const saveBtn = document.getElementById('save-media-btn');

  const titleField = document.getElementById('media-title');
  const tagField = document.getElementById('media-tag');
  const typeField = document.getElementById('media-type');
  const urlField = document.getElementById('media-url');

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
    const items = [...readItems()].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Nothing in the library yet. Click "Add Media" to log your first item.</div>';
      return;
    }

    grid.innerHTML = items.map(m => `
      <div class="media-card" data-id="${m.id}">
        <div class="media-card-icon">${m.type === 'video' ? ICON_VIDEO : ICON_PHOTO}</div>
        <p class="media-card-title">${escapeHtml(m.title)}</p>
        <p class="media-card-meta">${escapeHtml(m.tag)} · ${formatDate(m.dateAdded)}</p>
        ${m.url ? `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="media-card-link">Open file ↗</a>` : '<p class="media-card-meta">No link attached</p>'}
        <div class="media-card-actions">
          <button type="button" class="btn-danger" data-delete="${m.id}" style="width:100%;">Remove</button>
        </div>
      </div>
    `).join('');
  }

  function openModal() {
    titleField.value = '';
    tagField.value = '';
    typeField.value = 'photo';
    urlField.value = '';
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  addBtn.addEventListener('click', openModal);

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', () => {
    const title = titleField.value.trim();
    if (!title) {
      showToast('Please give this item a title.', true);
      return;
    }

    const items = readItems();
    items.push({
      id: 'm' + Date.now(),
      title,
      tag: tagField.value.trim() || 'Uncategorized',
      type: typeField.value,
      dateAdded: new Date().toISOString().slice(0, 10),
      uploadedBy: 'Media Team',
      url: urlField.value.trim(),
    });

    writeItems(items);
    render();
    closeModal();
    showToast(`"${title}" added to the library.`);
  });

  grid.addEventListener('click', (e) => {
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;

    const items = readItems();
    const item = items.find(x => x.id === deleteId);
    if (!item) return;
    if (!confirm(`Remove "${item.title}" from the library?`)) return;

    writeItems(items.filter(x => x.id !== deleteId));
    render();
    showToast(`"${item.title}" removed.`);
  });

  render();
});
