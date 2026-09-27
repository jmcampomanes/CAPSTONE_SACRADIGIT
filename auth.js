/* ============================================
   SacraDigit — sign-in and roles (AWS Cognito)

   Who you are comes from your Cognito account;
   what you can open comes from its group:
     admin   → Admin portal (everything), Media portal
     staff   → Admin portal (parish office)
     itech   → Sacra ITech portal
     media   → Media portal
     (none)  → Parishioner — every signed-in person
               can use the Parishioner portal

   Each role's shell script calls guardPage() for
   its portal. The page stays hidden (html.auth-
   pending, set by the <head> snippet) until the
   check passes; otherwise the visitor is sent to
   index.html, the sign-in page (not signed in) or to their own portal
   (signed in, wrong role).

   The signed-in person's name/email/role is also
   cached in localStorage so page scripts can read it
   right away (currentUser()); guardPage() refreshes
   it from Cognito on every page load, and signOut()
   clears it.

   Staying signed in: parishioners stay signed in
   on this device until they log out (or the 30-day
   Cognito refresh token runs out). Admin, staff,
   ITech and media sessions last only until the
   browser is closed — a session cookie marks them,
   and a staff login found without it is signed out.
   ============================================ */

import './amplify-init.js'; // makes sure Amplify is configured first
import {
  signIn as cognitoSignIn, signUp as cognitoSignUp, confirmSignUp, resendSignUpCode,
  confirmSignIn, signOut as cognitoSignOut, fetchAuthSession, fetchUserAttributes,
  resetPassword, confirmResetPassword, getCurrentUser,
} from 'aws-amplify/auth';

const CACHE_KEY = 'sacradigit_user';
const STAFF_SESSION_COOKIE = 'sacradigit_staff_session';
let justSignedIn = false; // set by signIn()/setNewPassword() on this page load

export const ROLES = {
  admin:       { label: 'Administrator',     home: 'Sacradigit/dashboard.html' },
  staff:       { label: 'Parish Staff',      home: 'Sacradigit/dashboard.html' },
  itech:       { label: 'IT Team',           home: 'Sacraitech/itech-dashboard.html' },
  media:       { label: 'Media Team',        home: 'Sacramedia/media-dashboard.html' },
  parishioner: { label: 'Parishioner',       home: 'user/user-dashboard.html' },
};

/** Which roles may open each portal. */
export const PORTAL_ACCESS = {
  admin:       ['admin', 'staff'],
  itech:       ['itech'],
  media:       ['media', 'admin'],
  parishioner: ['parishioner', 'admin', 'staff', 'itech', 'media'],
};

// When someone is in several groups, their "home" portal follows this order.
const ROLE_ORDER = ['admin', 'itech', 'staff', 'media'];

/* ---------- paths (pages live one folder deep, index.html (sign-in) at the root) ---------- */

function siteRoot() {
  // e.g. /CAPSTONE_SACRADIGIT/Sacradigit/masses.html → /CAPSTONE_SACRADIGIT/
  const parts = window.location.pathname.split('/');
  const known = ['Sacradigit', 'user', 'Sacraitech', 'Sacramedia'];
  const i = parts.findIndex(p => known.includes(p));
  return (i >= 0 ? parts.slice(0, i) : parts.slice(0, -1)).join('/') + '/';
}

export const pageUrl = (rel) => siteRoot() + rel;
export const homeFor = (role) => pageUrl((ROLES[role] || ROLES.parishioner).home);

function goToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.replace(`${pageUrl('index.html')}?next=${encodeURIComponent(next)}`);
}

/* ---------- the signed-in person ---------- */

function roleFromGroups(groups) {
  return ROLE_ORDER.find(r => groups.includes(r)) || 'parishioner';
}

/** { sub, email, firstName, lastName, name, groups, role } or null — synchronous (cached). */
export function currentUser() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch { return null; }
}

/** Display name for the signed-in person ('' when not signed in). */
export const currentUserName = () => currentUser()?.name || '';

export function hasRole(user, ...roles) {
  return !!user && roles.some(r => r === 'parishioner' || (user.groups || []).includes(r));
}

/** Reads the account from Cognito and refreshes the cache. Null when not signed in. */
export async function loadUser() {
  try {
    const session = await fetchAuthSession();
    if (!session.tokens) { clearCache(); return null; }
    const payload = session.tokens.accessToken.payload;
    const groups = payload['cognito:groups'] || [];
    let attrs = {};
    try { attrs = await fetchUserAttributes(); } catch { /* offline — keep token data */ }
    const firstName = attrs.given_name || '';
    const lastName = attrs.family_name || '';
    const email = attrs.email || payload.username || '';
    const user = {
      sub: payload.sub,
      email,
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(' ') || attrs.name || email.split('@')[0],
      groups,
      role: roleFromGroups(groups),
    };
    if (user.role !== 'parishioner') {
      if (justSignedIn) setStaffSession();
      else if (!hasStaffSession()) {
        // Staff login left over from an earlier browser session — make them sign in again.
        clearCache();
        try { await cognitoSignOut(); } catch { /* already signed out */ }
        return null;
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearCache();
    return null;
  }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  document.cookie = `${STAFF_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

// No expiry → the browser drops it when it closes.
function setStaffSession() {
  document.cookie = `${STAFF_SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

function hasStaffSession() {
  return document.cookie.split('; ').some(c => c.startsWith(`${STAFF_SESSION_COOKIE}=`));
}

/**
 * Protects a portal page. Call at the top of the portal's shell script.
 * Returns the signed-in user (or never resolves, because it redirects).
 */
export async function guardPage(portal) {
  const allowed = PORTAL_ACCESS[portal] || [];
  // Fast path: nobody cached → straight to login, before the page does anything.
  if (!currentUser()) { goToLogin(); return new Promise(() => {}); }
  const user = await loadUser();
  if (!user) { goToLogin(); return new Promise(() => {}); }
  const ok = allowed.includes('parishioner') || allowed.some(r => user.groups.includes(r));
  if (!ok) { window.location.replace(homeFor(user.role)); return new Promise(() => {}); }
  const paint = () => paintUserCard(user);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
  document.documentElement.classList.remove('auth-pending');
  document.dispatchEvent(new CustomEvent('sacradigit:user', { detail: user }));
  return user;
}

/** The profile card at the bottom of every portal's sidebar: initials, name, role. */
function paintUserCard(user) {
  const initials = ((user.firstName?.[0] || user.name?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || '?';
  const card = document.getElementById('user-menu-btn');
  if (card) {
    const avatar = card.querySelector('span');
    const lines = card.querySelectorAll('p');
    if (avatar) avatar.textContent = initials;
    if (lines[0]) lines[0].textContent = user.name;
    if (lines[1]) lines[1].textContent = (ROLES[user.role] || ROLES.parishioner).label;
  }
  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarName) sidebarName.textContent = user.name;
  const avatarInitials = document.getElementById('avatar-initials');
  if (avatarInitials) avatarInitials.textContent = initials;
}

// Every portal's user menu has a "Log Out" item; make it really sign out.
document.addEventListener('click', (e) => {
  const item = e.target.closest('.user-menu-item[data-action="logout"]');
  if (!item) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  signOut();
}, true);

/* ---------- sign in / sign up / reset ---------- */

export async function signIn(email, password) {
  const res = await cognitoSignIn({ username: email.trim().toLowerCase(), password });
  if (res.isSignedIn) justSignedIn = true;
  return res.nextStep?.signInStep || (res.isSignedIn ? 'DONE' : 'UNKNOWN');
}

/** For accounts ITech created with a temporary password. */
export async function setNewPassword(newPassword) {
  const res = await confirmSignIn({ challengeResponse: newPassword });
  if (res.isSignedIn) justSignedIn = true;
  return res.nextStep?.signInStep || (res.isSignedIn ? 'DONE' : 'UNKNOWN');
}

export async function signUp({ email, password, firstName, lastName }) {
  const res = await cognitoSignUp({
    username: email.trim().toLowerCase(),
    password,
    options: { userAttributes: { email: email.trim().toLowerCase(), given_name: firstName.trim(), family_name: lastName.trim() } },
  });
  return res.nextStep?.signUpStep || 'DONE';
}

export const confirmCode = (email, code) => confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
export const resendCode = (email) => resendSignUpCode({ username: email.trim().toLowerCase() });
export const startPasswordReset = (email) => resetPassword({ username: email.trim().toLowerCase() });
export const finishPasswordReset = (email, code, newPassword) =>
  confirmResetPassword({ username: email.trim().toLowerCase(), confirmationCode: code.trim(), newPassword });

export async function isSignedIn() {
  try { await getCurrentUser(); return true; } catch { return false; }
}

export async function signOut() {
  clearCache();
  try { await cognitoSignOut(); } catch { /* already signed out */ }
  window.location.replace(pageUrl('index.html'));
}

/** Cognito error → a sentence a parishioner can act on. */
export function friendlyAuthError(err) {
  const name = err?.name || '';
  const map = {
    NotAuthorizedException: 'Incorrect email or password.',
    UserNotFoundException: 'Incorrect email or password.',
    UsernameExistsException: 'An account with this email already exists. Try signing in instead.',
    CodeMismatchException: 'That code is not correct. Please check the email and try again.',
    ExpiredCodeException: 'That code has expired. Request a new one.',
    InvalidPasswordException: 'Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol.',
    InvalidParameterException: 'Please check the details you entered.',
    LimitExceededException: 'Too many attempts. Please wait a few minutes and try again.',
    TooManyRequestsException: 'Too many attempts. Please wait a few minutes and try again.',
    UserNotConfirmedException: 'Please confirm your email first — enter the code we sent you.',
    UserAlreadyAuthenticatedException: 'You are already signed in.',
    NetworkError: 'Can’t reach the server. Check your internet connection.',
  };
  return map[name] || err?.message || 'Something went wrong. Please try again.';
}
