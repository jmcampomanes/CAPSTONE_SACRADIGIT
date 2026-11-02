/* ============================================
   SacraDigit Admin — Statistics
   Runs after dashboard.js. How many events the parish
   held each month, and each event with its date and
   priest: Mass records plus confirmed and completed
   services. Public and private baptisms count separately.

   Demographics are totals only. Any group smaller than
   MIN_GROUP is hidden, so nobody can be identified.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { printReport, tableHtml } from '../../shared/js/print-report.js';
import { logActivity } from '../../shared/js/activity-log.js';
import { serviceLabel } from '../../shared/js/public-baptism.js';
import { profileDetailsReady } from '../../shared/js/profile-details.js';
import { ageOn } from '../../shared/js/wedding-rules.js';
import { PRIEST_KEY } from '../../shared/js/sacrament-prep.js';
import { showToast } from './admin-ui.js';

const MIN_GROUP = 5;
const COUNTED = new Set(['scheduled', 'completed']);

async function listAll(model) {
  const items = [];
  let nextToken;
  do {
    const res = await client.models[model].list({ limit: 1000, nextToken });
    if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
    items.push(...res.data);
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const detailsOf = (r) => { try { return (typeof r.details === 'string' ? JSON.parse(r.details) : r.details) || {}; } catch { return {}; } };
  const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let events = [];

  const now = new Date();
  $('st-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  function renderChart() {
    const year = $('st-month').value.slice(0, 4);
    const months = Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { key, label: new Date(Number(year), i, 1).toLocaleDateString('en-US', { month: 'short' }), count: events.filter(e => e.date.startsWith(key)).length };
    });
    const top = Math.max(1, ...months.map(m => m.count));
    $('st-chart-title').textContent = `Events per Month, ${year}`;
    $('st-chart').innerHTML = months.map(m => `
      <button type="button" class="st-col${m.key === $('st-month').value ? ' is-current' : ''}" data-month="${m.key}" aria-label="${esc(m.label)}: ${m.count} events" data-tip="${esc(m.label)} ${year}: ${m.count} event${m.count === 1 ? '' : 's'}">
        <span class="st-value">${m.count || ''}</span>
        <span class="st-bar" style="height:${(m.count / top) * 100}%"></span>
        <span class="st-label">${esc(m.label)}</span>
      </button>`).join('');
  }

  const shown = () => events.filter(e => e.date.startsWith($('st-month').value)).sort((a, b) => a.date.localeCompare(b.date));

  function renderMonth() {
    const rows = shown();
    const byType = new Map();
    rows.forEach(e => byType.set(e.type, (byType.get(e.type) || 0) + 1));
    $('st-total').textContent = String(rows.length);
    $('st-types').innerHTML = rows.length ? [...byType].sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `<li><span>${esc(type)}</span><strong>${n}</strong></li>`).join('') : '<li>No events this month.</li>';
    $('st-rows').innerHTML = rows.length ? rows.map(e => `
      <tr><td>${esc(longDate(e.date))}</td><td>${esc(e.type)}</td><td>${esc(e.name)}</td><td>${esc(e.priest || 'Not assigned')}</td></tr>`).join('')
      : '<tr><td colspan="4" class="text-center text-gray-400 py-6">No events this month.</td></tr>';
  }

  const render = () => { renderChart(); renderMonth(); };
  $('st-month').addEventListener('change', render);
  $('st-chart').addEventListener('click', (e) => {
    const col = e.target.closest('[data-month]');
    if (col) { $('st-month').value = col.dataset.month; render(); }
  });

  const HEAD = ['Date', 'Event', 'For', 'Priest'];
  const cells = (e) => [e.date, e.type, e.name, e.priest || 'Not assigned'];
  $('st-export').addEventListener('click', () => {
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [HEAD, ...shown().map(cells)].map(r => r.map(quote).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `sacradigit-events-${$('st-month').value}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    logActivity('Download', `Exported the events for ${$('st-month').value}`);
  });
  $('st-print').addEventListener('click', () => {
    printReport({ title: 'Parish Events', subtitle: $('st-month').value, body: tableHtml(HEAD.map(label => ({ label })), shown().map(e => cells(e).map(esc))) });
  });

  /* ---------- demographics ---------- */
  function renderDemographics(people) {
    const today = new Date().toLocaleDateString('en-CA');
    const ageGroup = (p) => {
      if (!p.birthdate) return null;
      const age = ageOn(p.birthdate, today);
      return age < 18 ? 'Under 18' : age < 36 ? '18 to 35' : age < 60 ? '36 to 59' : '60 and over';
    };
    const tally = (pick) => {
      const counts = new Map();
      people.forEach(p => { const k = pick(p); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
      return counts;
    };
    const list = (title, counts) => `
      <div>
        <h3 class="text-sm font-semibold text-gray-900 mb-1">${esc(title)}</h3>
        <ul class="pay-types">${[...counts].map(([k, n]) => `<li><span>${esc(k)}</span><strong>${n < MIN_GROUP ? `Fewer than ${MIN_GROUP}` : n}</strong></li>`).join('') || '<li>Not enough answers yet.</li>'}</ul>
      </div>`;
    $('st-demographics').innerHTML = `
      ${list('Age Group', tally(ageGroup))}
      ${list('Sex', tally(p => p.sex || null))}
      ${list('Person with Disability', tally(p => (p.isPwd === true ? 'Yes' : p.isPwd === false ? 'No' : null)))}`;
  }

  try {
    const [masses, services] = await Promise.all([listAll('Mass'), listAll('Blessing')]);
    events = [
      ...masses.filter(m => m.date).map(m => ({ date: m.date, type: m.isSpecial ? 'Special Mass' : 'Mass', name: m.title || m.type || '', priest: m.officiant })),
      ...services.filter(s => COUNTED.has(s.status) && s.date).map(s => ({ date: s.date, type: serviceLabel(s), name: s.requesterName, priest: detailsOf(s)[PRIEST_KEY] })),
    ];
    render();
    if (profileDetailsReady()) renderDemographics(await listAll('ParishionerPreference'));
    else $('st-demographics-panel').classList.add('hidden');
  } catch (err) {
    console.error('Failed to load statistics:', err);
    showToast("Couldn't load the statistics.", true);
  }
});
