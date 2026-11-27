/* ============================================
   SacraDigit — Extra sign-in protection (email code)

   When it's on, signing in also needs a 6-digit code
   we email to the account's own address. The code is
   made, emailed and checked by the loginCode backend
   function (amplify/functions/login-code); the browser
   only asks for it and types it back in.

   Used by:
     • landing/login.js   — the code step after the password
     • shared/js/auth.js  — guardPage re-checks once per
                            browser tab (see sessionStorage 'sdTwoFa')
     • every profile page — the on/off switch (initTwoFactorToggle)

   Turning it on or off needs a fresh emailed code too, so
   the address is proven to work before it can lock anyone out.
   ============================================ */

import { client } from './amplify-init.js';

export const TWOFA_FLAG = 'sdTwoFa'; // sessionStorage: 'ok' once this tab passed (or didn't need) the code

export const twoFaPassed = () => { try { return sessionStorage.getItem(TWOFA_FLAG) === 'ok'; } catch { return false; } };
export const markTwoFaPassed = () => { try { sessionStorage.setItem(TWOFA_FLAG, 'ok'); } catch { /* storage blocked */ } };
export const clearTwoFa = () => { try { sessionStorage.removeItem(TWOFA_FLAG); } catch { /* storage blocked */ } };

async function call(action, purpose, code) {
  const { data, errors } = await client.mutations.loginCode({ action, purpose, code });
  if (errors?.length) throw new Error('We could not reach the sign-in service. Please try again.');
  const res = typeof data === 'string' ? JSON.parse(data) : data;
  if (!res?.success) throw new Error(res?.error || 'Something went wrong. Please try again.');
  return res.data || {};
}

/** Is Extra sign-in protection on for the signed-in user? Rejects if the service can't be reached. */
export const twoFactorEnabled = async () => !!(await call('status')).enabled;
/** Emails a fresh code. purpose: 'signin' | 'enable' | 'disable'. Resolves { hint: 'ma****@gmail.com', minutes }. */
export const sendTwoFactorCode = (purpose) => call('send', purpose);
/** Checks the code. Resolves { verified, enabled }; rejects with a sentence to show the person. */
export const checkTwoFactorCode = (purpose, code) => call('verify', purpose, code);

/* ---------- on/off switch on a profile page ---------- */

const COPY = {
  enable: { title: 'Turn on extra sign-in protection', go: 'Turn On' },
  disable: { title: 'Turn off extra sign-in protection', go: 'Turn Off' },
};

/** A small dialog: sends the code, asks for it, resolves true when it checked out (false if cancelled). */
function codeDialog(purpose) {
  return new Promise((resolve) => {
    const copy = COPY[purpose];
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', copy.title);
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
    wrap.innerHTML = `
      <div style="background:#fff;color:#1f2937;border-radius:14px;max-width:400px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:Inter,sans-serif;">
        <h3 style="margin:0 0 6px;font-size:17px;font-weight:700;">${copy.title}</h3>
        <p data-msg style="margin:0 0 14px;font-size:13px;color:#6b7280;">Sending a code to your email…</p>
        <input data-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" aria-label="6-digit code"
          style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:20px;letter-spacing:6px;text-align:center;" />
        <p data-err role="alert" style="margin:8px 0 0;font-size:12.5px;color:#b91c1c;min-height:1em;"></p>
        <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:14px;">
          <button type="button" data-resend style="background:none;border:none;color:#6c6fb0;font-size:12.5px;cursor:pointer;padding:0;">Send a new code</button>
          <span style="display:flex;gap:8px;">
            <button type="button" data-cancel style="border:1px solid #d1d5db;background:#fff;border-radius:10px;padding:8px 14px;font-size:13px;cursor:pointer;">Cancel</button>
            <button type="button" data-ok style="border:none;background:#1e2a4a;color:#fff;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">${copy.go}</button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const input = $('[data-code]');
    const err = (m) => { $('[data-err]').textContent = m || ''; };
    const close = (result) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(result); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);

    async function send() {
      err('');
      try {
        const { hint, minutes } = await sendTwoFactorCode(purpose);
        $('[data-msg]').textContent = `We emailed a 6-digit code to ${hint}. It expires in ${minutes} minutes.`;
        input.focus();
      } catch (e) { $('[data-msg]').textContent = 'We could not send the code.'; err(e.message); }
    }
    async function confirm() {
      const btn = $('[data-ok]');
      btn.disabled = true;
      try { await checkTwoFactorCode(purpose, input.value); close(true); }
      catch (e) { err(e.message); btn.disabled = false; }
    }
    $('[data-cancel]').addEventListener('click', () => close(false));
    $('[data-resend]').addEventListener('click', send);
    $('[data-ok]').addEventListener('click', confirm);
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
    send();
  });
}

/**
 * Wires a profile page's switch + status label to the real thing.
 * Shows the saved state from the server, and asks for an emailed code
 * before either turning it on or off.
 */
export async function initTwoFactorToggle({ toggle, statusEl, showToast = () => {} }) {
  if (!toggle) return;
  const paint = (on) => {
    toggle.checked = on;
    if (statusEl) { statusEl.textContent = on ? 'On' : 'Off'; statusEl.className = 'twofa-status ' + (on ? 'on' : 'off'); }
  };
  paint(false);
  toggle.disabled = true;
  let current = false;
  try { current = await twoFactorEnabled(); paint(current); } catch (e) { console.warn('Extra sign-in protection: status unavailable', e); showToast('Could not load your sign-in protection setting.', true); }
  toggle.disabled = false;

  toggle.addEventListener('change', async () => {
    const wantOn = toggle.checked;
    toggle.disabled = true;
    const done = await codeDialog(wantOn ? 'enable' : 'disable');
    toggle.disabled = false;
    if (!done) { paint(current); return; }
    current = wantOn;
    paint(current);
    if (current) markTwoFaPassed();
    showToast(current ? 'Extra sign-in protection turned on. We’ll email you a code each time you sign in.' : 'Extra sign-in protection turned off.');
  });
}
