/* ============================================
   SacraDigit Admin — Mass check-in display
   A full-screen view meant for a projector/TV
   at church: big QR code + short code, and a
   live count of who has checked in. Built by
   this module (no HTML needed on the page);
   styles in sacradigit-css/mass-checkin.css.
   ============================================ */

import QRCode from 'qrcode';
import {
  checkInReady, startSession, closeSession, watchSessionCheckIns,
  rememberedCode, checkInUrl, formatCode, massStart,
} from '../mass-checkin.js';

const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

export function initCheckInDisplay({ showToast }) {
  document.body.insertAdjacentHTML('beforeend', `
    <section id="checkin-display" class="ci-display hidden" role="dialog" aria-modal="true" aria-labelledby="ci-title">
      <div class="ci-top">
        <button type="button" class="ci-btn ci-btn-ghost" id="ci-back">‹ Back to Masses</button>
        <div class="ci-top-actions">
          <button type="button" class="ci-btn ci-btn-ghost" id="ci-fullscreen">Full screen</button>
          <button type="button" class="ci-btn ci-btn-danger" id="ci-close">Close Check-in</button>
        </div>
      </div>
      <div class="ci-body">
        <div class="ci-left">
          <p class="ci-eyebrow">Our Lady of Fatima Parish</p>
          <h2 class="ci-title" id="ci-title"></h2>
          <p class="ci-sub" id="ci-sub"></p>
          <ol class="ci-steps">
            <li>Open your phone camera</li>
            <li>Point it at the QR code</li>
            <li>Tap the link to check in</li>
          </ol>
          <p class="ci-or">No camera? Go to <strong>My Badges</strong> in the SacraDigit app and enter:</p>
          <p class="ci-code" id="ci-code"></p>
        </div>
        <div class="ci-right">
          <div class="ci-qr" id="ci-qr"></div>
          <div class="ci-count"><span id="ci-count">0</span> checked in</div>
          <p class="ci-closes" id="ci-closes"></p>
        </div>
      </div>
      <div class="ci-recent" id="ci-recent" aria-live="polite"></div>
    </section>`);

  const el = document.getElementById('checkin-display');
  let session = null;
  let unwatch = null;
  let closeTimer = null;

  async function show(sess, code) {
    session = sess;
    const when = massStart(sess.massDate, sess.massTime);
    document.getElementById('ci-title').textContent = sess.title || 'Holy Mass';
    document.getElementById('ci-sub').textContent = when
      ? when.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : sess.massDate;
    document.getElementById('ci-code').textContent = formatCode(code);
    document.getElementById('ci-qr').innerHTML = await QRCode.toString(checkInUrl(sess.id, code), {
      type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e2a4a', light: '#ffffff' },
    });
    const closes = new Date(sess.closesAt);
    document.getElementById('ci-closes').textContent = `Check-in closes at ${closes.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    if (unwatch) unwatch();
    unwatch = watchSessionCheckIns(sess.id, (items) => {
      document.getElementById('ci-count').textContent = items.length;
      const recent = items.slice().sort((a, b) => String(b.checkedInAt).localeCompare(String(a.checkedInAt))).slice(0, 8);
      // First names only on the big screen, for privacy.
      document.getElementById('ci-recent').innerHTML = recent.length
        ? `<span class="ci-recent-label">Welcome,</span> ${recent.map(c => `<span class="ci-chip">${escapeHtml(String(c.parishionerName || '').split(' ')[0])}</span>`).join('')}`
        : '<span class="ci-recent-label">Waiting for the first check-in…</span>';
    });

    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => hide(), Math.max(0, closes.getTime() - Date.now()));

    el.classList.remove('hidden');
    document.body.classList.add('ci-open');
  }

  function hide() {
    if (unwatch) { unwatch(); unwatch = null; }
    clearTimeout(closeTimer);
    el.classList.add('hidden');
    document.body.classList.remove('ci-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    session = null;
  }

  document.getElementById('ci-back').addEventListener('click', hide);
  document.getElementById('ci-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  });
  document.getElementById('ci-close').addEventListener('click', async () => {
    if (!session) return;
    if (!confirm('Close check-in for this Mass? Parishioners won’t be able to check in after this.')) return;
    try {
      await closeSession(session.id);
      showToast('Check-in closed.');
      hide();
    } catch (err) {
      console.error('Failed to close check-in:', err);
      showToast("Couldn't close check-in.", true);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.classList.contains('hidden') && !document.fullscreenElement) hide();
  });

  return {
    /** Start check-in for a Mass ({ id?, date, time, title }). */
    async start(mass) {
      if (!checkInReady()) {
        showToast('Mass check-in isn’t set up on the backend yet. Deploy the check-in update first.', true);
        return;
      }
      try {
        const { session: sess, code } = await startSession(mass);
        await show(sess, code);
        showToast('Check-in is open.');
      } catch (err) {
        console.error('Failed to start check-in:', err);
        showToast(err.message || "Couldn't start check-in.", true);
      }
    },
    /** Re-open the display for a session started on this device. */
    async resume(sess) {
      const code = rememberedCode(sess.id);
      if (!code) {
        showToast('This check-in was started on another device. Close it and start a new one to show a QR code here.', true);
        return false;
      }
      await show(sess, code);
      return true;
    },
  };
}
