/* ============================================
   SacraDigit User Portal — My Settings Scripts
   Runs after user-shell.js.

   Display/language/accessibility are already
   backed by localStorage via ui-prefs.js (also
   used by the quick toggle icons in every top
   bar) — this page just gives them a dedicated,
   labeled home instead of three small icons.
   ============================================ */

import { currentTheme, setTheme, currentLang, setLanguage, accessibilityOn, setAccessibility, reduceMotionOn, setReduceMotion } from '../../shared/js/ui-prefs.js';

document.addEventListener('DOMContentLoaded', () => {

  const themeToggle = document.getElementById('settings-theme-toggle');
  const a11yToggle = document.getElementById('settings-a11y-toggle');
  const motionToggle = document.getElementById('settings-motion-toggle');
  const langSelect = document.getElementById('settings-lang-select');

  const paint = () => {
    if (themeToggle) themeToggle.checked = currentTheme() === 'dark';
    if (a11yToggle) a11yToggle.checked = accessibilityOn();
    if (motionToggle) motionToggle.checked = reduceMotionOn();
    if (langSelect) langSelect.value = currentLang();
  };
  paint();

  themeToggle?.addEventListener('change', () => setTheme(themeToggle.checked ? 'dark' : 'light'));
  a11yToggle?.addEventListener('change', () => setAccessibility(a11yToggle.checked));
  motionToggle?.addEventListener('change', () => setReduceMotion(motionToggle.checked));
  langSelect?.addEventListener('change', () => setLanguage(langSelect.value));

  // Stay in sync if changed elsewhere (e.g. the top bar's quick toggles) while this page is open.
  document.addEventListener('sacradigit:theme', paint);
  document.addEventListener('sacradigit:a11y', paint);
  document.addEventListener('sacradigit:motion', paint);
  document.addEventListener('sacradigit:lang', paint);
});
