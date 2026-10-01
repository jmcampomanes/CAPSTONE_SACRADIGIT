/* ============================================
   Sacra ITech — Service Schedules
   Edits the days, times and slots-per-time of
   each bookable service (Request a Service).
   Saves one ServiceSlot record per changed
   service; "Reset to default" deletes it so the
   built-in schedule in ../service-schedule.js
   applies again. Every change is recorded in
   Activity Logs.
   ============================================ */

import { client } from '../amplify-init.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES } from '../service-catalog.js';
import { DEFAULT_SERVICE_SCHEDULES, listServiceSlots, timeToMinutes } from '../service-schedule.js';
import { escapeHtml, showToast, logItAction } from './itech-shell.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const listEl = document.getElementById('ss-list');

/** Saved ServiceSlot record per service name. */
const saved = new Map();
/** What's on screen per service: { days: Set, times: [], capacity }. */
const draft = new Map();

const services = SERVICE_TYPES.filter(s => DEFAULT_SERVICE_SCHEDULES[s.name]);

/* ---------- time helpers ---------- */

/** "14:30" (time input) → "02:30 PM" (how schedules store times). */
function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

const sortTimes = (times) => [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

/* ---------- state ---------- */

function effective(name) {
  const base = DEFAULT_SERVICE_SCHEDULES[name];
  const r = saved.get(name);
  return {
    days: new Set(r?.days?.length ? r.days : base.days),
    times: sortTimes(r?.times?.length ? r.times : base.times),
    capacity: r?.capacity > 0 ? r.capacity : base.capacity,
  };
}

const sameSchedule = (a, b) =>
  [...a.days].sort().join() === [...b.days].sort().join() &&
  a.times.join() === b.times.join() &&
  Number(a.capacity) === Number(b.capacity);

const isDirty = (name) => !sameSchedule(draft.get(name), effective(name));

/* ---------- rendering ---------- */

function cardHtml(s) {
  const d = draft.get(s.name);
  const edited = saved.has(s.name);
  return `
  <article class="ss-card" data-name="${escapeHtml(s.name)}">
    <header class="ss-card-head">
      <div class="ss-card-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
      <h3 class="ss-card-title">${escapeHtml(s.name)}</h3>
      <span class="badge ${edited ? 'badge-teal' : 'badge-gray'}">${edited ? 'Edited' : 'Default'}</span>
    </header>

    <div class="ss-field">
      <p class="ss-label">Days</p>
      <div class="ss-days" role="group" aria-label="${escapeHtml(s.name)} days">
        ${DAY_NAMES.map((n, i) => `<button type="button" class="ss-day${d.days.has(i) ? ' on' : ''}" data-day="${i}" aria-pressed="${d.days.has(i)}">${n}</button>`).join('')}
      </div>
    </div>

    <div class="ss-field">
      <p class="ss-label">Times</p>
      <div class="ss-times">
        ${d.times.map(t => `<span class="ss-time">${escapeHtml(t)}<button type="button" class="ss-time-remove" data-time="${escapeHtml(t)}" aria-label="Remove ${escapeHtml(t)}">×</button></span>`).join('')}
        ${d.times.length ? '' : '<span class="ss-empty">No times — add at least one.</span>'}
      </div>
      <div class="ss-add-time">
        <input type="time" class="form-input ss-time-input" step="900" aria-label="New time for ${escapeHtml(s.name)}" />
        <button type="button" class="btn-secondary btn-sm ss-time-add">Add time</button>
      </div>
    </div>

    <div class="ss-field ss-capacity">
      <label class="ss-label" for="cap-${s.id}">Bookings per time slot</label>
      <input type="number" id="cap-${s.id}" class="form-input ss-capacity-input" min="1" max="500" value="${d.capacity}" />
    </div>

    <footer class="ss-card-foot">
      <button type="button" class="btn-secondary btn-sm ss-reset"${edited ? '' : ' disabled'} title="Go back to the built-in schedule">Reset to default</button>
      <button type="button" class="btn-teal btn-sm ss-save"${isDirty(s.name) ? '' : ' disabled'}>Save</button>
    </footer>
  </article>`;
}

function render() {
  listEl.innerHTML = SERVICE_CATEGORIES.map(cat => {
    const items = services.filter(s => s.category === cat.key);
    if (!items.length) return '';
    return `
    <section>
      <h2 class="ss-category">${escapeHtml(cat.label)}</h2>
      <div class="ss-grid">${items.map(cardHtml).join('')}</div>
    </section>`;
  }).join('');
}

function rerenderCard(name) {
  const s = services.find(x => x.name === name);
  const card = listEl.querySelector(`.ss-card[data-name="${CSS.escape(name)}"]`);
  if (!s || !card) return;
  const focusedTimeInput = document.activeElement?.classList.contains('ss-time-input');
  card.outerHTML = cardHtml(s);
  if (focusedTimeInput) listEl.querySelector(`.ss-card[data-name="${CSS.escape(name)}"] .ss-time-input`)?.focus();
}

/* ---------- editing ---------- */

listEl.addEventListener('click', async (e) => {
  const card = e.target.closest('.ss-card');
  if (!card) return;
  const name = card.dataset.name;
  const d = draft.get(name);

  const dayBtn = e.target.closest('.ss-day');
  if (dayBtn) {
    const day = Number(dayBtn.dataset.day);
    if (d.days.has(day)) d.days.delete(day); else d.days.add(day);
    return rerenderCard(name);
  }

  const removeBtn = e.target.closest('.ss-time-remove');
  if (removeBtn) {
    d.times = d.times.filter(t => t !== removeBtn.dataset.time);
    return rerenderCard(name);
  }

  if (e.target.closest('.ss-time-add')) return addTime(card, name);
  if (e.target.closest('.ss-save')) return save(name);
  if (e.target.closest('.ss-reset')) return reset(name);
});

listEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('ss-time-input')) {
    e.preventDefault();
    const card = e.target.closest('.ss-card');
    addTime(card, card.dataset.name);
  }
});

listEl.addEventListener('input', (e) => {
  if (!e.target.classList.contains('ss-capacity-input')) return;
  const card = e.target.closest('.ss-card');
  const name = card.dataset.name;
  draft.get(name).capacity = Number(e.target.value) || 0;
  card.querySelector('.ss-save').disabled = !isDirty(name);
});

function addTime(card, name) {
  const input = card.querySelector('.ss-time-input');
  if (!input.value) { showToast('Pick a time first.', true); input.focus(); return; }
  const d = draft.get(name);
  const t = to12h(input.value);
  if (d.times.includes(t)) { showToast(`${t} is already on the list.`, true); return; }
  d.times = sortTimes([...d.times, t]);
  rerenderCard(name);
}

async function save(name) {
  const d = draft.get(name);
  if (!d.days.size) { showToast('Choose at least one day.', true); return; }
  if (!d.times.length) { showToast('Add at least one time.', true); return; }
  if (!Number.isInteger(d.capacity) || d.capacity < 1 || d.capacity > 500) { showToast('Bookings per time slot must be 1–500.', true); return; }

  const fields = { serviceType: name, days: [...d.days].sort((a, b) => a - b), times: d.times, capacity: d.capacity };
  const existing = saved.get(name);
  try {
    const res = existing
      ? await client.models.ServiceSlot.update({ id: existing.id, ...fields })
      : await client.models.ServiceSlot.create(fields);
    if (res.errors?.length) throw new Error(res.errors.map(er => er.message).join('; '));
    saved.set(name, res.data);
    draft.set(name, effective(name));
    rerenderCard(name);
    showToast(`${name} schedule saved.`);
    logItAction('Updated service schedule', `${name}: ${fields.days.map(i => DAY_NAMES[i]).join(', ')} · ${fields.times.join(', ')} · ${fields.capacity}/slot`);
  } catch (err) {
    console.error('Could not save service schedule:', err);
    showToast(err.message || 'Could not save. Please try again.', true);
  }
}

async function reset(name) {
  const existing = saved.get(name);
  if (!existing) return;
  if (!confirm(`Reset ${name} to its built-in schedule?`)) return;
  try {
    const res = await client.models.ServiceSlot.delete({ id: existing.id });
    if (res.errors?.length) throw new Error(res.errors.map(er => er.message).join('; '));
    saved.delete(name);
    draft.set(name, effective(name));
    rerenderCard(name);
    showToast(`${name} is back to its default schedule.`);
    logItAction('Reset service schedule', name);
  } catch (err) {
    console.error('Could not reset service schedule:', err);
    showToast(err.message || 'Could not reset. Please try again.', true);
  }
}

/* ---------- load ---------- */

async function load() {
  try {
    const rows = await listServiceSlots();
    // Newest record wins if a service somehow has two.
    rows.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))
      .forEach(r => { if (DEFAULT_SERVICE_SCHEDULES[r.serviceType]) saved.set(r.serviceType, r); });
  } catch (err) {
    console.error('Could not load service schedules:', err);
    showToast('Could not load saved schedules — showing the defaults.', true);
  }
  services.forEach(s => draft.set(s.name, effective(s.name)));
  render();
}

load();
