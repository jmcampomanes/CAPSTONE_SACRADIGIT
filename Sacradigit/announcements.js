/* ============================================
   SacraDigit Admin — Announcements Scripts (AWS Amplify)
   Backed by the Announcement model. Media files
   (images/videos) upload to S3 via Amplify Storage
   under announcements/{filename}.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

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
  function renderGrid() {
    const publishedCount = announcements.filter(a => a.published).length;
    announcementsCount.textContent = `${publishedCount} published`;

    if (announcements.length === 0) {
      grid.innerHTML = '';
      announcementsEmpty.classList.remove('hidden');
      return;
    }
    announcementsEmpty.classList.add('hidden');

    grid.innerHTML = announcements.map((a) => {
      const statusActions = a.published
        ? `<button type="button" class="ann-unpublish" data-id="${a.id}">Unpublish</button>`
        : `<button type="button" class="ann-republish" data-id="${a.id}">Republish</button>`;

      const media = a.media ? JSON.parse(a.media) : [];
      const firstMedia = media[0];
      let mediaHtml = '';
      if (firstMedia) {
        const thumb = firstMedia.type === 'video'
          ? `<video class="announcement-image" src="${firstMedia.url}" muted></video><span class="announcement-video-badge"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>`
          : `<img class="announcement-image" src="${firstMedia.url}" alt="${escapeHtml(a.title)}" />`;
        mediaHtml = `
          <div class="announcement-image-wrap">
            ${thumb}
            ${media.length > 1 ? `<span class="announcement-media-count">+${media.length - 1} more</span>` : ''}
          </div>
        `;
      }

      return `
        <div class="announcement-card ${a.published ? '' : 'unpublished'}">
          ${mediaHtml}
          <div class="announcement-top">
            <p class="announcement-title">${escapeHtml(a.title)}</p>
          </div>
          <p class="announcement-excerpt">${escapeHtml(a.body)}</p>
          <div class="announcement-meta">
            <span class="announcement-date">${formatShortDate(a.createdAt)}</span>
            <span class="audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          </div>
          <div class="announcement-actions">
            <button type="button" class="ann-edit" data-id="${a.id}">Edit</button>
            ${statusActions}
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', async (e) => {
    const editBtn       = e.target.closest('.ann-edit');
    const unpublishBtn   = e.target.closest('.ann-unpublish');
    const republishBtn   = e.target.closest('.ann-republish');

    if (editBtn) openEditModal(editBtn.dataset.id);

    if (unpublishBtn) openUnpublishModal(unpublishBtn.dataset.id);

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

  function openEditModal(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    editTargetId = id;
    modalTitle.textContent = 'Edit Announcement';
    submitBtn.textContent = 'Save Changes';
    titleInput.value = a.title;
    bodyInput.value = a.body;
    audienceSelect.value = a.audience;
    // Existing media already has an S3 url; new items added in this
    // session get a `file` instead until they're uploaded on save.
    currentMedia = (a.media ? JSON.parse(a.media) : []).map(m => ({ ...m, previewUrl: m.url }));
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

      // Public URL pattern for an S3 object served via the bucket's
      // public read access (configured in amplify/storage/resource.ts).
      // If your bucket isn't public, swap this for getUrl({ path })
      // from 'aws-amplify/storage' to get a signed URL instead.
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
     4. MODAL HELPERS (open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(modal); closeModal(unpublishModal); });
  });

  [modal, unpublishModal].forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(modal); closeModal(unpublishModal); }
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