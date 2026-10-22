/* ============================================
   SacraDigit Admin — Find a parishioner
   A "Find" button in the top bar (or Ctrl+K / ⌘K) on
   every admin page. Type a name and see everything
   the parish has for that person in one list:
   certificate requests, blessings, facility bookings,
   Mass intentions and archive records, newest first,
   each linking to the page where it's handled.
   For the walk-in at the counter asking "is my
   certificate ready? is my blessing still on?".
   ============================================ */

import { client } from '../amplify-init.js';

const SOURCES = [
  { model: 'CertificateRequest', name: r => r.requesterName, title: r => r.certificateType, date: r => r.createdAt, kind: 'Certificate', href: 'record-requests.html' },
  { model: 'Blessing', name: r => r.requesterName, title: r => r.type, date: r => r.preferredDate || r.date || r.createdAt, kind: 'Service', href: 'blessings.html' },
  { model: 'FacilityBooking', name: r => r.requesterName, title: r => r.facilityName, date: r => r.date || r.createdAt, kind: 'Facility', href: 'facility-booking.html' },
  { model: 'MassIntention', name: r => r.donor, title: r => `Mass intention · ${r.type || ''}`, date: r => r.massDate || r.createdAt, kind: 'Intention', href: 'mass-intentions.html' },
  { model: 'ParishRecord', name: r => r.fullName, title: r => `${r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : 'Parish'} record`, date: r => r.dateOfEvent || r.createdAt, kind: 'Record', href: 'digital-archives.html' },
];
const STATUS_TONE = { pending: 'badge-amber', approved: 'badge-green', scheduled: 'badge-green', released: 'badge-blue', completed: 'badge-blue', digitized: 'badge-green', rejected: 'badge-red', cancelled: 'badge-red', declined: 'badge-red' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const fmtDate = (v) => {
  if (!v) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const STYLE = `
  .fp-backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(15, 23, 42, 0.45); display: flex; align-items: flex-start; justify-content: center; padding: 8vh 1rem 1rem; }
  .fp-backdrop.hidden { display: none; }
  .fp-box { width: 100%; max-width: 36rem; max-height: 80vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 0.875rem; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3); overflow: hidden; }
  .fp-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
  .fp-head svg { width: 1.25rem; height: 1.25rem; color: #6b7280; flex-shrink: 0; }
  .fp-input { flex: 1; min-width: 0; border: 0; outline: none; font-size: 1rem; padding: 0.4rem 0; background: transparent; color: #111827; }
  .fp-close { min-width: 2.5rem; min-height: 2.5rem; border: 0; border-radius: 0.5rem; background: none; color: #6b7280; font-size: 1.25rem; cursor: pointer; }
  .fp-close:hover { background: #f3f4f6; }
  .fp-body { overflow-y: auto; }
  .fp-hint { padding: 1.25rem 1rem; font-size: 0.875rem; color: #6b7280; }
  .fp-person { padding: 0.6rem 1rem 0.25rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; }
  .fp-list { list-style: none; margin: 0; padding: 0; }
  .fp-item a { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; text-decoration: none; color: inherit; }
  .fp-item a:hover, .fp-item a:focus-visible { background: #f5f6fb; outline: none; }
  .fp-kind { flex-shrink: 0; width: 5.25rem; font-size: 0.75rem; font-weight: 600; color: #6b7280; }
  .fp-text { flex: 1; min-width: 0; }
  .fp-title { font-size: 0.875rem; font-weight: 600; color: #111827; }
  .fp-sub { font-size: 0.8125rem; color: #6b7280; }
  .fp-item .badge { flex-shrink: 0; }
  @media (max-width: 640px) { .fp-backdrop { padding-top: 0.75rem; } .fp-kind { width: auto; } .fp-item a { flex-wrap: wrap; } .fp-text { flex-basis: calc(100% - 6rem); } }
  :root[data-theme="dark"] .fp-box { background: #1a2131; }
  :root[data-theme="dark"] .fp-head { border-color: #2a3346; }
  :root[data-theme="dark"] .fp-input, :root[data-theme="dark"] .fp-title { color: #f1f3f7; }
  :root[data-theme="dark"] :is(.fp-hint, .fp-person, .fp-kind, .fp-sub, .fp-close, .fp-head svg) { color: #b6bdca; }
  :root[data-theme="dark"] .fp-item a:hover, :root[data-theme="dark"] .fp-item a:focus-visible, :root[data-theme="dark"] .fp-close:hover { background: #242c3e; }
`;

const SEARCH_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>';

async function listAll(model) {
  const rows = [];
  let nextToken = null;
  do {
    const res = await client.models[model].list({ limit: 1000, nextToken });
    rows.push(...(res.data || []));
    nextToken = res.nextToken;
  } while (nextToken && rows.length < 5000);
  return rows;
}

export function initFindPerson() {
  const wrap = document.querySelector('header .help-date-wrap');
  if (!wrap || document.getElementById('find-person-btn')) return;

  const st = document.createElement('style');
  st.textContent = STYLE;
  document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'find-person-btn';
  btn.className = 'find-person-btn';
  btn.setAttribute('aria-label', 'Find a parishioner (Ctrl+K)');
  btn.title = 'Find a parishioner (Ctrl+K)';
  btn.innerHTML = SEARCH_ICON;
  wrap.prepend(btn);

  const backdrop = document.createElement('div');
  backdrop.className = 'fp-backdrop hidden';
  backdrop.innerHTML = `
    <div class="fp-box" role="dialog" aria-modal="true" aria-label="Find a parishioner">
      <div class="fp-head">
        ${SEARCH_ICON}
        <input type="search" class="fp-input" placeholder="Type a parishioner's name" aria-label="Parishioner's name" autocomplete="off" />
        <button type="button" class="fp-close" aria-label="Close">×</button>
      </div>
      <div class="fp-body" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(backdrop);
  const input = backdrop.querySelector('.fp-input');
  const body = backdrop.querySelector('.fp-body');

  let rows = null; // every searchable item, loaded on first open
  let loading = null;

  function load() {
    loading ||= Promise.all(SOURCES.map(async (src) => {
      if (!client.models[src.model]) return [];
      try {
        return (await listAll(src.model)).map(r => ({ src, r, key: norm(src.name(r)) }));
      } catch (err) {
        console.warn(`Find: couldn't load ${src.model}`, err);
        return [];
      }
    })).then(lists => { rows = lists.flat(); render(); });
    return loading;
  }

  function render() {
    const q = norm(input.value);
    if (q.length < 2) { body.innerHTML = '<p class="fp-hint">Type at least 2 letters of a name. Results cover certificate requests, blessings and other services, facility bookings, Mass intentions and archive records.</p>'; return; }
    if (!rows) { body.innerHTML = '<p class="fp-hint">Loading…</p>'; return; }
    const words = q.split(' ');
    const hits = rows.filter(x => words.every(w => x.key.includes(w)));
    if (!hits.length) { body.innerHTML = `<p class="fp-hint">No one named “${esc(input.value.trim())}” in requests, services, bookings, intentions or records.</p>`; return; }
    // Group by person, newest first inside each.
    const people = new Map();
    hits.forEach(x => { const name = x.src.name(x.r) || 'Unnamed'; if (!people.has(name)) people.set(name, []); people.get(name).push(x); });
    body.innerHTML = [...people].slice(0, 12).map(([name, list]) => `
      <p class="fp-person" data-no-translate>${esc(name)}</p>
      <ul class="fp-list">${list
        .sort((a, b) => String(b.src.date(b.r) || '').localeCompare(String(a.src.date(a.r) || '')))
        .slice(0, 12)
        .map(({ src, r }) => `
        <li class="fp-item"><a href="${src.href}">
          <span class="fp-kind">${src.kind}</span>
          <span class="fp-text"><span class="fp-title">${esc(src.title(r))}</span><br><span class="fp-sub">${esc(fmtDate(src.date(r)))}</span></span>
          ${r.status ? `<span class="badge ${STATUS_TONE[r.status] || 'badge-gray'}">${esc(cap(r.status))}</span>` : ''}
        </a></li>`).join('')}
      </ul>`).join('');
  }

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    backdrop.classList.remove('hidden');
    input.select();
    input.focus();
    render();
    load();
  }
  function close() {
    backdrop.classList.add('hidden');
    lastFocus?.focus?.();
  }

  btn.addEventListener('click', open);
  backdrop.querySelector('.fp-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  input.addEventListener('input', render);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) close();
  });
  // Keep Tab inside the dialog while it's open.
  backdrop.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...backdrop.querySelectorAll('input, button, a[href]')].filter(el => el.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
