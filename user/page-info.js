/* ============================================
   SacraDigit — "What can I do here?" box at the top
   of each parishioner page (started by user-shell.js).
   Same look as Request a Service's "What can I request
   here?": an info icon, a question, a sentence or two —
   and, when the page has a main button, that button on
   the right (moved in from the page's .page-actions row).
   The Dashboard has none. Pages that already have their
   own box (Request a Service, Mass Intentions) keep it;
   Mass Intentions just gets its button moved inside.
   ============================================ */

const PAGE_INFO = {
  'user-mass-schedule.html': {
    title: 'What’s on this page?',
    text: 'The Mass times for every week, with today highlighted. Pick a date below to see that day’s Masses, including special ones.',
  },
  'user-announcements.html': {
    title: 'What’s on this page?',
    text: 'Official notices from the parish office are under Announcements; photos and news from the media team are under Updates. Tap any card to read it in full.',
  },
  'user-messages.html': {
    title: 'Who will reply?',
    text: 'Messages here go to the parish office. A staff member will reply on this page, usually within 1 day.',
  },
  'user-my-requests.html': {
    title: 'What’s on this page?',
    text: 'Every certificate you’ve asked for and where it is now. When one is ready, pick it up at the parish office.',
  },
  'user-requested-services.html': {
    title: 'What’s on this page?',
    text: 'Your blessings, sacraments and special Masses, with their dates. Blessings wait for the parish office to approve them. Tap View details to reschedule or cancel.',
  },
  'user-request-certificate.html': {
    title: 'What can I request here?',
    text: 'A copy of your Baptismal, Confirmation, First Communion or Marriage certificate. Pick one below and fill in the details — it’s usually ready to pick up in 3–5 working days.',
    action: { href: 'user-my-requests.html', label: 'View My Requests', icon: 'list' },
  },
  'user-donations.html': {
    title: 'How does giving work?',
    text: 'Choose a fund, pick an amount, and say how you’ll send it — GCash, Maya, bank transfer or cash at the office. No money leaves your account until you send it yourself.',
  },
  'user-facility-booking.html': {
    title: 'What can I book here?',
    text: 'A parish hall or room for a meeting, party or other event. Book at least 3 days ahead — your booking is confirmed right away.',
  },
  'user-mass-intentions.html': {}, // keeps its own "What is a Mass Intention?" box
  'user-prayer-wall.html': {
    title: 'What is the Prayer Wall?',
    text: 'Share a prayer request and the parish community will pray with you. Tap “I prayed for this” on someone’s request to let them know.',
  },
  'user-ministry.html': {
    title: 'How do I volunteer?',
    text: 'Pick your ministry, find a Mass that still needs people, and tap Volunteer. You can withdraw until the day before; after that, ask for a swap so someone else can take your place.',
  },
  'user-badges.html': {
    title: 'What are badges?',
    text: 'You earn badges for coming to Mass, giving and serving in the parish. Check in at Mass to count your visits — the code is on the church screen.',
  },
  'user-profile.html': {
    title: 'What’s on this page?',
    text: 'Your contact details, password, the notices you get, and a record of your activity in the portal.',
  },
  'user-settings.html': {
    title: 'What can I change here?',
    text: 'Make the letters bigger, switch to dark mode, or change the language to Filipino. Your choices are saved on this device.',
  },
};

const INFO_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
const LIST_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

/** Moves the page's main button(s) into `banner`, on the right. */
function moveActions(banner, actionsRow) {
  if (!actionsRow) return;
  const buttons = [...actionsRow.children];
  if (!buttons.length) return;
  banner.classList.add('info-banner-with-action');
  buttons.forEach(b => { b.classList.add('info-banner-action'); banner.appendChild(b); });
  actionsRow.remove();
}

/* From the second visit to a page, the box folds to its title, with
   "Show more" to open it again: returning parishioners know what the
   page is for, and their own items move up the screen. */
const SEEN_KEY = 'sacradigit_seen_pages';
function foldAfterFirstVisit(banner, pageFile) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { /* private mode */ }
  if (!seen.includes(pageFile)) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, pageFile])); } catch { /* private mode */ }
    return;
  }
  const title = banner.querySelector('.info-banner-title');
  if (!title) return;
  const body = title.parentElement;
  if (!body.id) body.id = `page-info-${pageFile.replace(/\W/g, '')}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'info-banner-toggle';
  btn.setAttribute('aria-controls', body.id);
  const paint = (open) => {
    banner.classList.toggle('is-folded', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Show less' : 'Show more';
  };
  btn.addEventListener('click', () => paint(banner.classList.contains('is-folded')));
  title.append(' ', btn);
  paint(false);
}

export function mountPageInfo(pageFile) {
  const info = PAGE_INFO[pageFile];
  const main = document.querySelector('main');
  if (!info || !main || main.querySelector('.page-info')) return;
  const actionsRow = main.querySelector('.page-actions');

  // Page already has its own box: just bring its button inside.
  const existing = main.querySelector('.info-banner');
  if (existing) {
    existing.classList.add('page-info');
    const body = existing.querySelector('.info-banner-icon + div');
    body?.classList.add('info-banner-body');
    moveActions(existing, actionsRow);
    foldAfterFirstVisit(existing, pageFile);
    return;
  }
  if (!info.title) return;

  const banner = document.createElement('div');
  banner.className = 'info-banner page-info';
  banner.innerHTML = `
    <div class="info-banner-icon">${INFO_ICON}</div>
    <div class="info-banner-body">
      <p class="info-banner-title">${esc(info.title)}</p>
      <p class="info-banner-text">${esc(info.text)}</p>
    </div>`;

  if (info.action) {
    banner.classList.add('info-banner-with-action');
    banner.insertAdjacentHTML('beforeend', `
      <a href="${info.action.href}" class="btn-secondary info-banner-action">${info.action.icon === 'list' ? LIST_ICON : ''}${esc(info.action.label)}</a>`);
  }

  // Goes where the page's button row was (so it stays inside that view),
  // otherwise at the very top of the page.
  if (actionsRow) {
    actionsRow.before(banner);
    moveActions(banner, actionsRow);
  } else {
    const firstView = main.querySelector(':scope > #menu-view') || main;
    firstView.prepend(banner);
  }

  foldAfterFirstVisit(banner, pageFile);

  // Messages: the chat box is sized to the screen — make room for the box above it.
  document.getElementById('chat-layout')?.classList.add('with-hero');
}
