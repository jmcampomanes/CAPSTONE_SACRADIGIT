/* ============================================
   SacraDigit — shared toast timing
   One place for how a toast lives (motion-guide.html):
   success toasts show a thin bar with the time left,
   pause while the pointer is over them, and every
   toast is announced to motion.js (a busy button
   turns green when its save worked). Errors stay
   until closed.

   showToast() is the admin / staff toast (#toast with
   a .toast-message inside); the parishioner shell
   builds its own markup and only uses autoHide().
   ============================================ */

const SUCCESS_MS = 3000;

/** Announces a toast to motion.js (button busy → success). */
export const announceToast = (isError) =>
  document.dispatchEvent(new CustomEvent('sacradigit:toast', { detail: { isError } }));

/**
 * Hides `toast` (via `hide`) after `ms`, pausing while the pointer is over it,
 * with the time-left bar from motion.css. Returns a function that cancels it.
 */
export function autoHide(toast, hide, ms = SUCCESS_MS) {
  toast._sdCancelHide?.();
  let left = ms;
  let startedAt = Date.now();
  let timer = setTimeout(done, left);
  toast.style.setProperty('--toast-ms', `${ms}ms`);
  toast.classList.remove('has-timer');
  void toast.offsetWidth; // restart the bar
  toast.classList.add('has-timer');
  const pause = () => { clearTimeout(timer); left -= Date.now() - startedAt; };
  const resume = () => { startedAt = Date.now(); clearTimeout(timer); timer = setTimeout(done, Math.max(400, left)); };
  toast.addEventListener('mouseenter', pause);
  toast.addEventListener('mouseleave', resume);
  function cancel() {
    clearTimeout(timer);
    toast.removeEventListener('mouseenter', pause);
    toast.removeEventListener('mouseleave', resume);
    toast.classList.remove('has-timer');
    toast._sdCancelHide = null;
  }
  function done() { cancel(); hide(); }
  toast._sdCancelHide = cancel;
  return cancel;
}

export function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast._sdCancelHide?.();
  const msgEl = toast.querySelector('.toast-message');
  if (msgEl) msgEl.textContent = message; else toast.textContent = message;
  toast.style.backgroundColor = '';
  toast.classList.toggle('toast-error', isError);
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  announceToast(isError);
  if (isError) return;
  autoHide(toast, () => {
    toast.classList.remove('show');
    setTimeout(() => { if (!toast.classList.contains('show')) toast.classList.add('hidden'); }, 200);
  });
}
