/* ============================================
   SacraDigit — parishioner email notifier client

   Calls the notifyParishioner mutation (AppSync -> Lambda
   -> Gmail via an App Password). This replaces the old
   local-only Express server in server/email-notifier
   (kept there for local reference only — see its README),
   which couldn't be reached once the site is deployed.
   Kinds of email that go out:
     signup-code       — courtesy notice after Cognito
                          emails a sign-up confirmation code
     password-reset    — courtesy notice after Cognito
                          emails a password-reset code
     service-update     — a blessing/service request was
                           scheduled or declined
     service-reminder   — a scheduled booking is tomorrow
     certificate-ready — a certificate request was approved
                          and is ready for pickup

   Never blocks the caller: if the mutation fails, this
   just logs a warning.
   ============================================ */

import { client } from './amplify-init.js';

async function send(kind, payload, { guest = false } = {}) {
  try {
    const input = { kind, ...payload, detailsLines: JSON.stringify(payload.detailsLines || []) };
    const { data, errors } = await client.mutations.notifyParishioner(input, guest ? { authMode: 'apiKey' } : undefined);
    if (errors?.length) { console.warn(`Email notifier: ${kind} failed`, errors); return; }
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    if (!result?.success) console.warn(`Email notifier: ${kind} failed`, result?.error);
  } catch (err) {
    console.warn(`Email notifier: ${kind} unreachable`, err);
  }
}

/** Courtesy email after signUp()/resendCode() — Cognito sends the actual code. Fires before sign-in. */
export const notifySignupCode = (to, name) => send('signup-code', { to, name }, { guest: true });

/** Courtesy email after startPasswordReset() — Cognito sends the actual code. Fires before sign-in. */
export const notifyPasswordReset = (to, name) => send('password-reset', { to, name }, { guest: true });

/**
 * A blessing/service request was scheduled or declined, or a parishioner
 * confirming their own self-booked slot. Uses the signed-in caller's Cognito
 * session automatically; the backend decides who may send which (see
 * amplify/functions/notify-parishioner).
 */
export function notifyServiceUpdate({ to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines }) {
  if (!to) return; // nothing to notify (e.g. no email on file for this requester)
  return send('service-update', { to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines });
}

/**
 * A scheduled booking falls tomorrow. Staff-only — this is meant to be
 * called from the admin Blessings page when it loads.
 */
export function notifyServiceReminder({ to, name, serviceType, date, time, location }) {
  if (!to) return;
  return send('service-reminder', { to, name, serviceType, date, time, location });
}

/**
 * A certificate request was approved and is ready for pickup. Staff-only —
 * meant to be called from Record Requests when the Head Admin approves a
 * request.
 */
export function notifyCertificateReady({ to, name, certificateType }) {
  if (!to) return;
  return send('certificate-ready', { to, name, certificateType });
}
