/* ============================================
   SacraDigit Admin — Ministry Bookings
   Runs after dashboard.js. People who serve the
   parish book its rooms with no fee, once verified
   (rules: ministry-booking.js):

     New Ministry Booking → "Who is booking?"
       · on the Ministry Roster or on file → verified
       · otherwise the office records their ministry,
         role and who confirmed it (the Head Admin's
         word confirms it; the Secretary's waits for
         the Head Admin)
     → the shared booking screen (booking-wizard.js)
       picks the room, date and time, so ministry and
       regular bookings never clash.

   The Head Admin verifies or cancels waiting ones
   from the "Waiting for Verification" panel.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUserName, isHeadAdmin } from '../../shared/js/auth.js';
import { logBookingAction } from '../../shared/js/service-schedule.js';
import { ministryReady } from '../../shared/js/ministry.js';
import { serversReady, listApplications } from '../../shared/js/parish-servers.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../../shared/js/mobile-number.js';
import { trackArrivals, isFresh } from '../../shared/js/motion.js';
import { showToast, confirmDialog, reasonDialog } from './admin-ui.js';
import { createBookingWizard, formatShortDate } from './booking-wizard.js';
import {
  GROUPS, VOUCH_MONTHS, ROSTER_BACK_DAYS, ROSTER_AHEAD_DAYS, readMinistry, ministryNotes, checkServant,
  servantNames, verificationLabel, isoDay, addMonths, longDate,
} from './ministry-booking.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => isoDay(new Date());
  const headAdmin = () => isHeadAdmin();

  // Keep in step with facility-booking.js and user/user-facility-booking.js.
  const facilities = ['Multi-Purpose Hall', '3rd Floor Hall'];

  let bookings = [];   // every FacilityBooking (all of them block rooms)
  let signups = [];    // recent Ministry Roster sign-ups
  let servers = [];    // Parish Server applications (verified ones count)
  let pending = null;  // the person being booked for: { name, contact, info }

  /* ---------- Data ---------- */
  client.models.FacilityBooking.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      bookings = items;
      trackArrivals('ministry-bookings', items.filter(b => readMinistry(b)).map(b => b.id), isSynced);
      render();
      wizard.refresh();
    },
    error: (err) => {
      console.error('Failed to load bookings:', err);
      $('mb-tbody').innerHTML = '<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn’t load bookings.</td></tr>';
    },
  });

  async function loadSignups() {
    if (!ministryReady()) return;
    const from = isoDay(new Date(Date.now() - ROSTER_BACK_DAYS * 86400000));
    const to = isoDay(new Date(Date.now() + ROSTER_AHEAD_DAYS * 86400000));
    const all = [];
    let nextToken = null;
    try {
      do {
        const { data, nextToken: nt, errors } = await client.models.MinistrySignup.list({ filter: { massDate: { between: [from, to] } }, limit: 500, nextToken });
        if (errors) throw new Error(errors.map(e => e.message).join('; '));
        all.push(...(data || []));
        nextToken = nt;
      } while (nextToken);
      signups = all;
      fillNameSuggestions();
      if (!$('mb-who-modal').classList.contains('hidden')) runCheck();
    } catch (err) {
      console.error('Failed to load the Ministry Roster:', err);
    }
  }
  loadSignups();
  if (serversReady()) listApplications().then((apps) => { servers = apps; fillNameSuggestions(); }).catch(err => console.error('Failed to load Parish Servers:', err));

  /* ---------- Lists ---------- */
  const ministryBookings = () => bookings.map(b => ({ b, info: readMinistry(b) })).filter(x => x.info);
  const byWhen = (a, b) => (a.b.date + a.b.startTime).localeCompare(b.b.date + b.b.startTime);
  const timeRange = (b) => (b.endTime ? `${b.startTime} – ${b.endTime}` : b.startTime || '—');
  const hoursOf = (b) => {
    const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t || ''); if (!m) return null; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + +m[2]; };
    const s = toMin(b.startTime), e = toMin(b.endTime);
    return s !== null && e !== null && e > s ? (e - s) / 60 : 1;
  };

  function render() {
    const all = ministryBookings();
    const t = today();
    const month = t.slice(0, 7);
    const waiting = all.filter(x => x.info.waiting).sort(byWhen);
    $('stat-upcoming').textContent = all.filter(x => x.b.date >= t).length;
    $('stat-waiting').textContent = waiting.length;
    $('stat-hours').textContent = all.filter(x => !x.info.waiting && x.b.date.slice(0, 7) === month).reduce((h, x) => h + hoursOf(x.b), 0);

    // Waiting for the Head Admin
    $('mb-waiting-panel').classList.toggle('hidden', !waiting.length);
    $('mb-waiting-count').textContent = `${waiting.length} waiting`;
    $('mb-waiting-list').innerHTML = waiting.map(({ b, info }) => `
      <li class="mb-waiting-item">
        <div class="min-w-0">
          <p class="mb-person">${esc(b.requesterName)}</p>
          <p class="mb-meta">${esc(info.group)} · ${esc(info.role)} · confirmed with ${esc(info.confirmedWith)}</p>
          <p class="mb-meta">${esc(b.facilityName)}, ${formatShortDate(b.date)} · ${esc(timeRange(b))} · filed by ${esc(info.checkedBy)}</p>
        </div>
        <div class="row-actions act-row">
          ${headAdmin() ? `<button type="button" class="act-btn act-approve" data-verify="${b.id}">Verify</button>
          <button type="button" class="act-btn act-danger" data-reject="${b.id}">Not verified…</button>`
          : '<span class="mb-meta">The Head Admin verifies these.</span>'}
          <button type="button" class="act-btn" data-view="${b.id}">View</button>
        </div>
      </li>`).join('');

    // The bookings table
    const when = $('mb-when').value;
    const rows = all.filter(x => (when === 'past' ? x.b.date < t : x.b.date >= t)).sort(byWhen);
    if (when === 'past') rows.reverse();
    $('mb-count').textContent = `${rows.length} booking${rows.length === 1 ? '' : 's'}`;
    $('mb-empty').classList.toggle('hidden', rows.length > 0);
    $('mb-empty-text').textContent = when === 'past' ? 'No past ministry bookings.' : 'No upcoming ministry bookings.';
    $('mb-tbody').innerHTML = rows.map(({ b, info }) => {
      const v = verificationLabel(info);
      return `
        <tr${isFresh('ministry-bookings', b.id) ? ' class="sd-row-new"' : ''}>
          <td class="font-medium text-gray-900">${esc(b.requesterName)}<span class="mb-sub">${esc(info.group)}</span></td>
          <td>${esc(b.facilityName)} <span class="mb-fee">No fee</span></td>
          <td>${formatShortDate(b.date)}</td>
          <td>${esc(timeRange(b))}</td>
          <td><span class="badge ${v.cls}" data-sd-status="s-${b.id}:${v.cls}">${esc(v.text)}</span></td>
          <td class="text-right">
            <div class="row-actions">
              ${info.waiting && headAdmin() ? `<button type="button" class="act-btn act-approve" data-verify="${b.id}">Verify</button>` : ''}
              <button type="button" class="act-btn" data-view="${b.id}">View</button>
              ${b.date >= t ? `<button type="button" class="act-btn act-danger row-reject" data-cancel="${b.id}">Cancel…</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  }
  $('mb-when').addEventListener('change', render);

  /* ---------- Actions: view, verify, not verified, cancel ---------- */
  document.querySelector('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view], [data-verify], [data-reject], [data-cancel]');
    if (!btn) return;
    const b = bookings.find(x => x.id === (btn.dataset.view || btn.dataset.verify || btn.dataset.reject || btn.dataset.cancel));
    if (!b) return;
    if (btn.dataset.view) openDetails(b);
    else if (btn.dataset.verify) verify(b);
    else if (btn.dataset.reject) notVerified(b);
    else cancel(b);
  });

  function openDetails(b) {
    const info = readMinistry(b);
    const v = verificationLabel(info);
    const row = (label, value, wide) => value ? `<div${wide ? ' style="grid-column: 1 / -1;"' : ''}><p class="so-detail-label">${label}</p><p class="so-detail-value">${value}</p></div>` : '';
    $('mb-details-grid').innerHTML = [
      row('Booked For', esc(b.requesterName)),
      row('Contact Number', esc(info.contact)),
      row('Ministry / Group', esc(info.group)),
      row('Role', esc(info.role)),
      row('Facility', `${esc(b.facilityName)} <span class="mb-fee">No fee</span>`),
      row('Date', longDate(b.date)),
      row('Time', esc(timeRange(b))),
      row('Purpose', esc(b.purpose), true),
      row('Expected Attendees', b.attendees ? esc(b.attendees) : ''),
      row('Notes', esc(info.note), true),
      row('Verification', `<span class="badge ${v.cls}">${esc(v.text)}</span>`),
      row('Proof', esc(info.proof), true),
      row('Confirmed With', esc(info.confirmedWith)),
      row(info.verifiedBy ? 'Filed By' : 'Checked By', `${esc(info.checkedBy)}${info.checkedAt ? `, ${longDate(info.checkedAt.slice(0, 10))}` : ''}`),
      row('Verified By', info.verifiedBy ? `${esc(info.verifiedBy)}, ${longDate(info.verifiedAt.slice(0, 10))}` : ''),
      row('Vouch Valid Until', info.validUntil && !info.waiting ? longDate(info.validUntil) : ''),
    ].join('');
    openModal($('mb-details-modal'));
  }

  async function verify(b) {
    const info = readMinistry(b);
    const ok = await confirmDialog({
      title: 'Verify that they serve the parish?',
      message: `The booking is confirmed with no fee, and ${b.requesterName} is on file for ${VOUCH_MONTHS} months, so their next ministry bookings are verified automatically.`,
      detail: `${b.requesterName}\n${info.group} · ${info.role}\nConfirmed with: ${info.confirmedWith}\nFiled by: ${info.checkedBy}`,
      confirmLabel: 'Verify',
      tone: 'approve',
    });
    if (!ok) return;
    const now = new Date().toISOString();
    // checkedBy/checkedAt stay as filed (by the Secretary); verifiedBy/verifiedAt are the Head Admin's word.
    const verified = { ...info, waiting: false, method: 'vouched', verifiedBy: currentUserName(), verifiedAt: now, validUntil: addMonths(now.slice(0, 10), VOUCH_MONTHS) };
    delete verified.kind; delete verified.v;
    try {
      const { errors } = await client.models.FacilityBooking.update({ id: b.id, status: 'approved', notes: ministryNotes(verified) });
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      showToast(`${b.requesterName} verified — ${b.facilityName} confirmed, no fee.`);
    } catch (err) {
      console.error('Failed to verify:', err);
      showToast(err.message || 'Couldn’t verify. Please try again.', true);
    }
  }

  async function notVerified(b) {
    const reason = await reasonDialog({
      title: 'Not verified — cancel this booking?',
      message: 'The room is freed. Let them know they can book as a regular booking at the parish office.',
      detail: `${b.requesterName} · ${b.facilityName}, ${formatShortDate(b.date)} · ${timeRange(b)}`,
      input: { label: 'Why it couldn’t be verified', placeholder: 'e.g. Not a member of the Lectors’ ministry' },
      confirmLabel: 'Cancel Booking',
    });
    if (!reason) return;
    await remove(b, `Not verified: ${reason}`);
  }

  async function cancel(b) {
    const ok = await confirmDialog({
      title: 'Cancel this ministry booking?',
      message: 'The room is freed for others. This can’t be undone.',
      detail: `${b.requesterName} · ${b.facilityName}, ${formatShortDate(b.date)} · ${timeRange(b)}`,
      confirmLabel: 'Cancel Booking',
      cancelLabel: 'Keep Booking',
      tone: 'danger',
    });
    if (ok) await remove(b);
  }

  async function remove(b, note = '') {
    try {
      const { errors } = await client.models.FacilityBooking.delete({ id: b.id });
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
      logBookingAction(client, {
        action: 'Cancel',
        record: { type: `${b.facilityName} (ministry)`, requesterName: b.requesterName, date: b.date, time: b.startTime },
        reason: note || undefined,
      });
      showToast(`Ministry booking for ${b.requesterName} cancelled.`);
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      showToast(err.message || 'Couldn’t cancel the booking.', true);
    }
  }

  /* ---------- New ministry booking: who is booking? ---------- */
  const whoModal = $('mb-who-modal');
  const nameInput = $('mb-name');
  const contactInput = $('mb-contact');
  const checkBox = $('mb-check');
  const vouchBox = $('mb-vouch');
  const groupSelect = $('mb-group');
  groupSelect.innerHTML = `<option value="">Choose one…</option>${GROUPS.map(g => `<option>${esc(g)}</option>`).join('')}`;
  const OTHER = GROUPS[GROUPS.length - 1];

  function fillNameSuggestions() {
    $('mb-names').innerHTML = servantNames({ signups, bookings, servers, today: today() }).map(n => `<option value="${esc(n)}"></option>`).join('');
  }

  const fieldsToClear = ['mb-name', 'mb-contact', 'mb-group', 'mb-group-other', 'mb-role', 'mb-confirmed-with'];
  function setError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-error-msg'; input.insertAdjacentElement('afterend', msg); }
    msg.textContent = message;
  }
  function clearError(input) {
    input.classList.remove('has-error');
    input.parentElement.querySelector('.form-error-msg')?.remove();
  }

  let found = null; // checkServant() result for the typed name
  function runCheck() {
    const name = nameInput.value.trim();
    found = name.length >= 3 ? checkServant(name, { signups, bookings, servers, today: today() }) : null;
    checkBox.classList.toggle('hidden', name.length < 3);
    if (name.length < 3) { vouchBox.classList.add('hidden'); return; }
    if (found) {
      checkBox.className = 'mb-check is-verified';
      checkBox.innerHTML = `
        <span class="mb-check-icon" aria-hidden="true">✓</span>
        <div><p class="mb-check-title">Verified — ${{ server: 'a Parish Server', roster: 'on the Ministry Roster' }[found.method] || 'on file'}</p>
        <p class="mb-check-text">${esc(found.proof)}</p>
        ${found.validUntil ? `<p class="mb-check-text">${found.method === 'server' ? 'Verified' : 'On file'} until ${longDate(found.validUntil)}.</p>` : ''}
        <p class="mb-check-text"><strong>No fee</strong> for this booking.</p></div>`;
      vouchBox.classList.add('hidden');
    } else {
      checkBox.className = 'mb-check is-unknown';
      checkBox.innerHTML = `
        <span class="mb-check-icon" aria-hidden="true">?</span>
        <div><p class="mb-check-title">Not on the Ministry Roster or on file</p>
        <p class="mb-check-text">Record how they serve the parish below. ${headAdmin()
          ? 'As Head Admin, your word verifies them for the next ' + VOUCH_MONTHS + ' months.'
          : 'The Head Admin verifies it before the booking is confirmed; the room is held for them meanwhile.'}</p></div>`;
      vouchBox.classList.remove('hidden');
      $('mb-vouch-note').textContent = headAdmin() ? '' : 'Saved as “Waiting for the Head Admin”.';
    }
  }
  let checkTimer;
  nameInput.addEventListener('input', () => { clearError(nameInput); clearTimeout(checkTimer); checkTimer = setTimeout(runCheck, 250); });
  nameInput.addEventListener('change', runCheck);
  groupSelect.addEventListener('change', () => {
    clearError(groupSelect);
    $('mb-group-other-wrap').classList.toggle('hidden', groupSelect.value !== OTHER);
  });
  fieldsToClear.forEach(id => $(id).addEventListener('input', () => clearError($(id))));
  $('mb-attest').addEventListener('change', () => $('mb-attest').closest('.mb-attest').classList.remove('has-error'));

  $('btn-new-ministry-booking').addEventListener('click', () => {
    fieldsToClear.forEach(id => { $(id).value = ''; clearError($(id)); });
    $('mb-attest').checked = false;
    $('mb-attest').closest('.mb-attest').classList.remove('has-error');
    $('mb-group-other-wrap').classList.add('hidden');
    checkBox.classList.add('hidden');
    vouchBox.classList.add('hidden');
    found = null;
    fillNameSuggestions();
    openModal(whoModal);
    nameInput.focus();
  });

  $('mb-continue').addEventListener('click', () => {
    runCheck();
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const contact = contactInput.value.trim();
    let ok = true;
    if (name.length < 3) { setError(nameInput, 'Type their full name.'); ok = false; }
    if (contact && !isMobile(contact)) { setError(contactInput, MOBILE_HINT); ok = false; }
    const base = { contact: contact ? mobileDigits(contact) : '', checkedBy: currentUserName(), checkedAt: new Date().toISOString() };
    let info;
    if (ok && found) {
      info = { ...base, method: found.method, group: found.group, role: found.role, proof: found.proof, validUntil: found.validUntil || '', waiting: false };
    } else if (ok) {
      const group = groupSelect.value === OTHER ? $('mb-group-other').value.trim() : groupSelect.value;
      const role = $('mb-role').value.trim();
      const confirmedWith = $('mb-confirmed-with').value.trim();
      if (!groupSelect.value) { setError(groupSelect, 'Choose their ministry or group.'); ok = false; }
      else if (!group) { setError($('mb-group-other'), 'Type the name of the ministry or organization.'); ok = false; }
      if (!role) { setError($('mb-role'), 'Type their role.'); ok = false; }
      if (!confirmedWith) { setError($('mb-confirmed-with'), 'Who confirmed that they serve here?'); ok = false; }
      if (!$('mb-attest').checked) { $('mb-attest').closest('.mb-attest').classList.add('has-error'); ok = false; }
      const waiting = !headAdmin();
      info = {
        ...base, group, role, confirmedWith, waiting,
        method: waiting ? 'pending' : 'vouched',
        proof: `${role}, ${group}`,
        validUntil: waiting ? '' : addMonths(today(), VOUCH_MONTHS),
      };
    }
    if (!ok) { showToast('Please fix the highlighted fields.', true); return; }
    pending = { name, info };
    closeModal(whoModal);
    wizard.open();
  });

  /* ---------- The booking screen (shared with Facility Booking) ---------- */
  const wizard = createBookingWizard({
    client,
    facilities,
    getBookings: () => bookings,
    showToast,
    title: 'New Ministry Booking',
    sub: 'For someone who serves the parish: no fee. Pick the room and date, then the time.',
    purposeLabel: 'Purpose / Activity',
    askRequester: false, // who it’s for was settled on the Who Is Booking? step
    purposePlaceholder: 'e.g. Choir practice, Lectors’ formation',
    banner: () => {
      if (!pending) return '';
      const v = verificationLabel(pending.info);
      return `
        <div class="mb-banner">
          <div class="min-w-0">
            <p class="mb-banner-name">${esc(pending.name)} <span class="mb-fee">No fee</span></p>
            <p class="mb-banner-meta">${esc(pending.info.group)} · ${esc(pending.info.role)}</p>
          </div>
          <span class="badge ${v.cls}">${esc(v.text)}</span>
        </div>`;
    },
    confirmRows: () => {
      if (!pending) return '';
      const v = verificationLabel(pending.info);
      return `
        <div><p class="so-detail-label">Booked For</p><p class="so-detail-value">${esc(pending.name)}</p></div>
        <div><p class="so-detail-label">Ministry / Group</p><p class="so-detail-value">${esc(pending.info.group)}</p></div>
        <div><p class="so-detail-label">Fee</p><p class="so-detail-value"><span class="mb-fee">No fee</span></p></div>
        <div><p class="so-detail-label">Verification</p><p class="so-detail-value"><span class="badge ${v.cls}">${esc(v.text)}</span></p></div>`;
    },
    buildRecord: (base) => ({
      ...base,
      requesterName: pending.name,
      // Waiting ones hold the room, but aren't confirmed until the Head Admin verifies them.
      status: pending.info.waiting ? 'pending' : 'approved',
      // The booking notes field holds the verification; the office's own note goes inside it.
      notes: ministryNotes({ ...pending.info, ...(base.notes ? { note: base.notes } : {}) }),
    }),
    savedMessage: (rec) => (pending.info.waiting
      ? `${rec.facilityName} held for ${pending.name} — waiting for the Head Admin to verify.`
      : `${rec.facilityName} booked for ${pending.name}, ${formatShortDate(rec.date)} — no fee.`),
    onSaved: () => { pending = null; },
  });

  /* ---------- Dialogs ---------- */
  const dialogs = [whoModal, $('mb-details-modal')];
  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) { if (m.classList.contains('hidden')) return; m.classList.add('hidden'); document.body.style.overflow = ''; }
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => dialogs.forEach(closeModal)));
  dialogs.forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dialogs.forEach(closeModal); });
});
