/* ============================================
   SacraDigit — Page Help / Tutorial widget
   Shared by every admin page (via dashboard.js)
   and every user page (via user-shell.js).

   Usage: import { initPageHelp } from '../help-tutorial.js';
   then call initPageHelp({ title, intro, steps }) once the
   page's shell script has finished its own DOMContentLoaded work.

   Fully self-contained on purpose — it injects its own <style>
   block instead of depending on each page's stylesheet stack
   (which varies: e.g. dashboard.html / user-dashboard.html don't
   load the same modal CSS every other page does), and it finds
   its anchor point (#current-date in the top bar) which is the
   one element every page's header already has in common. That
   means adding a tutorial to a page never requires an HTML or
   CSS edit — only a content entry in the calling shell script.
   ============================================ */

const STYLE_ID = 'help-tutorial-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .help-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 999px;
      border: 1.5px solid #c7cad6;
      background-color: #ffffff;
      color: #6b7280;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .help-icon-btn:hover {
      background-color: #f3f4f6;
      border-color: #9ca3af;
      color: #1e2a4a;
    }
    .help-icon-btn svg { width: 1rem; height: 1rem; }

    .help-date-wrap {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .help-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background-color: rgba(17, 24, 39, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .help-modal-overlay.hidden { display: none; }
    .help-modal-overlay.show { opacity: 1; }

    .help-modal-card {
      background-color: #ffffff;
      border-radius: 1rem;
      width: 100%;
      max-width: 26rem;
      max-height: calc(100vh - 3rem);
      overflow-y: auto;
      box-shadow: 0 20px 45px rgba(17, 24, 39, 0.25);
      transform: translateY(6px) scale(0.98);
      transition: transform 0.15s ease;
    }
    .help-modal-overlay.show .help-modal-card {
      transform: translateY(0) scale(1);
    }

    .help-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1.125rem 1.25rem;
      border-bottom: 1px solid #eef0f4;
    }
    .help-modal-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #111827;
    }
    .help-modal-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.5rem;
      color: #9ca3af;
      background: none;
      border: none;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .help-modal-close:hover { background-color: #f3f4f6; color: #374151; }
    .help-modal-close svg { width: 1rem; height: 1rem; }

    .help-modal-body { padding: 1.125rem 1.25rem 1.375rem; }

    .help-modal-intro {
      font-size: 0.8125rem;
      color: #4b5563;
      line-height: 1.55;
      margin-bottom: 0.875rem;
    }

    .help-modal-steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .help-modal-steps li {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      font-size: 0.8125rem;
      color: #374151;
      line-height: 1.5;
      counter-increment: help-step;
    }

    .help-modal-steps {
      counter-reset: help-step;
    }

    .help-modal-steps li::before {
      content: counter(help-step);
      flex-shrink: 0;
      width: 1.375rem;
      height: 1.375rem;
      border-radius: 999px;
      background-color: rgba(139, 143, 199, 0.16);
      color: #4b4f8f;
      font-size: 0.6875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.05rem;
    }

    [data-theme="dark"] .help-icon-btn {
      background-color: transparent;
      border-color: #3a3f52;
      color: #9ca3af;
    }
    [data-theme="dark"] .help-icon-btn:hover {
      background-color: #262b3d;
      color: #e5e7eb;
    }
    [data-theme="dark"] .help-modal-card { background-color: #1c2032; }
    [data-theme="dark"] .help-modal-header { border-bottom-color: #2f3448; }
    [data-theme="dark"] .help-modal-title { color: #f3f4f6; }
    [data-theme="dark"] .help-modal-intro { color: #9ca3af; }
    [data-theme="dark"] .help-modal-steps li { color: #d1d5db; }
    [data-theme="dark"] .help-modal-close:hover { background-color: #262b3d; color: #e5e7eb; }
  `;
  document.head.appendChild(style);
}

let overlayEl, titleEl, introEl, stepsEl;

function buildModal() {
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'help-modal-overlay hidden';
  overlayEl.id = 'page-help-modal';
  overlayEl.innerHTML = `
    <div class="help-modal-card" role="dialog" aria-modal="true" aria-labelledby="page-help-title">
      <div class="help-modal-header">
        <h3 class="help-modal-title" id="page-help-title"></h3>
        <button type="button" class="help-modal-close" data-close-help aria-label="Close">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="help-modal-body">
        <p class="help-modal-intro" id="page-help-intro"></p>
        <ol class="help-modal-steps" id="page-help-steps"></ol>
      </div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  titleEl = overlayEl.querySelector('#page-help-title');
  introEl = overlayEl.querySelector('#page-help-intro');
  stepsEl = overlayEl.querySelector('#page-help-steps');

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl || e.target.closest('[data-close-help]')) closeHelp();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl.classList.contains('show')) closeHelp();
  });
}

function openHelp(content) {
  buildModal();
  titleEl.textContent = content.title || 'How to use this page';
  introEl.textContent = content.intro || '';
  stepsEl.innerHTML = (content.steps || []).map((s) => `<li>${s}</li>`).join('');
  overlayEl.classList.remove('hidden');
  requestAnimationFrame(() => overlayEl.classList.add('show'));
}

function closeHelp() {
  if (!overlayEl) return;
  overlayEl.classList.remove('show');
  setTimeout(() => overlayEl.classList.add('hidden'), 150);
}

/**
 * initPageHelp({ title, intro, steps })
 * Injects a "?" button into the top bar, right next to #current-date
 * (which every page's header has), and wires it to open a modal with
 * the given content. No-ops quietly if the page has no #current-date
 * (so it's always safe to call from a shared shell script) or if
 * content is missing (a page not yet covered by the content registry).
 */
export function initPageHelp(content) {
  if (!content) return;

  const dateEl = document.getElementById('current-date');
  if (!dateEl) return;

  injectStyles();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'page-help-btn';
  btn.className = 'help-icon-btn';
  btn.setAttribute('aria-label', 'How to use this page');
  btn.setAttribute('title', 'How to use this page');
  btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.09 9a3 3 0 115.83 1c0 2-3 2-3 4m.02 4h.01M12 21a9 9 0 100-18 9 9 0 000 18z"/></svg>`;
  btn.addEventListener('click', () => openHelp(content));

  // On most pages #current-date is a direct child of <header>, which
  // lays its children out with justify-content: space-between. Simply
  // inserting the button as a new sibling there would add a 3rd item to
  // that layout and strand it floating in the middle of the header
  // instead of sitting next to the date on the right. So: group the
  // button with the date (and anything already grouped with it, like
  // the theme-toggle button on the Dashboard pages) inside a small flex
  // wrapper that takes the date's original slot — that keeps the
  // header's own layout untouched and puts the icon right beside the
  // date on the right edge, where it belongs.
  const parent = dateEl.parentElement;
  if (parent && parent.tagName === 'HEADER') {
    const wrap = document.createElement('div');
    wrap.className = 'help-date-wrap';
    parent.insertBefore(wrap, dateEl);
    wrap.appendChild(btn);
    wrap.appendChild(dateEl);
  } else {
    // Already inside a grouping wrapper (e.g. date + theme toggle) —
    // just join that group, right before the date.
    dateEl.insertAdjacentElement('beforebegin', btn);
  }
}