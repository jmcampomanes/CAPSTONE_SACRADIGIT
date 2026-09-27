/* ============================================
   SacraDigit — Sign in / Create account
   One page for every role; after signing in,
   each person goes to their own portal (or back
   to the page they were trying to open, if
   their role is allowed there).
   ============================================ */

import {
  signIn, signUp, confirmCode, resendCode, startPasswordReset, finishPasswordReset,
  setNewPassword, loadUser, homeFor, isSignedIn, friendlyAuthError, PORTAL_ACCESS,
} from './auth.js';
import { initUiPrefs } from './ui-prefs.js';
import './Sacradigit/sacred-art.js';

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll('.lg-view')];
const alertEl = $('lg-alert');
let pendingEmail = '';   // email waiting for a confirmation / reset code
let pendingPassword = ''; // so we can sign straight in after confirming

initUiPrefs();

/* ---------- where to go after signing in ---------- */
const PORTAL_OF = { Sacradigit: 'admin', Sacraitech: 'itech', Sacramedia: 'media', user: 'parishioner' };

function destinationFor(user) {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    const folder = Object.keys(PORTAL_OF).find(f => next.includes(`/${f}/`));
    const portal = folder && PORTAL_OF[folder];
    const allowed = portal && PORTAL_ACCESS[portal];
    if (allowed && (allowed.includes('parishioner') || allowed.some(r => user.groups.includes(r)))) return next;
  }
  return homeFor(user.role);
}

async function finishSignIn() {
  const user = await loadUser();
  if (!user) throw new Error('Signed in, but your account could not be loaded. Please try again.');
  window.location.replace(destinationFor(user));
}

/* ---------- view switching ---------- */
function show(view, { keepAlert = false } = {}) {
  views.forEach(v => v.classList.toggle('hidden', v.dataset.view !== view));
  document.querySelectorAll('.lg-tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  $('lg-tabs').classList.toggle('hidden', !['signin', 'signup'].includes(view));
  if (!keepAlert) setAlert('');
  const first = document.querySelector(`.lg-view[data-view="${view}"] input`);
  first?.focus();
}

function setAlert(message, kind = 'error') {
  alertEl.textContent = message;
  alertEl.className = `lg-alert ${kind === 'ok' ? 'is-ok' : 'is-error'}${message ? '' : ' hidden'}`;
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); show(go.dataset.go); }
  const tab = e.target.closest('.lg-tab');
  if (tab) show(tab.dataset.view);
  const pw = e.target.closest('[data-toggle-pw]');
  if (pw) {
    const input = $(pw.dataset.togglePw);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    pw.textContent = reveal ? 'Hide' : 'Show';
    pw.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  }
});

async function busy(form, fn) {
  const btn = form.querySelector('.lg-btn');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';
  try { await fn(); } catch (err) {
    console.error(err);
    setAlert(friendlyAuthError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------- password rules (live checklist) ---------- */
const RULES = {
  len: (p) => p.length >= 8,
  upper: (p) => /[A-Z]/.test(p),
  lower: (p) => /[a-z]/.test(p),
  num: (p) => /\d/.test(p),
  sym: (p) => /[^A-Za-z0-9]/.test(p),
};
const passwordOk = (p) => Object.values(RULES).every(fn => fn(p));
$('su-password').addEventListener('input', () => {
  const p = $('su-password').value;
  document.querySelectorAll('#su-rules li').forEach(li => li.classList.toggle('ok', RULES[li.dataset.rule](p)));
});

/* ---------- forms ---------- */
const form = (view) => document.querySelector(`.lg-view[data-view="${view}"]`);

form('signin').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('si-email').value.trim();
  const password = $('si-password').value;
  if (!email || !password) { setAlert('Please enter your email and password.'); return; }
  busy(e.target, async () => {
    const step = await signIn(email, password);
    if (step === 'DONE') return finishSignIn();
    if (step === 'CONFIRM_SIGN_UP') {
      pendingEmail = email; pendingPassword = password;
      $('cf-email-label').textContent = email;
      try { await resendCode(email); } catch { /* a code may already be on its way */ }
      show('confirm');
      setAlert('Please confirm your email first — we sent you a new code.', 'ok');
      return;
    }
    if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') { show('newpass'); return; }
    if (step === 'RESET_PASSWORD') {
      pendingEmail = email;
      $('rp-email-label').textContent = email;
      await startPasswordReset(email);
      show('reset');
      setAlert('Your password needs to be reset. We emailed you a code.', 'ok');
      return;
    }
    setAlert('This sign-in needs a step SacraDigit doesn’t support yet. Please contact the parish IT team.');
  });
});

form('signup').addEventListener('submit', (e) => {
  e.preventDefault();
  const firstName = $('su-first').value.trim();
  const lastName = $('su-last').value.trim();
  const email = $('su-email').value.trim();
  const password = $('su-password').value;
  if (!firstName || !lastName || !email) { setAlert('Please fill in your name and email.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAlert('Please enter a valid email address.'); return; }
  if (!passwordOk(password)) { setAlert('Your password doesn’t meet all the rules below it yet.'); return; }
  if (password !== $('su-password2').value) { setAlert('The two passwords don’t match.'); return; }
  busy(e.target, async () => {
    const step = await signUp({ email, password, firstName, lastName });
    pendingEmail = email; pendingPassword = password;
    if (step === 'CONFIRM_SIGN_UP') {
      $('cf-email-label').textContent = email;
      show('confirm');
      setAlert('Account created. Enter the code we emailed you.', 'ok');
    } else {
      await signIn(email, password);
      await finishSignIn();
    }
  });
});

form('confirm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('cf-code').value.trim();
  if (!/^\d{6}$/.test(code)) { setAlert('Please enter the 6-digit code from the email.'); return; }
  busy(e.target, async () => {
    await confirmCode(pendingEmail, code);
    if (pendingPassword) {
      const step = await signIn(pendingEmail, pendingPassword);
      if (step === 'DONE') return finishSignIn();
    }
    show('signin');
    $('si-email').value = pendingEmail;
    setAlert('Your email is confirmed. Please sign in.', 'ok');
  });
});

$('cf-resend').addEventListener('click', async () => {
  try { await resendCode(pendingEmail); setAlert('A new code is on its way.', 'ok'); }
  catch (err) { setAlert(friendlyAuthError(err)); }
});

form('forgot').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('fp-email').value.trim();
  if (!email) { setAlert('Please enter your email.'); return; }
  busy(e.target, async () => {
    await startPasswordReset(email);
    pendingEmail = email;
    $('rp-email-label').textContent = email;
    show('reset');
    setAlert('If that email has an account, a code is on its way.', 'ok');
  });
});

form('reset').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('rp-code').value.trim();
  const password = $('rp-password').value;
  if (!/^\d{6}$/.test(code)) { setAlert('Please enter the 6-digit code from the email.'); return; }
  if (!passwordOk(password)) { setAlert('Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol.'); return; }
  busy(e.target, async () => {
    await finishPasswordReset(pendingEmail, code, password);
    show('signin');
    $('si-email').value = pendingEmail;
    setAlert('Password changed. You can sign in now.', 'ok');
  });
});

form('newpass').addEventListener('submit', (e) => {
  e.preventDefault();
  const password = $('np-password').value;
  if (!passwordOk(password)) { setAlert('Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol.'); return; }
  busy(e.target, async () => {
    const step = await setNewPassword(password);
    if (step === 'DONE') return finishSignIn();
    setAlert('Please contact the parish IT team to finish setting up this account.');
  });
});

/* ---------- already signed in? skip the form ---------- */
(async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'signup') show('signup');
  if (await isSignedIn()) {
    try { await finishSignIn(); } catch { /* stay on the form */ }
  }
})();
