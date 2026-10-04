/* ============================================
   SacraDigit — Ministry Sign-ups (parishioner)
   Runs after user-shell.js. The month's roster of
   weekend and special Masses: volunteer as a lector,
   choir member, altar server or usher; withdraw (until
   the day before); ask for a swap; or take over a slot
   someone needs swapped. See ../ministry.js.
   ============================================ */

import { currentUser } from '../auth.js';
import {
  MINISTRIES, ministryById, ministryReady, watchRosterMasses, watchSignups, groupSignups,
  volunteer, withdraw, setSwapRequested, takeOver, canChangeSignup, canSwap,
  fmtMassDay, fmtTime, monthLabel, escapeHtml, todayIso,
} from '../ministry.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  if (!ministryReady()) {
    $('min-unavailable').classList.remove('hidden');
    $('min-main').classList.add('hidden');
    return;
  }

  const user = currentUser() || {};
  const me = { id: user.sub, name: user.name || 'Parishioner' };
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let filter = 'all';
  let masses = [];
  let signups = [];
  let stops = [];

  function load() {
    stops.forEach(stop => stop());
    masses = []; signups = [];
    $('min-month').textContent = monthLabel(year, month);
    stops = [
      watchRosterMasses(year, month, (list) => { masses = list; render(); }),
      watchSignups(year, month, (list) => { signups = list; render(); }),
    ];
  }

  $('min-prev').addEventListener('click', () => { month -= 1; if (month < 0) { month = 11; year -= 1; } load(); });
  $('min-next').addEventListener('click', () => { month += 1; if (month > 11) { month = 0; year += 1; } load(); });

  // Ministry filter chips
  $('min-filter').innerHTML = [{ id: 'all', label: 'All ministries' }, ...MINISTRIES]
    .map(m => `<button type="button" class="min-chip${m.id === 'all' ? ' active' : ''}" data-filter="${m.id}">${escapeHtml(m.label)}</button>`).join('');
  $('min-show-past').addEventListener('change', render);

  $('min-filter').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    filter = chip.dataset.filter;
    $('min-filter').querySelectorAll('.min-chip').forEach(c => c.classList.toggle('active', c === chip));
    render();
  });

  function render() {
    const grouped = groupSignups(signups);
    const shownMinistries = filter === 'all' ? MINISTRIES : MINISTRIES.filter(m => m.id === filter);

    // My slots this month
    const mine = signups.filter(s => s.volunteerId === me.id && s.massDate >= todayIso())
      .sort((a, b) => a.massDate.localeCompare(b.massDate));
    $('min-mine-wrap').classList.toggle('hidden', mine.length === 0);
    $('min-mine').innerHTML = mine.map(s => `
      <li><b>${escapeHtml(fmtMassDay(s.massDate))} · ${escapeHtml(fmtTime(s.massTime))}</b> — ${escapeHtml(ministryById(s.ministry)?.one || s.ministry)}${s.swapRequested ? ' <span class="min-swap-tag">Swap requested</span>' : ''}</li>`).join('');

    // Masses already over are hidden unless asked for
    const shownMasses = $('min-show-past').checked ? masses : masses.filter(m => m.date >= todayIso());
    $('min-empty').classList.toggle('hidden', shownMasses.length > 0);
    $('min-roster').innerHTML = shownMasses.map(mass => {
      const byMin = grouped.get(mass.key) || new Map();
      const past = mass.date < todayIso();
      const rows = shownMinistries.map(m => {
        const list = byMin.get(m.id) || [];
        const minePending = list.find(s => s.volunteerId === me.id);
        const open = Math.max(0, m.perMass - list.length);
        const people = list.map(s => {
          const isMe = s.volunteerId === me.id;
          let actions = '';
          if (isMe && !past) {
            actions = canChangeSignup(s.massDate)
              ? `<button type="button" class="min-link" data-act="withdraw" data-id="${s.id}">Withdraw</button>`
              : '';
            if (canSwap(s.massDate)) actions += `<button type="button" class="min-link" data-act="${s.swapRequested ? 'unswap' : 'swap'}" data-id="${s.id}">${s.swapRequested ? 'Cancel swap' : 'Ask for swap'}</button>`;
          } else if (s.swapRequested && !minePending && canSwap(s.massDate)) {
            actions = `<button type="button" class="min-link strong" data-act="take" data-id="${s.id}">Take this slot</button>`;
          }
          return `<li class="min-person${isMe ? ' me' : ''}${s.swapRequested ? ' swap' : ''}">
              <span data-no-translate>${isMe ? 'You' : escapeHtml(s.volunteerName || 'Volunteer')}</span>${s.swapRequested ? ' <span class="min-swap-tag">Swap needed</span>' : ''}
              ${actions}
            </li>`;
        }).join('');
        const canJoin = !past && !minePending && open > 0 && canChangeSignup(mass.date);
        return `
          <div class="min-row">
            <div class="min-row-head">
              <span class="min-name">${escapeHtml(m.label)}</span>
              <span class="min-filled${open === 0 ? ' full' : ''}">${list.length}/${m.perMass}</span>
            </div>
            <ul class="min-people">${people || '<li class="min-person none">No one yet</li>'}</ul>
            ${canJoin ? `<button type="button" class="btn-secondary min-volunteer" data-act="volunteer" data-mass="${escapeHtml(mass.key)}" data-ministry="${m.id}">Volunteer</button>` : ''}
          </div>`;
      }).join('');
      return `
        <section class="min-mass${past ? ' past' : ''}">
          <header class="min-mass-head">
            <div><p class="min-mass-day">${escapeHtml(fmtMassDay(mass.date))} · ${escapeHtml(fmtTime(mass.time))}</p>
            <p class="min-mass-title">${escapeHtml(mass.title)}</p></div>
            ${past ? '<span class="min-past-tag">Done</span>' : mass.date === todayIso() ? '<span class="min-past-tag min-today-tag">Today</span>' : ''}
          </header>
          <div class="min-rows">${rows}</div>
        </section>`;
    }).join('');
  }

  $('min-roster').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const s = signups.find(x => x.id === btn.dataset.id);
    btn.disabled = true;
    try {
      if (act === 'volunteer') {
        const mass = masses.find(m => m.key === btn.dataset.mass);
        const m = ministryById(btn.dataset.ministry);
        await volunteer(mass, m.id, me);
        window.showToast(`Thank you! You're down as ${m.one.toLowerCase()} for ${fmtMassDay(mass.date)} · ${fmtTime(mass.time)}.`);
      } else if (act === 'withdraw') {
        if (!confirm('Withdraw from this slot?')) { btn.disabled = false; return; }
        await withdraw(s);
        window.showToast('You’ve withdrawn from that slot.');
      } else if (act === 'swap' || act === 'unswap') {
        await setSwapRequested(s, act === 'swap');
        window.showToast(act === 'swap' ? 'Swap requested — others can now take your slot.' : 'Swap request cancelled.');
      } else if (act === 'take') {
        await takeOver(s, me);
        window.showToast('The slot is yours now. Thank you for serving!');
      }
    } catch (err) {
      console.error('Ministry sign-up failed:', err);
      window.showToast(err.message || "Couldn't update the roster.", true);
      btn.disabled = false;
    }
  });

  load();
});
