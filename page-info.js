/* ============================================
   SacraDigit — "What can I do here?" box at the top
   of each page, for every role. Each portal keeps its
   own list of pages (user/page-info.js,
   Sacradigit/admin-page-info.js,
   Sacramedia/media-page-info.js,
   Sacraitech/itech-page-info.js) and its shell calls
   mountPageInfo().

   The box: an info icon, a question, a sentence or
   two, and the page's main button(s) on the right —
   moved in from the page's .page-actions row, or
   from wherever the page's `move` selectors point.
   A .page-info-note in the .page-actions row (e.g.
   "Last backup: …") goes under the sentence.
   From the second visit it folds to its title, with
   "Show more" to open it again.
   ============================================ */

const INFO_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
const LIST_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>';

/* Staff portals get the box's look from here; the parishioner portal has
   the same rules in user-shell.css. */
const STYLE = `
.page-actions { display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; }
.info-banner {
  display: flex; gap: 0.875rem;
  background: linear-gradient(90deg, rgba(139, 143, 199, 0.1), rgba(139, 143, 199, 0.03));
  border: 1px solid rgba(139, 143, 199, 0.28); border-left: 3px solid #8b8fc7;
  border-radius: 0.875rem; padding: 1rem 1.25rem;
}
.info-banner-icon {
  width: 2.25rem; height: 2.25rem; flex-shrink: 0; margin-top: 0.1rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background-color: rgba(139, 143, 199, 0.18); color: #5b5fa8;
}
.info-banner-title { font-size: 0.875rem; font-weight: 700; color: #383b6e; margin-bottom: 0.2rem; }
.info-banner-text { font-size: 0.8125rem; color: #4a4e8a; line-height: 1.55; }
.info-banner-with-action { align-items: center; }
.info-banner-body { flex: 1; min-width: 0; }
.info-banner-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; flex-shrink: 0; }
.info-banner-action { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; flex-shrink: 0; white-space: nowrap; }
.page-info-note { margin-top: 0.35rem; font-size: 0.75rem; color: #5b5fa8; }
.page-info-note:empty { display: none; }
.info-banner.is-folded { padding-top: 0.625rem; padding-bottom: 0.625rem; align-items: center; }
.info-banner.is-folded .info-banner-icon { width: 1.75rem; height: 1.75rem; margin-top: 0; }
.info-banner.is-folded .info-banner-title { margin-bottom: 0; }
.info-banner.is-folded .info-banner-title ~ * { display: none; }
.info-banner-toggle {
  margin-left: 0.35rem; padding: 0.25rem 0.4rem; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 0.8125rem; font-weight: 600; color: #4b50a0; text-decoration: underline; min-height: 2rem;
}
:root[data-theme="dark"] .info-banner-toggle { color: #b3b6e6; }
:root[data-theme="dark"] .page-info-note { color: #a9abd1; }
@media (max-width: 640px) {
  .info-banner-with-action { flex-wrap: wrap; align-items: flex-start; }
  .info-banner-body { flex-basis: calc(100% - 3.25rem); }
  .info-banner-actions { width: 100%; }
  .info-banner-actions > * { flex: 1 1 auto; }
  .page-actions > a, .page-actions > button { width: 100%; justify-content: center; }
}
`;

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/** Moves `buttons` into `banner`, on the right. */
function addActions(banner, buttons) {
  if (!buttons.length) return;
  banner.classList.add('info-banner-with-action');
  let row = banner.querySelector(':scope > .info-banner-actions');
  if (!row) {
    row = document.createElement('div');
    row.className = 'info-banner-actions';
    banner.appendChild(row);
  }
  buttons.forEach(b => { b.classList.add('info-banner-action'); row.appendChild(b); });
}

/** Takes the buttons (and any note) out of the page's .page-actions row. */
function takeActionsRow(banner, actionsRow) {
  if (!actionsRow) return;
  const notes = [...actionsRow.querySelectorAll('.page-info-note')];
  const body = banner.querySelector('.info-banner-body') || banner.querySelector('.info-banner-icon + div');
  notes.forEach(n => body?.appendChild(n));
  addActions(banner, [...actionsRow.children]);
  actionsRow.remove();
}

const SEEN_KEY = 'sacradigit_seen_pages';
function foldAfterFirstVisit(banner, seenId) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { /* private mode */ }
  if (!seen.includes(seenId)) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, seenId])); } catch { /* private mode */ }
    return;
  }
  const title = banner.querySelector('.info-banner-title');
  if (!title) return;
  const body = title.parentElement;
  if (!body.id) body.id = `page-info-${seenId.replace(/\W/g, '')}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'info-banner-toggle';
  btn.setAttribute('aria-controls', body.id);
  const paint = (open) => {
    banner.classList.toggle('is-folded', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Show less' : 'Show more';
  };
  btn.addEventListener('click', () => paint(banner.classList.contains('is-folded')));
  title.append(' ', btn);
  paint(false);
}

/**
 * @param {string} pageFile  e.g. 'record-requests.html'
 * @param {object} pages     pageFile → { title, text, action?, move?: string[] } ({} = page keeps its own box)
 * @param {object} [o]
 * @param {string}  [o.portal]      prefix so "profile.html" in two portals is remembered separately
 * @param {boolean} [o.withStyles]  add the box's styles (staff portals)
 */
export function mountPageInfo(pageFile, pages, { portal = '', withStyles = false } = {}) {
  const info = pages[pageFile];
  const main = document.querySelector('main');
  if (!info || !main || main.querySelector('.page-info')) return;
  if (withStyles && !document.getElementById('page-info-style')) {
    const st = document.createElement('style');
    st.id = 'page-info-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  const seenId = portal ? `${portal}/${pageFile}` : pageFile;
  const actionsRow = main.querySelector('.page-actions');
  const moved = (info.move || []).map(sel => main.querySelector(sel)).filter(Boolean);

  // Page already has its own box: just bring its button inside.
  const existing = main.querySelector('.info-banner');
  if (existing) {
    existing.classList.add('page-info');
    existing.querySelector('.info-banner-icon + div')?.classList.add('info-banner-body');
    takeActionsRow(existing, actionsRow);
    addActions(existing, moved);
    foldAfterFirstVisit(existing, seenId);
    return;
  }
  if (!info.title) return;

  const banner = document.createElement('div');
  banner.className = 'info-banner page-info';
  banner.innerHTML = `
    <div class="info-banner-icon">${INFO_ICON}</div>
    <div class="info-banner-body">
      <p class="info-banner-title">${esc(info.title)}</p>
      <p class="info-banner-text">${esc(info.text)}</p>
    </div>`;

  if (info.action) {
    banner.classList.add('info-banner-with-action');
    banner.insertAdjacentHTML('beforeend', `
      <a href="${info.action.href}" class="btn-secondary info-banner-action">${info.action.icon === 'list' ? LIST_ICON : ''}${esc(info.action.label)}</a>`);
  }

  // Goes where the page's button row was (so it stays inside that view),
  // otherwise at the very top of the page.
  if (actionsRow) {
    actionsRow.before(banner);
    takeActionsRow(banner, actionsRow);
  } else {
    const firstView = main.querySelector(':scope > #menu-view') || main;
    firstView.prepend(banner);
  }
  addActions(banner, moved);

  foldAfterFirstVisit(banner, seenId);

  // Messages: the chat box is sized to the screen — make room for the box above it.
  document.getElementById('chat-layout')?.classList.add('with-hero');
}
