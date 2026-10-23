/* ============================================
   SacraDigit — Parish Server (parishioner side)
   Runs after user-shell.js. A parishioner who serves
   the parish asks to be verified as a Parish Server;
   the Head Admin approves or declines it on the admin
   Parish Servers page. This page shows where their
   application stands, and the form when they can
   apply (first time, after a decline, or to renew).
   Rules and backend: ../parish-servers.js.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUser, currentUserName } from '../auth.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../mobile-number.js';
import { confirmDialog } from '../staff-ui.js'; // brings its own styles
import {
  SERVER_GROUPS, OTHER_GROUP, APPROVAL_MONTHS, serversReady, listApplications, latestPerPerson, standing, longDate,
} from '../parish-servers.js';

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, isError) => window.showToast?.(msg, isError);
  const me = currentUser() || {};

  if (!serversReady()) {
    $('ps-unavailable').classList.remove('hidden');
    return;
  }

  const statusEl = $('ps-status');
  const formPanel = $('ps-form-panel');
  const groupSelect = $('ps-group');
  groupSelect.innerHTML = `<option value="">Choose one…</option>${SERVER_GROUPS.map(g => `<option>${esc(g)}</option>`).join('')}`;
  groupSelect.addEventListener('change', () => {
    clearError(groupSelect);
    $('ps-group-other-wrap').classList.toggle('hidden', groupSelect.value !== OTHER_GROUP);
  });

  let mine = null; // my latest application

  async function load() {
    try {
      const apps = await listApplications();
      mine = latestPerPerson(apps.filter(a => a.applicantKey === me.sub))[0] || null;
    } catch (err) {
      console.error('Failed to load your Parish Server application:', err);
      statusEl.className = 'ps-status is-error';
      statusEl.innerHTML = '<p class="ps-status-text">Couldn’t load your application. Please refresh the page.</p>';
      statusEl.classList.remove('hidden');
      return;
    }
    render();
  }

  /* ---------- where it stands ---------- */
  const ICON = { ok: '✓', wait: '…', no: '!' };
  function card(tone, icon, title, lines, actions = '') {
    statusEl.className = `ps-status is-${tone}`;
    statusEl.innerHTML = `
      <span class="ps-status-icon" aria-hidden="true">${icon}</span>
      <div class="min-w-0 flex-1">
        <p class="ps-status-title">${title}</p>
        ${lines.filter(Boolean).map(l => `<p class="ps-status-text">${l}</p>`).join('')}
      </div>
      ${actions}`;
    statusEl.classList.remove('hidden');
  }

  function render() {
    const s = standing(mine);
    const what = mine ? `${esc(mine.role)}, ${esc(mine.ministry)}` : '';
    let showForm = true;
    let formTitle = 'Apply as a Parish Server';
    statusEl.classList.add('hidden');

    if (s === 'pending') {
      showForm = false;
      card('wait', ICON.wait, 'Waiting for the parish office',
        [`You applied on ${longDate(mine.createdAt)} as ${what}.`, 'The Head Admin checks with the person you named, then approves it. You’ll get a notice (🔔) when it’s done.'],
        '<button type="button" class="btn-secondary ps-status-action" id="ps-withdraw">Withdraw</button>');
    } else if (s === 'verified') {
      showForm = false;
      card('ok', ICON.ok, 'You’re a verified Parish Server', [`${what}.`, `Verified until ${longDate(mine.validUntil)}.`]);
    } else if (s === 'expiring') {
      formTitle = 'Renew Your Parish Server Verification';
      card('ok', ICON.ok, 'You’re a verified Parish Server — renew soon', [`${what}.`, `Your verification ends on ${longDate(mine.validUntil)}. Send the form below to renew it.`]);
    } else if (s === 'expired') {
      formTitle = 'Renew Your Parish Server Verification';
      card('no', ICON.no, 'Your Parish Server verification has ended', [`It ended on ${longDate(mine.validUntil)}. Send the form below to renew it.`]);
    } else if (s === 'declined') {
      card('no', ICON.no, 'Your application wasn’t approved',
        [mine.reason ? `Reason: ${esc(mine.reason)}` : '', 'You can apply again below, or ask at the parish office.']);
    } else if (s === 'revoked') {
      card('no', ICON.no, 'Your Parish Server role was removed',
        [mine.reason ? `Reason: ${esc(mine.reason)}` : '', 'If you serve again, you can apply below.']);
    }

    formPanel.classList.toggle('hidden', !showForm);
    $('ps-form-title').textContent = formTitle;
    // Renewing: start from what they sent last time.
    if (showForm && mine && !$('ps-role').value) {
      if (SERVER_GROUPS.includes(mine.ministry)) groupSelect.value = mine.ministry;
      else { groupSelect.value = OTHER_GROUP; $('ps-group-other').value = mine.ministry || ''; }
      groupSelect.dispatchEvent(new Event('change'));
      $('ps-role').value = mine.role || '';
      $('ps-since').value = mine.servingSince || '';
      $('ps-confirm').value = mine.confirmWith || '';
      $('ps-contact').value = mine.contact || '';
    }
    $('ps-withdraw')?.addEventListener('click', withdraw);
  }

  async function withdraw() {
    if (!mine) return;
    const ok = await confirmDialog({ title: 'Withdraw your application?', message: 'The parish office won’t review it. You can apply again anytime.', confirmLabel: 'Withdraw', cancelLabel: 'Keep It', tone: 'danger' });
    if (!ok) return;
    try {
      const { errors } = await client.models.ServerApplication.delete({ id: mine.id });
      if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
      toast('Your application was withdrawn.');
      mine = null;
      render();
    } catch (err) {
      console.error('Failed to withdraw:', err);
      toast('Couldn’t withdraw it. Please try again.', true);
    }
  }

  /* ---------- the form ---------- */
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
  formPanel.addEventListener('input', (e) => { if (e.target.matches('.form-input')) clearError(e.target); });
  $('ps-attest').addEventListener('change', () => $('ps-attest-wrap').classList.remove('has-error'));

  $('ps-submit').addEventListener('click', async () => {
    const group = groupSelect.value === OTHER_GROUP ? $('ps-group-other').value.trim() : groupSelect.value;
    const role = $('ps-role').value.trim();
    const since = $('ps-since').value.trim();
    const confirmWith = $('ps-confirm').value.trim();
    const contact = $('ps-contact').value.trim();
    let ok = true;
    if (!groupSelect.value) { setError(groupSelect, 'Choose your ministry or group.'); ok = false; }
    else if (!group) { setError($('ps-group-other'), 'Type the name of the ministry or organization.'); ok = false; }
    if (!role) { setError($('ps-role'), 'Type your role.'); ok = false; }
    if (since && !/^(19|20)\d{2}$/.test(since)) { setError($('ps-since'), 'Type the year, e.g. 2019.'); ok = false; }
    if (!confirmWith) { setError($('ps-confirm'), 'Who can confirm that you serve here?'); ok = false; }
    if (!contact) { setError($('ps-contact'), 'Contact number is required.'); ok = false; }
    else if (!isMobile(contact)) { setError($('ps-contact'), MOBILE_HINT); ok = false; }
    if (!$('ps-attest').checked) { $('ps-attest-wrap').classList.add('has-error'); ok = false; }
    if (!ok) { toast('Please fix the highlighted fields.', true); return; }

    const btn = $('ps-submit');
    btn.disabled = true;
    try {
      const { data, errors } = await client.models.ServerApplication.create({
        applicantKey: me.sub,
        applicantName: currentUserName(),
        email: me.email || undefined,
        contact: mobileDigits(contact),
        ministry: group,
        role,
        servingSince: since || undefined,
        confirmWith,
        message: $('ps-message').value.trim() || undefined,
        status: 'pending',
      });
      if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
      mine = data;
      toast(`Sent! The parish office will verify it — approval lasts ${APPROVAL_MONTHS} months.`);
      render();
      statusEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Failed to send application:', err);
      toast('Couldn’t send it. Please try again.', true);
    } finally {
      btn.disabled = false;
    }
  });

  load();
});
