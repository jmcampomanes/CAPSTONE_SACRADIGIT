/* ============================================
   SacraDigit Admin — windows that open as a page
   Like the parishioner side, admin windows
   (Schedule Mass, Upload Record, details, day
   plans …) open as their own page beside the
   sidebar instead of a pop-up. Mark a window with
   class "adm-page" (styles: .adm-page in
   Sacradigit/css/admin-shell.css); the Generate
   Certificate pages (.gen-page) get the same Back
   button and history.

   Each page's own script still opens and closes
   its windows by toggling .hidden — this only
   watches that:
     - the ✕ becomes a "‹ Back" button (same
       element, so its close handler still works)
     - opening adds a #window history entry, so the
       browser's Back button closes it
     - a window opened from another (Day Plan →
       Mass Details) stacks on top of it
   Short yes/no confirmations stay pop-ups.
   ============================================ */

const SELECTOR = '.modal-overlay.adm-page, .modal-overlay.gen-page';
const BACK_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';

const stack = [];      // open pages, newest last
let closedThisTick = 0; // pages closed by the page's own UI, history not yet rewound
let skipPops = 0;      // popstate events caused by our own history.go()

function toBackButton(page) {
  const close = page.querySelector('.modal-header .modal-close');
  if (close) {
    close.classList.add('adm-page-back');
    close.innerHTML = `${BACK_ICON}<span>Back</span>`;
    close.setAttribute('aria-label', 'Back');
    return;
  }
  // Windows with their own heading layout (no .modal-header): add a page top
  // bar titled from data-page-title; its Back presses the window's own ✕.
  const card = page.querySelector('.modal-card');
  const ownClose = card?.querySelector('[data-close-modal]');
  if (!ownClose) return;
  const bar = document.createElement('div');
  bar.className = 'modal-header adm-page-bar';
  bar.innerHTML = `<button type="button" class="adm-page-back" aria-label="Back">${BACK_ICON}<span>Back</span></button>
    <h3 class="modal-title"></h3>`;
  bar.querySelector('.modal-title').textContent = page.dataset.pageTitle || '';
  bar.querySelector('button').addEventListener('click', () => ownClose.click());
  ownClose.classList.add('adm-page-own-close');
  card.prepend(bar);
}

function onOpen(page) {
  if (stack.includes(page)) return;
  stack.push(page);
  page.style.zIndex = String(50 + stack.length);
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.querySelector('.modal-body')?.scrollTo(0, 0);
  const state = { admPage: page.id };
  // Closed one window and opened the next in the same step (e.g. View → Edit):
  // swap the history entry instead of going back and forward.
  if (closedThisTick) { closedThisTick--; history.replaceState(state, '', `#${page.id}`); }
  else history.pushState(state, '', `#${page.id}`);
}

function onClose(page) {
  const i = stack.indexOf(page);
  if (i < 0) return; // already handled (closed from history)
  stack.splice(i, 1);
  page.style.zIndex = '';
  closedThisTick++;
  setTimeout(rewindHistory, 0);
}

function rewindHistory() {
  if (!closedThisTick) return;
  const steps = closedThisTick;
  closedThisTick = 0;
  skipPops++;
  history.go(-steps);
}

// Browser Back: close every page newer than the one this history entry belongs to.
function onPopState() {
  if (skipPops) { skipPops--; return; }
  const want = history.state?.admPage;
  while (stack.length && stack[stack.length - 1].id !== want) {
    const page = stack.pop();
    page.style.zIndex = '';
    const closeBtn = page.querySelector('[data-close-modal]');
    if (closeBtn) closeBtn.click(); else page.classList.add('hidden');
  }
}

export function initAdminPageViews() {
  const pages = [...document.querySelectorAll(SELECTOR)].filter(p => p.id);
  if (!pages.length) return;

  // A reload on #schedule-modal etc. can't reopen the window — drop the hash.
  if (pages.some(p => location.hash === `#${p.id}`)) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  const observer = new MutationObserver((records) => {
    for (const { target } of records) {
      if (target.classList.contains('hidden')) onClose(target); else onOpen(target);
    }
  });
  pages.forEach((page) => {
    toBackButton(page);
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
  });
  window.addEventListener('popstate', onPopState);
}
