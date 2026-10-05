/* ============================================
   SacraDigit Admin — Attendance Insights (Head Admin)
   Built from the QR check-in data (MassCheckIn: one
   row per parishioner per Mass — massDate, massTime,
   parishionerKey). Runs after dashboard.js.

     Fullest Masses   check-ins vs the church capacity
     Over time        check-ins per week (one series)
     Weekly heatmap   average check-ins per Mass time ×
                      day of week, for planning schedules
                      and priest assignments

   Counts only include parishioners who checked in,
   so they are a floor, not a headcount. Capacity is a
   setting on this page, remembered in this browser.
   ============================================ */

import { client } from '../amplify-init.js';
import { isHeadAdmin } from '../auth.js';

const CAPACITY_KEY = 'sacradigit_church_capacity';
const DEFAULT_CAPACITY = 300;
const NEAR_FULL = 0.9;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const localIso = (d) => d.toLocaleDateString('en-CA');
const parseIso = (iso) => new Date(iso + 'T00:00:00');
const shortDate = (iso) => parseIso(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayDate = (iso) => parseIso(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const displayTime = (t) => (t || '').replace(/^0(\d)/, '$1') || 'Time not set';

function toMinutes(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
  if (!m) return 24 * 60;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

function mondayOf(iso) {
  const d = parseIso(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localIso(d);
}

/** 0, 50, 100, 150… — a clean axis maximum and step. */
function niceScale(max) {
  if (max <= 0) return { top: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  // Check-ins are whole people, so never a step below 1
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough));
  return { top: Math.ceil(max / step) * step, step };
}

document.addEventListener('DOMContentLoaded', () => {
  const root = $('att-root');

  if (!isHeadAdmin()) {
    $('att-restricted').classList.remove('hidden');
    root.classList.add('hidden');
    return;
  }
  if (!client.models.MassCheckIn) {
    $('att-unavailable').classList.remove('hidden');
    root.classList.add('hidden');
    return;
  }

  const rangeSel = $('att-range');
  const capacityInput = $('att-capacity');
  let capacity = DEFAULT_CAPACITY;
  try { capacity = parseInt(localStorage.getItem(CAPACITY_KEY), 10) || DEFAULT_CAPACITY; } catch { /* storage blocked */ }
  capacityInput.value = capacity;

  let checkins = [];

  client.models.MassCheckIn.observeQuery().subscribe({
    next: ({ items }) => { checkins = items; render(); },
    error: (err) => {
      console.error('Failed to load check-ins:', err);
      $('att-unavailable').textContent = 'Couldn’t load the check-in data.';
      $('att-unavailable').classList.remove('hidden');
    },
  });

  rangeSel.addEventListener('change', render);
  capacityInput.addEventListener('change', () => {
    capacity = Math.max(1, parseInt(capacityInput.value, 10) || DEFAULT_CAPACITY);
    capacityInput.value = capacity;
    try { localStorage.setItem(CAPACITY_KEY, String(capacity)); } catch { /* storage blocked */ }
    render();
  });

  function render() {
    const today = localIso(new Date());
    const from = new Date();
    from.setDate(from.getDate() - parseInt(rangeSel.value, 10) + 1);
    const fromIso = localIso(from);
    const inRange = checkins.filter(c => c.massDate && c.massDate >= fromIso && c.massDate <= today);

    // One entry per Mass celebrated (date + time)
    const massMap = new Map();
    for (const c of inRange) {
      const key = `${c.massDate}|${c.massTime || ''}`;
      if (!massMap.has(key)) massMap.set(key, { date: c.massDate, time: c.massTime || '', title: c.title || '', count: 0 });
      massMap.get(key).count += 1;
    }
    const masses = [...massMap.values()];

    renderStats(inRange, masses);
    renderFullest(masses);
    renderTrend(inRange, masses, fromIso, today);
    renderHeatmap(masses);
  }

  /* ---------- Stat tiles ---------- */
  function renderStats(inRange, masses) {
    const people = new Set(inRange.map(c => c.parishionerKey || c.parishionerName).filter(Boolean));
    $('stat-checkins').textContent = fmt(inRange.length);
    $('stat-masses').textContent = fmt(masses.length);
    $('stat-average').textContent = masses.length ? fmt(inRange.length / masses.length) : '0';
    $('stat-people').textContent = fmt(people.size);
  }

  /* ---------- Fullest Masses ---------- */
  function renderFullest(masses) {
    const list = $('fullest-list');
    const top = masses.slice().sort((a, b) => b.count - a.count || b.date.localeCompare(a.date)).slice(0, 8);
    $('fullest-sub').textContent = `Top ${top.length || ''} by check-ins · capacity ${fmt(capacity)}`.replace('Top  ', 'Top ');
    if (!top.length) {
      list.innerHTML = '';
      $('fullest-empty').classList.remove('hidden');
      $('fullest-table').innerHTML = '';
      return;
    }
    $('fullest-empty').classList.add('hidden');
    list.innerHTML = top.map(m => {
      const share = m.count / capacity;
      const pct = Math.round(share * 100);
      const near = share >= NEAR_FULL;
      const tip = `<b>${esc(dayDate(m.date))} · ${esc(displayTime(m.time))}</b>${fmt(m.count)} checked in · ${pct}% of ${fmt(capacity)} seats${m.title ? `<br>${esc(m.title)}` : ''}`;
      return `
        <li class="att-bar-row" tabindex="0" data-tip="${esc(tip)}">
          <span class="att-bar-label">${esc(dayDate(m.date))}<small>${esc(displayTime(m.time))}</small></span>
          <span class="att-bar-track"><span class="att-bar-fill" style="width:${Math.min(100, share * 100).toFixed(1)}%"></span></span>
          <span class="att-bar-value">${fmt(m.count)} <small>· ${pct}%</small>${share >= 1 ? '<span class="att-near-full" title="At or over the church capacity">▲ Full</span>' : near ? '<span class="att-near-full" title="At or above 90% of capacity">▲ Near capacity</span>' : ''}</span>
        </li>`;
    }).join('');
    $('fullest-table').innerHTML = tableHtml(['Mass', 'Check-ins', '% of capacity'],
      top.map(m => [`${dayDate(m.date)} · ${displayTime(m.time)}`, fmt(m.count), `${Math.round(m.count / capacity * 100)}%`]));
  }

  /* ---------- Over time: check-ins per week ---------- */
  function renderTrend(inRange, masses, fromIso, today) {
    const svg = $('trend-svg');
    const weeks = [];
    for (let w = mondayOf(fromIso); w <= today;) {
      weeks.push({ start: w, count: 0, masses: 0 });
      const d = parseIso(w); d.setDate(d.getDate() + 7); w = localIso(d);
    }
    const byWeek = new Map(weeks.map(w => [w.start, w]));
    inRange.forEach(c => { const w = byWeek.get(mondayOf(c.massDate)); if (w) w.count += 1; });
    masses.forEach(m => { const w = byWeek.get(mondayOf(m.date)); if (w) w.masses += 1; });

    if (!inRange.length) {
      svg.innerHTML = '';
      $('trend-empty').classList.remove('hidden');
      $('trend-table').innerHTML = '';
      return;
    }
    $('trend-empty').classList.add('hidden');

    const W = 640, H = 240, padL = 40, padR = 8, padT = 18, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const { top, step } = niceScale(Math.max(...weeks.map(w => w.count)));
    const slot = plotW / weeks.length;
    const barW = Math.min(24, Math.max(3, slot - 2)); // 2px surface gap between neighbours
    const y = (v) => padT + plotH - (v / top) * plotH;
    const labelEvery = Math.ceil(weeks.length / 8);

    let out = '';
    for (let v = 0; v <= top; v += step) {
      out += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`;
      out += `<text class="axis-text" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    }
    const peak = weeks.reduce((a, b) => (b.count > a.count ? b : a), weeks[0]);
    weeks.forEach((w, i) => {
      const cx = padL + slot * i + slot / 2;
      const x = cx - barW / 2;
      const h = Math.max(0, plotH - (y(w.count) - padT));
      const yTop = padT + plotH - h;
      const r = Math.min(4, barW / 2, h);
      // Rounded data end (top), square at the baseline
      const path = h > 0
        ? `M${x},${padT + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${padT + plotH} Z`
        : '';
      const tip = `<b>Week of ${esc(shortDate(w.start))}</b>${fmt(w.count)} check-ins across ${w.masses} Mass${w.masses === 1 ? '' : 'es'}`;
      out += `<rect class="col-hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}" tabindex="0" data-tip="${esc(tip)}"><title>Week of ${esc(shortDate(w.start))}: ${w.count}</title></rect>`;
      if (path) out += `<path class="col" d="${path}"/>`;
      if (i % labelEvery === 0) out += `<text class="axis-text" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(shortDate(w.start))}</text>`;
      if (w === peak && w.count > 0) out += `<text class="end-label" x="${cx}" y="${yTop - 5}" text-anchor="middle">${fmt(w.count)}</text>`;
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', `Check-ins per week, ${weeks.length} weeks. Highest: ${fmt(peak.count)} in the week of ${shortDate(peak.start)}.`);
    svg.innerHTML = out;
    $('trend-table').innerHTML = tableHtml(['Week of', 'Check-ins', 'Masses'],
      weeks.map(w => [shortDate(w.start), fmt(w.count), String(w.masses)]));
  }

  /* ---------- Weekly heatmap: Mass time × day of week ---------- */
  function renderHeatmap(masses) {
    const table = $('heatmap');
    if (!masses.length) {
      table.innerHTML = '';
      $('heat-empty').classList.remove('hidden');
      $('heat-legend').classList.add('hidden');
      $('heat-table').innerHTML = '';
      return;
    }
    $('heat-empty').classList.add('hidden');
    $('heat-legend').classList.remove('hidden');

    // Average check-ins per Mass for each (time, weekday)
    const cells = new Map();
    for (const m of masses) {
      const key = `${m.time}|${parseIso(m.date).getDay()}`;
      if (!cells.has(key)) cells.set(key, { total: 0, n: 0 });
      const c = cells.get(key); c.total += m.count; c.n += 1;
    }
    const times = [...new Set(masses.map(m => m.time))].sort((a, b) => toMinutes(a) - toMinutes(b));
    const max = Math.max(...[...cells.values()].map(c => c.total / c.n));
    const styles = getComputedStyle(root);
    const ramp = [1, 2, 3, 4, 5].map(i => styles.getPropertyValue(`--heat-${i}`).trim());

    let html = `<thead><tr><th scope="col"><span class="sr-only">Mass time</span></th>${DAYS.map(d => `<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>`;
    const rows = [];
    for (const t of times) {
      html += `<tr><th scope="row">${esc(displayTime(t))}</th>`;
      DAYS.forEach((d, dow) => {
        const c = cells.get(`${t}|${dow}`);
        if (!c) { html += '<td class="empty">–</td>'; return; }
        const avg = c.total / c.n;
        const bin = Math.min(5, Math.max(1, Math.ceil((avg / max) * 5)));
        const fill = ramp[bin - 1];
        const ink = luminance(fill) > 0.4 ? '#0b0b0b' : '#ffffff';
        const tip = `<b>${DAY_NAMES[dow]} · ${esc(displayTime(t))}</b>Average ${fmt(avg)} check-ins (${c.n} Mass${c.n === 1 ? '' : 'es'})${capacity ? ` · ${Math.round(avg / capacity * 100)}% of capacity` : ''}`;
        html += `<td tabindex="0" style="background-color:${fill};color:${ink}" data-tip="${esc(tip)}">${fmt(avg)}</td>`;
        rows.push([`${DAY_NAMES[dow]} ${displayTime(t)}`, fmt(avg), String(c.n)]);
      });
      html += '</tr>';
    }
    table.innerHTML = html + '</tbody>';
    $('heat-legend').innerHTML = `Fewer ${ramp.map(c => `<span class="sw" style="background-color:${c}"></span>`).join('')} More`;
    $('heat-table').innerHTML = tableHtml(['Day & time', 'Average check-ins', 'Masses'], rows);
  }

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function tableHtml(head, rows) {
    return `<table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  // The heatmap colours come from CSS tokens, so repaint on a theme switch.
  document.addEventListener('sacradigit:theme', () => requestAnimationFrame(render));

  /* ---------- Tooltip (hover and keyboard focus) ---------- */
  const tip = $('att-tip');
  function showTip(el, x, y) {
    tip.innerHTML = el.dataset.tip;
    tip.classList.remove('hidden');
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
    tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
  }
  const hideTip = () => tip.classList.add('hidden');
  root.addEventListener('mousemove', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY); else hideTip();
  });
  root.addEventListener('mouseleave', hideTip);
  root.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    showTip(el, r.left + r.width / 2, r.top);
  });
  root.addEventListener('focusout', hideTip);
});
