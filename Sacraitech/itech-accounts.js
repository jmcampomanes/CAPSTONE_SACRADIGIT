/* ============================================
   Sacra ITech — sign-in accounts (Cognito)
   Lists every account and lets the IT team set
   each person's role (Cognito group), add staff
   accounts, and switch accounts off/on.

   Backed by IT-only backend operations:
     queries.listUsers()
     mutations.setUserRole({ username, role })
     mutations.createStaffUser({ email, firstName, lastName, role })
     mutations.setUserEnabled({ username, enabled })
   Until they're deployed, the panel says so.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUser, ROLES } from '../auth.js';
import { escapeHtml, showToast, logItAction } from './itech-shell.js';

const ROLE_CHOICES = ['parishioner', 'staff', 'admin', 'media', 'itech'];

const ready = () => !!(client.queries?.listUsers && client.mutations?.setUserRole && client.mutations?.createStaffUser && client.mutations?.setUserEnabled);
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const failed = (res) => (res.errors?.length ? res.errors.map(e => e.message).join('; ') : null);

function roleOf(u) {
  const g = u.groups || [];
  return ['admin', 'itech', 'staff', 'media'].find(r => g.includes(r)) || 'parishioner';
}

const STATUS = {
  CONFIRMED: ['Active', 'acct-ok'],
  UNCONFIRMED: ['Email not confirmed', 'acct-warn'],
  FORCE_CHANGE_PASSWORD: ['Invited — first sign-in pending', 'acct-warn'],
  RESET_REQUIRED: ['Password reset needed', 'acct-warn'],
};

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const tbody = $('acct-tbody');
  const me = currentUser();
  let accounts = [];

  $('acct-role').innerHTML = ROLE_CHOICES.filter(r => r !== 'parishioner')
    .map(r => `<option value="${r}">${escapeHtml(ROLES[r].label)}</option>`).join('');

  if (!ready()) {
    $('acct-not-ready').classList.remove('hidden');
    $('acct-table-wrap').classList.add('hidden');
    $('btn-new-account').disabled = true;
    return;
  }

  async function load() {
    try {
      const res = await client.queries.listUsers();
      const err = failed(res); if (err) throw new Error(err);
      accounts = parse(res.data) || [];
      render();
    } catch (err) {
      console.error('Failed to load accounts:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Couldn’t load accounts. ${escapeHtml(err.message || '')}</td></tr>`;
    }
  }

  function render() {
    const q = $('acct-search').value.trim().toLowerCase();
    const rows = accounts
      .filter(u => !q || `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (roleOf(a) === 'parishioner') - (roleOf(b) === 'parishioner') || String(a.email).localeCompare(String(b.email)));
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No accounts match.</td></tr>'; return; }
    tbody.innerHTML = rows.map(u => {
      const role = roleOf(u);
      const isMe = me && (u.sub === me.sub || u.email === me.email);
      const [statusLabel, statusClass] = u.enabled === false ? ['Disabled', 'acct-off'] : (STATUS[u.status] || [u.status || '—', 'acct-warn']);
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
      return `
        <tr data-username="${escapeHtml(u.username)}">
          <td class="font-medium">${escapeHtml(name)}${isMe ? ' <span class="acct-you">You</span>' : ''}</td>
          <td>${escapeHtml(u.email || '')}</td>
          <td>
            <select class="form-input acct-role-select" data-role-for="${escapeHtml(u.username)}" ${isMe ? 'disabled title="You can’t change your own role"' : ''}>
              ${ROLE_CHOICES.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${escapeHtml(ROLES[r].label)}</option>`).join('')}
            </select>
          </td>
          <td><span class="acct-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td class="text-right">
            ${isMe ? '' : `<button type="button" class="btn-link ${u.enabled === false ? '' : 'danger'}" data-toggle-enabled="${escapeHtml(u.username)}">${u.enabled === false ? 'Enable' : 'Disable'}</button>`}
          </td>
        </tr>`;
    }).join('');
  }

  $('acct-search').addEventListener('input', render);

  tbody.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-role-for]');
    if (!sel) return;
    const username = sel.dataset.roleFor;
    const u = accounts.find(a => a.username === username);
    const before = roleOf(u);
    const role = sel.value;
    if (!confirm(`Change ${u.email} from ${ROLES[before].label} to ${ROLES[role].label}? They’ll get the new access the next time they sign in.`)) { sel.value = before; return; }
    sel.disabled = true;
    try {
      const res = await client.mutations.setUserRole({ username, role });
      const err = failed(res) || (parse(res.data)?.ok === false && parse(res.data).message); if (err) throw new Error(err);
      u.groups = role === 'parishioner' ? [] : [role];
      logItAction('Change Role', `${u.email}: ${ROLES[before].label} → ${ROLES[role].label}`);
      showToast(`${u.email} is now ${ROLES[role].label}.`);
    } catch (err) {
      console.error('Failed to change role:', err);
      sel.value = before;
      showToast(err.message || 'Couldn’t change the role.', true);
    } finally {
      sel.disabled = false;
    }
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle-enabled]');
    if (!btn) return;
    const u = accounts.find(a => a.username === btn.dataset.toggleEnabled);
    const enable = u.enabled === false;
    if (!confirm(enable ? `Let ${u.email} sign in again?` : `Disable ${u.email}? They won’t be able to sign in until you enable the account again.`)) return;
    btn.disabled = true;
    try {
      const res = await client.mutations.setUserEnabled({ username: u.username, enabled: enable });
      const err = failed(res) || (parse(res.data)?.ok === false && parse(res.data).message); if (err) throw new Error(err);
      u.enabled = enable;
      logItAction(enable ? 'Enable Account' : 'Disable Account', u.email);
      render();
      showToast(enable ? `${u.email} can sign in again.` : `${u.email} is disabled.`);
    } catch (err) {
      console.error('Failed to update account:', err);
      showToast(err.message || 'Couldn’t update the account.', true);
      btn.disabled = false;
    }
  });

  /* ---------- add staff account ---------- */
  const modal = $('acct-modal');
  const open = () => { ['acct-first', 'acct-last', 'acct-email'].forEach(id => { $(id).value = ''; }); $('acct-role').value = 'staff'; modal.classList.remove('hidden'); $('acct-first').focus(); };
  const close = () => modal.classList.add('hidden');
  $('btn-new-account').addEventListener('click', open);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close-acct]')) close(); });

  $('acct-save').addEventListener('click', async () => {
    const firstName = $('acct-first').value.trim();
    const lastName = $('acct-last').value.trim();
    const email = $('acct-email').value.trim().toLowerCase();
    const role = $('acct-role').value;
    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a first name, last name, and a valid email.', true); return; }
    const btn = $('acct-save');
    btn.disabled = true;
    try {
      const res = await client.mutations.createStaffUser({ email, firstName, lastName, role });
      const err = failed(res) || (parse(res.data)?.ok === false && parse(res.data).message); if (err) throw new Error(err);
      logItAction('Create Account', `${email} as ${ROLES[role].label}`);
      close();
      showToast(`Account created. ${email} will get an email with a temporary password.`);
      load();
    } catch (err) {
      console.error('Failed to create account:', err);
      showToast(err.message || 'Couldn’t create the account.', true);
    } finally {
      btn.disabled = false;
    }
  });

  load();
});
