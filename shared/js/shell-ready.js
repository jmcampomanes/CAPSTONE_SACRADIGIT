/* ============================================
   SacraDigit — show the page in one piece
   The portal shells add parts of the page after it first paints: the
   top-bar buttons (Alerts, Bigger text, Dark, Language, Help), the
   "What's on this page?" box, and each page's first render (legends,
   default tables). Shown as they arrive, they popped in and pushed the
   page down on every page switch.
   motion.css keeps the top bar's contents and <main> invisible on
   portal pages until <html> gets .sd-shell-ready, then fades them in
   together. Each portal shell calls markShellReady() from its
   DOMContentLoaded code; the class is added one frame later, after
   every DOMContentLoaded handler (the shell's and the page's own) has
   run. motion.css shows everything anyway after a short cap, so a
   failed script never leaves the page blank.
   Data that arrives later from the server still fills in where the
   page shows its loading placeholders (motion.js skeletons).
   ============================================ */

export function markShellReady() {
  const root = document.documentElement;
  if (root.classList.contains('sd-shell-ready')) return;
  const show = () => requestAnimationFrame(() => root.classList.add('sd-shell-ready'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
}
