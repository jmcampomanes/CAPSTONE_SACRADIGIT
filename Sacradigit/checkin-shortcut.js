/* ============================================
   SacraDigit Admin — "Check-in is open" shortcut
   On the Dashboard: while any Mass is open for
   check-in, a banner lists it with a button that
   shows the QR code and code again — on any staff
   device, as many times as needed (the code is
   shared through ../mass-checkin.js). Check-in is
   started from Masses → Date's Schedule.
   ============================================ */

import { checkInReady, watchOpenSessions, massStart } from '../mass-checkin.js';
import { initCheckInDisplay } from './mass-checkin-display.js';

document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('checkin-shortcut');
  if (!box || !checkInReady()) return;

  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(message, isError = false) {
    if (!toast) return;
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 200); }, 3000);
  }

  const display = initCheckInDisplay({ showToast });
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  let sessions = [];

  watchOpenSessions((list) => {
    sessions = list;
    box.classList.toggle('hidden', !list.length);
    box.innerHTML = list.length ? `
      <div class="ci-shortcut-icon" aria-hidden="true">●</div>
      <div class="ci-shortcut-text">
        <p class="ci-shortcut-title">Mass check-in is open</p>
        <p class="ci-shortcut-sub">Show the QR code and code again on this device — as often as you need.</p>
      </div>
      <div class="ci-shortcut-actions">
        ${list.map(s => {
          const when = massStart(s.massDate, s.massTime);
          const label = when ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : (s.massTime || '');
          return `<button type="button" class="btn-lavender" data-session="${esc(s.id)}">Show ${esc(label)} Check-in</button>`;
        }).join('')}
      </div>` : '';
  });

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-session]');
    if (!btn) return;
    const sess = sessions.find(s => s.id === btn.dataset.session);
    if (!sess) return;
    btn.disabled = true;
    await display.resume(sess);
    btn.disabled = false;
  });
});
