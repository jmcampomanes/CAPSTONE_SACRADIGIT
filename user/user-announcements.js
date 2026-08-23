/* ============================================
   SacraDigit — User Announcements Scripts (AWS Amplify)
   Runs after user-shell.js.

   Announcement media (images/videos) lives in a private
   Storage bucket — the record only holds a bare S3 path,
   which has to be exchanged for a temporary signed URL
   via getUrl() before it can be used as an <img>/<video>
   src. Resolution happens at render time and is cached
   briefly, mirroring the same fix applied to the admin
   Announcements page.
   ============================================ */

import { client } from '../amplify-init.js';
import { getUrl } from 'aws-amplify/storage';

document.addEventListener('DOMContentLoaded', () => {

  let announcements = [];

  const grid         = document.getElementById('ann-grid');
  const annEmpty      = document.getElementById('ann-empty');
  const resultsLabel   = document.getElementById('results-label');
  const searchInput     = document.getElementById('search-input');
  const audienceFilter   = document.getElementById('audience-filter');
  const clearBtn          = document.getElementById('btn-clear');

  const detailModal = document.getElementById('detail-modal');
  const detailTitle  = document.getElementById('detail-title');
  const detailBody    = document.getElementById('detail-body');
  const detailAudience = document.getElementById('detail-audience');
  const detailDate      = document.getElementById('detail-date');
  const detailMediaGrid  = document.getElementById('detail-media-grid');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatDate(input) {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function formatShort(input) {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function audienceClass(audience) {
    return audience === 'All Parishioners' ? 'all' : 'ministry';
  }

  /* Resolve a stored S3 path into a real, fetchable URL,
     cached for ~55 minutes (signed URLs here are issued
     for 1 hour) so re-renders don't re-sign the same
     path repeatedly. */
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

  client.models.Announcement.observeQuery({ filter: { published: { eq: true } } }).subscribe({
    next: ({ items }) => {
      announcements = items;
      renderGrid();
    },
    error: (err) => {
      console.error('Failed to load announcements:', err);
      window.showToast?.("Couldn't load announcements.", true);
    },
  });

  let renderToken = 0;

  async function renderGrid() {
    const myToken = ++renderToken;

    const query   = searchInput.value.trim().toLowerCase();
    const audience = audienceFilter.value;

    const filtered = announcements.filter(a => {
      const matchQuery   = !query || a.title.toLowerCase().includes(query) || a.body.toLowerCase().includes(query);
      const matchAudience = !audience || a.audience === audience;
      return matchQuery && matchAudience;
    });

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    resultsLabel.textContent = `${filtered.length} announcement${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      annEmpty.classList.remove('hidden');
      return;
    }
    annEmpty.classList.add('hidden');

    // Only the first media item of each card is shown as a thumbnail,
    // so that's the only one worth resolving here.
    const firstMediaUrls = await Promise.all(filtered.map(async (a) => {
      const media = a.media ? JSON.parse(a.media) : [];
      const first = media[0];
      return first ? resolveMediaUrl(first.url) : '';
    }));

    // A newer render started while these URLs were resolving (e.g. the
    // user kept typing in the search box) — discard this stale pass.
    if (myToken !== renderToken) return;

    grid.innerHTML = filtered.map((a, i) => {
      const media = a.media ? JSON.parse(a.media) : [];
      const firstMedia = media[0];
      const firstMediaUrl = firstMediaUrls[i];
      let mediaHtml = '';
      if (firstMedia && firstMediaUrl) {
        const thumb = firstMedia.type === 'video'
          ? `<video class="ann-card-image" src="${firstMediaUrl}" muted></video><span class="ann-card-video-badge"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>`
          : `<img class="ann-card-image" src="${firstMediaUrl}" alt="${escapeHtml(a.title)}" />`;
        mediaHtml = `
          <div class="ann-card-image-wrap">
            ${thumb}
            ${media.length > 1 ? `<span class="ann-card-media-count">+${media.length - 1} more</span>` : ''}
          </div>`;
      }

      return `
      <div class="ann-card audience-${audienceClass(a.audience)}" data-id="${a.id}" role="button" tabindex="0" aria-label="Read announcement: ${escapeHtml(a.title)}">
        ${mediaHtml}
        <p class="ann-card-title">${escapeHtml(a.title)}</p>
        <p class="ann-card-excerpt">${escapeHtml(a.body)}</p>
        <div class="ann-card-footer">
          <span class="ann-card-date">${formatShort(a.createdAt)}</span>
          <span class="ann-audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          <button type="button" class="ann-read-more" data-id="${a.id}">Read more ›</button>
        </div>
      </div>`;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.ann-card');
    if (!card) return;
    openDetail(card.dataset.id);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.ann-card');
      if (card) { e.preventDefault(); openDetail(card.dataset.id); }
    }
  });

  searchInput.addEventListener('input', renderGrid);
  audienceFilter.addEventListener('change', renderGrid);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    audienceFilter.value = '';
    renderGrid();
  });

  async function openDetail(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    detailTitle.textContent    = a.title;
    detailBody.textContent     = a.body;
    detailDate.textContent     = formatDate(a.createdAt);
    detailAudience.textContent = a.audience;
    detailAudience.className   = `ann-audience-tag ${audienceClass(a.audience)}`;

    detailMediaGrid.innerHTML = '';
    detailMediaGrid.classList.add('hidden');
    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const media = a.media ? JSON.parse(a.media) : [];
    if (media.length === 0) return;

    // Resolve every attachment for the full gallery (not just the
    // first, unlike the card thumbnail) — this is the modal the
    // parishioner is actually viewing the announcement's media in.
    const resolvedItems = await Promise.all(media.map(async (m) => ({ ...m, resolvedUrl: await resolveMediaUrl(m.url) })));

    // The parishioner may have closed the modal (or opened a
    // different announcement) while these were resolving.
    if (detailModal.classList.contains('hidden') || detailTitle.textContent !== a.title) return;

    const items = resolvedItems.filter(m => m.resolvedUrl);
    if (items.length === 0) return;

    detailMediaGrid.innerHTML = items.map(m => m.type === 'video'
      ? `<div class="ann-detail-media-item"><video src="${m.resolvedUrl}" controls></video></div>`
      : `<div class="ann-detail-media-item"><img src="${m.resolvedUrl}" alt="${escapeHtml(a.title)}" /></div>`
    ).join('');
    detailMediaGrid.classList.remove('hidden');
  }

  function closeDetail() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ------------------------------------------
     PHOTO LIGHTBOX — click a photo in the detail
     modal's media grid to view it full-size.
     Sits on top of the detail modal (which stays
     open behind it). Videos are left alone since
     they already have native playback controls.
  ------------------------------------------ */
  const photoLightbox   = document.getElementById('photo-lightbox');
  const lightboxImg       = document.getElementById('lightbox-img');
  const lightboxCloseBtn    = document.getElementById('lightbox-close');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    photoLightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    if (photoLightbox.classList.contains('hidden')) return;
    photoLightbox.classList.add('hidden');
    lightboxImg.src = '';
  }

  detailMediaGrid.addEventListener('click', (e) => {
    const img = e.target.closest('.ann-detail-media-item img');
    if (img) openLightbox(img.src, img.alt);
  });

  lightboxCloseBtn.addEventListener('click', closeLightbox);
  photoLightbox.addEventListener('click', (e) => { if (e.target === photoLightbox) closeLightbox(); });

  // Registered before the detail modal's own Escape listener below,
  // so closing the lightbox with Escape doesn't also close the
  // detail modal behind it in the same keypress.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !photoLightbox.classList.contains('hidden')) {
      closeLightbox();
      e.stopImmediatePropagation();
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeDetail));
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

});