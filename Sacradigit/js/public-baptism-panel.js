/* ============================================
   SacraDigit Admin — Public Baptism Dates
   Opened from Schedule Offers. The Head Admin or
   Secretary announces, edits and cancels the dates.
   Publishing shows a date on the homepage, in the
   parishioners' Announcements and on the Baptism
   request form. See ../../shared/js/public-baptism.js.

   Cancelling a date that has families registered
   needs a reason. Each family is emailed, and the
   list stays here until staff move every one of them
   with Reschedule on Schedule Offers.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import {
  watchDates, saveDate, cancelDate, seatsTaken, closingDateFor, fmtLong, fmtShort, isoOf,
  DEFAULT_CAPACITY, PUBLIC_DATE_KEY,
} from '../../shared/js/public-baptism.js';
import { displayTime } from '../../shared/js/time-picker.js';
import { notifyServiceUpdate } from '../../shared/js/email-notify.js';
import { reportEmail } from './admin-ui.js';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const ACTIVE = new Set(['scheduled', 'pending']);

const dateIdOf = (record) => {
  try { return (typeof record.details === 'string' ? JSON.parse(record.details) : record.details)?.[PUBLIC_DATE_KEY] || ''; } catch { return ''; }
};
// Someone moved with Reschedule no longer has this date, so they drop off the list.
const familiesOn = (records, d) => records.filter(r => r.type === 'Baptism' && ACTIVE.has(r.status) && dateIdOf(r) === d.id && r.date === d.date);

// <input type="time"> ↔ the "11:00 AM" stored on bookings
function to12(value) {
  const [h, m] = value.split(':').map(Number);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function to24(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12 || '');
  if (!m) return '';
  const h = parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function initPublicBaptismPanel({ showToast, getRecords }) {
  document.body.insertAdjacentHTML('beforeend', `
  <section id="pb-screen" class="svc-screen hidden" role="dialog" aria-modal="true" aria-labelledby="pb-title">
    <header class="svc-screen-bar">
      <button type="button" id="pb-back" class="svc-screen-back"><span>Back</span></button>
      <div class="svc-screen-heading">
        <h2 class="svc-screen-title" id="pb-title">Public Baptism Dates</h2>
        <p class="svc-screen-sub">Announce the dates families can join. Parishioners see them on the homepage and the Baptism request form.</p>
      </div>
    </header>
    <div class="svc-screen-body">
      <div class="svc-screen-cols">
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title" id="pb-form-title">Announce a Date</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="form-label" for="pb-date">Date <span class="text-red-500">*</span></label><input type="date" id="pb-date" class="form-input" /></div>
            <div><label class="form-label" for="pb-time">Time <span class="text-red-500">*</span></label><input type="time" id="pb-time" class="form-input" value="11:00" /></div>
            <div class="sm:col-span-2"><label class="form-label" for="pb-location">Location <span class="text-red-500">*</span></label><input type="text" id="pb-location" class="form-input" value="Main Church" /></div>
            <div><label class="form-label" for="pb-capacity">Number of families <span class="text-red-500">*</span></label><input type="number" id="pb-capacity" class="form-input" min="1" value="${DEFAULT_CAPACITY}" /></div>
            <div><label class="form-label" for="pb-closes">Registration closes <span class="text-red-500">*</span></label><input type="date" id="pb-closes" class="form-input" /></div>
            <div class="sm:col-span-2"><label class="form-label" for="pb-note">Note (optional)</label><input type="text" id="pb-note" class="form-input" placeholder="Shown with the date" /></div>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="button" id="pb-save" class="btn-lavender">Publish Date</button>
            <button type="button" id="pb-reset" class="btn-secondary hidden">Cancel Edit</button>
          </div>
        </div>
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Announced Dates</h3>
          <div id="pb-list" class="bt-admin-list"></div>
        </div>
      </div>
    </div>
  </section>

  <div id="pb-cancel-modal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header"><h3 class="modal-title">Cancel Public Baptism Date</h3></div>
      <div class="modal-body">
        <p class="text-sm text-gray-600" id="pb-cancel-text"></p>
        <label class="form-label mt-3" for="pb-cancel-reason">Reason <span class="text-red-500">*</span></label>
        <textarea id="pb-cancel-reason" class="form-input" rows="3"></textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="pb-cancel-back">Keep Date</button>
        <button type="button" class="btn-danger" id="pb-cancel-confirm">Cancel Date</button>
      </div>
    </div>
  </div>`);

  const $ = (id) => document.getElementById(id);
  const screen = $('pb-screen');
  const modal = $('pb-cancel-modal');
  let dates = [];
  let editingId = null;
  let cancelling = null;

  watchDates(client, (next) => { dates = next; render(); });

  function render() {
    if (screen.classList.contains('hidden')) return;
    const today = isoOf(new Date());
    const records = getRecords();
    const shown = dates.filter(d => d.date >= today || familiesOn(records, d).length);
    $('pb-list').innerHTML = shown.length ? shown.map(d => {
      const families = familiesOn(records, d);
      if (d.cancelled) {
        return `
        <article class="bt-admin-date is-cancelled">
          <p class="bt-admin-title">${esc(fmtLong(d.date))} <span class="badge badge-gray">Cancelled</span></p>
          <p class="bt-admin-sub">${esc(d.cancelReason)}</p>
          ${families.length ? `<p class="bt-admin-warn">Move ${families.length === 1 ? 'this family' : `these ${families.length} families`} with Reschedule on Schedule Offers:</p>
          <ul class="bt-admin-families">${families.map(f => `<li>${esc(f.requesterName)}${f.contact ? `, ${esc(f.contact)}` : ''}</li>`).join('')}</ul>` : '<p class="bt-admin-sub">All families have been moved.</p>'}
        </article>`;
      }
      return `
      <article class="bt-admin-date">
        <p class="bt-admin-title">${esc(fmtLong(d.date))}</p>
        <p class="bt-admin-sub">${esc(displayTime(d.time))}, ${esc(d.location)}</p>
        <p class="bt-admin-sub">${seatsTaken(records, d)} of ${d.capacity} families. Registration closes ${esc(fmtShort(d.closesOn))}.</p>
        <div class="flex gap-2 mt-2">
          <button type="button" class="btn-secondary" data-pb-edit="${esc(d.id)}">Edit</button>
          <button type="button" class="btn-danger-outline" data-pb-cancel="${esc(d.id)}">Cancel Date</button>
        </div>
      </article>`;
    }).join('') : '<p class="bt-empty">No dates announced yet.</p>';
  }

  function resetForm() {
    editingId = null;
    $('pb-form-title').textContent = 'Announce a Date';
    $('pb-save').textContent = 'Publish Date';
    $('pb-reset').classList.add('hidden');
    ['pb-date', 'pb-closes', 'pb-note'].forEach(id => { $(id).value = ''; });
    $('pb-time').value = '11:00';
    $('pb-location').value = 'Main Church';
    $('pb-capacity').value = DEFAULT_CAPACITY;
  }

  $('pb-date').addEventListener('change', () => {
    if ($('pb-date').value && !$('pb-closes').value) $('pb-closes').value = closingDateFor($('pb-date').value);
  });

  $('pb-save').addEventListener('click', async () => {
    const form = {
      date: $('pb-date').value, time: $('pb-time').value ? to12($('pb-time').value) : '', location: $('pb-location').value.trim(),
      capacity: Number($('pb-capacity').value), closesOn: $('pb-closes').value, note: $('pb-note').value.trim(),
    };
    const today = isoOf(new Date());
    if (!form.date || !form.time || !form.location || !form.closesOn) { showToast('Please fill in the date, time, location and closing date.', true); return; }
    if (form.date <= today) { showToast('Choose a date after today.', true); return; }
    if (form.closesOn > form.date) { showToast('Registration must close on or before the baptism date.', true); return; }
    if (!(form.capacity >= 1)) { showToast('Enter how many families can join.', true); return; }
    const editing = dates.find(d => d.id === editingId);
    if (editing) {
      const taken = familiesOn(getRecords(), editing).length;
      if (form.capacity < taken) { showToast(`${taken} families are already registered, so capacity can't go below that.`, true); return; }
      if (taken && (form.date !== editing.date || form.time !== editing.time)) {
        showToast('Families are registered on this date. Cancel it and move them instead of changing the date or time.', true);
        return;
      }
    }
    if (dates.some(d => !d.cancelled && d.id !== editingId && d.date === form.date && d.time === form.time)) {
      showToast('That date and time is already announced.', true);
      return;
    }
    $('pb-save').disabled = true;
    try {
      await saveDate(client, form, editingId);
      showToast(editingId ? 'Public baptism date updated.' : 'Public baptism date published.');
      resetForm();
    } catch (err) {
      console.error('Failed to save the public baptism date:', err);
      showToast(err.message || "Couldn't save the date.", true);
    } finally {
      $('pb-save').disabled = false;
    }
  });
  $('pb-reset').addEventListener('click', resetForm);

  $('pb-list').addEventListener('click', (e) => {
    const editId = e.target.closest('[data-pb-edit]')?.dataset.pbEdit;
    const cancelId = e.target.closest('[data-pb-cancel]')?.dataset.pbCancel;
    if (editId) {
      const d = dates.find(x => x.id === editId);
      editingId = editId;
      $('pb-form-title').textContent = 'Edit Date';
      $('pb-save').textContent = 'Save Changes';
      $('pb-reset').classList.remove('hidden');
      $('pb-date').value = d.date;
      $('pb-time').value = to24(d.time);
      $('pb-location').value = d.location;
      $('pb-capacity').value = d.capacity;
      $('pb-closes').value = d.closesOn;
      $('pb-note').value = d.note || '';
    }
    if (cancelId) {
      cancelling = dates.find(x => x.id === cancelId);
      const count = familiesOn(getRecords(), cancelling).length;
      $('pb-cancel-text').textContent = `${fmtLong(cancelling.date)}: ${count ? `${count} registered ${count === 1 ? 'family' : 'families'} will be emailed.` : 'no families are registered.'}`;
      $('pb-cancel-reason').value = '';
      modal.classList.remove('hidden');
    }
  });

  $('pb-cancel-back').addEventListener('click', () => modal.classList.add('hidden'));
  $('pb-cancel-confirm').addEventListener('click', async () => {
    const reason = $('pb-cancel-reason').value.trim();
    if (!reason) { showToast('Please give a reason.', true); return; }
    const btn = $('pb-cancel-confirm');
    btn.disabled = true;
    try {
      await cancelDate(client, cancelling, reason);
      const families = familiesOn(getRecords(), cancelling);
      families.filter(f => f.email).forEach(f => reportEmail(notifyServiceUpdate({
        to: f.email, name: f.requesterName, serviceType: 'Public Baptism', status: 'rescheduled',
        date: fmtLong(cancelling.date), time: cancelling.time, location: cancelling.location,
        declineReason: `This date was cancelled: ${reason}. The parish office will contact you with a new date.`,
      }), f.requesterName, `Public baptism date cancelled. ${f.requesterName} was notified.`));
      if (!families.some(f => f.email)) showToast(families.length ? 'Date cancelled. These families have no email on file, so call them.' : 'Date cancelled.');
      modal.classList.add('hidden');
    } catch (err) {
      console.error('Failed to cancel the public baptism date:', err);
      showToast(err.message || "Couldn't cancel the date.", true);
    } finally {
      btn.disabled = false;
    }
  });

  function close() {
    screen.classList.add('hidden');
    document.body.classList.remove('svc-screen-open');
    resetForm();
  }
  $('pb-back').addEventListener('click', close);
  $('btn-public-baptism').addEventListener('click', () => {
    screen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('svc-screen-open');
    render();
  });
}
