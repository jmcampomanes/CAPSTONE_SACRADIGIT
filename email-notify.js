/* ============================================
   SacraDigit — parishioner email notifier client

   Talks to the small Express server in
   server/email-notifier (Gmail via OAuth2, see
   its README/.env.example to run it). Only three
   kinds of email ever go out:
     signup-code     — courtesy notice after Cognito
                        emails a sign-up confirmation code
     password-reset  — courtesy notice after Cognito
                        emails a password-reset code
     service-update   — a blessing/service request was
                         scheduled or declined
     service-reminder — a scheduled booking is tomorrow

   Never blocks the caller: if the notifier is down
   or the request fails, this just logs a warning.
   ============================================ */

// Point this at wherever server/email-notifier is actually running.
// Local dev default — update for a deployed notifier.
const NOTIFY_BASE_URL = 'http://localhost:3001';

// Must match NOTIFY_API_KEY in server/email-notifier/.env.
const NOTIFY_API_KEY = '03e3d63c643275b05f10f817c522572f713db902dd7514c7';

async function send(kind, payload, { authToken } = {}) {
  try {
    const headers = { 'Content-Type': 'application/json', 'x-notify-key': NOTIFY_API_KEY };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${NOTIFY_BASE_URL}/notify-parishioner`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kind, ...payload }),
    });
    if (!res.ok) console.warn(`Email notifier: ${kind} failed (${res.status})`);
  } catch (err) {
    console.warn(`Email notifier: ${kind} unreachable`, err);
  }
}

/** Courtesy email after signUp()/resendCode() — Cognito sends the actual code. */
export const notifySignupCode = (to, name) => send('signup-code', { to, name });

/** Courtesy email after startPasswordReset() — Cognito sends the actual code. */
export const notifyPasswordReset = (to, name) => send('password-reset', { to, name });

async function staffAuthToken() {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    return (await fetchAuthSession()).tokens?.idToken?.toString();
  } catch { return undefined; } // not signed in — server will reject, which is correct
}

/**
 * A blessing/service request was scheduled or declined. Requires the
 * signed-in staff/admin's Cognito ID token (the server checks the group).
 */
export async function notifyServiceUpdate({ to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines }) {
  if (!to) return; // nothing to notify (e.g. no email on file for this requester)
  const authToken = await staffAuthToken();
  return send('service-update', { to, name, serviceType, status, date, time, declineReason, location, contact, detailsLines }, { authToken });
}

/**
 * A scheduled booking falls tomorrow. Same staff-only gate as above — this
 * is meant to be called from the admin Blessings page when it loads.
 */
export async function notifyServiceReminder({ to, name, serviceType, date, time, location }) {
  if (!to) return;
  const authToken = await staffAuthToken();
  return send('service-reminder', { to, name, serviceType, date, time, location }, { authToken });
}
