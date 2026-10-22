/* ============================================
   SacraDigit — profile photo in the sidebar account card
   (every portal). auth.js paints the initials first; this
   swaps in the photo saved on My Profile
   (ParishionerPreference.avatarKey) when there is one.
   The signed link is kept for the browser session so pages
   don't look it up again on every click.
   My Profile calls setCardPhoto() right after an upload.
   ============================================ */

import { client } from './amplify-init.js';
import { getUrl } from 'aws-amplify/storage';

const CACHE = 'sacradigit_card_photo';
const keyFor = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

function targets() {
  // Staff portals: the round badge inside the user-menu button. Parishioner: #avatar-initials' circle.
  return [
    document.querySelector('#user-menu-btn span')?.parentElement,
    document.getElementById('avatar-initials')?.parentElement,
  ].filter((el, i, all) => el && all.indexOf(el) === i);
}

function show(url) {
  targets().forEach((el) => {
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.querySelector('span')?.style.setProperty('visibility', 'hidden');
  });
}

function readCache(name) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
    return c && c.name === keyFor(name) && c.exp > Date.now() ? c.url : null;
  } catch { return null; }
}

/** Put a freshly uploaded photo in the card now (and remember it for this session). */
export function setCardPhoto(url, name) {
  if (!url) return;
  try { sessionStorage.setItem(CACHE, JSON.stringify({ name: keyFor(name), url, exp: Date.now() + 50 * 60 * 1000 })); } catch { /* private mode */ }
  show(url);
}

/** Look up the signed-in person's saved photo and show it in the card. Never throws. */
export async function paintCardPhoto(user) {
  const name = user?.name;
  if (!name || !targets().length) return;
  const cached = readCache(name);
  if (cached) { show(cached); return; }
  try {
    if (!client.models.ParishionerPreference) return;
    const { data } = await client.models.ParishionerPreference.list({ filter: { parishionerKey: { eq: keyFor(name) } } });
    const avatarKey = (data || []).find(p => p.avatarKey)?.avatarKey;
    if (!avatarKey) return;
    const { url } = await getUrl({ path: avatarKey, options: { expiresIn: 3600 } });
    setCardPhoto(url.toString(), name);
  } catch (err) {
    console.warn('Couldn’t load the profile photo for the sidebar:', err);
  }
}
