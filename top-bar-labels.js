/* ============================================
   SacraDigit — a word under every top-bar icon
   (Alerts · Bigger text · Dark · Language · Help)
   and a 44×44px tap area. Used by the parishioner
   shell (user/user-shell.js) and the admin shell
   (Sacradigit/dashboard.js). Call it after the
   bell / preferences / help buttons are in place.
   ============================================ */

import { currentLang, currentTheme } from './ui-prefs.js';

const LABELS = {
  en: { alerts: 'Alerts', bigger: 'Bigger text', dark: 'Dark', light: 'Light', language: 'Language', help: 'Help' },
  fil: { alerts: 'Abiso', bigger: 'Mas malaki', dark: 'Madilim', light: 'Maliwanag', language: 'Wika', help: 'Tulong' },
};

const ICONS = ':is(.pn-btn, .ui-prefs-btn, .ui-prefs-lang, .help-icon-btn)';

const STYLE = `
  header .help-date-wrap { gap: 0.5rem; }
  header .help-date-wrap .ui-prefs { gap: 0.5rem; }
  header .help-date-wrap ${ICONS} {
    width: auto; min-width: 2.75rem; height: auto; min-height: 2.75rem;
    flex-wrap: wrap; align-content: flex-start; justify-content: center;
    /* Same 1.25rem icon row on every button (the "Aa" letters, the globe + EN,
       the drawn icons), so every word underneath starts on the same line. */
    line-height: 1.25rem;
    column-gap: 0.2rem; row-gap: 0.15rem; padding: 0.25rem 0.35rem;
    border-radius: 0.6rem; border-color: transparent; background-color: transparent; color: #1e2a4a;
  }
  header .help-date-wrap ${ICONS}:hover { background-color: #f3f4f6; border-color: transparent; }
  header .help-date-wrap :is(.pn-btn, .ui-prefs-btn, .help-icon-btn) svg { width: 1.25rem; height: 1.25rem; }
  header .help-date-wrap ${ICONS}[data-label]::after {
    content: attr(data-label); flex-basis: 100%; text-align: center; font-family: inherit;
    font-size: 0.6875rem; font-weight: 600; letter-spacing: 0; line-height: 1.1; color: #374151; white-space: nowrap;
  }
  header .help-date-wrap .ui-prefs-a11y { font-size: 1rem !important; line-height: 1.25rem; }
  /* Bigger text mode draws the icons at 1.5rem (accessibility.css): match the row to it. */
  :root[data-a11y="on"] header .help-date-wrap ${ICONS},
  :root[data-a11y="on"] header .help-date-wrap .ui-prefs-a11y { line-height: 1.5rem; }
  header .help-date-wrap :is(.pn-btn, .ui-prefs-btn, .ui-prefs-lang, .help-icon-btn) > :is(svg, span) { flex-shrink: 0; }
  header .help-date-wrap .ui-prefs-a11y[data-label]::after { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  header .help-date-wrap .ui-prefs-a11y[aria-pressed="true"]::after { color: inherit; }
  header .help-date-wrap .pn-count { top: -0.2rem; right: -0.1rem; }
  :root[data-theme="dark"] header .help-date-wrap ${ICONS} { background-color: transparent; border-color: transparent; color: #e5e8ef; }
  :root[data-theme="dark"] header .help-date-wrap ${ICONS}:hover { background-color: #242c3e; }
  :root[data-theme="dark"] header .help-date-wrap [data-label]::after { color: #cbd3e6; }

  @media (max-width: 640px) {
    header .help-date-wrap, header .help-date-wrap .ui-prefs { gap: 0.25rem; }
    /* Fixed 52px columns: "Bigger text" goes onto two short lines, so the page title keeps its room. */
    header .help-date-wrap ${ICONS} { width: 3.25rem; padding: 0.25rem 0.1rem; }
    header .help-date-wrap .ui-prefs-lang { width: auto; min-width: 3.25rem; }
    body header.bg-white h1 { overflow-wrap: break-word; hyphens: auto; }
    header .help-date-wrap [data-label]::after { white-space: normal; font-size: 0.625rem; line-height: 1.05; }

    /* Bigger text: the title gets the whole first row, the icons go on a row under it. */
    :root[data-a11y="on"] body header.bg-white { flex-wrap: wrap; row-gap: 0.375rem; }
    :root[data-a11y="on"] body header.bg-white > div:first-child { flex-basis: 100%; }
    :root[data-a11y="on"] body header .help-date-wrap { margin-left: auto; }
    :root[data-a11y="on"] header .help-date-wrap ${ICONS} { width: auto; min-width: 3.25rem; padding: 0.25rem 0.4rem; }
    :root[data-a11y="on"] header .help-date-wrap [data-label]::after { white-space: nowrap; }
  }
`;

export function labelTopBarIcons() {
  if (!document.getElementById('top-bar-labels-style')) {
    const st = document.createElement('style');
    st.id = 'top-bar-labels-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  const paint = () => {
    const l = LABELS[currentLang()];
    const set = (sel, text) => document.querySelector(sel)?.setAttribute('data-label', text);
    set('header .pn-btn', l.alerts);
    set('#ui-a11y-btn', l.bigger);
    set('#ui-theme-btn', currentTheme() === 'dark' ? l.light : l.dark);
    set('#ui-lang-btn', l.language);
    set('#page-help-btn', l.help);
  };
  paint();
  document.addEventListener('sacradigit:lang', paint);
  document.addEventListener('sacradigit:theme', paint);
}
