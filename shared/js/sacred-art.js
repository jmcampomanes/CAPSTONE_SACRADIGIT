/* ============================================
   SacraDigit — Sacred Art Rotator
   A small gallery of real, public-domain medieval and
   Byzantine devotional artworks — the Hagia Sophia Deësis
   mosaic (Christ Pantocrator with the Virgin Mary and John
   the Baptist), Duccio's Maestà, the Good
   Shepherd mosaic from the Mausoleum of Galla Placidia,
   Pieter Bruegel the Elder's The Fall of the Rebel Angels
   (Saint Michael), and Leonardo da Vinci's The Last Supper.
   Each piece is a genuine photograph of a centuries-old work
   of art, stored locally as a static image — nothing here is
   a live external fetch. All five are landscape-oriented so
   they fill the wide banner frames cleanly.

   Any element on the page marked with the [data-sacred-art]
   attribute becomes a rotating backdrop: the piece currently
   showing slowly zooms/drifts (a soft "Ken Burns" motion), and
   the whole set advances to the next piece every 3 hours. The
   active piece is chosen from the wall-clock hour, not from how
   long the page has been open, so every open tab — and every
   visitor — sees the same artwork change together.
   ============================================ */

// Image paths resolve relative to this script (import.meta.url), so the
// art loads correctly from any page that imports it — admin, media, or
// user side.
export const SACRED_ART = [
  {
    id: 'christ-pantocrator',
    title: 'Christ Pantocrator with the Virgin Mary and John the Baptist — Deësis mosaic, Hagia Sophia (13th century)',
    src: new URL('../../sacradigit-images/sacred-art/christ-pantocrator (1).jpg', import.meta.url).href,
    credit: { by: 'Photograph: Myrabella', license: 'Public domain', url: 'https://commons.wikimedia.org/wiki/File:Deesis_mosaic_Hagia_Sophia.jpg' },
  },
  {
    id: 'maesta',
    title: 'Maestà — Duccio di Buoninsegna (1308–1311)',
    src: new URL('../../sacradigit-images/sacred-art/theotokos (1).jpg', import.meta.url).href,
    credit: { by: 'Duccio di Buoninsegna — Maestà', license: 'Public domain', url: 'https://en.wikipedia.org/wiki/Maest%C3%A0_%28Duccio%29#/media/File:Duccio_maesta1021.jpg' },
  },
  {
    id: 'good-shepherd',
    title: 'The Good Shepherd — mosaic, Mausoleum of Galla Placidia (5th century)',
    src: new URL('../../sacradigit-images/sacred-art/good-shepherd.jpg', import.meta.url).href,
    credit: { by: 'Gsimonov', license: 'CC0', url: 'https://en.wikipedia.org/wiki/Mausoleum_of_Galla_Placidia#/media/File:Ravenna_%E2%80%94_The_Good_Shepherd_mosaic.jpg' },
  },
  {
    id: 'st-michael',
    title: 'Saint Michael the Archangel — The Fall of the Rebel Angels, Pieter Bruegel the Elder (1562)',
    src: new URL('../../sacradigit-images/sacred-art/st-michael (1).jpg', import.meta.url).href,
    credit: { by: 'Pieter Bruegel the Elder — The Fall of the Rebel Angels', license: 'Public domain', url: 'https://en.wikipedia.org/wiki/The_Fall_of_the_Rebel_Angels#/media/File:Pieter_Bruegel_the_Elder_-_The_Fall_of_the_Rebel_Angels_-_RMFAB_584_(derivative_work).jpg' },
  },
  {
    id: 'last-supper',
    title: 'The Last Supper — Leonardo da Vinci (1495–1498)',
    src: new URL('../../sacradigit-images/sacred-art/last-supper.jpg', import.meta.url).href,
    credit: { by: 'Leonardo da Vinci — The Last Supper', license: 'Public domain', url: 'https://en.wikipedia.org/wiki/The_Last_Supper_(Leonardo)#/media/File:The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg' },
  },
];

// Pages that want to credit the artwork (the sign-in page) add an element
// marked [data-sacred-credit]; it names the piece's source and links to it.
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function showCredit(art) {
  document.querySelectorAll('[data-sacred-credit]').forEach((box) => {
    const c = art.credit;
    if (!c) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span aria-hidden="true">©</span> <a href="${escHtml(c.url)}" target="_blank" rel="noopener noreferrer">${escHtml(c.by)}</a> · ${escHtml(c.license)} · via Wikimedia Commons`;
  });
}

/* ---------- Rotator ---------- */

const ROTATE_MS = 3 * 60 * 60 * 1000; // 3 hours — the art changes on this wall-clock cadence
const CHECK_MS = 60 * 1000; // re-check every minute so an open tab swaps right on the boundary

function currentArtIndex() {
  return Math.floor(Date.now() / ROTATE_MS) % SACRED_ART.length;
}

// Applies the rotating, slowly-animating sacred art background to one
// container element (or its id). Safe to call more than once on the
// same element — repeat calls are ignored.
export function initSacredArt(container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el || el.dataset.sacredArtReady) return;
  el.dataset.sacredArtReady = 'true';
  el.classList.add('sacred-art-frame');

  let shownIndex = -1;

  function paint() {
    const idx = currentArtIndex();
    if (idx === shownIndex) return;
    shownIndex = idx;
    const art = SACRED_ART[idx];

    const layer = document.createElement('div');
    layer.className = 'sacred-art-layer';

    const img = document.createElement('img');
    img.className = 'sacred-kb-group';
    img.src = art.src;
    img.alt = art.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    layer.appendChild(img);

    const previousLayers = Array.from(el.querySelectorAll('.sacred-art-layer'));
    el.appendChild(layer);
    showCredit(art);
    // Force a layout flush first, so the opacity transition below actually animates
    // instead of snapping straight to visible.
    void layer.offsetWidth;
    layer.classList.add('sacred-art-visible');

    previousLayers.forEach((old) => {
      old.classList.remove('sacred-art-visible');
      setTimeout(() => old.remove(), 1700);
    });
  }

  paint();
  setInterval(paint, CHECK_MS);
}

/* ---------- Navy page headers ----------
   Every navy header on the admin / media side (.ann-hero, or any element
   marked [data-sacred-header]) gets the same rotating art as the
   Dashboard banner: an art frame plus a navy tint (so the white text
   stays readable) are prepended as its first children. See "Sacred art
   on navy page headers" in admin-shell.css for the layering. */
const SACRED_HEADER_SELECTOR = '.ann-hero, [data-sacred-header]';

export function addSacredArtToHeaders(root = document) {
  root.querySelectorAll(SACRED_HEADER_SELECTOR).forEach((header) => {
    if (header.querySelector(':scope > .sacred-art-frame')) return;
    header.classList.add('sacred-header');
    const tint = document.createElement('div');
    tint.className = 'sacred-header-tint';
    tint.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('div');
    frame.setAttribute('aria-hidden', 'true');
    header.prepend(frame, tint);
    initSacredArt(frame);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-sacred-art]').forEach((el) => initSacredArt(el));
  addSacredArtToHeaders();
});