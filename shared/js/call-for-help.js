/* ============================================
   SacraDigit — Call for Help
   An announcement kind for when the parish needs
   people now: volunteers, calamity aid. Active ones
   show as a banner on the public homepage and the
   parishioner dashboard, and in Announcements.

   Saved as an ordinary Announcement with
   media.kind = 'call-for-help', with the same Start
   and End Dates as an official announcement.
   ============================================ */

export const CALL_FOR_HELP = 'call-for-help';

function mediaOf(a) {
  try { return JSON.parse(a.media || '{}') || {}; } catch { return {}; }
}

export const isCallForHelp = (a) => mediaOf(a).kind === CALL_FOR_HELP;

/** Published calls that are live today, newest first. */
export function activeCalls(list, today = new Date().toLocaleDateString('en-CA')) {
  return list.filter(a => {
    if (a.published === false || !isCallForHelp(a)) return false;
    const m = mediaOf(a);
    return (!m.startDate || m.startDate <= today) && (!m.endDate || m.endDate >= today);
  }).sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const callBannerHtml = (calls) => calls.map(a => `
  <section class="cfh-banner" role="region" aria-label="Call for Help">
    <p class="cfh-kicker">Call for Help</p>
    <h2 class="cfh-title">${esc(a.title)}</h2>
    <p class="cfh-body">${esc(a.body)}</p>
  </section>`).join('');
