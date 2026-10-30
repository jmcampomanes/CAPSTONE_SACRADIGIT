/* ============================================
   SacraDigit Admin — My Profile Scripts (AWS Amplify)
   Runs after dashboard.js.

   Profile Info and the photo are saved to the database
   (../../shared/js/staff-profile.js — the same ParishionerPreference
   record the parishioner My Profile uses). Security's
   Change Password is real: it changes the signed-in
   account's Cognito password (../../shared/js/password-change.js).
   Notifications and Two-Factor are still this-session only.

   The Activity Log tab is wired to the AccessLog model
   (userName, fileName, action, createdAt), the same model
   Sacra ITech reads for its Activity Logs page.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { initPasswordChange } from '../../shared/js/password-change.js';
import { showToast } from './admin-ui.js';
import { initStaffProfile } from '../../shared/js/staff-profile.js';

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. NOTIFICATION SETTINGS (this session only)
  ------------------------------------------ */

  const notifTypes = [
    { id: 'record-requests', label: 'New Record Requests', desc: 'A parishioner submits a certificate request.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`, enabled: true },
    { id: 'blessings', label: 'New Blessing / Service Requests', desc: 'A parishioner requests a sacrament or blessing.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`, enabled: true },
    { id: 'facility-booking', label: 'New Facility Bookings', desc: 'A parishioner books a parish facility.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`, enabled: true },
    { id: 'donations', label: 'New Donations', desc: 'An online donation is received.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`, enabled: false },
    { id: 'mass-intentions', label: 'New Mass Intentions', desc: 'A parishioner submits a mass intention.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 7h6m-6 4h6m-6 4h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`, enabled: false },
    { id: 'storage', label: 'Low Cloud Storage Warnings', desc: 'Archive storage is nearing its quota.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 15a4 4 0 004 4h9a5 5 0 001-9.9 5.5 5.5 0 00-10.6-1.4A4.5 4.5 0 003 15z"/></svg>`, enabled: true },
    { id: 'weekly-summary', label: 'Weekly Summary Email', desc: 'A digest of parish activity every Monday.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`, enabled: true },
  ];

  let accessLog = []; // kept in sync via observeQuery, each has .id


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ------------------------------------------
     2. TABS
  ------------------------------------------ */
  const tabs   = document.querySelectorAll('.profile-tab');
  const panels = document.querySelectorAll('.profile-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });


  /* ------------------------------------------
     3–4. PHOTO + PROFILE INFO — saved to the database (../../shared/js/staff-profile.js)
  ------------------------------------------ */
  initStaffProfile({ showToast });


  /* ------------------------------------------
     5. SECURITY — Change Password (real Cognito password;
     checklist, show/hide, match check: ../../shared/js/password-change.js)
  ------------------------------------------ */
  initPasswordChange({ showToast });


  /* ------------------------------------------
     6. TWO-FACTOR AUTHENTICATION TOGGLE
  ------------------------------------------ */
  const twofaToggle = document.getElementById('twofa-toggle');
  const twofaStatus = document.getElementById('twofa-status');

  twofaToggle.addEventListener('change', () => {
    if (twofaToggle.checked) {
      twofaStatus.textContent = 'On';
      twofaStatus.className = 'twofa-status on';
      showToast('Two-factor authentication enabled.');
    } else {
      twofaStatus.textContent = 'Off';
      twofaStatus.className = 'twofa-status off';
      showToast('Two-factor authentication disabled.');
    }
  });


  /* ------------------------------------------
     7. NOTIFICATION PREFERENCES
  ------------------------------------------ */
  const notifList = document.getElementById('notif-list');

  notifList.innerHTML = notifTypes.map(n => `
    <div class="notif-row">
      <div class="flex items-center gap-3 min-w-0">
        <div class="notif-row-icon">${n.icon}</div>
        <div class="min-w-0">
          <p class="notif-row-title">${escapeHtml(n.label)}</p>
          <p class="notif-row-desc">${escapeHtml(n.desc)}</p>
        </div>
      </div>
      <label class="toggle-switch shrink-0" aria-label="Toggle ${escapeHtml(n.label)}">
        <input type="checkbox" data-id="${n.id}" ${n.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');

  notifList.addEventListener('change', (e) => {
    const input = e.target.closest('input[type="checkbox"]');
    if (!input) return;
    const notif = notifTypes.find(n => n.id === input.dataset.id);
    if (!notif) return;
    notif.enabled = input.checked;
    showToast(`${notif.label} notifications ${input.checked ? 'enabled' : 'disabled'}.`);
  });


  /* ------------------------------------------
     8. ACTIVITY LOG — real data from AccessLog
  ------------------------------------------ */
  const activityList     = document.getElementById('activity-list');
  const activityEmpty      = document.getElementById('activity-empty');
  const activityFilter        = document.getElementById('activity-filter');

  client.models.AccessLog.observeQuery().subscribe({
    next: ({ items }) => {
      accessLog = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderActivity();
    },
    error: (err) => {
      console.error('Failed to load activity log:', err);
      activityList.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load activity log.</p>`;
    },
  });

  function activityIcon(action) {
    if (action === 'Cancel' || action === 'Decline') {
      return { bg: 'rgba(220,38,38,0.12)', color: '#b91c1c', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12"/></svg>` };
    }
    if (action === 'Download') {
      return { bg: 'rgba(21,128,61,0.14)', color: '#15803d', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>` };
    }
    if (action === 'Edit') {
      return { bg: 'rgba(201,168,76,0.18)', color: '#9c7d2e', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828z"/></svg>` };
    }
    return { bg: 'rgba(139,143,199,0.16)', color: '#5b5fa8', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>` };
  }

  function renderActivity() {
    const filterVal = activityFilter.value;
    const filtered = filterVal ? accessLog.filter(a => a.action === filterVal) : accessLog;

    if (filtered.length === 0) {
      activityList.innerHTML = '';
      activityEmpty.classList.remove('hidden');
      return;
    }
    activityEmpty.classList.add('hidden');

    activityList.innerHTML = filtered.map(a => {
      const icon = activityIcon(a.action);
      const when = a.createdAt
        ? new Date(a.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '—';
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background-color:${icon.bg};color:${icon.color};">${icon.svg}</div>
          <div class="activity-body">
            <p class="activity-title">${escapeHtml(a.action) || 'Activity'} — ${escapeHtml(a.fileName) || 'file'}</p>
            <p class="activity-meta">${escapeHtml(a.userName) || 'Unknown user'} · ${when}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  activityFilter.addEventListener('change', renderActivity);

  document.getElementById('btn-export-activity').addEventListener('click', () => {
    if (accessLog.length === 0) { showToast('No activity to export.', true); return; }
    const rows = [['User', 'File', 'Action', 'Date'], ...accessLog.map(a => [a.userName || '', a.fileName || '', a.action || '', a.createdAt || ''])];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sacradigit-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Activity log exported.');
  });


  /* ------------------------------------------
     9. TOAST
  ------------------------------------------ */


});