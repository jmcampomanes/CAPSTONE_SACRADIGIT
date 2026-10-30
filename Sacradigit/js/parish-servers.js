/* ============================================
   SacraDigit Admin — Parish Servers
   Runs after dashboard.js. Parishioners apply on their
   portal (user/user-parish-server.html) to be verified
   as Parish Servers. The Head Admin approves or
   declines each one here, and can remove the role
   later. The Secretary sees the list.

   Approving: the application is marked approved for a
   year, the account gets the Parish Server role (the
   'server' group, once the backend's setServerRole is
   deployed), and the parishioner sees it on their page
   and in their notifications (🔔). Verified
   servers count as verified on Ministry Bookings.
   Rules and backend: ../../shared/js/parish-servers.js.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUserName, isHeadAdmin } from '../../shared/js/auth.js';
import { logActivity } from '../../shared/js/activity-log.js';
import { showToast, confirmDialog, reasonDialog } from './admin-ui.js';
import {
  APPROVAL_MONTHS, serversReady, serverRoleReady, listApplications, latestPerPerson, standing, STANDING_LABEL,
  setServerRole, todayIso, addMonthsIso, longDate,
} from '../../shared/js/parish-servers.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  if (!serversReady()) {
    $('ps-unavailable').classList.remove('hidden');
    $('ps-main').classList.add('hidden');
    return;
  }

  let apps = [];
  const latest = () => latestPerPerson(apps);

  async function load() {
    try {
      apps = await listApplications();
      render();
    } catch (err) {
      console.error('Failed to load Parish Server applications:', err);
      $('ps-waiting').innerHTML = '<li class="empty-state">Couldn’t load applications. Please refresh.</li>';
    }
  }

  /* ---------- lists ---------- */
  function render() {
    const today = todayIso();
    const people = latest();
    const waiting = people.filter(a => standing(a, today) === 'pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const verified = people.filter(a => ['verified', 'expiring'].includes(standing(a, today)));
    $('stat-waiting').textContent = waiting.length;
    $('stat-verified').textContent = verified.length;
    $('stat-expiring').textContent = people.filter(a => standing(a, today) === 'expiring').length;

    $('ps-waiting-count').textContent = `${waiting.length} waiting`;
    $('ps-waiting').innerHTML = waiting.length ? waiting.map(a => `
      <li class="ps-item">
        <div class="min-w-0">
          <p class="ps-name">${esc(a.applicantName)}</p>
          <p class="ps-meta">${esc(a.role)} · ${esc(a.ministry)}${a.servingSince ? ` · since ${esc(a.servingSince)}` : ''}</p>
          <p class="ps-meta">Confirm with: <strong>${esc(a.confirmWith)}</strong>${a.contact ? ` · ${esc(a.contact)}` : ''} · applied ${longDate(a.createdAt)}</p>
          ${a.message ? `<p class="ps-msg">“${esc(a.message)}”</p>` : ''}
        </div>
        <div class="row-actions act-row">
          ${isHeadAdmin() ? `
            <button type="button" class="act-btn act-approve" data-approve="${a.id}">Approve</button>
            <button type="button" class="act-btn act-danger" data-decline="${a.id}">Decline…</button>`
          : '<span class="ps-meta">The Head Admin approves these.</span>'}
          <button type="button" class="act-btn" data-view="${a.id}">View</button>
        </div>
      </li>`).join('') : '<li class="empty-state">No applications waiting.</li>';

    const show = $('ps-show').value;
    const rows = show === 'verified' ? verified : people.filter(a => ['expired', 'declined', 'revoked'].includes(standing(a, today)));
    rows.sort((a, b) => String(a.applicantName).localeCompare(String(b.applicantName)));
    $('ps-count').textContent = `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`;
    $('ps-empty').classList.toggle('hidden', rows.length > 0);
    $('ps-empty-text').textContent = show === 'verified' ? 'No verified Parish Servers yet.' : 'Nobody here.';
    $('ps-tbody').innerHTML = rows.map(a => {
      const s = standing(a, today);
      const label = STANDING_LABEL[s];
      return `
        <tr>
          <td class="font-medium text-gray-900">${esc(a.applicantName)}</td>
          <td>${esc(a.ministry)}</td>
          <td>${esc(a.role)}</td>
          <td><span class="badge ${label.cls}" data-sd-status="s-${a.id}:${s}">${label.text}</span></td>
          <td>${a.validUntil && a.status === 'approved' ? longDate(a.validUntil) : '—'}</td>
          <td class="text-right"><div class="row-actions">
            <button type="button" class="act-btn" data-view="${a.id}">View</button>
            ${isHeadAdmin() && ['verified', 'expiring'].includes(s) ? `<button type="button" class="act-btn act-danger" data-revoke="${a.id}">Remove role…</button>` : ''}
          </div></td>
        </tr>`;
    }).join('');
  }
  $('ps-show').addEventListener('change', render);

  /* ---------- actions ---------- */
  document.querySelector('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view], [data-approve], [data-decline], [data-revoke]');
    if (!btn) return;
    const a = apps.find(x => x.id === (btn.dataset.view || btn.dataset.approve || btn.dataset.decline || btn.dataset.revoke));
    if (!a) return;
    if (btn.dataset.view) openDetails(a);
    else if (btn.dataset.approve) approve(a);
    else if (btn.dataset.decline) decline(a);
    else revoke(a);
  });

  const summary = (a) => `${a.applicantName}\n${a.role} · ${a.ministry}${a.servingSince ? ` · since ${a.servingSince}` : ''}\nConfirm with: ${a.confirmWith}`;

  async function save(a, changes, doneMsg) {
    try {
      const { data, errors } = await client.models.ServerApplication.update({ id: a.id, ...changes });
      if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
      Object.assign(a, data || changes);
      render();
      showToast(doneMsg); // they're told in their notifications (🔔) and on their Parish Server page
      return true;
    } catch (err) {
      console.error('Failed to update the application:', err);
      showToast(err.message || 'Couldn’t save. Please try again.', true);
      return false;
    }
  }

  async function approve(a) {
    const until = addMonthsIso(todayIso(), APPROVAL_MONTHS);
    const ok = await confirmDialog({
      title: 'Approve as a Parish Server?',
      message: `Approve only after checking with ${a.confirmWith}. They’ll be a verified Parish Server until ${longDate(until)}, and parish rooms booked for their ministry have no fee.`,
      detail: summary(a),
      confirmLabel: 'Approve',
      tone: 'approve',
    });
    if (!ok) return;
    const saved = await save(a, { status: 'approved', reviewedBy: currentUserName(), reviewedAt: new Date().toISOString(), validUntil: until, reason: null },
      `${a.applicantName} is now a verified Parish Server.`);
    if (!saved) return;
    logActivity('Approve', `Parish Server — ${a.applicantName} (${a.ministry})`);
    const role = await setServerRole(a.applicantKey, true);
    if (role === 'failed') showToast(`Approved, but the Parish Server role couldn’t be added to ${a.applicantName}’s account. Try again later.`, true);
  }

  async function decline(a) {
    const reason = await reasonDialog({
      title: 'Decline this application?',
      message: 'They’ll see the reason on their Parish Server page and can apply again.',
      detail: summary(a),
      input: { label: 'Reason', placeholder: 'e.g. The Lectors’ coordinator doesn’t know them yet' },
      confirmLabel: 'Decline',
    });
    if (!reason) return;
    const saved = await save(a, { status: 'declined', reviewedBy: currentUserName(), reviewedAt: new Date().toISOString(), reason },
      `${a.applicantName}’s application was declined.`);
    if (saved) logActivity('Decline', `Parish Server — ${a.applicantName}: ${reason}`);
  }

  async function revoke(a) {
    const reason = await reasonDialog({
      title: 'Remove the Parish Server role?',
      message: 'They stop being verified right away. They’ll see the reason and can apply again later.',
      detail: summary(a),
      input: { label: 'Reason', placeholder: 'e.g. No longer serving in the choir' },
      confirmLabel: 'Remove Role',
    });
    if (!reason) return;
    const saved = await save(a, { status: 'revoked', reviewedBy: currentUserName(), reviewedAt: new Date().toISOString(), reason },
      `${a.applicantName} is no longer a Parish Server.`);
    if (!saved) return;
    logActivity('Remove', `Parish Server role — ${a.applicantName}: ${reason}`);
    await setServerRole(a.applicantKey, false);
  }

  function openDetails(a) {
    const s = standing(a);
    const label = STANDING_LABEL[s];
    const row = (lbl, value, wide) => (value ? `<div${wide ? ' style="grid-column: 1 / -1;"' : ''}><p class="so-detail-label">${lbl}</p><p class="so-detail-value">${value}</p></div>` : '');
    $('ps-details-grid').innerHTML = [
      row('Name', esc(a.applicantName)),
      row('Status', `<span class="badge ${label.cls}">${label.text}</span>`),
      row('Ministry / Group', esc(a.ministry)),
      row('Role', esc(a.role)),
      row('Serving Since', esc(a.servingSince)),
      row('Confirm With', esc(a.confirmWith)),
      row('Contact Number', esc(a.contact)),
      row('Email', esc(a.email)),
      row('Their Message', esc(a.message), true),
      row('Applied', longDate(a.createdAt)),
      row(s === 'pending' ? '' : 'Reviewed By', a.reviewedBy ? `${esc(a.reviewedBy)}${a.reviewedAt ? `, ${longDate(a.reviewedAt)}` : ''}` : ''),
      row('Verified Until', a.status === 'approved' ? longDate(a.validUntil) : ''),
      row('Reason', esc(a.reason), true),
      row('Account Role', a.status === 'approved' && !serverRoleReady() ? 'Saved here; the account role is added once the backend’s setServerRole is deployed.' : '', true),
    ].join('');
    const m = $('ps-details-modal');
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  const closeDetails = () => { $('ps-details-modal').classList.add('hidden'); document.body.style.overflow = ''; };
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeDetails));
  $('ps-details-modal').addEventListener('click', (e) => { if (e.target.id === 'ps-details-modal') closeDetails(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetails(); });

  load();
  // New applications arrive while the page is open.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
});
