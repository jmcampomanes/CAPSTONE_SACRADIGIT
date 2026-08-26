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

   Read-only: parishioners browse a simple card grid and
   open a bigger detail view with a photo/video carousel —
   no like/share/edit actions here.
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
     `eventDate` / `location` badges shown on the post card. Both
     shapes are normalized so every call site can just read
     `.items` / `.eventDate` / `.location`. */
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

  /* Split a body into paragraphs on blank lines (a single newline
     within a paragraph becomes a <br>), so the detail view reads
     like the multi-paragraph announcements admins actually write
     instead of one unbroken block of text. */
  function bodyParagraphsHtml(text) {
    return (text || '').split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  }

  const CALENDAR_ICON  = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
  const PIN_ICON       = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
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

    // Only the cover (first) item is needed for the card grid.
    const resolvedCovers = await Promise.all(filtered.map(async (a) => {
      const { items } = parseMediaField(a.media);
      if (items.length === 0) return null;
      const resolvedUrl = await resolveMediaUrl(items[0].url);
      return resolvedUrl ? { ...items[0], resolvedUrl } : null;
    }));

    // A newer render started while these URLs were resolving (e.g. the
    // user kept typing in the search box) — discard this stale pass.
    if (myToken !== renderToken) return;

    grid.innerHTML = filtered.map((a, i) => {
      const { items, eventDate, location } = parseMediaField(a.media);
      const cover = resolvedCovers[i];

      const coverHtml = cover
        ? (cover.type === 'video'
            ? `<video class="post-card-cover-media" src="${cover.resolvedUrl}" muted></video>`
            : `<img class="post-card-cover-media" src="${cover.resolvedUrl}" alt="${escapeHtml(a.title)}" />`)
        : `<div class="post-card-cover-placeholder">${MEGAPHONE_ICON}</div>`;

      return `
        <article class="post-card" data-id="${a.id}" role="button" tabindex="0" aria-label="Read announcement: ${escapeHtml(a.title)}">
          <div class="post-card-cover">
            ${coverHtml}
            ${items.length > 1 ? `<span class="post-card-media-count">${CAMERA_ICON}${items.length}</span>` : ''}
          </div>
          <div class="post-card-body">
            <p class="post-card-title">${escapeHtml(a.title)}</p>
            ${eventBarHtml(eventDate, location)}
            <p class="post-card-excerpt">${escapeHtml(a.body)}</p>
            <div class="post-card-meta">
              <span class="announcement-date">${CALENDAR_ICON}${formatShortDate(a.createdAt)}</span>
              <span class="ann-audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
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

  searchInput.addEventListener('input', renderGrid);
  audienceFilter.addEventListener('change', renderGrid);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    audienceFilter.value = '';
    renderGrid();
  });


  /* ------------------------------------------
     ANNOUNCEMENT DETAIL MODAL
     A big photo/video carousel (page counter,
     always-visible prev/next arrows, a "View"
     button that opens the full-size photo
     lightbox) plus title, complete body,
     audience, and date. Read-only.
  ------------------------------------------ */
  const detailModal      = document.getElementById('detail-modal');
  const detailMediaWrap    = document.getElementById('detail-media');
  const detailMediaScroll   = document.getElementById('detail-media-scroll');
  const detailCounter        = document.getElementById('detail-counter');
  const detailDots              = document.getElementById('detail-dots');
  const detailViewBtn              = document.getElementById('detail-view-btn');
  const detailNavPrev                 = document.getElementById('detail-nav-prev');
  const detailNavNext                    = document.getElementById('detail-nav-next');
  const detailTitle      = document.getElementById('detail-title');
  const detailBody        = document.getElementById('detail-body');
  const detailDate          = document.getElementById('detail-date');
  const detailAudience        = document.getElementById('detail-audience');
  const detailEventbar  = document.getElementById('detail-eventbar');
  const detailEventDateChip = document.getElementById('detail-event-date-chip');
  const detailEventDateText = document.getElementById('detail-event-date-text');
  const detailLocationChip  = document.getElementById('detail-location-chip');
  const detailLocationText  = document.getElementById('detail-location-text');

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
    detailAudience.className   = `ann-audience-tag ${audienceClass(a.audience)}`;

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

    // The parishioner may have closed the modal (or opened a different
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


  /* ------------------------------------------
     PHOTO LIGHTBOX — click a photo in the detail
     modal's carousel (or tap "View") to view it
     full-size. Sits on top of the detail modal
     (which stays open behind it). Videos are left
     alone since they already have native controls.
  ------------------------------------------ */
  const photoLightbox   = document.getElementById('photo-lightbox');
  const lightboxImg       = document.getElementById('lightbox-img');
  const lightboxCloseBtn    = document.getElementById('lightbox-close');

  function openLightbox(src, alt) {
    if (!src) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    photoLightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    if (photoLightbox.classList.contains('hidden')) return;
    photoLightbox.classList.add('hidden');
    lightboxImg.src = '';
  }

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


  /* ------------------------------------------
     MODAL HELPERS (open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(detailModal)));
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeModal(detailModal); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(detailModal); });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }

});