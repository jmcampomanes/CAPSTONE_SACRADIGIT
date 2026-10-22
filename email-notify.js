/* ============================================
   SacraDigit — parishioner email notifier client

   Calls the notifyParishioner mutation (AppSync -> Lambda
   -> Gmail via an App Password). This replaces the old
   local-only Express server in server/email-notifier
   (kept there for local reference only — see its README),
   which couldn't be reached once the site is deployed.
   Kinds of email that go out:
     signup-code           — courtesy notice after Cognito
                              emails a sign-up confirmation code
     password-reset        — courtesy notice after Cognito
                              emails a password-reset code
     service-update        — a blessing/service/facility request
                              was approved, confirmed, rescheduled,
                              declined or cancelled
     certificate-update    — a certificate request was approved,
                              is ready for pickup, or was rejected
     mass-intention-update — a Mass intention was cancelled
   Day-before reminders, "appointment complete" and
   "intention offered" go out from the daily backend job
   (amplify/functions/blessing-reminder), not from here.

   Never throws. Each notify* call resolves to
   'sent', 'no-email' (nothing on file to send to) or
   'failed' so staff pages can say when an email
   didn't go out (see reportEmail in Sacradigit/admin-ui.js).
   ============================================ */

import { client } from './amplify-init.js';

async function send(kind, payload, { guest = false } = {}) {
  if (!payload.to) return 'no-email';
  try {
    const input = { kind, ...payload, detailsLines: JSON.stringify(payload.detailsLines || []) };
    const { data, errors } = await client.mutations.notifyParishioner(input, guest ? { authMode: 'apiKey' } : undefined);
    if (errors?.length) { console.warn(`Email notifier: ${kind} failed`, errors); return 'failed'; }
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    if (!result?.success) { console.warn(`Email notifier: ${kind} failed`, result?.error); return 'failed'; }
    return 'sent';
  } catch (err) {
    console.warn(`Email notifier: ${kind} unreachable`, err);
    return 'failed';
  }
}

/** Courtesy email after signUp()/resendCode() — Cognito sends the actual code. Fires before sign-in. */
export const notifySignupCode = (to, name) => send('signup-code', { to, name }, { guest: true });

/** Courtesy email after startPasswordReset() — Cognito sends the actual code. Fires before sign-in. */
export const notifyPasswordReset = (to, name) => send('password-reset', { to, name }, { guest: true });

/**
 * A service/blessing/facility request changed. status: 'approved' |
 * 'scheduled' | 'rescheduled' | 'declined' | 'cancelled' (reason for the last
 * three in declineReason). Only 'scheduled' may come from the parishioner
 * (confirming their own self-booked slot); the rest are staff-only — the
 * backend checks (see amplify/functions/notify-parishioner).
 */
export function notifyServiceUpdate({ to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines }) {
  return send('service-update', { to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines });
}

/** A certificate request was approved, released (ready for pickup) or rejected. Staff-only. */
export function notifyCertificateUpdate({ to, name, certificateType, status, reason }) {
  return send('certificate-update', { to, name, certificateType, status, declineReason: reason });
}

/** A Mass intention was cancelled by the office. Staff-only. */
export function notifyMassIntentionUpdate({ to, name, status, date, time, reason, detailsLines }) {
  return send('mass-intention-update', { to, name, status, date, time, declineReason: reason, detailsLines });
}
