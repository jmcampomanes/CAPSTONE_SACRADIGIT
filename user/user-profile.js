/* ============================================
   SacraDigit User Portal — My Profile Scripts (AWS Amplify)
   Runs after user-shell.js.

   There is no auth/sign-in system yet (see the
   TODO comments across the user pages, e.g.
   user-mass-intentions.js's hardcoded DONOR_NAME),
   so Profile Info / Security / Notifications have
   no backing data model and stay session-local —
   same convention as the admin's profile.js.

   The My Activity tab IS wired to real data: the
   MassIntention model, filtered to this parishioner's
   own donor name — the same records that power the
   "My Intentions" tab on the Mass Intentions page.
   Other request types (CertificateRequest,
   FacilityBooking) don't currently store who
   submitted them, so they can't be included here yet.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SESSION-LOCAL ACCOUNT DATA (no backend model)
  ------------------------------------------ */
  const DONOR_NAME = 'Maria P. Santos'; // same hardcoded identity used across the user portal
  const STORED_PASSWORD = 'parish123'; // demo-only "current" password

  const notifTypes = [
    { id: 'mass-intentions-status', label: 'Mass Intention Status Updates', desc: 'Your submitted mass intention is confirmed or scheduled.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 7h6m-6 4h6m-6 4h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`, enabled: true },
    { id: 'facility-booking-status', label: 'Facility Booking Updates', desc: 'Your facility booking request is approved or updated.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`, enabled: true },
    { id: 'certificate-status', label: 'Certificate Request Updates', desc: 'Your certificate request is ready for pickup.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`, enabled: true },
    { id: 'announcements', label: 'Parish Announcements', desc: 'New announcements are posted by the parish.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>`, enabled: true },
    { id: 'mass-schedule-changes', label: 'Mass Schedule Changes', desc: 'Changes to the regular mass schedule.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`, enabled: true },
    { id: 'donation-receipts', label: 'Donation Receipts', desc: 'A receipt is issued for your donation.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`, enabled: false },
    { id: 'weekly-bulletin', label: 'Weekly Parish Bulletin', desc: 'The parish bulletin every week, straight to your inbox.', icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`, enabled: true },
  ];

  let myIntentions = []; // kept in sync via observeQuery, each has .id

  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', completed: 'Completed' };
  const statusIcon = {
    pending:   { bg: 'rgba(217,119,6,0.14)',  color: '#b45309', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
    scheduled: { bg: 'rgba(21,128,61,0.14)',  color: '#15803d', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>` },
    completed: { bg: 'rgba(67,56,202,0.14)',  color: '#4338ca', svg: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>` },
  };


  /* ------------------------------------------
     1. DOM REFERENCES
  ------------------------------------------ */
  const avatarLg          = document.getElementById('avatar-lg');
  const sidebarInitials     = document.getElementById('avatar-initials');
  const headerName            = document.getElementById('header-name');
  const sidebarUserName          = document.getElementById('sidebar-user-name');

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
  const pfAddress           = document.getElementById('pf-address');
  const pfBio                  = document.getElementById('pf-bio');

  const defaults = {
    name: pfName.value, email: pfEmail.value, phone: pfPhone.value,
    address: pfAddress.value, bio: pfBio.value,
  };

  [pfName, pfEmail, pfPhone, pfAddress].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  document.getElementById('pf-save').addEventListener('click', () => {
    let hasError = false;

    clearFieldError(pfName);
    if (!pfName.value.trim()) { setFieldError(pfName, 'Full name is required.'); hasError = true; }

    clearFieldError(pfEmail);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pfEmail.value.trim() && !emailPattern.test(pfEmail.value.trim())) {
      setFieldError(pfEmail, 'Enter a valid email address.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    headerName.textContent = pfName.value.trim();
    sidebarUserName.textContent = pfName.value.trim();

    const initials = initialsFrom(pfName.value.trim());
    sidebarInitials.textContent = initials;
    if (!avatarLg.style.backgroundImage) avatarLg.textContent = initials;

    showToast('Profile information saved for this session.');
  });

  document.getElementById('pf-reset').addEventListener('click', () => {
    pfName.value = defaults.name;
    pfEmail.value = defaults.email;
    pfPhone.value = defaults.phone;
    pfAddress.value = defaults.address;
    pfBio.value = defaults.bio;
    [pfName, pfEmail, pfPhone, pfAddress].forEach(clearFieldError);
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
     8. MY ACTIVITY — real data from MassIntention
  ------------------------------------------ */
  const activityList     = document.getElementById('activity-list');
  const activityEmpty      = document.getElementById('activity-empty');
  const activityFilter        = document.getElementById('activity-filter');

  client.models.MassIntention.observeQuery({ filter: { donor: { eq: DONOR_NAME } } }).subscribe({
    next: ({ items }) => {
      myIntentions = items.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      renderActivity();
    },
    error: (err) => {
      console.error('Failed to load mass intention activity:', err);
      activityList.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load your activity.</p>`;
    },
  });

  function formatMassDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderActivity() {
    const filterVal = activityFilter.value;
    const filtered = filterVal ? myIntentions.filter(i => i.status === filterVal) : myIntentions;

    if (filtered.length === 0) {
      activityList.innerHTML = '';
      activityEmpty.classList.remove('hidden');
      return;
    }
    activityEmpty.classList.add('hidden');

    activityList.innerHTML = filtered.map(it => {
      const icon = statusIcon[it.status] || statusIcon.pending;
      const when = (it.updatedAt || it.createdAt)
        ? new Date(it.updatedAt || it.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '—';
      const massInfo = formatMassDate(it.massDate)
        ? `for the mass on ${formatMassDate(it.massDate)}`
        : 'awaiting mass assignment';
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background-color:${icon.bg};color:${icon.color};">${icon.svg}</div>
          <div class="activity-body">
            <p class="activity-title">${escapeHtml(it.type) || 'Mass Intention'} — ${statusLabel[it.status] || it.status || 'Pending'}</p>
            <p class="activity-meta">${massInfo} · ${when}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  activityFilter.addEventListener('change', renderActivity);

  document.getElementById('btn-export-activity').addEventListener('click', () => {
    if (myIntentions.length === 0) { showToast('No activity to export.', true); return; }
    const rows = [
      ['Type', 'Mass Date', 'Status', 'Submitted'],
      ...myIntentions.map(it => [it.type || '', it.massDate || '', it.status || '', it.createdAt || '']),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-mass-intention-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Activity exported.');
  });


  /* ------------------------------------------
     9. TOAST
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    if (window.showToast) { window.showToast(message, isError); return; }
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});