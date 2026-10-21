/* ============================================
   SacraDigit — "Check in at Mass" camera scanner
   (Dashboard button + My Badges). Opens the phone's
   back camera full screen, reads the QR code on the
   church screen and checks in right away — no need
   to leave the page or find the camera app.

   The QR code holds a link like
     user/user-badges.html?checkin=<session>&code=<CODE>
   (see checkInUrl() in ../mass-checkin.js). A plain
   6-character code is accepted too.

   Reading the QR: the browser's own BarcodeDetector
   where it exists (Android Chrome); otherwise jsQR
   (npm "jsqr", loaded only when needed — iPhone).
   No camera, or permission refused → "Type the code
   instead" is right there.
   ============================================ */

import { currentUserName } from '../auth.js';
import { submitCheckIn, normalizeCode, checkInErrorMessage } from '../mass-checkin.js';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/** What the QR (or typed text) says: { sessionId?, code } or null. */
function parseScan(text) {
  const raw = String(text || '').trim();
  try {
    const url = new URL(raw, window.location.href);
    const code = url.searchParams.get('code');
    if (code) return { sessionId: url.searchParams.get('checkin') || undefined, code };
  } catch { /* not a link */ }
  const code = normalizeCode(raw);
  return code.length === 6 ? { code } : null;
}

/** Builds a frame reader: (video) => Promise<string|null>. */
async function makeReader() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      if (!formats || formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch { /* fall through to jsQR */ }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    // Scan a scaled-down copy — plenty for a QR on a screen, and much faster.
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
  };
}

/**
 * Opens the full-screen scanner.
 * @param {{ onCheckedIn?: (res: object) => void }} [opts]  called after a successful check-in
 */
export function openCheckInScanner({ onCheckedIn } = {}) {
  const name = currentUserName();
  const overlay = document.createElement('div');
  overlay.className = 'ci-scan';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ci-scan-title');
  overlay.innerHTML = `
    <div class="ci-scan-top">
      <h2 id="ci-scan-title" class="ci-scan-title">Check in at Mass</h2>
      <button type="button" class="ci-scan-close" data-ci-close aria-label="Close">×</button>
    </div>
    <div class="ci-scan-stage">
      <video class="ci-scan-video" playsinline muted></video>
      <div class="ci-scan-frame" aria-hidden="true"></div>
      <p class="ci-scan-status" role="status">Starting the camera…</p>
    </div>
    <div class="ci-scan-bottom">
      <p class="ci-scan-hint">Point your camera at the QR code on the church screen.</p>
      <button type="button" class="ci-scan-type" data-ci-type>Type the code instead</button>
      <form class="ci-scan-form hidden" autocomplete="off">
        <label class="ci-scan-label" for="ci-scan-code">Code shown under the QR code</label>
        <div class="ci-scan-form-row">
          <input id="ci-scan-code" class="form-input ci-scan-input" maxlength="7" inputmode="text" autocapitalize="characters" spellcheck="false" placeholder="ABC-123" />
          <button type="submit" class="btn-lavender">Check In</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const video = overlay.querySelector('video');
  const statusEl = overlay.querySelector('.ci-scan-status');
  const form = overlay.querySelector('.ci-scan-form');
  const input = overlay.querySelector('#ci-scan-code');
  let stream = null;
  let timer = null;
  let busy = false;
  let closed = false;

  const setStatus = (text, state = '') => { statusEl.textContent = text; statusEl.dataset.state = state; };

  function stopCamera() {
    clearTimeout(timer);
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
  }
  function close() {
    if (closed) return;
    closed = true;
    stopCamera();
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  function showTyping() {
    overlay.querySelector('[data-ci-type]').classList.add('hidden');
    form.classList.remove('hidden');
    input.focus();
  }

  function showDone(res) {
    stopCamera();
    overlay.classList.add('is-done');
    overlay.querySelector('.ci-scan-stage').innerHTML = `
      <div class="ci-scan-done">
        <div class="ci-scan-done-icon" aria-hidden="true">✓</div>
        <p class="ci-scan-done-title">${esc(res.message || 'You’re checked in. God bless!')}</p>
        <p class="ci-scan-done-sub">It counts toward your badges in My Badges.</p>
      </div>`;
    overlay.querySelector('.ci-scan-bottom').innerHTML = `<button type="button" class="btn-lavender ci-scan-done-btn" data-ci-close>Done</button>`;
    overlay.querySelector('[data-ci-close]').focus();
    onCheckedIn?.(res);
  }

  async function checkIn(found) {
    if (busy || closed) return;
    busy = true;
    setStatus('Checking you in…');
    try {
      const res = await submitCheckIn({ sessionId: found.sessionId, code: found.code, parishionerName: name });
      if (res.ok) { showDone(res); return; }
      setStatus(res.message, 'error');
    } catch (err) {
      console.error('Check-in failed:', err);
      setStatus(checkInErrorMessage(err), 'error');
    } finally {
      busy = false;
    }
    if (stream) scanSoon(2500); // let them read the message, then keep looking
  }

  let read = null;
  function scanSoon(delay = 250) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (closed || busy || !stream) return;
      let text = null;
      try { text = await read(video); } catch { /* frame not ready */ }
      const found = text && parseScan(text);
      if (found) checkIn(found);
      else {
        if (text) setStatus('That QR code isn’t a Mass check-in code. Try the one on the church screen.', 'error');
        scanSoon();
      }
    }, delay);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('This phone’s browser can’t open the camera here. Please type the code instead.', 'error');
      showTyping();
      return;
    }
    try {
      [stream, read] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
        makeReader(),
      ]);
      if (closed) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      setStatus('Looking for the QR code…');
      scanSoon();
    } catch (err) {
      console.warn('Camera unavailable:', err);
      setStatus(err?.name === 'NotAllowedError'
        ? 'The camera wasn’t allowed. You can allow it in your browser settings — or type the code instead.'
        : 'Couldn’t open the camera. Please type the code instead.', 'error');
      showTyping();
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-ci-close]')) close();
    else if (e.target.closest('[data-ci-type]')) showTyping();
  });
  // Uppercase as they type, dash after 3 — and check in by itself at 6 characters
  input.addEventListener('input', () => {
    const c = normalizeCode(input.value).slice(0, 6);
    input.value = c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
    if (c.length === 6) checkIn({ code: c });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = normalizeCode(input.value);
    if (c.length < 6) { setStatus('Please type all 6 letters and numbers of the code.', 'error'); return; }
    checkIn({ code: c });
  });

  startCamera();
  return { close };
}
