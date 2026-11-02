/* ============================================
   SacraDigit — Reviewing announcements
   A second person looks at every post before it goes
   out: draft > for-review > published, or returned
   with a note.
     Head Admin or Secretary writes it: Media reviews.
     Media writes it: the Head Admin reviews.
     Nobody approves their own post.
   The Head Admin can fast-track a real emergency; that
   is logged. Public baptism dates and marriage banns
   don't come through here.

   Saved in `media` as review: { status, authorName,
   authorRole, note, reviewedBy, reviewedAt, fastTrack }.
   This check runs in the browser, and banns and
   baptism dates publish the same way (see Known limits
   in BACKEND_CHANGES.md).
   ============================================ */

const reviewerRole = (authorRole) => (authorRole === 'media' ? 'admin' : 'media');

export function reviewOf(announcement) {
  try { return JSON.parse(announcement?.media || '{}').review || null; } catch { return null; }
}

const roleOf = (user) => ((user?.groups || []).includes('admin') ? 'admin' : (user?.groups || []).includes('media') ? 'media' : user?.role);

/** May this person approve this post? */
export function canReview(user, announcement) {
  const review = reviewOf(announcement);
  if (review?.status !== 'for-review' || !user) return false;
  const who = user.name || user.email;
  return who !== review.authorName && roleOf(user) === reviewerRole(review.authorRole);
}

export const authorStamp = (user) => ({ status: 'for-review', authorName: user?.name || user?.email || 'Staff', authorRole: roleOf(user) });

/** The announcement's media JSON with its review changed. */
export function mediaWithReview(announcement, changes) {
  let media = {};
  try { media = JSON.parse(announcement.media || '{}'); } catch { /* start clean */ }
  return JSON.stringify({ ...media, review: { ...(media.review || {}), ...changes } });
}
