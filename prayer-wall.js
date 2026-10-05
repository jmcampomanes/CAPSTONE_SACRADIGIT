/* ============================================
   SacraDigit — Prayer Wall (shared)
   Parishioners post prayer requests (anonymously if
   they want); the Secretary or Head Admin approves
   each one before it appears; others tap
   "I prayed for this 🙏".

   Models (see the backend prompt):
     PrayerRequest  body, authorName ('' when anonymous),
                    anonymous, authorKey (the poster's
                    account id, so they can follow their own
                    requests), status 'pending' | 'approved'
                    | 'rejected' | 'removed', moderationNote
     PrayerReaction requestId, reactorKey — one row per
                    person per request ("I prayed")
   An anonymous request never stores the person's name.
   Used by user/user-prayer-wall.js and
   Sacradigit/prayer-wall.js.
   ============================================ */

import { client } from './amplify-init.js';

export const MAX_PRAYER_LENGTH = 500;
/** Approved requests stay on the wall this long. */
export const WALL_DAYS = 60;

export const prayerReady = () => !!(client.models.PrayerRequest && client.models.PrayerReaction);

const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

export function watchRequests(onChange, options = {}) {
  if (!prayerReady()) return () => {};
  const sub = client.models.PrayerRequest.observeQuery(options).subscribe({
    next: ({ items }) => onChange(items.slice().sort(byNewest)),
    error: (err) => console.error('Failed to load prayer requests:', err),
  });
  return () => sub.unsubscribe();
}

export function watchReactions(onChange) {
  if (!prayerReady()) return () => {};
  const sub = client.models.PrayerReaction.observeQuery().subscribe({
    next: ({ items }) => onChange(items),
    error: (err) => console.error('Failed to load prayer reactions:', err),
  });
  return () => sub.unsubscribe();
}

function check(result) {
  if (result?.errors) throw new Error(result.errors.map(e => e.message).join('; '));
  return result?.data;
}

export async function submitRequest({ body, anonymous, authorName, authorKey }) {
  const text = (body || '').trim();
  if (!text) throw new Error('Please write your prayer request.');
  if (text.length > MAX_PRAYER_LENGTH) throw new Error(`Please keep it under ${MAX_PRAYER_LENGTH} characters.`);
  return check(await client.models.PrayerRequest.create({
    body: text,
    anonymous: !!anonymous,
    authorName: anonymous ? '' : (authorName || ''),
    authorKey,
    status: 'pending',
  }));
}

/** Office: approve / reject / take down a request. */
export async function moderateRequest(id, status, moderationNote = '') {
  return check(await client.models.PrayerRequest.update({ id, status, moderationNote: moderationNote || null }));
}

export async function deleteRequest(id) {
  return check(await client.models.PrayerRequest.delete({ id }));
}

export async function prayFor(requestId, reactorKey) {
  return check(await client.models.PrayerReaction.create({ requestId, reactorKey }));
}

/** { counts: Map(requestId → n), mine: Set(requestId) } */
export function tallyReactions(reactions, myKey) {
  const counts = new Map();
  const mine = new Set();
  for (const r of reactions) {
    counts.set(r.requestId, (counts.get(r.requestId) || 0) + 1);
    if (myKey && r.reactorKey === myKey) mine.add(r.requestId);
  }
  return { counts, mine };
}

/** Approved, and posted within the last WALL_DAYS days. */
export function isOnWall(req, now = new Date()) {
  if (req.status !== 'approved') return false;
  const age = (now - new Date(req.createdAt || 0)) / 86400000;
  return age <= WALL_DAYS;
}

export const displayName = (req) => (req.anonymous || !req.authorName ? 'Anonymous' : req.authorName);

export function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
