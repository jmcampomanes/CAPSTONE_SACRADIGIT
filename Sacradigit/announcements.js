/* ============================================
   SacraDigit Admin — Announcements Scripts (AWS Amplify)
   Backed by the Announcement model. Media files
   (images/videos) upload to S3 via Amplify Storage
   under announcements/{filename}.

   The Storage bucket is private (guest IAM grants via
   the Cognito identity pool, not public HTTP read), so
   a bare S3 path can never be used directly as an <img>
   src — it has to be exchanged for a temporary signed
   URL via getUrl() first. That resolution happens at
   render time (not at upload time) and is cached briefly,
   since signed URLs expire and announcements can be
   viewed long after they were uploaded.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData, getUrl } from 'aws-amplify/storage';

document.addEventListener('DOMContentLoaded', () => {

  let announcements = []; // kept in sync via observeQuery, each has .id

  const grid              = document.getElementById('announcements-grid');
  const announcementsEmpty  = document.getElementById('announcements-empty');
  const announcementsCount  = document.getElementById('announcements-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatShortDate(input) {
    if (!input) return '';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function audienceClass(audience) {
    return audience === 'All Parishioners' ? 'all' : 'ministry';
  }

  /* Resolve a stored S3 path into a real, fetchable URL.
     Caches each resolved URL for ~55 minutes (signed URLs
     here are issued for 1 hour) so re-renders (observeQuery
     fires on every change) don't re-sign the same path
     repeatedly. Already-resolved URLs (http/data/blob — e.g.
     a local FileReader preview that hasn't been uploaded
     yet) are passed through untouched. */
  const mediaUrlCache = new Map(); // path -> { url, expiresAt }

  async function resolveMediaUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/.test(path)) return path;

    const cached = mediaUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    try {
      const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
      const resolved = url.toString();
      mediaUrlCache.set(path, { url: resolved, expiresAt: Date.now() + 55 * 60 * 1000 });
      return resolved;
    } catch (err) {
      console.error(`Failed to resolve media URL for "${path}":`, err);
      return '';
    }
  }


  /* --- Live data --- */
  client.models.Announcement.observeQuery().subscribe({
    next: ({ items }) => {
      announcements = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderGrid();
    },
    error: (err) => {
      console.error('Failed to load announcements:', err);
      showToast("Couldn't load announcements from the database.", true);
    },
  });


  /* ------------------------------------------
     1. RENDER — Announcement card grid
  ------------------------------------------ */
  let renderToken = 0;

  async function renderGrid() {
    const myToken = ++renderToken;

    const publishedCount = announcements.filter(a => a.published).length;
    announcementsCount.textContent = `${publishedCount} published`;

    if (announcements.length === 0) {
      grid.innerHTML = '';
      announcementsEmpty.classList.remove('hidden');
      return;
    }
    announcementsEmpty.classList.add('hidden');

    // Only the first media item of each card is ever shown as a
    // thumbnail, so that's the only one worth resolving here.
    const firstMediaUrls = await Promise.all(announcements.map(async (a) => {
      const media = a.media ? JSON.parse(a.media) : [];
      const first = media[0];
      return first ? resolveMediaUrl(first.url) : '';
    }));

    // A newer render started while these URLs were resolving — bail
    // out so a stale (possibly reordered) grid never gets painted.
    if (myToken !== renderToken) return;

    grid.innerHTML = announcements.map((a, i) => {
      const statusActions = a.published
        ? `<button type="button" class="ann-action-btn ann-unpublish" data-id="${a.id}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>
            Unpublish
          </button>`
        : `<button type="button" class="ann-action-btn ann-republish" data-id="${a.id}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Republish
          </button>`;

      const media = a.media ? JSON.parse(a.media) : [];
      const firstMedia = media[0];
      const firstMediaUrl = firstMediaUrls[i];
      let mediaHtml = '';
      if (firstMedia && firstMediaUrl) {
        const thumb = firstMedia.type === 'video'
          ? `<video class="announcement-image" src="${firstMediaUrl}" muted></video><span class="announcement-video-badge"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>`
          : `<img class="announcement-image" src="${firstMediaUrl}" alt="${escapeHtml(a.title)}" />`;
        mediaHtml = `
          <div class="announcement-image-wrap">
            ${thumb}
            ${media.length > 1 ? `<span class="announcement-media-count">+${media.length - 1} more</span>` : ''}
          </div>
        `;
      }

      return `
        <div class="announcement-card ${a.published ? '' : 'unpublished'} audience-${audienceClass(a.audience)}">
          ${a.published ? '' : '<span class="ann-status-ribbon">Unpublished</span>'}
          ${mediaHtml}
          <div class="announcement-top">
            <p class="announcement-title">${escapeHtml(a.title)}</p>
          </div>
          <p class="announcement-excerpt">${escapeHtml(a.body)}</p>
          <div class="announcement-meta">
            <span class="announcement-date">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${formatShortDate(a.createdAt)}
            </span>
            <span class="audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          </div>
          <div class="announcement-actions">
            <button type="button" class="ann-action-btn ann-edit" data-id="${a.id}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit
            </button>
            ${statusActions}
            <button type="button" class="ann-action-btn ann-delete" data-id="${a.id}" aria-label="Delete announcement" title="Delete announcement">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', async (e) => {
    const editBtn       = e.target.closest('.ann-edit');
    const unpublishBtn   = e.target.closest('.ann-unpublish');
    const republishBtn   = e.target.closest('.ann-republish');
    const deleteBtn      = e.target.closest('.ann-delete');

    if (editBtn) openEditModal(editBtn.dataset.id);

    if (unpublishBtn) openUnpublishModal(unpublishBtn.dataset.id);

    if (deleteBtn) openDeleteModal(deleteBtn.dataset.id);

    if (republishBtn) {
      const a = announcements.find(x => x.id === republishBtn.dataset.id);
      try {
        const result = await client.models.Announcement.update({ id: republishBtn.dataset.id, published: true });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${a ? a.title : 'Announcement'}" republished.`);
      } catch (err) {
        console.error(err);
        showToast(err.message || "Couldn't republish.", true);
      }
    }
  });


  /* ------------------------------------------
     2. NEW / EDIT ANNOUNCEMENT MODAL
  ------------------------------------------ */
  const modal          = document.getElementById('announcement-modal');
  const modalTitle       = document.getElementById('announcement-modal-title');
  const submitBtn         = document.getElementById('announcement-submit');
  const titleInput          = document.getElementById('ann-title');
  const bodyInput            = document.getElementById('ann-body');
  const audienceSelect        = document.getElementById('ann-audience');

  const dropzone            = document.getElementById('ann-dropzone');
  const mediaInput            = document.getElementById('ann-media-input');
  const mediaGrid                = document.getElementById('ann-media-grid');

  let editTargetId = null;
  // Each item: { type, name, url (existing, uploaded) OR file (new, pending upload), previewUrl }
  let currentMedia = [];

  function renderMediaGrid() {
    mediaGrid.innerHTML = currentMedia.map((m, i) => `
      <div class="ann-media-item" data-index="${i}">
        ${m.type === 'video'
          ? `<video src="${m.previewUrl}" muted></video><span class="media-video-badge"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>`
          : `<img src="${m.previewUrl}" alt="${escapeHtml(m.name)}" />`}
        <button type="button" class="ann-media-remove" data-index="${i}" aria-label="Remove ${escapeHtml(m.name)}">×</button>
      </div>
    `).join('');
  }

  function handleMediaFiles(files) {
    Array.from(files).forEach(file => {
      const isImage = ['image/png', 'image/jpeg'].includes(file.type);
      const isVideo = ['video/mp4', 'video/webm'].includes(file.type);

      if (!isImage && !isVideo) {
        showToast(`"${file.name}" isn't a supported image or video type.`, true);
        return;
      }
      const maxSize = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(`"${file.name}" is too large (max ${isVideo ? '20 MB for videos' : '5 MB for images'}).`, true);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        currentMedia.push({ type: isVideo ? 'video' : 'image', file, name: file.name, previewUrl: reader.result });
        renderMediaGrid();
      };
      reader.readAsDataURL(file);
    });
  }

  mediaInput.addEventListener('change', () => {
    if (mediaInput.files.length > 0) handleMediaFiles(mediaInput.files);
    mediaInput.value = '';
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
      handleMediaFiles(e.dataTransfer.files);
    }
  });

  mediaGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.ann-media-remove');
    if (!btn) return;
    currentMedia.splice(parseInt(btn.dataset.index, 10), 1);
    renderMediaGrid();
  });

  document.getElementById('btn-new-announcement').addEventListener('click', () => {
    editTargetId = null;
    modalTitle.textContent = 'New Announcement';
    submitBtn.textContent = 'Publish Now';
    titleInput.value = '';
    bodyInput.value = '';
    audienceSelect.value = 'All Parishioners';
    currentMedia = [];
    renderMediaGrid();
    openModal(modal);
  });

  async function openEditModal(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    editTargetId = id;
    modalTitle.textContent = 'Edit Announcement';
    submitBtn.textContent = 'Save Changes';
    titleInput.value = a.title;
    bodyInput.value = a.body;
    audienceSelect.value = a.audience;
    // Existing media items store a bare S3 path in `.url` (kept as-is
    // so it round-trips back to the model unchanged on save) — resolve
    // a real signed URL for `.previewUrl` so the thumbnail actually
    // displays. New items added in this session get a `file` instead
    // until they're uploaded on save, and already have a usable
    // `previewUrl` from the local FileReader preview.
    const existingMedia = a.media ? JSON.parse(a.media) : [];
    currentMedia = await Promise.all(
      existingMedia.map(async (m) => ({ ...m, previewUrl: await resolveMediaUrl(m.url) }))
    );
    renderMediaGrid();
    openModal(modal);
  }

  async function uploadPendingMedia(mediaList) {
    const uploaded = [];
    for (const m of mediaList) {
      if (m.url) {
        // Already uploaded (kept from a previous edit)
        uploaded.push({ type: m.type, url: m.url, name: m.name });
        continue;
      }

      const path = `announcements/${Date.now()}_${m.name}`;
      await uploadData({ path, data: m.file }).result;

      // Store the bare S3 path, not a resolved URL — the bucket is
      // private, so signed URLs (from getUrl(), see resolveMediaUrl
      // above) expire and must be regenerated at render/edit time,
      // not baked in permanently at upload time.
      uploaded.push({ type: m.type, url: path, name: m.name });
    }
    return uploaded;
  }

  submitBtn.addEventListener('click', async () => {
    const title    = titleInput.value.trim();
    const body      = bodyInput.value.trim();
    const audience   = audienceSelect.value;

    if (!title || !body) {
      showToast('Please fill in both title and body.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const media = JSON.stringify(await uploadPendingMedia(currentMedia));

      if (editTargetId !== null) {
        const result = await client.models.Announcement.update({ id: editTargetId, title, body, audience, media });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${title}" updated.`);
      } else {
        const result = await client.models.Announcement.create({ title, body, audience, media, published: true });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${title}" published.`);
      }
      closeModal(modal);
    } catch (err) {
      console.error('Failed to save announcement:', err);
      showToast(err.message || "Couldn't save the announcement.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editTargetId !== null ? 'Save Changes' : 'Publish Now';
    }
  });


  /* ------------------------------------------
     3. UNPUBLISH CONFIRMATION MODAL
  ------------------------------------------ */
  const unpublishModal      = document.getElementById('unpublish-modal');
  const unpublishTargetTitle = document.getElementById('unpublish-target-title');
  let unpublishTargetId = null;

  function openUnpublishModal(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    unpublishTargetId = id;
    unpublishTargetTitle.textContent = a.title;
    openModal(unpublishModal);
  }

  document.getElementById('unpublish-confirm-submit').addEventListener('click', async () => {
    if (unpublishTargetId === null) return;
    const a = announcements.find(x => x.id === unpublishTargetId);

    try {
      const result = await client.models.Announcement.update({ id: unpublishTargetId, published: false });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(unpublishModal);
      showToast(`"${a ? a.title : 'Announcement'}" unpublished.`);
      unpublishTargetId = null;
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't unpublish.", true);
    }
  });


  /* ------------------------------------------
     3b. DELETE CONFIRMATION MODAL
     Permanently removes the record. Note: this does
     NOT delete the announcement's uploaded media from
     S3 — only the database record — matching how
     deletes work elsewhere in the admin (e.g. Cloud
     Access), which are metadata-only deletes.
  ------------------------------------------ */
  const deleteModal      = document.getElementById('delete-modal');
  const deleteTargetTitle = document.getElementById('delete-target-title');
  let deleteTargetId = null;

  function openDeleteModal(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    deleteTargetId = id;
    deleteTargetTitle.textContent = a.title;
    openModal(deleteModal);
  }

  document.getElementById('delete-confirm-submit').addEventListener('click', async () => {
    if (deleteTargetId === null) return;
    const a = announcements.find(x => x.id === deleteTargetId);
    const btn = document.getElementById('delete-confirm-submit');

    btn.disabled = true;
    try {
      const result = await client.models.Announcement.delete({ id: deleteTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(deleteModal);
      showToast(`"${a ? a.title : 'Announcement'}" deleted.`);
      deleteTargetId = null;
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't delete the announcement.", true);
    } finally {
      btn.disabled = false;
    }
  });


  /* ------------------------------------------
     4. MODAL HELPERS (open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(modal); closeModal(unpublishModal); closeModal(deleteModal); });
  });

  [modal, unpublishModal, deleteModal].forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(modal); closeModal(unpublishModal); closeModal(deleteModal); }
  });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }


  /* ------------------------------------------
     5. TOAST NOTIFICATIONS
  ------------------------------------------ */
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

});