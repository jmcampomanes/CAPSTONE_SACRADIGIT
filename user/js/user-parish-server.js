/* ============================================
   SacraDigit — Parish Server (parishioner side)
   Runs after user-shell.js. A parishioner who serves
   the parish asks to be verified as a Parish Server;
   the Head Admin approves or declines it on the admin
   Parish Servers page. This page shows where their
   application stands, and the form when they can
   apply (first time, after a decline, or to renew).
   Rules and backend: ../../shared/js/parish-servers.js.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUser, currentUserName } from '../../shared/js/auth.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../../shared/js/mobile-number.js';
import { confirmDialog } from '../../shared/js/staff-ui.js'; // brings its own styles
import {
  SERVER_GROUPS, OTHER_GROUP, OTHER_ROLE, NO_CONFIRM, APPROVAL_MONTHS, serversReady, listApplications, latestPerPerson, standing, longDate,
  rolesFor, conditionsFor, applicationFieldsReady,
} from '../../shared/js/parish-servers.js';
import { myDetails, prefill } from '../../shared/js/profile-details.js';
import { consentBoxHtml, recordConsent } from '../../shared/js/consent.js';
import { submitServerApplication } from '../../shared/js/secure-actions.js';

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
    renderRoles();
    renderConditions();
  });

  function renderRoles() {
    const kept = $('ps-role').value;
    const roles = groupSelect.value ? rolesFor(groupSelect.value) : [];
    $('ps-role').innerHTML = `<option value="">Choose one…</option>${roles.map(r => `<option>${esc(r)}</option>`).join('')}`;
    if (roles.includes(kept)) $('ps-role').value = kept;
    $('ps-role-other-wrap').classList.toggle('hidden', $('ps-role').value !== OTHER_ROLE);
  }
  $('ps-role').addEventListener('change', () => {
    clearError($('ps-role'));
    $('ps-role-other-wrap').classList.toggle('hidden', $('ps-role').value !== OTHER_ROLE);
  });

  function renderConditions() {
    const list = groupSelect.value ? conditionsFor(groupSelect.value) : [];
    $('ps-conditions').innerHTML = list.length ? `
      <fieldset class="ps-conditions" id="ps-conditions-set">
        <legend class="form-label">Please answer each one <span class="text-red-500">*</span></legend>
        ${list.map((q, i) => `
          <div class="ps-condition">
            <span>${esc(q)}</span>
            <span class="ps-condition-yn">
              <label><input type="radio" name="ps-cond-${i}" value="yes" /> Yes</label>
              <label><input type="radio" name="ps-cond-${i}" value="no" /> No</label>
            </span>
          </div>`).join('')}
      </fieldset>` : '';
  }

  /* First time serving / Already serving */
  let firstTime = true;
  function showTab(tab) {
    firstTime = tab === 'new';
    document.querySelectorAll('[data-ps-tab]').forEach(b => {
      const on = b.dataset.psTab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('ps-since-wrap').classList.toggle('hidden', firstTime);
    $('ps-tab-hint').textContent = firstTime
      ? 'New to serving? Tell us where you’d like to help. The admin will assess your application.'
      : 'Already part of a ministry or group? Tell us where you serve so we can verify you.';
  }
  document.querySelectorAll('[data-ps-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.psTab)));
  showTab('new');

  $('ps-consent-mount').innerHTML = consentBoxHtml('ps-consent');
  myDetails(currentUserName()).then(saved => prefill($('ps-contact'), saved.phone));

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
    let formTitle = 'Become a Parish Server';
    statusEl.classList.add('hidden');

    if (s === 'pending') {
      showForm = false;
      card('wait', ICON.wait, 'Waiting for the parish office',
        [`You applied on ${longDate(mine.createdAt)} as ${what}.`, 'The Head Admin assesses it. You’ll get a notice (🔔) when it’s done.'],
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
      if (rolesFor(groupSelect.value).includes(mine.role)) $('ps-role').value = mine.role;
      else { $('ps-role').value = OTHER_ROLE; $('ps-role-other').value = mine.role || ''; }
      $('ps-role').dispatchEvent(new Event('change'));
      $('ps-since').value = mine.servingSince || '';
      showTab('serving');
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
    const role = $('ps-role').value === OTHER_ROLE ? $('ps-role-other').value.trim() : $('ps-role').value;
    const since = $('ps-since').value.trim();
    const contact = $('ps-contact').value.trim();
    let ok = true;
    if (!groupSelect.value) { setError(groupSelect, 'Choose your ministry or group.'); ok = false; }
    else if (!group) { setError($('ps-group-other'), 'Type the name of the ministry or organization.'); ok = false; }
    if (!$('ps-role').value) { setError($('ps-role'), 'Choose your role.'); ok = false; }
    else if (!role) { setError($('ps-role-other'), 'Type your role.'); ok = false; }
    if (since && !/^(19|20)\d{2}$/.test(since)) { setError($('ps-since'), 'Type the year, e.g. 2019.'); ok = false; }
    if (!contact) { setError($('ps-contact'), 'Contact number is required.'); ok = false; }
    else if (!isMobile(contact)) { setError($('ps-contact'), MOBILE_HINT); ok = false; }
    if (!$('ps-attest').checked) { $('ps-attest-wrap').classList.add('has-error'); ok = false; }
    const questions = groupSelect.value ? conditionsFor(groupSelect.value) : [];
    const answers = questions.map((q, i) => ({ q, a: document.querySelector(`input[name="ps-cond-${i}"]:checked`)?.value || '' }));
    const conditionsSet = $('ps-conditions-set');
    conditionsSet?.classList.toggle('has-error', answers.some(x => !x.a));
    if (answers.some(x => !x.a)) ok = false;
    $('ps-consent-box').classList.toggle('has-error', !$('ps-consent').checked);
    if (!$('ps-consent').checked) ok = false;
    if (!ok) { toast('Please fix the highlighted fields.', true); return; }

    const btn = $('ps-submit');
    btn.disabled = true;
    try {
      const { data } = await submitServerApplication({
        applicantKey: me.sub,
        applicantName: currentUserName(),
        email: me.email || undefined,
        contact: mobileDigits(contact),
        ministry: group,
        role,
        servingSince: firstTime ? undefined : since || undefined,
        confirmWith: NO_CONFIRM,
        message: [
          $('ps-message').value.trim(),
          ...(applicationFieldsReady() ? [] : [firstTime ? 'First time serving.' : '', answers.map(x => `${x.q} ${x.a === 'yes' ? 'Yes' : 'No'}`).join(' ')]),
        ].filter(Boolean).join('\n') || undefined,
        ...(applicationFieldsReady() ? { conditions: JSON.stringify(answers), isFirstTime: firstTime } : {}),
        status: 'pending',
      });
      await recordConsent(client, me.sub, 'parish-server');
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
