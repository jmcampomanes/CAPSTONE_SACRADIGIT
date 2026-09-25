/* ============================================
   SacraDigit — User Portal Shell Scripts
   Shared across ALL user pages (user-shell.js)
   ============================================ */

import { initPageHelp } from '../help-tutorial.js';
import { initSacredArt } from './sacred-art.js';

/* ------------------------------------------
   Sacred art on every page's navy header
   (.req-hero), same rotating artwork as the
   Dashboard greeting banner. Each header gets
   the art frame plus a navy tint (so the white
   text stays readable) as its first children;
   see "Sacred art on page headers" in
   user-shell.css for the layering.
   ------------------------------------------ */
function addSacredArtToHeaders() {
  document.querySelectorAll('.req-hero').forEach((hero) => {
    if (hero.querySelector(':scope > .sacred-art-frame')) return;
    const tint = document.createElement('div');
    tint.className = 'req-hero-tint';
    tint.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('div');
    frame.setAttribute('aria-hidden', 'true');
    hero.prepend(frame, tint);
    initSacredArt(frame);
  });
}

/* ------------------------------------------
   Per-page "How to use this page" content for
   the (?) help icon in the top bar. Keyed by
   filename so it works for every user page
   that loads this shared shell script — see
   help-tutorial.js for how it's rendered.
------------------------------------------ */
const HELP_CONTENT = {
  'user-badges.html': {
    title: 'My Badges',
    intro: 'Your Faith Journey — badges for coming to Mass, giving, and parish life.',
    steps: [
      'At Mass, scan the QR code on the church screen with your phone camera, or type the code shown under it in “Check In at Mass”.',
      'Each check-in counts toward badges like Faithful Month, Steadfast (Sundays in a row), Simbang Gabi, and Holy Week Pilgrim. Saturday evening Mass counts for Sunday.',
      'Giving badges count how regularly you give — any amount. Amounts are never shown to anyone.',
      'Faithful Givers lists parishioners who have given every month for 3 months or more. Anonymous gifts never appear, and you can hide your name with the switch below the list.',
    ],
  },
  'user-dashboard.html': {
    title: 'Dashboard',
    intro: 'Your at-a-glance overview of parish life and your own requests.',
    steps: [
      'Check Today’s Mass Schedule and Upcoming Special Masses for what’s coming up.',
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
  'user-blessings.html': {
    title: 'Blessings',
    intro: 'Track your house, business, and vehicle blessing requests on a calendar.',
    steps: [
      'View your blessing requests laid out on the calendar by date.',
      'Click a date with a request to see its details and status.',
      'Looking for a sacrament (Baptism, Wedding, First Communion) or a special Mass (Funeral, Anniversary) instead? Submit and track those under “Request a Service.”',
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
      'Review Upcoming Special Masses for what’s coming up.',
      'Check the Regular Weekly Mass Schedule table for the recurring pattern that applies every week.',
    ],
  },
  'user-my-requests.html': {
    title: 'My Requests',
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
      'Turn on Two-Factor Authentication for extra account security.',
      'Adjust Notification Preferences to control what you’re alerted about.',
      'Export your Recent Activity if you’d like a copy for your records.',
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
      'Submit to book the slot right away. No waiting for approval. You’ll find it under “Requested Services.”',
    ],
  },
  'user-requested-services.html': {
    title: 'Requested Services',
    intro: 'Track the status of every sacrament, blessing, or special Mass you’ve requested.',
    steps: [
      'Browse My Requested Services to see each request and its current status.',
      'Open a request to see its full details, including any confirmed date, time, and officiant.',
      'Cancel a booking you no longer need. Its slot is released for other parishioners.',
    ],
  },
};

document.addEventListener('DOMContentLoaded', () => {

  addSacredArtToHeaders();

  /* ------------------------------------------
     1. USER PROFILE — populate name & initials
     In production these come from auth session.
     Stored in sessionStorage so it persists
     across user pages in the same session.
  ------------------------------------------ */
  const USER = {
    firstName: 'Maria',
    lastName: 'Santos',
    fullName: 'Maria P. Santos',
    role: 'Parishioner',
  };

  // Sidebar name + initials
  const sidebarName = document.getElementById('sidebar-user-name');
  const avatarInitials = document.getElementById('avatar-initials');
  if (sidebarName) sidebarName.textContent = USER.fullName;
  if (avatarInitials) {
    const initials = (USER.firstName[0] + USER.lastName[0]).toUpperCase();
    avatarInitials.textContent = initials;
  }


  /* ------------------------------------------
     1b. "Faith Journey → My Badges" nav section
     Added here (not in each page's HTML) so every
     user page gets it from one place.
  ------------------------------------------ */
  const sidebarNav = document.querySelector('#sidebar nav') || document.querySelector('nav');
  if (sidebarNav && !sidebarNav.querySelector('[data-nav="badges"]')) {
    sidebarNav.insertAdjacentHTML('beforeend', `
        <p class="sidebar-label mt-5">Faith Journey</p>
        <ul class="space-y-0.5">
          <li>
            <a href="user-badges.html" data-nav="badges" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15a5 5 0 100-10 5 5 0 000 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5"/></svg>
              My Badges
            </a>
          </li>
        </ul>`);
  }


  /* ------------------------------------------
     2. ACTIVE SIDEBAR LINK
     Matches current page filename to each
     link's href so the right tab highlights.
  ------------------------------------------ */
  const currentPage = window.location.pathname.split('/').pop() || 'user-dashboard.html';
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
      if (window.innerWidth < 768) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) closeSidebar();
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
  const toast = document.getElementById('toast');
  let toastTimer = null;

  window.showToast = function (message, isError = false) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  };


  /* ------------------------------------------
     6. USER MENU — real dropdown
     Settings isn't built yet, so it's shown but
     marked "Soon". Profile links to the new
     My Profile page. Log Out returns to the
     portal launcher. Injected via JS so every
     user page picks this up for free (this file
     is shared across all of them).
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
      <button type="button" class="user-menu-item" role="menuitem" data-action="settings" aria-disabled="true">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Settings
        <span class="user-menu-item-soon">Soon</span>
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
      } else if (item.dataset.action === 'logout') {
        window.location.href = '../index.html';
      }
    });
  }

});