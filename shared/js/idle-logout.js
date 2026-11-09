/* ============================================
   SacraDigit — log out after inactivity

   Started by guardPage() (auth.js) on every portal
   page once the sign-in check passes.

   - No mouse, key, touch or scroll activity for
     IDLE_MINUTES → a dialog warns that the session
     ends in WARN_SECONDS, with "Stay signed in"
     and "Log out now".
   - No answer → signed out and sent to the sign-in
     page, which says why (login.html?reason=idle).
   - Activity in any open tab counts for all tabs
     (shared through localStorage), and a sign-out
     in one tab signs the others out too.
   - Coming back to a page after the limit (laptop
     closed, tab left overnight) signs out at once.
   - A page can opt out with <html data-no-idle-logout>
     (e.g. Sacramedia livestream, where staff watch
     a stream for an hour without touching anything).
   ============================================ */

import { signOut, pageUrl } from './auth.js';

// Staff handle parish records, so their limit is shorter.
const IDLE_MINUTES = { staff: 15, parishioner: 30 };
const WARN_SECONDS = 60;

const LAST_KEY = 'sacradigit_last_active';
const USER_KEY = 'sacradigit_user';
const CHECK_EVERY_MS = 5000;
const SAVE_EVERY_MS = 10000; // throttle localStorage writes while the mouse moves

let limitMs = 0;
let lastSaved = 0;
let dialog = null;
let countdownTimer = 0;
let stopped = false;

function readLast() {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; }
}
function saveLast(now = Date.now()) {
  lastSaved = now;
  try { localStorage.setItem(LAST_KEY, String(now)); } catch { /* storage blocked */ }
}

function onActivity() {
  if (stopped || dialog) return; // while the warning shows, only its buttons count
  const now = Date.now();
  if (now - lastSaved > SAVE_EVERY_MS) saveLast(now);
}

async function logOutForIdle() {
  if (stopped) return;
  stopped = true;
  try { sessionStorage.setItem('sdLogoutReason', 'idle'); } catch { /* storage blocked */ }
  try { localStorage.removeItem(LAST_KEY); } catch { /* storage blocked */ }
  await signOut(); // clears the session and goes to login.html
}

function check() {
  if (stopped) return;
  // Signed out in another tab → follow it.
  let cached = null;
  try { cached = localStorage.getItem(USER_KEY); } catch { /* storage blocked */ }
  if (!cached) { stopped = true; window.location.replace(pageUrl('login.html')); return; }

  const idleFor = Date.now() - readLast();
  if (idleFor >= limitMs) { logOutForIdle(); return; }
  if (idleFor >= limitMs - WARN_SECONDS * 1000) showWarning();
  else if (dialog) hideWarning(); // activity in another tab
}

/* ---------- the warning dialog ---------- */

const STYLE = `
.sd-idle-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15, 20, 35, 0.55); }
.sd-idle-card { width: 100%; max-width: 400px; border-radius: 16px; padding: 24px; background: #ffffff; color: #1e2a4a; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); font-family: inherit; }
.sd-idle-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(212, 163, 94, 0.18); color: #a7742e; margin-bottom: 14px; }
.sd-idle-card h2 { margin: 0 0 6px; font-size: 1.125rem; font-weight: 600; }
.sd-idle-card p { margin: 0 0 20px; font-size: 0.9375rem; line-height: 1.5; color: #4b4e63; }
.sd-idle-count { font-weight: 600; font-variant-numeric: tabular-nums; color: #1e2a4a; }
.sd-idle-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.sd-idle-actions button { min-height: 44px; padding: 0 18px; border-radius: 10px; font: inherit; font-weight: 600; font-size: 0.9375rem; cursor: pointer; border: 1px solid transparent; }
.sd-idle-out { background: transparent; border-color: #d9dae4 !important; color: #1e2a4a; }
.sd-idle-stay { background: #3f4060; color: #ffffff; }
.sd-idle-stay:hover { background: #33344f; }
.sd-idle-actions button:focus-visible { outline: 3px solid #d4a35e; outline-offset: 2px; }
:root[data-theme="dark"] .sd-idle-card { background: #1f2738; color: #f1f3f7; }
:root[data-theme="dark"] .sd-idle-card p { color: #c3cadb; }
:root[data-theme="dark"] .sd-idle-count { color: #ffffff; }
:root[data-theme="dark"] .sd-idle-icon { color: #e6bd7f; }
:root[data-theme="dark"] .sd-idle-out { border-color: #46516b !important; color: #f1f3f7; }
:root[data-theme="dark"] .sd-idle-stay { background: #8b8fc7; color: #12172a; }
:root[data-theme="dark"] .sd-idle-stay:hover { background: #a3a6d6; }
`;

function showWarning() {
  if (dialog) return;
  if (!document.getElementById('sd-idle-style')) {
    const s = document.createElement('style');
    s.id = 'sd-idle-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }
  dialog = document.createElement('div');
  dialog.className = 'sd-idle-backdrop';
  dialog.innerHTML = `
    <div class="sd-idle-card" role="alertdialog" aria-modal="true" aria-labelledby="sd-idle-title" aria-describedby="sd-idle-text">
      <div class="sd-idle-icon" aria-hidden="true">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <h2 id="sd-idle-title">Are you still there?</h2>
      <p id="sd-idle-text">For your security, you'll be logged out in <span class="sd-idle-count">${WARN_SECONDS}</span> seconds because there's been no activity.</p>
      <div class="sd-idle-actions">
        <button type="button" class="sd-idle-out">Log out now</button>
        <button type="button" class="sd-idle-stay">Stay signed in</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  const count = dialog.querySelector('.sd-idle-count');
  const stay = dialog.querySelector('.sd-idle-stay');
  stay.addEventListener('click', () => { saveLast(); hideWarning(); });
  dialog.querySelector('.sd-idle-out').addEventListener('click', () => { stopped = true; signOut(); });
  stay.focus();
  const tick = () => {
    const left = Math.max(0, Math.ceil((readLast() + limitMs - Date.now()) / 1000));
    count.textContent = String(left);
    if (left <= 0) logOutForIdle();
  };
  tick();
  countdownTimer = window.setInterval(tick, 1000);
}

function hideWarning() {
  window.clearInterval(countdownTimer);
  dialog?.remove();
  dialog = null;
}

/* ---------- start ---------- */

export function startIdleWatch(user) {
  if (document.documentElement.hasAttribute('data-no-idle-logout')) return;
  limitMs = (user?.role === 'parishioner' ? IDLE_MINUTES.parishioner : IDLE_MINUTES.staff) * 60 * 1000;

  // Back after the limit (e.g. the laptop was closed) → out now.
  const last = readLast();
  if (last && Date.now() - last >= limitMs) { logOutForIdle(); return; }
  saveLast();

  const opts = { passive: true, capture: true };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, onActivity, opts));
  // Timers sleep in background tabs; check again the moment the tab is visible.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('storage', (e) => { if (e.key === LAST_KEY || e.key === USER_KEY) check(); });
  window.setInterval(check, CHECK_EVERY_MS);
}
