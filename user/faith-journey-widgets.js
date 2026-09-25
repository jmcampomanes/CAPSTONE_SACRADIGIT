/* ============================================
   SacraDigit — Faith Journey widgets
   Small, self-loading pieces of the My Badges
   page used elsewhere in the user portal:
     mountBadgeStrip(el)      — Dashboard
     mountFaithfulGivers(el)  — Donations
   Styles live in user-shell.css ("Faith Journey widgets").
   ============================================ */

import { client } from '../amplify-init.js';
import { computeBadges, faithfulGivers, badgeIconSvg, parishionerKey, streakLabel } from '../badges.js';
import { checkInReady, listCheckInsFor, optedOutKeys } from '../mass-checkin.js';

const PARISHIONER_NAME = 'Maria P. Santos'; // same hardcoded identity used across the user portal
const MY_KEY = parishionerKey(PARISHIONER_NAME);

const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/** Latest earned badges + the closest one still to earn. */
export function mountBadgeStrip(el) {
  if (!el) return;
  const data = { checkIns: [], donations: [], intentions: [], blessings: [] };
  const loaded = { donations: false, intentions: false, blessings: false, checkIns: false };

  const render = () => {
    if (!Object.values(loaded).every(Boolean)) return;
    const ready = checkInReady();
    const badges = computeBadges(data).filter(b => ready || !b.needsCheckIn || b.earned);
    const earned = badges.filter(b => b.earned);
    const next = badges
      .filter(b => !b.earned && b.progress && b.progress.target > b.progress.current)
      .sort((a, z) => z.progress.current / z.progress.target - a.progress.current / a.progress.target)[0];

    el.innerHTML = `
      <div class="fjw-strip">
        ${earned.length
          ? earned.slice(0, 6).map(b => `
            <div class="fjw-medal tier-${b.tier}" title="${escapeHtml(b.name)} — ${escapeHtml(b.desc)}">${badgeIconSvg(b, 'w-5 h-5')}</div>`).join('')
          : '<p class="fjw-empty">No badges yet — your first one is close!</p>'}
        ${earned.length > 6 ? `<span class="fjw-more">+${earned.length - 6}</span>` : ''}
      </div>
      <p class="fjw-caption">
        <strong>${earned.length}</strong> badge${earned.length === 1 ? '' : 's'} earned${next ? ` · Next: <strong>${escapeHtml(next.name)}</strong> (${next.progress.current}/${next.progress.target} ${escapeHtml(next.progress.label)})` : ''}
      </p>`;
  };

  client.models.Donation.observeQuery().subscribe({
    next: ({ items }) => { data.donations = items.filter(d => parishionerKey(d.donor) === MY_KEY); loaded.donations = true; render(); },
    error: (err) => console.error('Failed to load donations:', err),
  });
  client.models.MassIntention.observeQuery({ filter: { donor: { eq: PARISHIONER_NAME } } }).subscribe({
    next: ({ items }) => { data.intentions = items; loaded.intentions = true; render(); },
    error: (err) => console.error('Failed to load intentions:', err),
  });
  client.models.Blessing.observeQuery({ filter: { requesterName: { eq: PARISHIONER_NAME } } }).subscribe({
    next: ({ items }) => { data.blessings = items; loaded.blessings = true; render(); },
    error: (err) => console.error('Failed to load blessings:', err),
  });
  (checkInReady() ? listCheckInsFor(PARISHIONER_NAME) : Promise.resolve([]))
    .then(items => { data.checkIns = items; })
    .catch(err => console.error('Failed to load check-ins:', err))
    .finally(() => { loaded.checkIns = true; render(); });
}

/** Faithful Givers list (names + months in a row, never amounts). */
export function mountFaithfulGivers(el, { limit = 12 } = {}) {
  if (!el) return;
  let donations = [];
  let optedOut = new Set();
  let ready = false;

  const render = () => {
    if (!ready) return;
    const givers = faithfulGivers(donations, { optedOut });
    const mine = givers.find(g => g.key === MY_KEY);
    el.innerHTML = givers.length ? `
      <ol class="fjw-givers">
        ${givers.slice(0, limit).map(g => `
          <li class="fjw-giver${g.key === MY_KEY ? ' is-me' : ''}">
            <span class="fjw-giver-name">${escapeHtml(g.name)}${g.key === MY_KEY ? ' <span class="fjw-you">You</span>' : ''}</span>
            <span class="fjw-giver-streak">${escapeHtml(streakLabel(g.streak))}</span>
          </li>`).join('')}
      </ol>
      ${givers.length > limit ? `<p class="fjw-caption">and ${givers.length - limit} more faithful givers — thank you!</p>` : ''}
      ${mine ? '' : '<p class="fjw-caption">Give any amount 3 months in a row to join this list.</p>'}`
      : '<p class="fjw-caption">No one has given 3 months in a row yet — be the first!</p>';
  };

  client.models.Donation.observeQuery().subscribe({
    next: ({ items }) => { donations = items; render(); },
    error: (err) => console.error('Failed to load donations:', err),
  });
  optedOutKeys().catch(() => new Set()).then(keys => { optedOut = keys; ready = true; render(); });
}
