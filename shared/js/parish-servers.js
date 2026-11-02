/* ============================================
   SacraDigit — Parish Servers (shared)
   A parishioner who serves the parish (lector, choir,
   altar server, usher, catechist, office staff, a
   parish organization…) asks to be verified as a
   "Parish Server". The Head Admin approves or declines.
   Approved servers get the Parish Server role, shown
   on their account, and Ministry Bookings treats them
   as verified (no-fee use of parish rooms).
   Approval lasts a year; then they renew.

   Used by
     user/user-parish-server.html   (apply, see status)
     Sacradigit/parish-servers.html (approve / decline / remove)
     Sacradigit/ministry-booking.js (verified for free bookings)

   ---------- Backend (add, then redeploy) ----------
   1) amplify/data/resource.ts — the applications:

     ServerApplication: a.model({
       applicantKey: a.string().required(),   // the account's sub
       applicantName: a.string().required(),
       email: a.string(),
       contact: a.string(),                   // 11-digit mobile
       ministry: a.string().required(),       // 'Lectors', 'Parish office staff', …
       role: a.string().required(),           // their role in it
       servingSince: a.string(),              // year they started, e.g. '2019'
       confirmWith: a.string().required(),    // coordinator / priest who can confirm
       message: a.string(),
       status: a.string(),                    // 'pending' | 'approved' | 'declined' | 'revoked'
       reviewedBy: a.string(),
       reviewedAt: a.datetime(),
       reason: a.string(),                    // why declined / removed
       validUntil: a.date(),                  // approved until (a year)
     }).authorization((allow) => [
       allow.owner().to(['create', 'read', 'delete']),   // apply, see it, withdraw it
       allow.groups(['admin']).to(['read', 'update', 'delete']),
       allow.groups(['staff', 'itech']).to(['read']),
     ]),

   2) amplify/auth/resource.ts — a new user group:
        groups: ['admin', 'staff', 'itech', 'media', 'server']

   3) A mutation the Head Admin calls to add/remove the group
      (AdminAddUserToGroup / AdminRemoveUserFromGroup, like
      setUserRole), allowed for the 'admin' group only:
        setServerRole: a.mutation()
          .arguments({ sub: a.string().required(), enabled: a.boolean().required() })
        (Not `on`: AppSync rejects it as an argument name.)
          .returns(a.json())
          .authorization((allow) => [allow.group('admin')])
          .handler(a.handler.function(setServerRoleFn)),

   Until (1) is deployed, both pages say verification
   isn't switched on yet. Until (3) is, approval is still
   saved (and honoured by Ministry Bookings) — only the
   account group waits for it.
   ============================================ */

import { client } from './amplify-init.js';
import outputs from '../../amplify_outputs.json';
import { MINISTRIES } from './ministry.js';

export const APPROVAL_MONTHS = 12;
export const RENEW_WITHIN_DAYS = 30;

/** Ministries and parish groups someone can serve in. */
export const SERVER_GROUPS = [
  ...MINISTRIES.map(m => m.label),
  'Parish office staff',
  'Parish Pastoral Council',
  'Catechists',
  'Youth Ministry',
  'Another parish ministry or organization',
];
export const OTHER_GROUP = SERVER_GROUPS[SERVER_GROUPS.length - 1];

/** The role dropdown, by group. "Other" reveals a text box. */
export const OTHER_ROLE = 'Other';
const COMMON_ROLES = ['Member', 'Coordinator'];
export const ROLES_BY_GROUP = {
  Lectors: ['Lector', 'Commentator', ...COMMON_ROLES],
  Choir: ['Singer', 'Instrumentalist', 'Choir Director', ...COMMON_ROLES],
  'Altar Servers': ['Altar Server', 'Head Server', ...COMMON_ROLES],
  Ushers: ['Usher', 'Greeter', 'Collector', ...COMMON_ROLES],
  'Parish office staff': ['Office Staff', 'Volunteer'],
  Catechists: ['Catechist', 'Assistant Catechist', ...COMMON_ROLES],
  'Youth Ministry': ['Youth Leader', ...COMMON_ROLES],
};
export const rolesFor = (group) => [...(ROLES_BY_GROUP[group] || COMMON_ROLES), OTHER_ROLE];

/** Answered yes or no when applying, and read by the admin. DRAFT: the parish should
    confirm these. Ministry-specific ones come first. */
const COMMON_CONDITIONS = [
  'I am a practicing Catholic.',
  'I can attend the formation or practice this ministry requires.',
  'I can serve on the dates I sign up for.',
  'If I can’t serve, I will tell the parish office at least 3 days before.',
];
const MINISTRY_CONDITIONS = {
  Lectors: ['I am comfortable reading aloud at Mass.'],
  Choir: ['I can attend choir practice.'],
  'Altar Servers': ['I have received First Communion.'],
};
export const conditionsFor = (group) => [...(MINISTRY_CONDITIONS[group] || []), ...COMMON_CONDITIONS];

/** How the admin assessed someone. All three let the person take slots; only the word differs. */
export const ASSESSMENTS = ['Approved', 'Recommended', 'Referred'];

/** Sent while confirmWith is still required by the schema (BACKEND_CHANGES.md). */
export const NO_CONFIRM = 'Not asked';

/* conditions and isFirstTime need the fields in BACKEND_CHANGES.md: sending a
   field the model lacks fails the whole save, so until then they go in message. */
export const applicationFieldsReady = () => !!outputs.data?.model_introspection?.models?.ServerApplication?.fields?.conditions;

export function parseConditions(app) {
  try { return (typeof app?.conditions === 'string' ? JSON.parse(app.conditions) : app?.conditions) || []; } catch { return []; }
}

/** Ministries (from ministry.js) this person's approved application lets them serve in. */
export function ministriesAllowed(apps, today) {
  return MINISTRIES.filter(m => apps.some(a => a.ministry === m.label && isVerified(a, today))).map(m => m.id);
}

export const serversReady = () => !!client.models.ServerApplication;
export const serverRoleReady = () => !!client.mutations?.setServerRole;

const pad2 = (n) => String(n).padStart(2, '0');
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const addMonthsIso = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const longDate = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
const daysUntil = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso() + 'T00:00:00')) / 86400000);

/** Every application (pages for staff; RLS limits a parishioner to their own). */
export async function listApplications() {
  const items = [];
  let nextToken = null;
  do {
    const { data, errors, nextToken: nt } = await client.models.ServerApplication.list({ limit: 500, nextToken });
    if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
    items.push(...(data || []));
    nextToken = nt;
  } while (nextToken);
  return items;
}

const newestFirst = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

/** The latest application of each person (by applicantKey). */
export function latestPerPerson(apps) {
  const out = new Map();
  apps.slice().sort(newestFirst).forEach(a => { if (!out.has(a.applicantKey)) out.set(a.applicantKey, a); });
  return [...out.values()];
}

/**
 * Where an application stands today:
 *   'pending' | 'verified' | 'expiring' (verified, renew soon) | 'expired' | 'declined' | 'revoked'
 */
export function standing(app, today = todayIso()) {
  if (!app) return 'none';
  if (app.status === 'approved') {
    if (!app.validUntil || app.validUntil < today) return 'expired';
    return daysUntil(app.validUntil) <= RENEW_WITHIN_DAYS ? 'expiring' : 'verified';
  }
  return ['pending', 'declined', 'revoked'].includes(app.status) ? app.status : 'pending';
}
export const isVerified = (app, today) => ['verified', 'expiring'].includes(standing(app, today));

export const STANDING_LABEL = {
  pending:  { text: 'Waiting for approval', cls: 'badge-amber' },
  verified: { text: 'Verified', cls: 'badge-green' },
  expiring: { text: 'Verified · renew soon', cls: 'badge-green' },
  expired:  { text: 'Expired', cls: 'badge-gray' },
  declined: { text: 'Not approved', cls: 'badge-red' },
  revoked:  { text: 'Role removed', cls: 'badge-gray' },
};

/** Adds/removes the account's Parish Server group, when the backend has the mutation. */
export async function setServerRole(sub, on) {
  if (!serverRoleReady() || !sub) return 'unavailable';
  try {
    const { data, errors } = await client.mutations.setServerRole({ sub, enabled: on });
    if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
    // Returns { success } or { success: false, error } (AWSJSON may arrive as a string).
    const res = typeof data === 'string' ? JSON.parse(data) : data;
    if (!res?.success) throw new Error(res?.error || 'No result');
    return 'done';
  } catch (err) {
    console.error('Could not change the Parish Server role:', err);
    return 'failed';
  }
}
