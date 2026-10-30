/* ============================================
   SacraDigit — User Portal Shell Scripts
   Shared across ALL user pages (user-shell.js)
   ============================================ */

import { guardPage, currentUser } from '../../shared/js/auth.js';

// Only signed-in people with the right role get past this (see auth.js).
guardPage('parishioner');
import { initPageHelp } from '../../shared/js/help-tutorial.js';
import { initUiPrefs, currentLang, setAccessibility } from '../../shared/js/ui-prefs.js';
import { labelTopBarIcons } from '../../shared/js/top-bar-labels.js';
import { initTableCards } from '../../shared/js/table-cards.js';
import { watchUnreadBadge } from '../../shared/js/chat.js';
import { initParishAssistant } from '../../shared/js/assistant/parish-assistant.js';
import { initNotifications } from '../../shared/js/notifications/parish-notifications.js';
import { initExtToggles } from '../../shared/js/name-utils.js';
import { watchFieldErrors, FIELD_ERROR_SELECTOR } from './field-messages.js';
import { autoHide, announceToast } from '../../shared/js/toast.js';
import { initBirthDateDropdowns } from '../../shared/js/date-dropdowns.js';
import { mountPageInfo } from './page-info.js';
import { initLeaveWarning } from './leave-warning.js';

/* ------------------------------------------
   Per-page "How to use this page" content for
   the (?) help icon in the top bar. Keyed by
   filename so it works for every user page
   that loads this shared shell script — see
   help-tutorial.js for how it's rendered.
------------------------------------------ */
const HELP_CONTENT = {
  'user-messages.html': {
    title: 'Messages',
    intro: 'Chat with the parish office — a parish office staff member will reply here, usually within 1 day.',
    steps: [
      'Type your question at the bottom and tap Send.',
      'Replies from the parish office show up here as soon as they are sent.',
      'A red number next to Messages in the menu means the office has replied and you haven’t read it yet.',
    ],
  },
  'user-prayer-wall.html': {
    title: 'Prayer Wall',
    intro: 'Share a prayer request with the parish, and pray for others.',
    steps: [
      'Write your request and press Post Request. Tick “Post anonymously” if you don’t want your name shown — it isn’t saved at all.',
      'The parish office reads each request before it appears. Your Requests shows whether yours is waiting, on the wall, or not posted.',
      'Tap 🙏 “I prayed for this” on someone’s request to let them know they’re being prayed for.',
    ],
  },
  'user-columbary.html': {
    title: 'Columbary',
    intro: 'See which niches in the parish columbary are available and ask the office to reserve one.',
    steps: [
      'Pick a wall, then tap an available (white) niche. Each row shows its price.',
      'Fill in the buyer’s name and contact number and send the request. It’s not a purchase yet.',
      'The parish office calls or emails you. Once they approve it, pay at the office — in cash or installments. The vault can be used once fully paid.',
      'Your requests and the office’s answer appear under “My niche requests.” Use “Request an Inurnment” to schedule placing a loved one’s ashes.',
    ],
  },
  'user-ministry.html': {
    title: 'Ministry Sign-ups',
    intro: 'Serve as a lector, choir member, altar server or usher at Mass.',
    steps: [
      'Use ‹ › to pick a month and the chips to show one ministry.',
      'Press Volunteer under an open slot. You can withdraw until the day before the Mass.',
      'Can’t make it? Press Ask for swap — anyone can then take your slot.',
      'See “Swap needed” on someone’s slot? Press Take this slot to serve in their place.',
      'Serving 4 times earns the Faithful Servant badge.',
    ],
  },
  'user-parish-server.html': {
    title: 'Parish Server',
    intro: 'If you serve the parish — in a ministry, a parish group or the office — ask to be verified as a Parish Server.',
    steps: [
      'Choose your ministry or group, your role, and who can confirm that you serve (your coordinator or the parish priest).',
      'Press Send for Verification. The Head Admin checks with them, then approves it — you’ll get a notice (🔔).',
      'Once verified, your account shows “Parish Server”, and parish rooms booked for your ministry through the office have no fee.',
      'It lasts a year. Near the end, this page asks you to renew.',
    ],
  },
  'user-badges.html': {
    title: 'My Badges',
    intro: 'Your Faith Journey — badges for coming to Mass, giving, and parish life.',
    steps: [
      'At Mass, scan the QR code on the church screen with your phone camera — or type the 6-character code in the “Check In at Mass” box, which also appears on your Dashboard while a Mass is open. It checks you in as soon as all 6 characters are in.',
      'Each check-in counts toward badges like Faithful Month, Steadfast (Sundays in a row), Simbang Gabi, and Holy Week Pilgrim. Saturday evening Mass counts for Sunday.',
      'Giving badges count how regularly you give — any amount. Amounts are never shown to anyone.',
      'Faithful Givers lists parishioners who have given every month for 3 months or more. Anonymous gifts never appear, and you can hide your name with the switch below the list.',
    ],
  },
  'user-dashboard.html': {
    title: 'Dashboard',
    intro: 'Your at-a-glance overview of parish life and your own requests.',
    steps: [
      'Check Today’s Mass Schedule for today’s Masses — press Full schedule to see any other date.',
      'Read Recent Announcements for the latest parish news.',
      'Glance at My Recent Requests to see the status of anything you’ve submitted.',
      'Use the sidebar to jump into Mass Schedule, Request a Service, My Requests, and more.',
    ],
  },
  'user-announcements.html': {
    title: 'Announcements',
    intro: 'Stay up to date with news and events from the parish.',
    steps: [
      'Browse the list of announcements, newest first.',
      'Click an announcement to open its full details.',
      'Use “Clear” to reset any active search or filter.',
    ],
  },
  'user-donations.html': {
    title: 'Donations',
    intro: 'Support the parish mission through a secure online offering.',
    steps: [
      'Choose a fund or cause, then enter your donation amount.',
      'Fill in your details and submit to complete your offering.',
      'Check My Giving History below to see your past donations.',
    ],
  },
  'user-facility-booking.html': {
    title: 'Facility Booking',
    intro: 'Browse parish facilities and book an open time slot. Bookings are confirmed right away.',
    steps: [
      'Browse Available Facilities and pick the one you need.',
      'Choose how long you need it, then an open date and start time. Booked hours and parish closure days are greyed out.',
      'Use Back and Next to move through the booking steps, then confirm.',
      'Check My Bookings to see your confirmed bookings, or cancel one you no longer need.',
    ],
  },
  'user-mass-intentions.html': {
    title: 'Mass Intentions',
    intro: 'Submit a mass intention and track your offerings with the parish.',
    steps: [
      'Use “Find a name…” to search the intentions sheet for a specific name.',
      'Click Submit a Mass Intention to offer one for a loved one — Thanksgiving, a Special Intention, or a Soul.',
      'Fill in the name(s) and offering amount, then confirm the details.',
      'Check My Intentions to see the status of what you’ve submitted.',
    ],
  },
  'user-mass-schedule.html': {
    title: 'Mass Schedule',
    intro: 'View upcoming masses and the parish’s regular weekly schedule.',
    steps: [
      'Check the legend at the top to see what each mass-type badge (Daily, Anticipated, Special, Baptism) means.',
      'Pick a date to see that day’s full schedule.',
      'Upcoming Special Masses are listed at the bottom of Date’s Schedule — tap one to open its date.',
      'Check the Regular Weekly Mass Schedule table for the recurring pattern that applies every week.',
    ],
  },
  'user-my-requests.html': {
    title: 'My certificate requests',
    intro: 'Track the status of your certificate requests.',
    steps: [
      'Browse your submitted certificate requests and their current status.',
      'Open a request to see its full details.',
      'Cancel a booking you no longer need. Its slot is released for other parishioners.',
      'Head to “Request a Certificate” if you need to submit a new one.',
    ],
  },
  'user-profile.html': {
    title: 'My Profile',
    intro: 'Manage your account information, security, and preferences.',
    steps: [
      'Update your Profile Information, then save to keep the changes.',
      'Use Change Password to update your login password.',
      'Turn on Extra sign-in protection (a code sent to your phone) to keep your account safer.',
      'Adjust Notification Preferences to control what you’re alerted about.',
      'Export your Recent Activity if you’d like a copy for your records.',
    ],
  },
  'user-settings.html': {
    title: 'My Settings',
    intro: 'Choose how the portal looks and reads for you.',
    steps: [
      'Switch between Light and Dark mode.',
      'Switch the portal language between English and Filipino.',
      'Turn on Larger Text & High Contrast if that’s easier to read.',
      'These are saved on this device, so they stay the same next time you sign in here.',
    ],
  },
  'user-request-certificate.html': {
    title: 'Request a Certificate',
    intro: 'Submit a request for a Baptismal, Confirmation, Marriage, or First Communion certificate.',
    steps: [
      'Choose the certificate type you need.',
      'Fill in the required fields — anything marked with an asterisk (*) must be completed before you can submit.',
      'Double-check the preview of your request before submitting.',
      'Track its status afterward from “My Requests.”',
    ],
  },
  'user-request-service.html': {
    title: 'Request a Service',
    intro: 'Request a sacrament, blessing, or special Mass — grouped by category so it’s easy to find what you need.',
    steps: [
      'Browse the three rows — Blessings, Sacraments, and Special Masses — and pick the service you need.',
      'Each service shows its fixed schedule. Pick an open date, then an open time slot (full slots are greyed out).',
      'Sacraments and special Masses are booked as soon as you submit.',
      'Blessings are sent to the parish office for approval first — your slot is held while you wait. You can have up to 3 blessing requests waiting at a time.',
      'Track everything under “Requested Services.”',
    ],
  },
  'user-requested-services.html': {
    title: 'My service bookings',
    intro: 'Track the status of every sacrament, blessing, or special Mass you’ve requested.',
    steps: [
      'Use the chips above the list — All, Blessings, Sacraments, Special Masses — to narrow it down.',
      'Blessings show “Awaiting Approval” until the parish office approves them (then “Scheduled”) or declines them (“Not Approved,” with the reason).',
      'Open a request to see its full details, including any confirmed date, time, and officiant.',
      'Cancel a booking you no longer need. Its slot is released for other parishioners.',
    ],
  },
};

const PAGES_WITHOUT_ASSISTANT = new Set([
  'user-messages.html',
  'user-request-certificate.html',
  'user-request-service.html',
  'user-facility-booking.html',
  'user-parish-server.html',
  'user-mass-intentions.html',
]);


function addSkipLink() {
  const main = document.querySelector('main');
  if (!main || document.querySelector('.skip-link')) return;
  if (!main.id) main.id = 'main-content';
  main.setAttribute('tabindex', '-1');
  const link = document.createElement('a');
  link.className = 'skip-link';
  link.href = `#${main.id}`;
  link.textContent = currentLang() === 'fil' ? 'Lumaktaw sa nilalaman' : 'Skip to main content';
  document.body.prepend(link);
}

/* First sign-in on this device: offer bigger letters once, up front,
   instead of leaving it switched off behind the "Aa" button. */
const TEXT_SIZE_ASKED = 'sacradigit_textsize_asked';

function askAboutTextSize() {
  try {
    if (localStorage.getItem('sacradigit_a11y') !== null || localStorage.getItem(TEXT_SIZE_ASKED)) return;
  } catch { return; }

  const fil = currentLang() === 'fil';
  const overlay = document.createElement('div');
  overlay.className = 'textsize-ask-overlay';
  overlay.setAttribute('data-no-translate', '');
  overlay.innerHTML = `
    <div class="textsize-ask-card" role="dialog" aria-modal="true" aria-labelledby="textsize-ask-title">
      <p class="textsize-ask-sample" aria-hidden="true">Aa</p>
      <h2 id="textsize-ask-title">${fil ? 'Gusto mo ba ng mas malalaking letra?' : 'Would you like bigger letters?'}</h2>
      <p>${fil
        ? 'Lalaki rin ang mga button. Mapapalitan mo ito anumang oras gamit ang “Mas malaki” sa itaas.'
        : 'Buttons get bigger too. You can change this any time with “Bigger text” at the top of the screen.'}</p>
      <div class="textsize-ask-actions">
        <button type="button" class="btn-lavender" data-choice="yes">${fil ? 'Oo, palakihin' : 'Yes, bigger'}</button>
        <button type="button" class="btn-secondary" data-choice="no">${fil ? 'Hindi na, salamat' : 'No thanks'}</button>
      </div>
    </div>`;

  const close = (bigger) => {
    try { localStorage.setItem(TEXT_SIZE_ASKED, '1'); } catch { /* private mode */ }
    setAccessibility(bigger);
    overlay.remove();
  };
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-choice]');
    if (btn) close(btn.dataset.choice === 'yes');
  });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
  document.body.appendChild(overlay);
  overlay.querySelector('[data-choice="yes"]').focus();
}

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     1. USER PROFILE — populate name & initials
     In production these come from auth session.
     Stored in sessionStorage so it persists
     across user pages in the same session.
  ------------------------------------------ */
  const me = currentUser() || {};
  const USER = {
    firstName: me.firstName || me.name || '?',
    lastName: me.lastName || '',
    fullName: me.name || '',
    role: 'Parishioner',
  };

  // Sidebar name + initials
  const sidebarName = document.getElementById('sidebar-user-name');
  const avatarInitials = document.getElementById('avatar-initials');
  if (sidebarName) sidebarName.textContent = USER.fullName;
  if (avatarInitials) {
    const initials = ((USER.firstName[0] || '') + (USER.lastName[0] || '')).toUpperCase();
    avatarInitials.textContent = initials;
  }


  /* ------------------------------------------
     1b. "Faith Journey → My Badges" nav section
     Added here (not in each page's HTML) so every
     user page gets it from one place.
  ------------------------------------------ */
  // The user/*.html pages already carry these sections and names in their own
  // sidebar (so the menu doesn't change after the page appears). Each step below
  // skips what is already there; edit the pages' sidebar HTML too when changing them.
  const sidebarNav = document.querySelector('#sidebar nav') || document.querySelector('nav');
  if (sidebarNav && !sidebarNav.querySelector('[data-nav="badges"]')) {
    sidebarNav.insertAdjacentHTML('beforeend', `
        <p class="sidebar-label mt-5">Faith Journey</p>
        <ul class="space-y-0.5">
          <li>
            <a href="user-prayer-wall.html" data-nav="prayer-wall" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4c-1.5 2-3 4.5-3 7.5V17l-3 3h12l-3-3v-5.5C15 8.5 13.5 6 12 4zM12 4v13"/></svg>
              Prayer Wall
            </a>
          </li>
          <li>
            <a href="user-ministry.html" data-nav="ministry" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Ministry Sign-ups
            </a>
          </li>
          <li>
            <a href="user-badges.html" data-nav="badges" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15a5 5 0 100-10 5 5 0 000 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5"/></svg>
              My Badges
            </a>
          </li>
        </ul>`);
  }


  /* "Parish Server" (user-parish-server.html) — apply to be verified as serving the parish, after Ministry Sign-ups. */
  const minLink = sidebarNav?.querySelector('[data-nav="ministry"]');
  if (minLink && !sidebarNav.querySelector('[data-nav="parish-server"]')) {
    minLink.closest('li').insertAdjacentHTML('afterend', `
          <li><a href="user-parish-server.html" data-nav="parish-server" class="sidebar-link">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Parish Server</a></li>`);
  }

  /* "Columbary" (user-columbary.html), after Facility Booking. */
  const fbLink = sidebarNav?.querySelector('[data-nav="facility-booking"]');
  if (fbLink && !sidebarNav.querySelector('[data-nav="columbary"]')) {
    fbLink.closest('li').insertAdjacentHTML('afterend', `
          <li><a href="user-columbary.html" data-nav="columbary" class="sidebar-link">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 21V5a2 2 0 012-2h12a2 2 0 012 2v16M4 21h16M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/></svg>
            Columbary</a></li>`);
  }

  /* "My Requests" and "Requested Services" sounded like the same thing. */
  const NAV_NAMES = { 'my-requests': 'My certificate requests', 'requested-services': 'My service bookings' };
  document.querySelectorAll('#sidebar .sidebar-link[data-nav]').forEach(link => {
    const name = NAV_NAMES[link.dataset.nav];
    const textNode = name && [...link.childNodes].reverse().find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (textNode) textNode.textContent = ` ${name} `;
  });

  /* Profile, Settings and Log out as plain menu items — not only behind the name. */
  if (sidebarNav && !sidebarNav.querySelector('[data-nav="settings"]')) {
    sidebarNav.insertAdjacentHTML('beforeend', `
        <p class="sidebar-label mt-5">Account</p>
        <ul class="space-y-0.5">
          <li>
            <a href="user-profile.html" data-nav="profile" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              My Profile
            </a>
          </li>
          <li>
            <a href="user-settings.html" data-nav="settings" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Settings
            </a>
          </li>
          <li>
            <a href="../login.html" data-nav="logout" data-action="logout" class="sidebar-link sidebar-link-logout">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1"/></svg>
              Log out
            </a>
          </li>
        </ul>`);
  }

  /* "More below ↓" — the menu is taller than most screens and nothing showed
     it scrolls. A soft fade + a tappable hint sit at its bottom edge while
     there's more to see, and disappear once the end is reached. */
  if (sidebarNav) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'sidebar-more hidden';
    more.innerHTML = `<span>More below</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>`;
    more.setAttribute('aria-label', 'Scroll the menu to see more');
    sidebarNav.after(more);
    const update = () => {
      const left = sidebarNav.scrollHeight - sidebarNav.scrollTop - sidebarNav.clientHeight;
      more.classList.toggle('hidden', left <= 8);
    };
    more.addEventListener('click', () => sidebarNav.scrollBy({ top: sidebarNav.clientHeight * 0.7, behavior: 'smooth' }));
    sidebarNav.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    new ResizeObserver(update).observe(sidebarNav);
    // The sidebar slides in on phones — measure again once it's open.
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => setTimeout(update, 320));
    setTimeout(update, 0);                       // after the Messages link below is added
    window.addEventListener('load', update);     // after fonts / styles have settled
  }

  /* "Parish → Messages" — chat with the parish office (../../shared/js/chat.js),
     with a count of office replies not read yet. */
  const annLink = document.querySelector('#sidebar a.sidebar-link[href="user-announcements.html"]');
  if (annLink && !document.querySelector('#sidebar a.sidebar-link[href="user-messages.html"]')) {
    annLink.closest('li').insertAdjacentHTML('afterend', `
          <li><a href="user-messages.html" data-nav="messages" class="sidebar-link">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Messages</a></li>`);
  }
  watchUnreadBadge(document.querySelector('#sidebar a.sidebar-link[href="user-messages.html"]'), 'parishioner', { threadId: me.sub });


  /* ------------------------------------------
     2. ACTIVE SIDEBAR LINK
     Matches current page filename to each
     link's href so the right tab highlights.
  ------------------------------------------ */
  // Each certificate's / service's own page (user-request-*-certificate.html,
  // user-service-*.html) counts as its parent page here.
  const pageFile = window.location.pathname.split('/').pop() || 'user-dashboard.html';
  const currentPage = /^user-request-.+-certificate\.html$/.test(pageFile) ? 'user-request-certificate.html'
    : /^user-service-.+\.html$/.test(pageFile) ? 'user-request-service.html'
    : pageFile;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });


  /* ------------------------------------------
     2b. PAGE HELP — "?" icon + tutorial modal
     Content lives in HELP_CONTENT above; the
     widget itself is shared (help-tutorial.js).
  ------------------------------------------ */
  initPageHelp(HELP_CONTENT[currentPage]);
  initUiPrefs(); // Light/Dark + English/Filipino controls (ui-prefs.js)
  // The floating "Ask" bubble would sit on top of Next/Submit on step forms,
  // and next to the real office chat on Messages it's unclear which one reaches a person.
  if (!PAGES_WITHOUT_ASSISTANT.has(currentPage)) initParishAssistant();
  initNotifications(); // 🔔 bell in the top bar (notifications/)
  initExtToggles(); // phones: Ext. (Jr., III) box hidden behind an "Add extension" checkbox (name-utils.js)
  initBirthDateDropdowns(); // birth dates: Month / Day / Year dropdowns instead of the mm/dd/yyyy calendar (../../shared/js/date-dropdowns.js)
  mountPageInfo(pageFile); // "What can I do here?" box at the top of each page, main button on the right (page-info.js)
  initLeaveWarning(); // refreshing / leaving with something typed but not sent asks first (leave-warning.js)
  labelTopBarIcons();
  initTableCards('table.user-table:not(.weekly-table)'); // phones: Giving History, My Bookings as cards (../../shared/js/table-cards.js)
  addSkipLink();
  askAboutTextSize();


  /* ------------------------------------------
     3. MOBILE SIDEBAR TOGGLE
  ------------------------------------------ */
  const sidebar        = document.getElementById('sidebar');
  const sidebarToggle   = document.getElementById('sidebar-toggle');
  const sidebarOverlay  = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.remove('hidden');
    sidebarToggle?.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.add('hidden');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
  }

  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  sidebarOverlay?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 1024) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) closeSidebar();
  });


  /* ------------------------------------------
     4. LIVE DATE in top bar
  ------------------------------------------ */
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }


  /* ------------------------------------------
     5. TOAST helper (globally available)
  ------------------------------------------ */
  /* Good news ("Request sent") fades after 3s at the bottom. Warnings sit at
     the top, clear of the Next/Submit buttons, and stay until closed or
     replaced — a 3-second warning vanishes before a slow reader finishes it. */
  const toast = document.getElementById('toast');

  function hideToast() {
    toast._sdCancelHide?.();
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }

  window.showToast = function (message, isError = false) {
    if (!toast) return;
    toast._sdCancelHide?.();
    toast.classList.toggle('toast-error', isError);
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toast.style.backgroundColor = '';
    // Just under the top bar (so it doesn't hide the title and icons); at the very top once scrolled past it.
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    toast.style.top = isError ? `${Math.max(12, Math.round(headerBottom) + 8)}px` : '';
    if (isError) {
      toast.innerHTML = `
        <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m0 3.75h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        <span class="toast-text"></span>
        <button type="button" class="toast-close" aria-label="${currentLang() === 'fil' ? 'Isara' : 'Close'}">×</button>`;
      toast.querySelector('.toast-text').textContent = message;
      toast.querySelector('.toast-close').addEventListener('click', hideToast);
    } else {
      toast.textContent = message;
    }
    // A "fill in the boxes" warning closes itself once every box is fixed.
    toast.dataset.fieldError = isError && document.querySelector(FIELD_ERROR_SELECTOR) ? '1' : '';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    announceToast(isError);
    if (!isError) autoHide(toast, hideToast, 3000); // time-left bar, pauses on hover (toast.js)
  };

  watchFieldErrors(() => {
    if (toast?.dataset.fieldError === '1' && toast.classList.contains('show')) hideToast();
  });


  /* ------------------------------------------
     6. USER MENU — real dropdown
     Profile links to the My Profile page, Settings
     to the My Settings page, Log Out returns to the
     portal launcher. Injected via JS so every user
     page picks this up for free (this file is shared
     across all of them).
  ------------------------------------------ */
  const userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) {
    const menuWrap = userMenuBtn.parentElement;
    menuWrap.style.position = 'relative';

    const menu = document.createElement('div');
    menu.className = 'user-menu-dropdown hidden';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" class="user-menu-item" role="menuitem" data-action="profile">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        My Profile
      </button>
      <button type="button" class="user-menu-item" role="menuitem" data-action="settings">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Settings
      </button>
      <div class="user-menu-divider"></div>
      <button type="button" class="user-menu-item user-menu-item-danger" role="menuitem" data-action="logout">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1"/></svg>
        Log Out
      </button>
    `;
    menuWrap.appendChild(menu);

    function openUserMenu() {
      menu.classList.remove('hidden');
      userMenuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeUserMenu() {
      if (menu.classList.contains('hidden')) return;
      menu.classList.add('hidden');
      userMenuBtn.setAttribute('aria-expanded', 'false');
    }

    userMenuBtn.setAttribute('aria-haspopup', 'true');
    userMenuBtn.setAttribute('aria-expanded', 'false');

    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = userMenuBtn.getAttribute('aria-expanded') === 'true';
      expanded ? closeUserMenu() : openUserMenu();
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== userMenuBtn) closeUserMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeUserMenu();
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.user-menu-item');
      if (!item || item.getAttribute('aria-disabled') === 'true') return;
      closeUserMenu();
      if (item.dataset.action === 'profile') {
        window.location.href = 'user-profile.html';
      } else if (item.dataset.action === 'settings') {
        window.location.href = 'user-settings.html';
      } else if (item.dataset.action === 'logout') {
        window.location.href = '../login.html';
      }
    });
  }

});