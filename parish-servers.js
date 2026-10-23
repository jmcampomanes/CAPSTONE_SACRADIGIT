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
          .arguments({ sub: a.string().required(), on: a.boolean().required() })
          .returns(a.json())
          .authorization((allow) => [allow.group('admin')])
          .handler(a.handler.function(setServerRoleFn)),

   Until (1) is deployed, both pages say verification
   isn't switched on yet. Until (3) is, approval is still
   saved (and honoured by Ministry Bookings) — only the
   account group waits for it.
   ============================================ */

import { client } from './amplify-init.js';
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
    const { errors } = await client.mutations.setServerRole({ sub, on });
    if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
    return 'done';
  } catch (err) {
    console.error('Could not change the Parish Server role:', err);
    return 'failed';
  }
}
