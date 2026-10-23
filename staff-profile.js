/* ============================================
   SacraDigit — My Profile for staff (Head Admin,
   Secretary, Media Team, IT Team)
   Saves to the same database record the parishioner
   My Profile uses (ParishionerPreference, one per
   person, editable only by its owner):
     Phone, About, profile photo (avatars/{identityId}/…)
   Name and email come from the sign-in account and are
   read-only here (the IT team changes them in Accounts).
   Role and Department follow the account's role;
   "Since" is when the profile record was first saved.
   Used by Sacradigit/profile.js, Sacramedia/profile.js
   and Sacraitech/profile.js.
   ============================================ */

import { getUrl, uploadData } from 'aws-amplify/storage';
import { currentUser, currentUserName, isHeadAdmin } from './auth.js';
import { getPreference, preferencesReady, saveProfileDetails } from './mass-checkin.js';
import { setCardPhoto } from './profile-photo.js';
import { isMobile, mobileDigits, MOBILE_HINT } from './mobile-number.js';

const ROLE = {
  admin: { role: 'Head Admin', dept: 'Parish Office' },
  staff: { role: 'Secretary', dept: 'Parish Office' },
  media: { role: 'Media Team', dept: 'Media & Communications' },
  itech: { role: 'IT Team', dept: 'Information Technology' },
};

const initialsFrom = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Wires the Profile Info tab and the photo button to the database.
 * Expects the usual ids: avatar-lg, btn-change-photo, photo-input, header-name,
 * header-email, pf-name, pf-email, pf-phone, pf-department, pf-role, pf-joined,
 * pf-bio, pf-save, pf-reset.
 */
export function initStaffProfile({ showToast }) {
  const $ = (id) => document.getElementById(id);
  const avatarLg = $('avatar-lg');
  const fields = { phone: $('pf-phone'), about: $('pf-bio') };
  const saveBtn = $('pf-save');
  const photoBtn = $('btn-change-photo');
  const photoInput = $('photo-input');

  const me = currentUser() || {};
  const name = currentUserName();
  const info = isHeadAdmin(me) ? ROLE.admin : ROLE[me.role] || { role: 'Staff', dept: 'Parish' };

  // The account's own details — not editable here.
  $('pf-name').value = name;
  $('pf-email').value = me.email || '';
  ['pf-name', 'pf-email', 'pf-role', 'pf-department'].forEach(id => { $(id).disabled = true; });
  $('pf-role').value = info.role;
  $('pf-department').value = info.dept;
  $('header-name').textContent = name || info.role;
  $('header-email').textContent = me.email || '';
  const roleBadge = $('header-role'); // Admin page: the badge says Head Admin / Secretary
  if (roleBadge) roleBadge.textContent = info.role;
  if (!avatarLg.style.backgroundImage) avatarLg.textContent = initialsFrom(name);
  const note = document.createElement('p');
  note.className = 'pf-account-note';
  note.style.cssText = 'margin-top:0.375rem;font-size:0.8125rem;line-height:1.4;color:#6b7280;';
  note.textContent = 'Your name and email come from your sign-in account. Ask the IT team to change them.';
  $('pf-email').closest('div')?.appendChild(note);

  // Start empty (no sample text) until the saved record loads.
  let saved = { phone: '', about: '' };
  const fill = () => { fields.phone.value = saved.phone; fields.about.value = saved.about; };
  fill();

  async function showPhoto(key) {
    try {
      const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
      avatarLg.style.backgroundImage = `url(${url})`;
      avatarLg.textContent = '';
      setCardPhoto(url.toString(), name); // the sidebar account card too
    } catch (err) {
      console.error('Failed to load profile photo:', err);
    }
  }

  const ready = preferencesReady() && !!name;
  if (ready) {
    getPreference(name).then((pref) => {
      if (!pref) return;
      saved = { phone: pref.phone || '', about: pref.about || '' };
      fill();
      if (pref.createdAt) $('pf-joined').value = new Date(pref.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (pref.avatarKey) showPhoto(pref.avatarKey);
    }).catch((err) => console.error('Failed to load profile details:', err));
  }

  saveBtn.addEventListener('click', async () => {
    if (!ready) { showToast('Profile details can’t be saved right now.', true); return; }
    const phone = fields.phone.value.trim();
    if (phone && !isMobile(phone)) { fields.phone.focus(); showToast(MOBILE_HINT, true); return; }
    const next = { phone: phone && mobileDigits(phone), about: fields.about.value.trim() };
    saveBtn.disabled = true;
    try {
      const rec = await saveProfileDetails(name, next);
      saved = next;
      if (rec?.createdAt && $('pf-joined').value === '—') $('pf-joined').value = new Date(rec.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      showToast('Profile saved.');
    } catch (err) {
      console.error('Failed to save profile:', err);
      showToast('Couldn’t save your profile. Please try again.', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  $('pf-reset').addEventListener('click', () => { fill(); showToast('Changes discarded.'); });

  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.', true); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image is too large (max 5MB).', true); return; }
    if (!ready) { showToast('Profile photos can’t be saved right now.', true); return; }
    photoBtn.disabled = true;
    try {
      const path = ({ identityId }) => `avatars/${identityId}/${Date.now()}_${file.name}`;
      const { path: avatarKey } = await uploadData({ path, data: file }).result;
      await saveProfileDetails(name, { avatarKey });
      await showPhoto(avatarKey);
      showToast('Profile photo updated.');
    } catch (err) {
      console.error('Failed to upload profile photo:', err);
      showToast('Couldn’t upload the photo. Please try again.', true);
    } finally {
      photoBtn.disabled = false;
      photoInput.value = '';
    }
  });
}
