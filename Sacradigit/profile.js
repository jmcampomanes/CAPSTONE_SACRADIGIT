/* ============================================
   SacraDigit Admin — My Profile Scripts (AWS Amplify)
   Runs after dashboard.js.

   There is no auth/sign-in system yet (see the
   TODO comments across the admin pages, e.g.
   digital-archives.js's `addedByName: 'Admin User'`),
   so Profile Info / Security / Notifications have
   no backing data model and stay session-local —
   same convention as the rest of this app.

   The Activity Log tab IS wired to real data: the
   AccessLog model (userName, fileName, action,
   createdAt), the same model Cloud Access reads for
   its "Recent Access Log" panel. It's file/access
   activity, not per-admin login history — there's no
   Cognito-backed login flow to log yet.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SESSION-LOCAL ACCOUNT DATA (no backend model)
  ------------------------------------------ */
  const STORED_PASSWORD = 'admin123'; // demo-only "current" password

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


  /* ------------------------------------------
     1. DOM REFERENCES
  ------------------------------------------ */
  const avatarLg          = document.getElementById('avatar-lg');
  const sidebarInitials     = document.getElementById('sidebar-avatar-initials');
  const headerName            = document.getElementById('header-name');
  const headerEmail             = document.getElementById('header-email');
  const sidebarAdminName          = document.getElementById('sidebar-admin-name');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
  }

  function initialsFrom(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
     3. CHANGE PHOTO
  ------------------------------------------ */
  const photoInput = document.getElementById('photo-input');

  document.getElementById('btn-change-photo').addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      avatarLg.style.backgroundImage = `url(${e.target.result})`;
      avatarLg.textContent = '';
      showToast('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  });


  /* ------------------------------------------
     4. PROFILE INFO — save / reset (session-local)
  ------------------------------------------ */
  const pfName       = document.getElementById('pf-name');
  const pfEmail        = document.getElementById('pf-email');
  const pfPhone          = document.getElementById('pf-phone');
  const pfDepartment        = document.getElementById('pf-department');
  const pfBio                  = document.getElementById('pf-bio');

  const defaults = {
    name: pfName.value, email: pfEmail.value, phone: pfPhone.value,
    department: pfDepartment.value, bio: pfBio.value,
  };

  [pfName, pfEmail, pfPhone, pfDepartment].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  document.getElementById('pf-save').addEventListener('click', () => {
    let hasError = false;

    clearFieldError(pfName);
    if (!pfName.value.trim()) { setFieldError(pfName, 'Full name is required.'); hasError = true; }

    clearFieldError(pfEmail);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pfEmail.value.trim()) {
      setFieldError(pfEmail, 'Email address is required.');
      hasError = true;
    } else if (!emailPattern.test(pfEmail.value.trim())) {
      setFieldError(pfEmail, 'Enter a valid email address.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    headerName.textContent = pfName.value.trim();
    headerEmail.textContent = pfEmail.value.trim();
    sidebarAdminName.textContent = pfName.value.trim();

    const initials = initialsFrom(pfName.value.trim());
    sidebarInitials.textContent = initials;
    if (!avatarLg.style.backgroundImage) avatarLg.textContent = initials;

    showToast('Profile information saved for this session.');
  });

  document.getElementById('pf-reset').addEventListener('click', () => {
    pfName.value = defaults.name;
    pfEmail.value = defaults.email;
    pfPhone.value = defaults.phone;
    pfDepartment.value = defaults.department;
    pfBio.value = defaults.bio;
    [pfName, pfEmail, pfPhone, pfDepartment].forEach(clearFieldError);
    showToast('Changes discarded.');
  });


  /* ------------------------------------------
     5. SECURITY — password strength + change (session-local demo)
  ------------------------------------------ */
  const pwCurrent      = document.getElementById('pw-current');
  const pwNew            = document.getElementById('pw-new');
  const pwConfirm           = document.getElementById('pw-confirm');
  const pwStrengthFill        = document.getElementById('pw-strength-fill');
  const pwStrengthLabel          = document.getElementById('pw-strength-label');

  [pwCurrent, pwNew, pwConfirm].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  function passwordStrength(pw) {
    if (!pw) return { level: '', label: 'Password strength', pct: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 'weak', label: 'Weak password', pct: 30 };
    if (score <= 3) return { level: 'fair', label: 'Fair password', pct: 65 };
    return { level: 'strong', label: 'Strong password', pct: 100 };
  }

  pwNew.addEventListener('input', () => {
    const s = passwordStrength(pwNew.value);
    pwStrengthFill.className = `pw-strength-fill ${s.level}`;
    pwStrengthFill.style.width = `${s.pct}%`;
    pwStrengthLabel.className = `pw-strength-label ${s.level}`;
    pwStrengthLabel.textContent = s.label;
  });

  document.getElementById('pw-submit').addEventListener('click', () => {
    let hasError = false;
    [pwCurrent, pwNew, pwConfirm].forEach(clearFieldError);

    if (!pwCurrent.value) {
      setFieldError(pwCurrent, 'Enter your current password.');
      hasError = true;
    } else if (pwCurrent.value !== STORED_PASSWORD) {
      setFieldError(pwCurrent, 'Current password is incorrect.');
      hasError = true;
    }

    if (!pwNew.value) {
      setFieldError(pwNew, 'Enter a new password.');
      hasError = true;
    } else if (pwNew.value.length < 8) {
      setFieldError(pwNew, 'New password must be at least 8 characters.');
      hasError = true;
    } else if (pwNew.value === pwCurrent.value) {
      setFieldError(pwNew, 'New password must be different from the current one.');
      hasError = true;
    }

    if (!pwConfirm.value) {
      setFieldError(pwConfirm, 'Please confirm your new password.');
      hasError = true;
    } else if (pwConfirm.value !== pwNew.value) {
      setFieldError(pwConfirm, 'Passwords do not match.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    pwCurrent.value = '';
    pwNew.value = '';
    pwConfirm.value = '';
    pwStrengthFill.className = 'pw-strength-fill';
    pwStrengthFill.style.width = '0%';
    pwStrengthLabel.className = 'pw-strength-label';
    pwStrengthLabel.textContent = 'Password strength';

    showToast('Your password has been updated for this session.');
  });


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
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});