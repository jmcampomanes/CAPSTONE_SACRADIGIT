/* ============================================
   SacraDigit — Change Password (shared)
   The Security tab's Change Password form on every
   portal's profile page (parishioner, admin, Media).
   Changes the REAL sign-in password through Cognito's
   updatePassword() — no demo passwords.

   Works on the markup the profile pages already have:
     #pw-current, #pw-new, #pw-confirm, #pw-submit,
     #pw-strength-fill, #pw-strength-label
   and adds, without touching each page's HTML:
     • show/hide (eye) button on each password box
     • a live checklist of the password rules — read
       from the Cognito policy in amplify_outputs.json,
       so it always matches what sign-in enforces
     • "Passwords match" / "don't match" under Confirm
     • a Caps Lock warning
     • Update Password stays disabled until everything
       is valid
   Styles are injected here (light + dark) so all
   three portals look the same.
   ============================================ */

import { updatePassword } from 'aws-amplify/auth';
import outputs from './amplify_outputs.json';
import { friendlyAuthError } from './auth.js';

const policy = outputs?.auth?.password_policy || {};
const MIN_LENGTH = policy.min_length || 8;

// Only the rules the user pool actually requires.
const RULES = [
  { id: 'length', label: `At least ${MIN_LENGTH} characters`, test: (pw) => pw.length >= MIN_LENGTH },
  policy.require_uppercase !== false && { id: 'upper', label: 'An uppercase letter (A–Z)', test: (pw) => /[A-Z]/.test(pw) },
  policy.require_lowercase !== false && { id: 'lower', label: 'A lowercase letter (a–z)', test: (pw) => /[a-z]/.test(pw) },
  policy.require_numbers !== false && { id: 'number', label: 'A number (0–9)', test: (pw) => /[0-9]/.test(pw) },
  policy.require_symbols !== false && { id: 'symbol', label: 'A symbol (e.g. ! @ # $ %)', test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
].filter(Boolean);

const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1M6.6 6.6A17.4 17.4 0 002 12s3.6 7 10 7a9.9 9.9 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
const DOT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const STYLE = `
  .pwc-field { position: relative; }
  .pwc-field .form-input { padding-right: 2.75rem; }
  .pwc-eye {
    position: absolute; top: 50%; right: 0.375rem; transform: translateY(-50%);
    width: 2rem; height: 2rem; border: 0; border-radius: 0.5rem; background: transparent;
    color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .pwc-eye:hover { color: #1e2a4a; background-color: #f3f4f6; }
  .pwc-eye:focus-visible { outline: 2px solid #8b8fc7; outline-offset: 1px; }
  .pwc-eye svg { width: 1.1rem; height: 1.1rem; }

  .pwc-rules { list-style: none; margin: 0.625rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
  .pwc-rule { display: flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; color: #6b7280; transition: color 0.15s ease; }
  .pwc-rule-mark {
    width: 1rem; height: 1rem; border-radius: 999px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background-color: #f3f4f6; color: #c4c8d2; transition: background-color 0.15s ease, color 0.15s ease;
  }
  .pwc-rule-mark svg { width: 0.7rem; height: 0.7rem; }
  .pwc-rule.ok { color: #15803d; }
  .pwc-rule.ok .pwc-rule-mark { background-color: #dcfce7; color: #15803d; }

  .pwc-match { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.5rem; min-height: 1rem; }
  .pwc-match svg { width: 0.85rem; height: 0.85rem; }
  .pwc-match.ok { color: #15803d; }
  .pwc-match.bad { color: #dc2626; }
  .form-input.pwc-ok { border-color: #22c55e; }

  .pwc-caps { display: none; font-size: 0.75rem; font-weight: 600; color: #b45309; margin-top: 0.4rem; }
  .pwc-caps.on { display: block; }

  .pwc-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }

  #pw-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }

  /* Fallback for pages without their own field-error style (zero specificity — page styles win) */
  :where(.form-error-msg) { font-size: 0.6875rem; font-weight: 600; color: #dc2626; margin-top: 0.3rem; }
  :where(:root[data-theme="dark"]) :where(.form-error-msg) { color: #fca5a5; }

  :root[data-theme="dark"] .pwc-eye { color: #7d8699; }
  :root[data-theme="dark"] .pwc-eye:hover { color: #e6e9ef; background-color: #242c3e; }
  :root[data-theme="dark"] .pwc-rule { color: #9ea6b5; }
  :root[data-theme="dark"] .pwc-rule-mark { background-color: #242c3e; color: #5f6879; }
  :root[data-theme="dark"] .pwc-rule.ok, :root[data-theme="dark"] .pwc-match.ok { color: #6ee7a0; }
  :root[data-theme="dark"] .pwc-rule.ok .pwc-rule-mark { background-color: #133024; color: #6ee7a0; }
  :root[data-theme="dark"] .pwc-match.bad { color: #fca5a5; }
  :root[data-theme="dark"] .pwc-caps { color: #fcd34d; }
`;

function injectStyles() {
  if (document.getElementById('pwc-styles')) return;
  const st = document.createElement('style');
  st.id = 'pwc-styles';
  st.textContent = STYLE;
  document.head.appendChild(st);
}

/** Wraps a password box so it gets an eye button; returns the wrapper. */
function addEyeButton(input) {
  const wrap = document.createElement('div');
  wrap.className = 'pwc-field';
  input.before(wrap);
  wrap.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pwc-eye';
  const paint = () => {
    const shown = input.type === 'text';
    btn.innerHTML = shown ? EYE_OFF : EYE;
    btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    btn.title = shown ? 'Hide password' : 'Show password';
  };
  btn.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; paint(); input.focus(); });
  paint();
  wrap.appendChild(btn);
  return wrap;
}

function strengthOf(pw, passed) {
  if (!pw) return { level: '', label: 'Password strength', pct: 0 };
  const allRules = passed === RULES.length;
  if (!allRules) return { level: 'weak', label: 'Weak — meet all the rules below', pct: Math.max(15, Math.round((passed / RULES.length) * 60)) };
  if (pw.length >= 14) return { level: 'strong', label: 'Strong password', pct: 100 };
  if (pw.length >= 11) return { level: 'strong', label: 'Good password', pct: 85 };
  return { level: 'fair', label: 'OK — a longer password is even safer', pct: 65 };
}

/**
 * Wires up the Security tab's Change Password form.
 * @param {{ showToast: (msg: string, isError?: boolean) => void }} opts
 */
export function initPasswordChange({ showToast }) {
  const pwCurrent = document.getElementById('pw-current');
  const pwNew = document.getElementById('pw-new');
  const pwConfirm = document.getElementById('pw-confirm');
  const pwSubmit = document.getElementById('pw-submit');
  const strengthFill = document.getElementById('pw-strength-fill');
  const strengthLabel = document.getElementById('pw-strength-label');
  if (!pwCurrent || !pwNew || !pwConfirm || !pwSubmit) return;

  injectStyles();
  [pwCurrent, pwNew, pwConfirm].forEach(addEyeButton);
  pwCurrent.autocomplete = 'current-password';
  pwNew.autocomplete = 'new-password';
  pwConfirm.autocomplete = 'new-password';
  pwNew.placeholder = 'Create a new password';
  pwConfirm.placeholder = 'Type the new password again';

  // Rules checklist under the strength meter
  const rulesList = document.createElement('ul');
  rulesList.className = 'pwc-rules';
  rulesList.setAttribute('aria-label', 'Password requirements');
  rulesList.innerHTML = RULES.map(r => `<li class="pwc-rule" data-rule="${r.id}"><span class="pwc-rule-mark">${DOT}</span>${r.label}</li>`).join('');
  (strengthLabel || pwNew.parentElement).insertAdjacentElement('afterend', rulesList);

  const caps = document.createElement('p');
  caps.className = 'pwc-caps';
  caps.setAttribute('role', 'status');
  caps.textContent = 'Caps Lock is on';
  rulesList.insertAdjacentElement('beforebegin', caps);

  const match = document.createElement('p');
  match.className = 'pwc-match';
  match.setAttribute('aria-live', 'polite');
  pwConfirm.parentElement.insertAdjacentElement('afterend', match);

  let busy = false;

  function errorFor(input) { return input.closest('div:not(.pwc-field)')?.querySelector('.form-error-msg'); }
  function setError(input, message) {
    input.classList.add('has-error');
    let msg = errorFor(input);
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.parentElement.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }
  function clearError(input) {
    input.classList.remove('has-error');
    errorFor(input)?.remove();
  }

  function check() {
    const pw = pwNew.value;
    let passed = 0;
    RULES.forEach(r => {
      const ok = r.test(pw);
      if (ok) passed++;
      const li = rulesList.querySelector(`[data-rule="${r.id}"]`);
      li.classList.toggle('ok', ok);
      li.querySelector('.pwc-rule-mark').innerHTML = ok ? CHECK : DOT;
    });
    const rulesOk = passed === RULES.length;
    const differs = !pw || pw !== pwCurrent.value;

    const s = strengthOf(pw, passed);
    if (strengthFill) { strengthFill.className = `pw-strength-fill ${s.level}`; strengthFill.style.width = `${s.pct}%`; }
    if (strengthLabel) { strengthLabel.className = `pw-strength-label ${s.level}`; strengthLabel.textContent = differs ? s.label : 'Same as your current password — choose a new one'; }

    // Match line only once they've started confirming
    const confirm = pwConfirm.value;
    const matches = !!confirm && confirm === pw;
    if (!confirm) { match.className = 'pwc-match'; match.innerHTML = ''; }
    else if (matches) { match.className = 'pwc-match ok'; match.innerHTML = `${CHECK}Passwords match`; }
    else { match.className = 'pwc-match bad'; match.innerHTML = `${CROSS}${pw.startsWith(confirm) ? 'Keep typing…' : 'Passwords don’t match'}`; }
    pwConfirm.classList.toggle('pwc-ok', matches && rulesOk);
    pwNew.classList.toggle('pwc-ok', rulesOk && differs);

    const ready = !!pwCurrent.value && rulesOk && differs && matches;
    pwSubmit.disabled = busy || !ready;
    return ready;
  }

  [pwCurrent, pwNew, pwConfirm].forEach(input => {
    input.addEventListener('input', () => { clearError(input); check(); });
    // Caps Lock warning while typing a password
    input.addEventListener('keyup', (e) => caps.classList.toggle('on', !!e.getModifierState?.('CapsLock')));
    input.addEventListener('blur', () => caps.classList.remove('on'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !pwSubmit.disabled) pwSubmit.click(); });
  });

  // No pasting into Confirm — it should be typed again to catch typos.
  pwConfirm.addEventListener('paste', (e) => { e.preventDefault(); showToast('Please type the new password again instead of pasting it.', true); });

  function reset() {
    [pwCurrent, pwNew, pwConfirm].forEach(i => { i.value = ''; i.type = 'password'; i.classList.remove('pwc-ok'); clearError(i); });
    document.querySelectorAll('.pwc-eye').forEach(b => { b.innerHTML = EYE; b.setAttribute('aria-label', 'Show password'); b.title = 'Show password'; });
    check();
  }

  pwSubmit.addEventListener('click', async () => {
    if (!check()) {
      if (!pwCurrent.value) setError(pwCurrent, 'Enter your current password.');
      showToast('Please complete the password form first.', true);
      return;
    }
    busy = true;
    pwSubmit.disabled = true;
    const label = pwSubmit.textContent;
    pwSubmit.textContent = 'Updating…';
    try {
      await updatePassword({ oldPassword: pwCurrent.value, newPassword: pwNew.value });
      reset();
      showToast('Your password has been updated. Use the new one next time you sign in.');
    } catch (err) {
      console.error('Failed to update password:', err);
      if (err?.name === 'NotAuthorizedException') {
        setError(pwCurrent, 'Current password is incorrect.');
        pwCurrent.focus();
        showToast('Current password is incorrect.', true);
      } else if (err?.name === 'InvalidPasswordException') {
        setError(pwNew, friendlyAuthError(err));
        showToast(friendlyAuthError(err), true);
      } else {
        showToast(friendlyAuthError(err), true);
      }
    } finally {
      busy = false;
      pwSubmit.textContent = label;
      check();
    }
  });

  check();
}
