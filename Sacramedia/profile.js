/* ============================================
   SacraDigit Media — My Profile Scripts
   Entirely separate account from Sacradigit/profile.js
   (the Admin's profile). Data lives under its own
   localStorage key so nothing here ever touches or
   reads the Admin account.

   There is no real auth/Cognito login wired up yet
   (same as the Admin side — see the comment at the
   top of Sacradigit/profile.js), so this stays
   session-local for now. Once RBAC/Cognito groups
   are restored, this is where the Media group's
   real profile record would be read/written instead.
   ============================================ */

const PROFILE_KEY = 'sacradigit_media_profile';
const DEMO_PASSWORD = 'media123'; // demo-only "current" password, mirrors admin's pattern

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function seedIfMissing() {
  if (readProfile()) return;
  writeProfile({
    name: 'Media Team',
    email: 'media@sacradigit.parish',
    phone: '',
    department: 'Media & Communications Team',
    bio: "Handles the parish's Facebook page, announcements, content calendar, and event coverage through SacraDigit.",
    twoFactor: false,
  });
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MT';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

document.addEventListener('DOMContentLoaded', () => {
  seedIfMissing();

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

  /* ---------- Tabs ---------- */
  const tabs = document.querySelectorAll('.profile-tab');
  const panels = document.querySelectorAll('.profile-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  /* ---------- Profile Info ---------- */
  const avatarLg = document.getElementById('avatar-lg');
  const headerName = document.getElementById('header-name');
  const headerEmail = document.getElementById('header-email');

  const nameField = document.getElementById('pf-name');
  const emailField = document.getElementById('pf-email');
  const phoneField = document.getElementById('pf-phone');
  const deptField = document.getElementById('pf-department');
  const bioField = document.getElementById('pf-bio');

  function renderProfile() {
    const p = readProfile();
    nameField.value = p.name;
    emailField.value = p.email;
    phoneField.value = p.phone || '';
    deptField.value = p.department;
    bioField.value = p.bio || '';
    headerName.textContent = p.name;
    headerEmail.textContent = p.email;
    avatarLg.textContent = initialsFrom(p.name);
  }

  document.getElementById('pf-reset').addEventListener('click', () => {
    renderProfile();
    showToast('Changes discarded.');
  });

  document.getElementById('pf-save').addEventListener('click', () => {
    const name = nameField.value.trim();
    const email = emailField.value.trim();
    if (!name) {
      showToast('Please enter a name.', true);
      return;
    }
    if (!email.includes('@')) {
      showToast('Please enter a valid email.', true);
      return;
    }

    const p = readProfile();
    writeProfile({
      ...p,
      name,
      email,
      phone: phoneField.value.trim(),
      department: deptField.value.trim(),
      bio: bioField.value.trim(),
    });
    renderProfile();
    showToast('Profile updated.');
  });

  /* ---------- Security: password change ---------- */
  const pwCurrent = document.getElementById('pw-current');
  const pwNew = document.getElementById('pw-new');
  const pwConfirm = document.getElementById('pw-confirm');
  const pwStrengthFill = document.getElementById('pw-strength-fill');
  const pwStrengthLabel = document.getElementById('pw-strength-label');
  const pwSubmit = document.getElementById('pw-submit');

  function strengthOf(pw) {
    if (!pw) return { level: '', label: 'Password strength' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 'weak', label: 'Weak' };
    if (score <= 2) return { level: 'fair', label: 'Fair' };
    return { level: 'strong', label: 'Strong' };
  }

  pwNew.addEventListener('input', () => {
    const s = strengthOf(pwNew.value);
    pwStrengthFill.className = 'pw-strength-fill' + (s.level ? ` ${s.level}` : '');
    pwStrengthLabel.className = 'pw-strength-label' + (s.level ? ` ${s.level}` : '');
    pwStrengthLabel.textContent = s.level ? s.label : 'Password strength';
  });

  pwSubmit.addEventListener('click', () => {
    if (pwCurrent.value !== DEMO_PASSWORD) {
      showToast('Current password is incorrect.', true);
      return;
    }
    if (pwNew.value.length < 8) {
      showToast('New password must be at least 8 characters.', true);
      return;
    }
    if (pwNew.value !== pwConfirm.value) {
      showToast("New passwords don't match.", true);
      return;
    }
    pwCurrent.value = '';
    pwNew.value = '';
    pwConfirm.value = '';
    pwStrengthLabel.textContent = 'Password strength';
    pwStrengthLabel.className = 'pw-strength-label';
    pwStrengthFill.className = 'pw-strength-fill';
    showToast('Password updated.');
  });

  /* ---------- Two-Factor Authentication ---------- */
  const twofaToggle = document.getElementById('twofa-toggle');
  const twofaStatus = document.getElementById('twofa-status');

  function renderTwofa() {
    const p = readProfile();
    twofaToggle.checked = !!p.twoFactor;
    twofaStatus.textContent = p.twoFactor ? 'On' : 'Off';
    twofaStatus.className = 'twofa-status ' + (p.twoFactor ? 'on' : 'off');
  }

  twofaToggle.addEventListener('change', () => {
    const p = readProfile();
    writeProfile({ ...p, twoFactor: twofaToggle.checked });
    renderTwofa();
    showToast(twofaToggle.checked ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
  });

  renderProfile();
  renderTwofa();
});
