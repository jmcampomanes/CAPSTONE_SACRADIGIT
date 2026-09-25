/* ============================================
   SacraDigit Media — Media Library Scripts (AWS Amplify)
   Files upload to S3 via Amplify Storage under
   cloudFiles/media/{tag}/{timestamp}_{filename} and are
   tracked with the existing CloudFile model
   (folder: 'media'), the same pattern Cloud Access
   uses in Sacra ITech — so the IT team also sees
   these under Cloud Access → "Media Library".

   CloudFile has no tag/type columns, so:
   - the tag is the path segment after cloudFiles/media/
   - the type (photo/video) comes from the file extension
   - link-only items (Drive, YouTube, etc.) store the
     external https:// URL in `url` with bytes = 0
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData, getUrl, remove, copy } from 'aws-amplify/storage';

const FOLDER = 'media';
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d)) return String(input);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function isExternal(url) {
  return /^https?:\/\//i.test(url || '');
}

function tagFromPath(path) {
  const m = /^cloudFiles\/media\/([^/]+)\//.exec(path || '');
  return m ? decodeURIComponent(m[1]) : 'Uncategorized';
}

function typeOf(item) {
  return VIDEO_EXT.test(item.url || '') || /youtu\.?be|vimeo|fb\.watch/i.test(item.url || '') ? 'video' : 'photo';
}

const ICON_PHOTO = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"/></svg>';
const ICON_VIDEO = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';

document.addEventListener('DOMContentLoaded', () => {
  let items = [];
  let activeFilter = 'all';

  const grid = document.getElementById('library-grid');
  const filterSelect = document.getElementById('library-filter');
  const modal = document.getElementById('media-modal');
  const addBtn = document.getElementById('add-media-btn');
  const saveBtn = document.getElementById('save-media-btn');

  const titleField = document.getElementById('media-title');
  const tagField = document.getElementById('media-tag');
  const fileField = document.getElementById('media-file');
  const fileNameEl = document.getElementById('media-file-name');
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

  /* Signed S3 URLs expire, so resolve at render time and cache briefly
     (same approach as Sacradigit/announcements.js). */
  const urlCache = new Map();
  async function resolveUrl(path) {
    if (!path) return '';
    if (isExternal(path)) return path;
    const cached = urlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    try {
      const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
      const resolved = url.toString();
      urlCache.set(path, { url: resolved, expiresAt: Date.now() + 55 * 60 * 1000 });
      return resolved;
    } catch (err) {
      console.error(`Failed to resolve media URL for "${path}":`, err);
      return '';
    }
  }

  async function render() {
    let visible = [...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (activeFilter !== 'all') visible = visible.filter(m => typeOf(m) === activeFilter);

    if (visible.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">${
        items.length === 0 ? 'Nothing in the library yet. Click "Add Media" to upload your first file.' : 'No items match this filter.'
      }</div>`;
      return;
    }

    const resolved = await Promise.all(visible.map(m => resolveUrl(m.url)));

    grid.innerHTML = visible.map((m, i) => {
      const type = typeOf(m);
      const href = resolved[i];
      const external = isExternal(m.url);
      let preview = `<div class="media-card-icon">${type === 'video' ? ICON_VIDEO : ICON_PHOTO}</div>`;
      if (href && !external) {
        if (type === 'video') preview = `<video class="media-card-thumb" src="${escapeHtml(href)}" muted preload="metadata"></video>`;
        else if (IMAGE_EXT.test(m.url)) preview = `<img class="media-card-thumb" src="${escapeHtml(href)}" alt="${escapeHtml(m.name)}" loading="lazy" />`;
      }
      const meta = [tagFromPath(m.url), formatDate(m.createdAt), formatBytes(m.bytes)].filter(Boolean).join(' · ');
      return `
        <div class="media-card" data-id="${m.id}">
          ${preview}
          <p class="media-card-title">${escapeHtml(m.name)}</p>
          <p class="media-card-meta">${escapeHtml(external ? 'External link' : meta)}</p>
          ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="media-card-link">Open ${external ? 'link' : 'file'} ↗</a>` : '<p class="media-card-meta">File unavailable</p>'}
          <div class="media-card-actions">
            <button type="button" class="btn-secondary" data-edit="${m.id}">Edit</button>
            <button type="button" class="btn-danger" data-delete="${m.id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Loading…</div>';
  client.models.CloudFile.observeQuery({ filter: { folder: { eq: FOLDER } } }).subscribe({
    next: ({ items: next }) => {
      items = next;
      render();
    },
    error: (err) => {
      console.error('Failed to load media library:', err);
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Couldn\'t load the library. Check your connection and refresh.</div>';
    },
  });

  filterSelect?.addEventListener('change', () => {
    activeFilter = filterSelect.value;
    render();
  });

  const modalTitleEl = document.getElementById('media-modal-title');
  const fileLabelEl = document.getElementById('media-file-label');
  let editing = null; // the CloudFile item being edited, or null when adding

  function saveLabel() {
    return editing ? 'Save Changes' : 'Add to Library';
  }

  function openModal(item = null) {
    editing = item;
    const external = item && isExternal(item.url);
    titleField.value = item ? item.name || '' : '';
    tagField.value = item && !external ? tagFromPath(item.url) : '';
    fileField.value = '';
    fileNameEl.textContent = item ? 'Keep current file' : 'No file chosen';
    urlField.value = external ? item.url : '';
    modalTitleEl.textContent = item ? 'Edit Media Item' : 'Add Media Item';
    fileLabelEl.textContent = item ? 'Replace file (optional)' : 'File';
    saveBtn.disabled = false;
    saveBtn.textContent = saveLabel();
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  addBtn.addEventListener('click', () => openModal());

  fileField.addEventListener('change', () => {
    const file = fileField.files[0];
    fileNameEl.textContent = file ? `${file.name} (${formatBytes(file.size)})` : (editing ? 'Keep current file' : 'No file chosen');
    if (file && !titleField.value.trim()) titleField.value = file.name.replace(/\.[^.]+$/, '');
  });

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', async () => {
    const title = titleField.value.trim();
    const file = fileField.files[0];
    const link = urlField.value.trim();
    const tag = tagField.value.trim() || 'Uncategorized';

    if (!title) {
      showToast('Please give this item a title.', true);
      return;
    }
    // When editing an uploaded file, leaving both file and link empty keeps it.
    const keepStoredFile = editing && !isExternal(editing.url) && !file && !link;
    if (!file && !link && !keepStoredFile) {
      showToast('Choose a file to upload or paste a link.', true);
      return;
    }
    if (!file && link && !isExternal(link)) {
      showToast('Links must start with http:// or https://', true);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = file ? 'Uploading…' : 'Saving…';

    if (editing) {
      const old = editing;
      const oldStored = !isExternal(old.url);
      try {
        let url = old.url;
        let bytes = old.bytes || 0;
        if (file) {
          url = `cloudFiles/${FOLDER}/${encodeURIComponent(tag)}/${Date.now()}_${file.name}`;
          await uploadData({ path: url, data: file, options: { contentType: file.type } }).result;
          bytes = file.size;
        } else if (link && link !== old.url) {
          url = link;
          bytes = 0;
        } else if (keepStoredFile && tag !== tagFromPath(old.url)) {
          // The tag lives in the S3 path, so re-tagging means moving the object.
          const fileName = old.url.split('/').pop();
          url = `cloudFiles/${FOLDER}/${encodeURIComponent(tag)}/${fileName}`;
          await copy({ source: { path: old.url }, destination: { path: url } });
        }

        const { errors } = await client.models.CloudFile.update({ id: old.id, name: title, url, bytes });
        if (errors?.length) throw new Error(errors[0].message);

        if (oldStored && url !== old.url) {
          urlCache.delete(old.url);
          remove({ path: old.url }).catch(err => console.warn('Old S3 object not removed:', err));
        }

        closeModal();
        showToast(`"${title}" updated.`);
      } catch (err) {
        console.error('Media update failed:', err);
        showToast('Update failed. Please try again.', true);
        saveBtn.disabled = false;
        saveBtn.textContent = saveLabel();
      }
      return;
    }

    try {
      let url = link;
      let bytes = 0;
      if (file) {
        url = `cloudFiles/${FOLDER}/${encodeURIComponent(tag)}/${Date.now()}_${file.name}`;
        await uploadData({ path: url, data: file, options: { contentType: file.type } }).result;
        bytes = file.size;
      }

      const { errors } = await client.models.CloudFile.create({ name: title, url, folder: FOLDER, bytes });
      if (errors?.length) throw new Error(errors[0].message);

      closeModal();
      showToast(`"${title}" added to the library.`);
    } catch (err) {
      console.error('Media upload failed:', err);
      showToast('Upload failed. Please try again.', true);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add to Library';
    }
  });

  grid.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      const item = items.find(x => x.id === editId);
      if (item) openModal(item);
      return;
    }

    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    if (!deleteId) return;

    const item = items.find(x => x.id === deleteId);
    if (!item) return;
    if (!confirm(`Remove "${item.name}" from the library?`)) return;

    try {
      const { errors } = await client.models.CloudFile.delete({ id: deleteId });
      if (errors?.length) throw new Error(errors[0].message);
      if (!isExternal(item.url)) {
        remove({ path: item.url }).catch(err => console.warn('S3 object not removed:', err));
      }
      showToast(`"${item.name}" removed.`);
    } catch (err) {
      console.error('Failed to remove media item:', err);
      showToast("Couldn't remove that item.", true);
    }
  });
});
