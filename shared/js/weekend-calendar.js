/* ============================================
   SacraDigit — inline weekend calendar
   A month calendar where only weekends can be picked
   (Mass runs Saturday evening through Sunday), from the
   next weekend whose Saturday is after today. Picking
   either day selects the whole Sat–Sun pair. Same look
   as the booking calendars (navy selected day, green
   available days, everything else dim).

   Used by the parishioner's Submit a Mass Intention
   page (user/user-mass-intentions.js, step 4).
   Styles are injected here (light + dark).
   ============================================ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** The Sat–Sun pair a weekend day belongs to. */
export function weekendPairFor(dayIso) {
  const d = new Date(dayIso + 'T00:00:00');
  const sat = new Date(d);
  if (d.getDay() === 0) sat.setDate(sat.getDate() - 1);
  const sun = new Date(sat);
  sun.setDate(sun.getDate() + 1);
  return { sat: iso(sat), sun: iso(sun) };
}

/** "Sat, Oct 24 – Sun, Oct 25, 2026" */
export function formatWeekend(satIso) {
  if (!satIso) return '';
  const { sun } = weekendPairFor(satIso);
  const f = (s, opts) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', opts);
  return `${f(satIso, { weekday: 'short', month: 'short', day: 'numeric' })} – ${f(sun, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Weekend mode: the whole weekend must still be ahead. Day mode: just that day (tomorrow on). */
function selectable(d, mode = 'weekend') {
  const dow = d.getDay();
  if (dow !== 0 && dow !== 6) return false;
  if (mode === 'day') return d > today();
  const sat = new Date(d);
  if (dow === 0) sat.setDate(sat.getDate() - 1);
  return sat > today(); // at least a day before the weekend's Mass
}

/** "Sunday, Oct 25, 2026" */
export function formatDay(dayIso) {
  return dayIso ? new Date(dayIso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

const STYLE = `
  .wkcal { border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1rem; background: #ffffff; max-width: 26rem; }
  .wkcal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .wkcal-month { font-size: 1rem; font-weight: 700; color: #1e2a4a; }
  .wkcal-nav { width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; background: #ffffff; color: #374151; font-size: 1.25rem; line-height: 1; cursor: pointer; }
  .wkcal-nav:disabled { opacity: 0.35; cursor: default; }
  .wkcal-nav:not(:disabled):hover { border-color: #8b8fc7; color: #1e2a4a; }
  .wkcal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.25rem; text-align: center; }
  .wkcal-dow { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em; color: #9ca3af; padding: 0.25rem 0; }
  .wkcal-dow.wk { color: #5b5fa8; }
  .wkcal-day { height: 2.75rem; border-radius: 0.6rem; border: 1px solid transparent; background: none; font: inherit; font-size: 0.9375rem; font-weight: 600; color: #d1d5db; cursor: default; }
  .wkcal-day.open { color: #15803d; cursor: pointer; }
  .wkcal-day.open:hover { background: #f3f3ff; border-color: #c7c9e8; }
  .wkcal-day.today { border-color: #c9a84c; }
  .wkcal-day.selected { background: #1e2a4a; border-color: #1e2a4a; color: #ffffff; }
  .wkcal-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eef0f4; font-size: 0.875rem; color: #6b7280; }
  .wkcal-foot strong { color: #1e2a4a; }
  .wkcal-clear { border: 0; background: none; font: inherit; font-weight: 600; color: #b91c1c; cursor: pointer; padding: 0.5rem; }
  .wkcal-clear[hidden] { display: none; }

  :root[data-theme="dark"] .wkcal { background: #1a2131; border-color: #2c3548; }
  :root[data-theme="dark"] .wkcal-month, :root[data-theme="dark"] .wkcal-foot strong { color: #e3e6ec; }
  :root[data-theme="dark"] .wkcal-nav { background: #1a2131; border-color: #3a4459; color: #b6bdca; }
  :root[data-theme="dark"] .wkcal-dow.wk { color: #b3b6e6; }
  :root[data-theme="dark"] .wkcal-day { color: #4b5466; }
  :root[data-theme="dark"] .wkcal-day.open { color: #8decb1; }
  :root[data-theme="dark"] .wkcal-day.open:hover { background: #121827; border-color: #393c60; }
  :root[data-theme="dark"] .wkcal-day.selected { background: #3d4a7a; border-color: #8b8fc7; color: #ffffff; }
  :root[data-theme="dark"] .wkcal-foot { border-color: #2c3548; color: #9ea6b5; }
  :root[data-theme="dark"] .wkcal-clear { color: #fca5a5; }

  /* weekends-only: pairs side by side; month dates show just the number */
  .wkcal-weekends { padding: 0.75rem; }
  .wkcal-weekends .wkcal-head { margin-bottom: 0.5rem; }
  .wkcal-weekends .wkcal-month { font-size: 0.9375rem; }
  .wkcal-weekends .wkcal-nav { width: 2rem; height: 2rem; font-size: 1rem; }
  .wkcal-weekends .wkcal-grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .wkcal-wk { display: grid; grid-template-columns: repeat(2, 2.375rem); gap: 0.125rem; padding: 0.25rem; border-radius: 0.625rem; border: 1px solid #eef0f4; }
  .wkcal-wk .wkcal-dow { padding: 0 0 0.125rem; font-size: 0.625rem; }
  .wkcal-wk .wkcal-day { height: 2rem; font-size: 0.875rem; }
  .wkcal-wk.picked { background: #eef0fa; border-color: #8b8fc7; box-shadow: 0 0 0 2px rgba(139, 143, 199, 0.25); }
  .wkcal-wk.picked .wkcal-dow { color: #1e2a4a; }
  :root[data-theme="dark"] .wkcal-wk { border-color: #2c3548; }
  :root[data-theme="dark"] .wkcal-wk.picked { background: #242c3e; border-color: #8b8fc7; }
  :root[data-theme="dark"] .wkcal-wk.picked .wkcal-dow { color: #e3e6ec; }
  .wkcal-day.other { font-weight: 500; font-size: 0.8125rem; }

  @media (max-width: 480px) { .wkcal { max-width: none; padding: 0.75rem; } .wkcal-day { height: 2.5rem; } }
`;

/**
 * Renders the calendar into `container`.
 * @param {HTMLElement} container
 * @param {object} [opts]
 * @param {(value: string) => void} [opts.onChange]  '' when cleared
 * @param {boolean} [opts.weekendsOnly]  show just Sat | Sun pairs (side by side)
 * @param {'weekend'|'day'} [opts.mode]  'weekend' (default): value is the weekend's Saturday;
 *        'day': value is the exact Saturday or Sunday picked (the admin assigns the Mass day)
 * @param {HTMLInputElement} [opts.input]  kept in step with the value (e.g. a hidden input)
 * @returns {{ getValue(): string, setValue(v: string): void, set(v: string): void, reset(): void }}
 */
export function createWeekendCalendar(container, { onChange = () => {}, weekendsOnly = false, mode = 'weekend', input = null } = {}) {
  if (!document.getElementById('wkcal-styles')) {
    const st = document.createElement('style');
    st.id = 'wkcal-styles';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  let value = '';   // weekend mode: that weekend's Saturday · day mode: the exact day
  const isDay = mode === 'day';
  const changed = () => { if (input) input.value = value; onChange(value); };
  let view = new Date(today().getFullYear(), today().getMonth(), 1);

  function dayButton(d, { otherMonth = false } = {}) {
    const key = iso(d);
    const pair = value ? weekendPairFor(value) : null;
    const on = isDay ? key === value : !!(pair && (key === pair.sat || key === pair.sun));
    const open = selectable(d, mode);
    const cls = ['wkcal-day', open ? 'open' : '', on ? 'selected' : '', d.getTime() === today().getTime() ? 'today' : '', otherMonth ? 'other' : ''].filter(Boolean).join(' ');
    const label = otherMonth && !weekendsOnly ? `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}` : d.getDate();
    return `<button type="button" class="${cls}" data-date="${key}" ${open ? '' : 'disabled tabindex="-1"'} aria-pressed="${on}">${label}</button>`;
  }

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const now = today();
    let cells;
    if (weekendsOnly) {
      // Weekends side by side across one row: each is a small Sat | Sun pair,
      // and the picked weekend is highlighted as one block.
      cells = '';
      const pair = value ? weekendPairFor(value) : null;
      const first = new Date(y, m, 1);
      const sat = new Date(y, m, 1 - ((first.getDay() + 1) % 7)); // the Saturday on or before the 1st
      while (true) {
        const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1);
        if (sat.getMonth() !== m && sun.getMonth() !== m && sat > first) break;
        if (sat.getMonth() === m || sun.getMonth() === m) {
          const picked = !!pair && pair.sat === iso(sat); // the weekend holding the value
          cells += `
            <div class="wkcal-wk${picked ? ' picked' : ''}">
              <span class="wkcal-dow wk">Sat</span><span class="wkcal-dow wk">Sun</span>
              ${dayButton(new Date(sat), { otherMonth: sat.getMonth() !== m })}${dayButton(sun, { otherMonth: sun.getMonth() !== m })}
            </div>`;
        }
        sat.setDate(sat.getDate() + 7);
      }
    } else {
      cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => `<span class="wkcal-dow${i === 0 || i === 6 ? ' wk' : ''}">${d}</span>`).join('');
      for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cells += '<span></span>';
      for (let day = 1; day <= new Date(y, m + 1, 0).getDate(); day++) cells += dayButton(new Date(y, m, day));
    }
    container.innerHTML = `
      <div class="wkcal${weekendsOnly ? ' wkcal-weekends' : ''}">
        <div class="wkcal-head">
          <button type="button" class="wkcal-nav" data-step="-1" aria-label="Previous month" ${y === now.getFullYear() && m === now.getMonth() ? 'disabled' : ''}>‹</button>
          <span class="wkcal-month">${MONTHS[m]} ${y}</span>
          <button type="button" class="wkcal-nav" data-step="1" aria-label="Next month">›</button>
        </div>
        <div class="wkcal-grid">${cells}</div>
        <div class="wkcal-foot" aria-live="polite">
          <span>${value ? (isDay ? `Mass day: <strong>${formatDay(value)}</strong>` : `Weekend: <strong>${formatWeekend(value)}</strong>`) : 'Tap a Saturday or Sunday.'}</span>
          <button type="button" class="wkcal-clear" ${value ? '' : 'hidden'}>Clear</button>
        </div>
      </div>`;
  }

  container.addEventListener('click', (e) => {
    const nav = e.target.closest('.wkcal-nav');
    if (nav && !nav.disabled) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.step), 1); render(); return; }
    const day = e.target.closest('.wkcal-day');
    if (day && !day.disabled) { value = isDay ? day.dataset.date : weekendPairFor(day.dataset.date).sat; render(); changed(); return; }
    if (e.target.closest('.wkcal-clear')) { value = ''; render(); changed(); }
  });

  render();
  // setValue/set don't call onChange (they load a saved value); they do update `input`.
  function setValue(v) {
    value = v ? (isDay ? v : weekendPairFor(v).sat) : '';
    if (input) input.value = value;
    const d = value ? new Date(value + 'T00:00:00') : today();
    view = new Date(d.getFullYear(), d.getMonth(), 1);
    render();
  }
  return {
    getValue: () => value,
    setValue,
    set: setValue, // older name the admin page uses
    reset: () => setValue(''),
  };
}
