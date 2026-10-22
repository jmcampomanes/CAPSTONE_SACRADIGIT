/* ============================================
   SacraDigit Media — My Profile Scripts
   Profile Info and the photo are saved to the database
   (../staff-profile.js — each person's own record, the
   same one the parishioner My Profile uses). Security's
   Change Password is real (../password-change.js).
   Two-Factor is still only remembered on this device.
   ============================================ */

import { initPasswordChange } from '../password-change.js';
import { showToast } from '../Sacradigit/admin-ui.js';
import { initStaffProfile } from '../staff-profile.js';

const PROFILE_KEY = 'sacradigit_media_profile';

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
  if (!readProfile()) writeProfile({ twoFactor: false });
}

document.addEventListener('DOMContentLoaded', () => {
  seedIfMissing();



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

  /* ---------- Profile Info + photo — saved to the database (../staff-profile.js) ---------- */
  initStaffProfile({ showToast });

  /* ---------- Security: Change Password (real Cognito password — ../password-change.js) ---------- */
  initPasswordChange({ showToast });

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

  renderTwofa();
});
