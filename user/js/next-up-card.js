/* ============================================
   SacraDigit — "Your next thing" on the Dashboard
   One or two short cards above Quick Actions with
   what matters to this parishioner right now:
     Ready for you — a certificate ready to pick up
     Coming up     — the soonest booked service or
                     facility booking (today onward)
   Shows nothing when there's neither (Today's Mass
   Schedule already points to the next Mass).
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUserName } from '../../shared/js/auth.js';
import { loadParishContact } from '../../shared/js/parish-info.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayIso = () => new Date().toLocaleDateString('en-CA');
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function mountNextUpCard(el) {
  if (!el) return;
  const name = currentUserName();
  const state = { certs: [], services: [], bookings: [], hours: '' };
  const loaded = { certs: false, services: false, bookings: false };

  function paint() {
    if (!Object.values(loaded).every(Boolean)) return;
    const today = todayIso();
    const cards = [];

    const ready = state.certs.filter(r => r.status === 'approved');
    if (ready.length) {
      const what = ready.length === 1 ? `Your ${esc(ready[0].certificateType)} is ready` : `${ready.length} certificates are ready`;
      cards.push(`
        <a href="user-my-requests.html" class="next-up-item is-ready">
          <span class="next-up-kicker">Ready for you</span>
          <span class="next-up-title">${what}</span>
          <span class="next-up-sub">Pick ${ready.length === 1 ? 'it' : 'them'} up at the parish office${state.hours ? `, ${esc(state.hours)}` : ''}.</span>
        </a>`);
    }

    const upcoming = [
      ...state.services
        .filter(b => (b.status === 'pending' || b.status === 'scheduled') && (b.date || '') >= today)
        .map(b => ({ date: b.date, time: b.time, title: b.type, sub: b.status === 'pending' ? 'Waiting for parish approval' : 'Scheduled', href: 'user-requested-services.html' })),
      ...state.bookings
        .filter(f => f.status === 'approved' && (f.date || '') >= today)
        .map(f => ({ date: f.date, time: f.startTime, title: f.facilityName, sub: `Facility booking${f.endTime ? ` until ${f.endTime}` : ''}`, href: 'user-facility-booking.html' })),
    ].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const next = upcoming[0];
    if (next) {
      const when = next.date === today ? 'Today' : fmtDay(next.date);
      cards.push(`
        <a href="${next.href}" class="next-up-item is-coming">
          <span class="next-up-kicker">Coming up</span>
          <span class="next-up-title">${esc(next.title)} · ${when}${next.time ? `, ${esc(next.time)}` : ''}</span>
          <span class="next-up-sub">${esc(next.sub)}</span>
        </a>`);
    }

    el.innerHTML = cards.join('');
    el.classList.toggle('hidden', cards.length === 0);
  }

  const watch = (model, filter, key) => {
    if (!client.models[model]) { loaded[key] = true; return; }
    client.models[model].observeQuery(filter ? { filter } : undefined).subscribe({
      next: ({ items }) => { state[key] = items; loaded[key] = true; paint(); },
      error: (err) => { console.warn(`Next-up card: couldn't load ${model}`, err); loaded[key] = true; paint(); },
    });
  };
  watch('CertificateRequest', null, 'certs');
  watch('Blessing', { requesterName: { eq: name } }, 'services');
  watch('FacilityBooking', { requesterName: { eq: name } }, 'bookings');

  loadParishContact(client)
    .then(c => { state.hours = c?.officeHours?.en || ''; paint(); })
    .catch(() => {});
}
