/* ============================================
   SacraDigit — "Check In at Mass" on the parishioner
   dashboard. Shows itself while a Mass is open for
   check-in, so parishioners don't have to look for
   it: type the 6-character code from the church
   screen (it checks in by itself once all 6 are in)
   — or scan the QR code with the phone camera.
   When they've checked in, the card says so.
   See ../mass-checkin.js.
   ============================================ */

import { currentUserName } from '../auth.js';
import { checkInReady, watchOpenSessions, submitCheckIn, alreadyCheckedIn, normalizeCode, massStart, checkInErrorMessage } from '../mass-checkin.js';

export function mountCheckInCard(box) {
  if (!box || !checkInReady()) return;
  const name = currentUserName();
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  const timeOf = (s) => {
    const when = massStart(s.massDate, s.massTime);
    return when ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : (s.massTime || '');
  };

  let sessions = [];
  const checkedIn = new Set(); // session ids this person is checked in to
  let busy = false;
  let message = null; // { ok, text }

  watchOpenSessions(async (list) => {
    sessions = list;
    // Already checked in (e.g. on another device, or by the QR link)?
    await Promise.all(list.filter(s => !checkedIn.has(s.id)).map(async (s) => {
      if (await alreadyCheckedIn(s.id, name).catch(() => false)) checkedIn.add(s.id);
    }));
    render();
  });

  function render() {
    box.classList.toggle('hidden', !sessions.length);
    if (!sessions.length) { box.innerHTML = ''; return; }

    const waiting = sessions.filter(s => !checkedIn.has(s.id));
    const done = sessions.filter(s => checkedIn.has(s.id));
    if (!waiting.length) {
      box.innerHTML = `
        <div class="ci-card-icon done" aria-hidden="true">✓</div>
        <div class="ci-card-main">
          <p class="ci-card-title">You're checked in for the ${esc(done.map(timeOf).join(' and '))} Mass. God bless!</p>
          <p class="ci-card-sub">It counts toward your badges in My Faith Journey.</p>
        </div>`;
      return;
    }

    const only = waiting.length === 1 ? waiting[0] : null;
    const title = only ? `Check in to the ${timeOf(only)} ${only.title || 'Mass'}` : 'A Mass is open for check-in';
    box.innerHTML = `
      <div class="ci-card-icon" aria-hidden="true">⛪</div>
      <div class="ci-card-main">
        <p class="ci-card-title">${esc(title)}</p>
        <p class="ci-card-sub">Type the 6-character code shown on the church screen — or scan its QR code with your phone camera.</p>
        <form class="ci-card-form" autocomplete="off">
          <label for="ci-card-code" class="sr-only">Check-in code</label>
          <input id="ci-card-code" class="form-input ci-card-input" placeholder="ABC-123" maxlength="7" inputmode="text" autocapitalize="characters" spellcheck="false" ${busy ? 'disabled' : ''} />
          <button type="submit" class="btn-lavender" ${busy ? 'disabled' : ''}>${busy ? 'Checking in…' : 'Check In'}</button>
        </form>
        ${message ? `<p class="ci-card-msg ${message.ok ? 'ok' : 'err'}" role="status">${esc(message.text)}</p>` : ''}
      </div>`;
  }

  // Uppercase as they type, dash after 3 — and check in by itself at 6 characters
  box.addEventListener('input', (e) => {
    if (e.target.id !== 'ci-card-code') return;
    const c = normalizeCode(e.target.value).slice(0, 6);
    e.target.value = c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
    if (c.length === 6) submit(c);
  });
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(normalizeCode(box.querySelector('#ci-card-code')?.value));
  });

  async function submit(code) {
    if (busy) return;
    const waiting = sessions.filter(s => !checkedIn.has(s.id));
    busy = true;
    message = null;
    render();
    try {
      // With one Mass open, go straight to it; otherwise try each open one.
      const res = await submitCheckIn({ sessionId: waiting.length === 1 ? waiting[0].id : undefined, code, parishionerName: name });
      if (res.ok) {
        const sid = res.checkIn?.sessionId || (waiting.length === 1 ? waiting[0].id : null);
        if (sid) checkedIn.add(sid);
        else {
          // Several Masses open: ask which one it went to
          await Promise.all(waiting.map(async (s) => {
            if (await alreadyCheckedIn(s.id, name).catch(() => false)) checkedIn.add(s.id);
          }));
        }
        message = null;
      } else {
        message = { ok: false, text: res.message };
      }
    } catch (err) {
      console.error('Check-in failed:', err);
      message = { ok: false, text: checkInErrorMessage(err) };
    } finally {
      busy = false;
      render();
      if (message && !message.ok) box.querySelector('#ci-card-code')?.focus();
    }
  }
}
