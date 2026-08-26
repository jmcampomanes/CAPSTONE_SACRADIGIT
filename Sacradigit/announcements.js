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

  /* Parse the `media` AWSJSON field. Older records stored a bare
     array of {type,url,name} items; newer records store an object
     carrying that same array under `.items` plus the optional
     `eventDate` / `location` badges shown on the trendy post card.
     Both shapes are normalized to one return value so every call
     site can just read `.items` / `.eventDate` / `.location`. */
  function parseMediaField(raw) {
    if (!raw) return { items: [], eventDate: '', location: '' };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { items: [], eventDate: '', location: '' }; }
    if (Array.isArray(parsed)) return { items: parsed, eventDate: '', location: '' };
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      eventDate: parsed.eventDate || '',
      location: parsed.location || '',
    };
  }

  function formatEventDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  const CALENDAR_ICON = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
  const PIN_ICON      = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
  const MEGAPHONE_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>';
  const CAMERA_ICON    = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3.5" stroke-width="2"/></svg>';

  function eventBarHtml(eventDate, location) {
    if (!eventDate && !location) return '';
    return `
      <div class="social-post-eventbar">
        ${eventDate ? `<span class="chip chip-date">${CALENDAR_ICON}${formatEventDate(eventDate)}</span>` : ''}
        ${location ? `<span class="chip chip-location">${PIN_ICON}${escapeHtml(location)}</span>` : ''}
      </div>`;
  }

  /* Split a body into paragraphs on blank lines (a single newline
     within a paragraph becomes a <br>), so the detail view reads
     like the multi-paragraph announcements admins actually write
     instead of one unbroken block of text. */
  function bodyParagraphsHtml(text) {
    return (text || '').split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
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


  /* ------------------------------------------
     PHOTO LIGHTBOX — click a photo (list card
     thumbnail or a media item in the New/Edit
     composer) to view it full-size. Videos are
     left alone; only <img> tags are wired.
  ------------------------------------------ */
  const photoLightbox   = document.getElementById('photo-lightbox');
  const lightboxImg       = document.getElementById('lightbox-img');
  const lightboxCloseBtn    = document.getElementById('lightbox-close');

  function openLightbox(src, alt) {
    if (!src) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    photoLightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (photoLightbox.classList.contains('hidden')) return;
    photoLightbox.classList.add('hidden');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  lightboxCloseBtn.addEventListener('click', closeLightbox);
  photoLightbox.addEventListener('click', (e) => { if (e.target === photoLightbox) closeLightbox(); });

  // Registered before the other modals' Escape listener below, so
  // closing the lightbox with Escape doesn't also close whatever
  // modal (if any) sits behind it in the same keypress.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !photoLightbox.classList.contains('hidden')) {
      closeLightbox();
      e.stopImmediatePropagation();
    }
  });


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

    // Every media item is resolved up front (not just the first) so
    // the post's photo/video carousel can swipe through all of them
    // without a signed-URL round trip mid-scroll.
    const resolvedMedia = await Promise.all(announcements.map(async (a) => {
      const { items } = parseMediaField(a.media);
      const urls = await Promise.all(items.map(m => resolveMediaUrl(m.url)));
      return items.map((m, i) => ({ ...m, resolvedUrl: urls[i] })).filter(m => m.resolvedUrl);
    }));

    // A newer render started while these URLs were resolving — bail
    // out so a stale (possibly reordered) grid never gets painted.
    if (myToken !== renderToken) return;

    grid.innerHTML = announcements.map((a, i) => {
      const statusActions = a.published
        ? `<button type="button" class="post-icon-btn ann-unpublish" data-id="${a.id}" title="Unpublish">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>
            <span>Unpublish</span>
          </button>`
        : `<button type="button" class="post-icon-btn ann-republish" data-id="${a.id}" title="Republish">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            <span>Republish</span>
          </button>`;

      const { eventDate, location } = parseMediaField(a.media);
      const media = resolvedMedia[i];
      const cover = media[0];

      const coverHtml = cover
        ? (cover.type === 'video'
            ? `<video class="post-card-cover-media" src="${cover.resolvedUrl}" muted></video>`
            : `<img class="post-card-cover-media" src="${cover.resolvedUrl}" alt="${escapeHtml(a.title)}" />`)
        : `<div class="post-card-cover-placeholder">${MEGAPHONE_ICON}</div>`;

      const statusBadge = a.published
        ? `<span class="post-status-badge live">Live</span>`
        : `<span class="post-status-badge draft">Unpublished</span>`;

      return `
        <article class="post-card ${a.published ? '' : 'unpublished'}" data-id="${a.id}" role="button" tabindex="0" aria-label="View announcement: ${escapeHtml(a.title)}">
          <div class="post-card-cover">
            ${coverHtml}
            ${statusBadge}
            ${media.length > 1 ? `<span class="post-card-media-count">${CAMERA_ICON}${media.length}</span>` : ''}
          </div>
          <div class="post-card-body">
            <p class="post-card-title">${escapeHtml(a.title)}</p>
            ${eventBarHtml(eventDate, location)}
            <p class="post-card-excerpt">${escapeHtml(a.body)}</p>
            <div class="post-card-meta">
              <span class="announcement-date">${CALENDAR_ICON}${formatShortDate(a.createdAt)}</span>
              <span class="audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
            </div>
          </div>
          <div class="post-card-footer">
            <button type="button" class="post-icon-btn ann-edit" data-id="${a.id}" title="Edit">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span>Edit</span>
            </button>
            ${statusActions}
            <button type="button" class="post-icon-btn ann-delete" data-id="${a.id}" title="Delete">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/></svg>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  grid.addEventListener('click', async (e) => {
    const editBtn       = e.target.closest('.ann-edit');
    const unpublishBtn   = e.target.closest('.ann-unpublish');
    const republishBtn   = e.target.closest('.ann-republish');
    const deleteBtn      = e.target.closest('.ann-delete');

    if (editBtn) { openEditModal(editBtn.dataset.id); return; }

    if (unpublishBtn) { openUnpublishModal(unpublishBtn.dataset.id); return; }

    if (deleteBtn) { openDeleteModal(deleteBtn.dataset.id); return; }

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
      return;
    }

    // Click landed anywhere else on the card — open the full post
    // detail view (with its own full-size photo/video carousel).
    const card = e.target.closest('.post-card');
    if (card) openDetailModal(card.dataset.id);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.post-card');
    if (card && e.target === card) {
      e.preventDefault();
      openDetailModal(card.dataset.id);
    }
  });


  /* ------------------------------------------
     1b. ANNOUNCEMENT DETAIL MODAL
     Full post preview — a big photo/video carousel
     (page counter, always-visible prev/next arrows,
     a "View" button that opens the full-size photo
     lightbox) plus title, complete body, audience,
     date, status, and the Edit/Unpublish actions.
  ------------------------------------------ */
  const detailModal      = document.getElementById('detail-modal');
  const detailMediaWrap     = document.getElementById('detail-media');
  const detailMediaScroll    = document.getElementById('detail-media-scroll');
  const detailCounter          = document.getElementById('detail-counter');
  const detailDots                = document.getElementById('detail-dots');
  const detailViewBtn                = document.getElementById('detail-view-btn');
  const detailNavPrev                   = document.getElementById('detail-nav-prev');
  const detailNavNext                      = document.getElementById('detail-nav-next');
  const detailTitle        = document.getElementById('detail-title');
  const detailBody          = document.getElementById('detail-body');
  const detailDate            = document.getElementById('detail-date');
  const detailAudience          = document.getElementById('detail-audience');
  const detailStatus              = document.getElementById('detail-status');
  const detailEventbar    = document.getElementById('detail-eventbar');
  const detailEventDateChip = document.getElementById('detail-event-date-chip');
  const detailEventDateText = document.getElementById('detail-event-date-text');
  const detailLocationChip  = document.getElementById('detail-location-chip');
  const detailLocationText  = document.getElementById('detail-location-text');
  const detailEditBtn       = document.getElementById('detail-edit-btn');
  const detailUnpublishBtn  = document.getElementById('detail-unpublish-btn');

  let detailMedia = []; // resolved {type,url,name,resolvedUrl} items for the open post
  let detailAnnId = null;

  async function openDetailModal(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    detailAnnId = id;

    detailTitle.textContent    = a.title;
    detailBody.innerHTML       = bodyParagraphsHtml(a.body);
    detailDate.textContent     = formatShortDate(a.createdAt);
    detailAudience.textContent = a.audience;
    detailAudience.className   = `audience-tag ${audienceClass(a.audience)}`;
    detailStatus.textContent   = a.published ? '' : 'Unpublished';
    detailStatus.className     = `ann-detail-status-badge ${a.published ? 'hidden' : ''}`;

    detailUnpublishBtn.dataset.id = id;
    detailUnpublishBtn.querySelector('span').textContent = a.published ? 'Unpublish' : 'Republish';
    detailUnpublishBtn.classList.toggle('ann-unpublish', a.published);
    detailUnpublishBtn.classList.toggle('ann-republish', !a.published);

    const { items: media, eventDate, location } = parseMediaField(a.media);
    detailEventDateChip.classList.toggle('hidden', !eventDate);
    detailEventDateText.textContent = eventDate ? formatEventDate(eventDate) : '';
    detailLocationChip.classList.toggle('hidden', !location);
    detailLocationText.textContent = location || '';
    detailEventbar.classList.toggle('hidden', !eventDate && !location);

    detailMedia = [];
    detailMediaScroll.innerHTML = '';
    detailMediaWrap.classList.add('hidden');
    openModal(detailModal);

    if (media.length === 0) return;

    // Resolve every attachment for the full carousel here (the card
    // cover thumbnail only ever resolves the first one).
    const resolvedItems = await Promise.all(media.map(async (m) => ({ ...m, resolvedUrl: await resolveMediaUrl(m.url) })));

    // The admin may have closed the modal (or opened a different
    // announcement) while these were resolving.
    if (detailModal.classList.contains('hidden') || detailAnnId !== id) return;

    const items = resolvedItems.filter(m => m.resolvedUrl);
    if (items.length === 0) return;

    detailMedia = items;
    renderDetailMedia();
    detailMediaWrap.classList.remove('hidden');
  }

  function renderDetailMedia() {
    const multi = detailMedia.length > 1;
    detailMediaScroll.innerHTML = detailMedia.map(m => `
      <div class="post-detail-media-slide">
        ${m.type === 'video'
          ? `<video class="post-detail-media-el" src="${m.resolvedUrl}" controls></video>`
          : `<img class="post-detail-media-el" src="${m.resolvedUrl}" alt="${escapeHtml(detailTitle.textContent)}" />`}
      </div>`).join('');
    detailMediaScroll.scrollLeft = 0;

    detailCounter.classList.toggle('hidden', !multi);
    detailCounter.textContent = multi ? `1/${detailMedia.length}` : '';
    detailNavPrev.classList.toggle('hidden', !multi);
    detailNavNext.classList.toggle('hidden', !multi);
    detailDots.innerHTML = multi
      ? detailMedia.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('')
      : '';
  }

  // Keep the counter + dots in sync with free scrolling/swiping, not
  // just button clicks.
  detailMediaScroll.addEventListener('scroll', () => {
    if (detailMedia.length < 2) return;
    const index = Math.round(detailMediaScroll.scrollLeft / detailMediaScroll.clientWidth);
    detailCounter.textContent = `${index + 1}/${detailMedia.length}`;
    detailDots.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === index));
  });

  detailNavPrev.addEventListener('click', () => {
    detailMediaScroll.scrollBy({ left: -detailMediaScroll.clientWidth, behavior: 'smooth' });
  });
  detailNavNext.addEventListener('click', () => {
    detailMediaScroll.scrollBy({ left: detailMediaScroll.clientWidth, behavior: 'smooth' });
  });

  detailDots.addEventListener('click', (e) => {
    const dot = e.target.closest('.dot');
    if (!dot) return;
    detailMediaScroll.scrollTo({ left: Number(dot.dataset.index) * detailMediaScroll.clientWidth, behavior: 'smooth' });
  });

  // Clicking a photo directly (not just the "View" button) also opens
  // the full-size lightbox. Videos already have native controls.
  detailMediaScroll.addEventListener('click', (e) => {
    const img = e.target.closest('.post-detail-media-el');
    if (img && img.tagName === 'IMG') openLightbox(img.src, img.alt);
  });

  detailViewBtn.addEventListener('click', () => {
    if (detailMedia.length === 0) return;
    const index = Math.round(detailMediaScroll.scrollLeft / detailMediaScroll.clientWidth);
    const item = detailMedia[index];
    if (item && item.type !== 'video') openLightbox(item.resolvedUrl, detailTitle.textContent);
  });

  detailEditBtn.addEventListener('click', () => {
    if (!detailAnnId) return;
    closeModal(detailModal);
    openEditModal(detailAnnId);
  });

  detailUnpublishBtn.addEventListener('click', async () => {
    if (!detailAnnId) return;
    const a = announcements.find(x => x.id === detailAnnId);
    if (!a) return;
    if (a.published) {
      closeModal(detailModal);
      openUnpublishModal(detailAnnId);
      return;
    }
    try {
      const result = await client.models.Announcement.update({ id: detailAnnId, published: true });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      showToast(`"${a.title}" republished.`);
      closeModal(detailModal);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't republish.", true);
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
  const eventDateInput          = document.getElementById('ann-event-date');
  const locationInput             = document.getElementById('ann-location');

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
    if (btn) {
      currentMedia.splice(parseInt(btn.dataset.index, 10), 1);
      renderMediaGrid();
      return;
    }
    const img = e.target.closest('.ann-media-item img');
    if (img) openLightbox(img.src, img.alt);
  });

  document.getElementById('btn-new-announcement').addEventListener('click', () => {
    editTargetId = null;
    modalTitle.textContent = 'New Announcement';
    submitBtn.textContent = 'Publish Now';
    titleInput.value = '';
    bodyInput.value = '';
    audienceSelect.value = 'All Parishioners';
    eventDateInput.value = '';
    locationInput.value = '';
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
    const { items: existingMedia, eventDate, location } = parseMediaField(a.media);
    eventDateInput.value = eventDate || '';
    locationInput.value = location || '';
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
    const eventDate    = eventDateInput.value;
    const location       = locationInput.value.trim();

    if (!title || !body) {
      showToast('Please fill in both title and body.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const items = await uploadPendingMedia(currentMedia);
      const media = JSON.stringify({ items, eventDate, location });

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
    btn.addEventListener('click', () => { closeModal(modal); closeModal(unpublishModal); closeModal(deleteModal); closeModal(detailModal); });
  });

  [modal, unpublishModal, deleteModal, detailModal].forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(modal); closeModal(unpublishModal); closeModal(deleteModal); closeModal(detailModal); }
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