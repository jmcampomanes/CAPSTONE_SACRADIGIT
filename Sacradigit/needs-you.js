/* ============================================
   SacraDigit Admin — "Needs you" on the Dashboard
   One list of the office's waiting work, soonest
   first, instead of checking five pages:
     Both roles  certificate requests to approve and to
                 release, blessing and facility requests,
                 ministry swap requests
     Head Admin  announcement drafts to publish
   Each row links to the page where it's handled.
   Prayer Wall and Messages already show their own
   counts in the sidebar, so they aren't repeated here.
   ============================================ */

import { client } from '../amplify-init.js';
import { isHeadAdmin } from '../auth.js';

const SHOW = 6;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayIso = () => new Date().toLocaleDateString('en-CA');
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const daysAgo = (ts) => Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000));
const ago = (ts) => { const d = daysAgo(ts); return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`; };
const mediaKind = (media) => { try { return JSON.parse(media || '{}').kind === 'post' ? 'post' : 'announcement'; } catch { return 'announcement'; } };

export function mountNeedsYou(el) {
  if (!el) return;
  const data = { pending: [], approved: [], blessings: [], bookings: [], drafts: [], swaps: [] };
  let showAll = false;

  function items() {
    const today = todayIso();
    const out = [];
    // `when` sorts the list: a date the work is needed by, else when it came in.
    data.pending.forEach(r => out.push({
      tag: 'Certificate', tone: 'badge-blue', when: (r.createdAt || '').slice(0, 10),
      title: r.certificateType, who: r.requesterName,
      sub: `${r.purpose ? `For ${r.purpose} · ` : ''}came in ${ago(r.createdAt)}`,
      href: 'record-requests.html', action: 'Review',
    }));
    data.approved.forEach(r => out.push({
      tag: 'Release', tone: 'badge-green', when: (r.updatedAt || r.createdAt || '').slice(0, 10),
      title: r.certificateType, who: r.requesterName,
      sub: `Approved ${ago(r.updatedAt || r.createdAt)}, not picked up yet`,
      href: 'record-requests.html', action: 'Release', strong: true,
    }));
    data.blessings.forEach(b => {
      const day = b.preferredDate || b.date || '';
      out.push({
        tag: day === today ? 'Today' : 'Blessing', tone: day === today ? 'badge-amber' : 'badge-gray', when: day || (b.createdAt || '').slice(0, 10),
        title: b.type, who: b.requesterName,
        sub: [day ? `${fmtDay(day)}${b.time ? `, ${b.time}` : ''}` : 'No date picked', b.location].filter(Boolean).join(' · '),
        href: 'blessings.html', action: 'Review',
      });
    });
    data.bookings.forEach(f => out.push({
      tag: f.date === today ? 'Today' : 'Facility', tone: f.date === today ? 'badge-amber' : 'badge-gray', when: f.date || '',
      title: f.facilityName, who: f.requesterName,
      sub: `${f.date ? fmtDay(f.date) : ''}${f.startTime ? `, ${f.startTime}` : ''}${f.purpose ? ` · ${f.purpose}` : ''}`,
      href: 'facility-booking.html', action: 'Review',
    }));
    if (isHeadAdmin()) {
      data.drafts.forEach(a => out.push({
        tag: 'Draft', tone: 'badge-gray', when: (a.createdAt || '').slice(0, 10),
        title: a.title, who: '', sub: 'Announcement waiting to be published',
        href: 'announcements.html', action: 'Review',
      }));
    }
    data.swaps.forEach(s => out.push({
      tag: s.massDate === today ? 'Today' : 'Swap', tone: s.massDate === today ? 'badge-amber' : 'badge-gray', when: s.massDate,
      title: `${s.volunteerName || 'A volunteer'} can't serve`, who: '',
      sub: `${fmtDay(s.massDate)}${s.massTime ? `, ${s.massTime}` : ''} · needs a stand-in`,
      href: 'ministry-roster.html', action: 'Find cover',
    }));
    return out.sort((a, b) => (a.when || '9999').localeCompare(b.when || '9999'));
  }

  function paint() {
    const list = items();
    const shown = showAll ? list : list.slice(0, SHOW);
    el.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Needs you <span class="needs-count">${list.length}</span></h2>
        <span class="text-xs text-gray-400">Soonest first</span>
      </div>
      ${list.length === 0 ? '<p class="needs-empty">Nothing is waiting on you right now.</p>' : `
      <ul class="needs-list">${shown.map(it => `
        <li class="needs-row">
          <span class="badge needs-tag ${it.tone}">${esc(it.tag)}</span>
          <div class="needs-text">
            <p class="needs-title">${esc(it.title)}${it.who ? ` · <span data-no-translate>${esc(it.who)}</span>` : ''}</p>
            <p class="needs-sub">${esc(it.sub)}</p>
          </div>
          <a href="${it.href}" class="act-btn${it.strong ? ' act-navy' : ''}">${esc(it.action)}</a>
        </li>`).join('')}
      </ul>
      ${list.length > SHOW ? `<button type="button" class="needs-more" aria-expanded="${showAll}">${showAll ? 'Show fewer' : `Show all ${list.length}`}</button>` : ''}`}`;
  }

  el.addEventListener('click', (e) => {
    if (!e.target.closest('.needs-more')) return;
    showAll = !showAll;
    paint();
  });

  const watch = (model, options, key, keep = () => true) => {
    if (!client.models[model]) return;
    client.models[model].observeQuery(options).subscribe({
      next: ({ items: rows }) => { data[key] = rows.filter(keep); paint(); },
      error: (err) => console.warn(`Needs you: couldn't load ${model}`, err),
    });
  };
  watch('CertificateRequest', { filter: { status: { eq: 'pending' } } }, 'pending');
  watch('CertificateRequest', { filter: { status: { eq: 'approved' } } }, 'approved');
  watch('Blessing', { filter: { status: { eq: 'pending' } } }, 'blessings');
  watch('FacilityBooking', { filter: { status: { eq: 'pending' } } }, 'bookings');
  watch('Announcement', { filter: { published: { eq: false } } }, 'drafts', a => mediaKind(a.media) === 'announcement');
  watch('MinistrySignup', { filter: { swapRequested: { eq: true } } }, 'swaps', s => (s.massDate || '') >= todayIso());

  paint();
  document.addEventListener('sacradigit:user', paint);
}
