/* ============================================
   SacraDigit — Activity log (audit trail)
   Everything here ends up in the AccessLog model,
   shown on Sacra ITech → Activity Logs and the
   admin Profile → Activity Log.

   installActivityLog(client) — called once from
   amplify-init.js — wraps every model's create /
   update / delete so that any change made by staff
   (Head Admin, Secretary, Media Team, IT Team) is
   recorded automatically, from any portal. Before
   this only bookings and IT actions were logged,
   so Media and most admin changes never showed up.

   logActivity(action, detail) — for anything worth
   recording that doesn't go through a database model.

   Logging never throws: a failed log entry must not
   undo or block the change itself.
   ============================================ */

const STAFF_ROLES = { admin: 'Head Admin', staff: 'Secretary', media: 'Media Team', itech: 'IT Team' };

// Models that aren't logged automatically: the log itself, parishioner-only
// activity, chat (read markers would flood the log), and writes that already
// log themselves with more detail (bookings via logBookingAction).
const SKIP_MODELS = new Set(['AccessLog', 'ChatMessage', 'MassCheckIn', 'ParishionerPreference', 'LivestreamSession', 'PrayerReaction']);
const SKIP_OPS = new Set(['Blessing.create', 'Blessing.update', 'FacilityBooking.delete']);

const MODEL_LABELS = {
  ParishRecord: 'Parish Record', CertificateRequest: 'Certificate Request', Mass: 'Mass',
  WeeklyMassSchedule: 'Weekly Mass Schedule', MassIntention: 'Mass Intention', FacilityBooking: 'Facility Booking',
  Donation: 'Donation', DonationGoal: 'Donation Goal', Announcement: 'Announcement', Blessing: 'Service Booking',
  CloudFile: 'File', SpecialSchedule: 'Special Schedule', Role: 'Role', ContentCalendarEntry: 'Content Calendar',
  PostTemplate: 'Post Template', EventCoverageRequest: 'Event Coverage', LivestreamStatus: 'Livestream',
  ServiceSlot: 'Service Slot', MassCheckInSession: 'Mass Check-in',
  PrayerRequest: 'Prayer Request', MinistrySignup: 'Ministry Sign-up',
};

let logClient = null;

/** The signed-in staff member (from auth.js's cache), or null for parishioners / signed-out. */
function signedInStaff() {
  try {
    const user = JSON.parse(localStorage.getItem('sacradigit_user'));
    if (!user || !STAFF_ROLES[user.role]) return null;
    return user;
  } catch {
    return null;
  }
}

/** Writes one log entry as the signed-in staff member, e.g. "Maria Cruz · Media Team". */
export async function logActivity(action, detail) {
  const user = signedInStaff();
  if (!user || !logClient?.models.AccessLog) return;
  try {
    await logClient.models.AccessLog.create({
      userName: `${user.name || user.email || 'Staff'} · ${STAFF_ROLES[user.role]}`,
      fileName: detail,
      action,
    });
  } catch (err) {
    console.warn('Could not write activity log entry:', err);
  }
}

// A short, human name for a record: its title/name, then who it's for.
function describe(model, record = {}) {
  const name = record.title || record.name || record.fullName || record.eventName || record.label
    || record.requesterName || record.donor || record.role || record.certificateType
    || (record.date ? `${record.date}${record.time ? ' ' + record.time : ''}` : '') || record.dayOfWeek || '';
  const extra = [];
  if (record.status && model !== 'Announcement') extra.push(`status: ${record.status}`);
  if (model === 'Announcement' && typeof record.published === 'boolean') extra.push(record.published ? 'published' : 'draft');
  return `${MODEL_LABELS[model] || model}${name ? ` — ${name}` : ''}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

const VERB = { create: 'Create', update: 'Edit', delete: 'Delete' };

export function installActivityLog(client) {
  logClient = client;
  const page = globalThis.location?.pathname || '';
  if (/seed-mock/.test(page)) return; // dev seed pages would flood the log
  if (/\/Sacraitech\//.test(page)) return; // Sacra ITech already logs each of its actions (logItAction)
  for (const [model, api] of Object.entries(client.models || {})) {
    if (SKIP_MODELS.has(model) || !api) continue;
    for (const op of ['create', 'update', 'delete']) {
      if (typeof api[op] !== 'function' || SKIP_OPS.has(`${model}.${op}`)) continue;
      const original = api[op].bind(api);
      api[op] = async (input, options) => {
        const result = await original(input, options);
        if (result && !result.errors && signedInStaff()) {
          // update/delete return the full record, so the name is known even
          // when only { id, status } was sent.
          logActivity(VERB[op], describe(model, { ...(input || {}), ...(result.data || {}) }));
        }
        return result;
      };
    }
  }
}
