/* ============================================
   SacraDigit — "Leave / reload this page?" warning
   (started by user-shell.js on every parishioner page).

   If the person has typed or picked something in a box
   that's still on screen and not sent yet, refreshing,
   closing the tab or leaving the page asks first.
   Browsers show their own fixed wording for this (e.g.
   Chrome: "Reload site? Changes that you made may not be
   saved.") — a page can't change the text, only ask for it.

   Only boxes the person actually typed in count, and only
   while they're visible and still hold what was typed —
   so after sending (the form clears or closes) there's no
   warning. Search boxes, filters and checkboxes never count;
   a box can opt out with data-no-leave-warning.
   ============================================ */

const SKIP_TYPES = new Set(['search', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden', 'range', 'color']);

function counts(el) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return false;
  if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return false;
  if (el.disabled || el.readOnly || el.closest('[data-no-leave-warning]')) return false;
  return true;
}

const edited = new Set(); // boxes the person typed in or picked from

function hasUnsavedWork() {
  for (const el of edited) {
    if (!el.isConnected) { edited.delete(el); continue; }
    if (!el.getClientRects().length) continue; // hidden (form closed or sent)
    const value = el instanceof HTMLSelectElement ? el.value : el.value.trim();
    const original = el instanceof HTMLSelectElement
      ? ([...el.options].find(o => o.defaultSelected)?.value ?? el.options[0]?.value ?? '')
      : el.defaultValue.trim();
    if (value && value !== original) return true;
  }
  return false;
}

/** Call after saving a form whose boxes stay filled (e.g. My Profile): what's there now counts as saved. */
export function markSaved(root = document) {
  for (const el of [...edited]) {
    if (!root.contains(el)) continue;
    if (el instanceof HTMLSelectElement) [...el.options].forEach(o => { o.defaultSelected = o.selected; });
    else el.defaultValue = el.value;
    edited.delete(el);
  }
}

export function initLeaveWarning() {
  const mark = (e) => { if (e.isTrusted && counts(e.target)) edited.add(e.target); };
  document.addEventListener('input', mark, true);
  document.addEventListener('change', mark, true);

  window.addEventListener('beforeunload', (e) => {
    if (!hasUnsavedWork()) return;
    e.preventDefault();
    e.returnValue = ''; // older browsers need this to show the warning
  });
}
