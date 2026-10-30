/* ============================================
   SacraDigit Admin — Ministry Roster
   Runs after dashboard.js. The month's roster of
   lectors, choir, altar servers and ushers per Mass:
   who signed up, open slots, swap requests. The office
   can remove someone and print the roster.
   See ../../shared/js/ministry.js.
   ============================================ */

import { printReport, tableHtml, esc } from '../../shared/js/print-report.js';
import {
  MINISTRIES, ministryReady, watchRosterMasses, watchSignups, groupSignups, removeSignup,
  fmtMassDay, fmtTime, monthLabel, escapeHtml, todayIso,
} from '../../shared/js/ministry.js';
import { showToast, confirmDialog } from './admin-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  if (!ministryReady()) {
    $('min-unavailable').classList.remove('hidden');
    $('min-main').classList.add('hidden');
    return;
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let masses = [];
  let signups = [];
  let stops = [];
  // Upcoming Masses first: the coordinator's question is "who's short this weekend?".
  // Past Masses stay one tap away. A month with nothing upcoming opens on Past.
  let view = 'upcoming';
  let viewChosen = false;

  function load() {
    stops.forEach(stop => stop());
    masses = []; signups = [];
    $('min-month').textContent = monthLabel(year, month);
    viewChosen = false;
    stops = [
      watchRosterMasses(year, month, (list) => { masses = list; render(); }),
      watchSignups(year, month, (list) => { signups = list; render(); }),
    ];
  }

  $('min-prev').addEventListener('click', () => { month -= 1; if (month < 0) { month = 11; year -= 1; } load(); });
  $('min-next').addEventListener('click', () => { month += 1; if (month > 11) { month = 0; year += 1; } load(); });

  function render() {
    const grouped = groupSignups(signups);
    const needed = masses.length * MINISTRIES.reduce((n, m) => n + m.perMass, 0);
    const filled = masses.reduce((n, mass) => n + MINISTRIES.reduce((k, m) => k + Math.min(m.perMass, (grouped.get(mass.key)?.get(m.id) || []).length), 0), 0);
    const swaps = signups.filter(s => s.swapRequested && s.massDate >= todayIso()).length;
    $('stat-masses').textContent = masses.length;
    $('stat-filled').textContent = needed ? `${Math.round((filled / needed) * 100)}%` : '–';
    $('stat-open').textContent = Math.max(0, needed - filled);
    $('stat-swaps').textContent = swaps;

    $('min-thead').innerHTML = `<tr><th>Mass</th>${MINISTRIES.map(m => `<th>${escapeHtml(m.label)} <span class="text-gray-400 font-normal">(${m.perMass})</span></th>`).join('')}</tr>`;
    const today = todayIso();
    const upcoming = masses.filter(m => m.date >= today);
    const past = masses.filter(m => m.date < today);
    if (!viewChosen) view = upcoming.length || !past.length ? 'upcoming' : 'past';
    $('min-count-upcoming').textContent = `(${upcoming.length})`;
    $('min-count-past').textContent = `(${past.length})`;
    document.querySelectorAll('.min-view-chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.view === view)));
    const shown = view === 'past' ? past : upcoming;

    $('min-empty').classList.toggle('hidden', shown.length > 0);
    $('min-empty').textContent = masses.length === 0 ? 'No Masses on the roster this month.'
      : view === 'past' ? 'No past Masses this month.' : 'No more Masses this month. Use › for next month.';
    $('min-tbody').innerHTML = shown.map(mass => {
      const byMin = grouped.get(mass.key) || new Map();
      const short = MINISTRIES.reduce((n, m) => n + Math.max(0, m.perMass - (byMin.get(m.id) || []).length), 0);
      const need = mass.date < today ? ''
        : short ? `<span class="min-need">Needs ${short} ${short === 1 ? 'person' : 'people'}</span>`
        : '<span class="min-need is-full">Full</span>';
      return `<tr class="${mass.date < today ? 'past' : ''}">
        <td class="min-mass-cell"><b>${escapeHtml(fmtMassDay(mass.date))} · ${escapeHtml(fmtTime(mass.time))}</b><small>${escapeHtml(mass.title)}</small>${need}</td>
        ${MINISTRIES.map(m => {
          const list = byMin.get(m.id) || [];
          const open = m.perMass - list.length;
          return `<td>
            <ul class="min-cell-list">${list.map(s => `
              <li${s.swapRequested ? ' class="swap"' : ''}><span data-no-translate>${escapeHtml(s.volunteerName || 'Volunteer')}</span>${s.swapRequested ? ' <span class="min-swap-tag">Swap</span>' : ''}
                <button type="button" class="min-remove" data-id="${s.id}" title="Remove from the roster" aria-label="Remove ${escapeHtml(s.volunteerName || 'volunteer')}">×</button></li>`).join('')}</ul>
            ${open > 0 ? `<span class="min-open">${open} open</span>` : ''}
          </td>`;
        }).join('')}
      </tr>`;
    }).join('');
  }

  document.querySelector('.min-view-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.min-view-chip');
    if (!chip) return;
    view = chip.dataset.view;
    viewChosen = true;
    render();
  });

  $('min-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.min-remove');
    if (!btn) return;
    const s = signups.find(x => x.id === btn.dataset.id);
    if (!s) return;
    const sure = await confirmDialog({
      title: `Remove ${s.volunteerName || 'this volunteer'} from the roster?`,
      detail: `${fmtMassDay(s.massDate)} · ${fmtTime(s.massTime)}`,
      message: 'Their slot opens up for someone else.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!sure) return;
    try {
      await removeSignup(s);
      showToast('Removed from the roster.');
    } catch (err) {
      console.error('Failed to remove sign-up:', err);
      showToast(err.message || "Couldn't remove them.", true);
    }
  });

  // Print the month's roster on the parish letterhead
  $('btn-print-roster').addEventListener('click', () => {
    const grouped = groupSignups(signups);
    const rows = masses.map(mass => [
      `<b>${esc(fmtMassDay(mass.date))} · ${esc(fmtTime(mass.time))}</b><div class="small">${esc(mass.title)}</div>`,
      ...MINISTRIES.map(m => {
        const list = grouped.get(mass.key)?.get(m.id) || [];
        const open = m.perMass - list.length;
        return list.map(s => esc(s.volunteerName || 'Volunteer')).join('<br>') + (open > 0 ? `${list.length ? '<br>' : ''}<span class="muted">${open} open</span>` : '');
      }),
    ]);
    printReport({
      title: 'Ministry Roster',
      subtitle: monthLabel(year, month),
      chips: [['Masses', masses.length]],
      body: tableHtml([{ label: 'Mass' }, ...MINISTRIES.map(m => ({ label: m.label }))], rows, { empty: 'No Masses this month.' }),
      orientation: 'landscape',
    });
  });

  const toast = $('toast');

  load();
});
