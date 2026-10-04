/* ============================================
   SacraDigit Admin — Dashboard Scripts
   ============================================ */

import { guardPage } from '../auth.js';

// Only signed-in people with the right role get past this (see auth.js).
guardPage('admin');
import { initPageHelp } from '../help-tutorial.js';
import { initUiPrefs } from '../ui-prefs.js';
import { watchUnreadBadge } from '../chat.js';
import { watchRequests } from '../prayer-wall.js';

// Red count on the sidebar's Prayer Wall link: requests waiting for review.
function watchPendingPrayers(link) {
  if (!link) return;
  const badge = document.createElement('span');
  badge.className = 'chat-unread-badge hidden';
  link.appendChild(badge);
  watchRequests((items) => {
    const n = items.filter(r => r.status === 'pending').length;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('hidden', n === 0);
  });
}
// Adds the rotating sacred art to every navy page header (see sacred-art.js).
import './sacred-art.js';

/* ------------------------------------------
   Per-page "How to use this page" content for
   the (?) help icon in the top bar. Keyed by
   filename so it works for every admin page
   that loads this shared shell script — see
   help-tutorial.js for how it's rendered.
------------------------------------------ */
const HELP_CONTENT = {
  'dashboard.html': {
    title: 'Dashboard',
    intro: 'Your at-a-glance overview of what’s happening across the parish today.',
    steps: [
      'Check Today’s Schedule for the masses and events happening today.',
      'Review Pending Requests to see what needs your attention first.',
      'Glance at Cloud Status and Recent Records for a quick system health check.',
      'Use the sidebar on the left to jump into any module — Digital Archives, Record Requests, Masses, and more.',
    ],
  },
  'announcements.html': {
    title: 'Announcements',
    intro: 'Publish parish-wide announcements that parishioners see on their end.',
    steps: [
      'Click “New Announcement” to open the form.',
      'Fill in a title, the location (if any), and the full announcement text.',
      'Save to publish it — it appears right away under Published Announcements.',
      'Edit or remove an existing announcement any time from its row.',
    ],
  },
  'digital-archives.html': {
    title: 'Digital Archives',
    intro: 'Browse, search, and manage every digitized sacramental record on file.',
    steps: [
      'Search by name, record type, or reference number to find a specific record.',
      'Click “Scan Document” to read a birth, baptismal, confirmation, marriage, or death certificate: add a photo or PDF, pick the document type, and press Scan. The text is read left to right, row by row.',
      'Check every filled-in box before saving — words in amber were hard to read. Click a box, then click words on the document to copy them in.',
      'Click “New Record” to digitize and add a record manually.',
      'Click “Upload” to attach a scanned document to a record without reading it.',
      'Open any row in All Records to view or edit its details.',
      'Use “Clear Filters” to reset your search and see the full list again.',
    ],
  },
  'record-requests.html': {
    title: 'Record Requests',
    intro: 'Review and process certificate requests submitted by parishioners.',
    steps: [
      'Search by requester name or reference number to find a specific request.',
      'Open a request to review the requester’s details and the certificate type.',
      'Approve, Reject, or mark a request Released once the certificate has been handed over.',
      'Click “New Request” to log a request made in person or by phone.',
      'Click “Upload” to attach a supporting document to a request.',
    ],
  },
  'schedule-offers.html': {
    title: 'Schedule Offers',
    intro: 'Every parishioner service booking. Parishioners pick one of the parish’s fixed schedule slots, so bookings arrive already scheduled — no approval needed.',
    steps: [
      'Search by name or service type to find a specific booking.',
      'Click “View” to see the requester’s details and booked date and time.',
      'Click “Cancel” on an upcoming booking if the parish can’t honour it. Give a reason; the parishioner sees it and the slot opens up again.',
      'Click “Reschedule” to move a booking to another open slot — allowed up to the day before its date. Give a reason; the parishioner sees it.',
      'Click “+ Service” when a parishioner asks at the office (walk-in or phone call): choose the service, fill in their details, and book one of the same fixed slots for them — from tomorrow onward.',
      'Use “Clear Filters” to reset the list.',
    ],
  },
  'blessings.html': {
    title: 'Blessings',
    intro: 'See every booked service (blessings, sacraments and special masses) on the parish’s fixed schedule.',
    steps: [
      'Switch between List View and Calendar View with the toggle at the top.',
      'Parishioner requests book a fixed schedule slot and appear under Upcoming automatically.',
      'Open an upcoming booking’s Details to cancel it if the parish can’t make it. The slot opens up again.',
      'Click “+ Service” to book a walk-in or phone request (any service, not just blessings) into one of the same fixed slots. For a House Blessing you can pin the house on the map.',
      'Use “Clear Filters” to reset your search.',
    ],
  },
  'facility-booking.html': {
    title: 'Facility Booking',
    intro: 'Manage bookings for parish rooms, halls, and chapels. Bookings are confirmed instantly because the time picker blocks conflicts.',
    steps: [
      'Switch between List View and Calendar View with the toggle at the top.',
      'Click “New Booking” to reserve a facility directly. Booked hours and parish closure days are greyed out.',
      'Cancel a booking if the facility becomes unavailable. Cancellations are recorded in the activity log.',
      'To close the parish on certain dates, add a “No Services (Parish Closed)” entry in Special Schedules.',
    ],
  },
  'mass-intentions.html': {
    title: 'Mass Intentions',
    intro: 'Manage donor-submitted mass intentions and offerings.',
    steps: [
      'Search by donor or name(s), or use “Find a name…” to locate a specific intention.',
      'Click “Add Intention” to log one submitted in person or by phone.',
      'Mark an intention Completed once it’s been said/offered.',
      'Click “Print Sheet” to print the intentions log for a mass.',
      'Use “Clear Filters” to reset your search.',
    ],
  },
  'masses.html': {
    title: 'Special Masses',
    intro: 'Schedule and manage the parish’s regular and special masses.',
    steps: [
      'Check the legend at the top to see what each mass-type badge (Daily, Anticipated, Special, Baptism) means.',
      'Pick a date to see that day’s full schedule, or switch to Calendar View for a month at a glance.',
      'Click “Schedule Mass” to add a new mass — choose its type and, optionally, a title/intention.',
      'Review the Regular Weekly Mass Schedule table for the recurring pattern that applies every week.',
      'Click “See Full Details” on any mass for its complete information.',
      'For today’s masses, click “Start Check-in” to show a QR code on the church screen or projector. Parishioners scan it (or type the code under it) to check in and earn Faith Journey badges. Check-in closes by itself 90 minutes after the mass starts, or click “Close Check-in”.',
    ],
  },
  'donations.html': {
    title: 'Donations',
    intro: 'Track parish donations, collections, and financial contributions.',
    steps: [
      'Click “New Goal” to set up a fundraising goal to track progress against.',
      'Search by donor or fund to find a specific donation.',
      'Click “Export Report” to download the donations log.',
      'Click “View Graph” on a goal to see its progress visually.',
      'Use “Clear Filters” to reset your search.',
    ],
  },
  'prayer-wall.html': {
    title: 'Prayer Wall',
    intro: 'Prayer requests from parishioners. Nothing appears on the wall until the office approves it.',
    steps: [
      'Waiting for Review lists new requests, oldest first. Approve puts one on the wall; Reject asks for a short reason the person will see.',
      'On the Wall shows what parishioners see, with how many have prayed for each.',
      'Take Down removes an approved request (with a reason). Requests leave the wall on their own after 60 days.',
      'Anonymous requests never store the person’s name, so the office doesn’t see it either.',
    ],
  },
  'ministry-roster.html': {
    title: 'Ministry Roster',
    intro: 'Who is serving at each weekend and special Mass this month.',
    steps: [
      'Parishioners sign up from their portal’s Ministry Sign-ups page; this table updates live.',
      '“Open” shows slots that still need volunteers; “Swap” marks someone who asked to be replaced.',
      'Click × to remove someone from a slot. Print Roster prints the month for the sacristy.',
      'How many lectors, choir members, altar servers and ushers each Mass needs is set in ministry.js.',
    ],
  },
  'attendance.html': {
    title: 'Attendance Insights',
    intro: 'How full each Mass is, built from parishioners’ QR check-ins. For the Head Admin.',
    steps: [
      'Pick a period and enter the church’s seating capacity — it’s remembered on this computer.',
      'Fullest Masses ranks the busiest Masses; ▲ Near capacity means 90% of seats or more.',
      'Check-ins per Week shows whether attendance is growing or dropping.',
      'The heatmap shows the average turnout for each day and Mass time — useful for planning schedules and priest assignments.',
      'Hover (or tab to) any bar or cell for exact numbers, or open “Show as table”. Counts only include people who checked in.',
    ],
  },
  'messages.html': {
    title: 'Messages',
    intro: 'Questions parishioners send to the parish office. The Head Admin and the Secretary share this inbox.',
    steps: [
      'Pick a conversation on the left — unread ones are bold with a red count.',
      'Type your reply at the bottom and press Enter to send (Shift+Enter for a new line). The parishioner sees it on their Messages page.',
      'Parishioners start conversations from their portal; the office can reply to any of them.',
      'The red number next to Messages in the sidebar shows how many parishioner messages are still unread.',
    ],
  },
  'special-schedules.html': {
    title: 'Special Schedules',
    intro: 'Manage seasonal and special liturgical schedules, like Simbang Gabi or Holy Week.',
    steps: [
      'Click “Add Schedule” to create a new seasonal schedule with its own dates and description.',
      'Switch to Calendar View to see all special schedules laid out by date.',
      'Use the Upcoming, Completed and Cancelled tabs — a schedule moves to Completed on its own once its end date passes.',
      'Click “Cancel” to call off a schedule; it moves to the Cancelled tab, where you can Restore it or delete it for good.',
    ],
  },
  'profile.html': {
    title: 'My Profile',
    intro: 'Manage your admin account information, security, and preferences.',
    steps: [
      'Update your Profile Information — name, contact number, and role note — then save your changes.',
      'Use Change Password to update your login password.',
      'Turn on Two-Factor Authentication for extra account security.',
      'Adjust Notification Preferences to control what you’re alerted about.',
      'Check Recent Activity to review recent actions on your account.',
    ],
  },
};

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     1. ACTIVE SIDEBAR LINK
     Matches the current page filename against
     each link's href so the right tab is
     highlighted no matter which page loads.
  ------------------------------------------ */
  /* "Communications → Messages" (the parish office inbox), added here
     rather than in every page's HTML, with an unread count. */
  const annLink = document.querySelector('#sidebar a.sidebar-link[href="announcements.html"]');
  if (annLink && !document.querySelector('#sidebar a.sidebar-link[href="messages.html"]')) {
    annLink.closest('li').insertAdjacentHTML('afterend', `
          <li>
            <a href="messages.html" data-nav="messages" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Messages
            </a>
          </li>`);
  }
  watchUnreadBadge(document.querySelector('#sidebar a.sidebar-link[href="messages.html"]'), 'office');

  /* "Prayer Wall" (with a count waiting for review) and "Ministry Roster". */
  const msgLi = document.querySelector('#sidebar a.sidebar-link[href="messages.html"]')?.closest('li');
  if (msgLi && !document.querySelector('#sidebar a.sidebar-link[href="prayer-wall.html"]')) {
    msgLi.insertAdjacentHTML('afterend', `
          <li>
            <a href="prayer-wall.html" data-nav="prayer-wall" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4c-1.5 2-3 4.5-3 7.5V17l-3 3h12l-3-3v-5.5C15 8.5 13.5 6 12 4zM12 4v13"/></svg>
              Prayer Wall
            </a>
          </li>`);
  }
  const fbLi = document.querySelector('#sidebar a.sidebar-link[href="facility-booking.html"]')?.closest('li');
  if (fbLi && !document.querySelector('#sidebar a.sidebar-link[href="ministry-roster.html"]')) {
    fbLi.insertAdjacentHTML('afterend', `
          <li>
            <a href="ministry-roster.html" data-nav="ministry-roster" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Ministry Roster
            </a>
          </li>`);
  }
  watchPendingPrayers(document.querySelector('#sidebar a.sidebar-link[href="prayer-wall.html"]'));

  /* "Attendance" (Head Admin only) under Masses — charts from QR check-ins. */
  const massesLink = document.querySelector('#sidebar a.sidebar-link[href="masses.html"]');
  if (massesLink && !document.querySelector('#sidebar a.sidebar-link[href="attendance.html"]')) {
    massesLink.closest('li').insertAdjacentHTML('afterend', `
          <li class="head-admin-only">
            <a href="attendance.html" data-nav="attendance" class="sidebar-link">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              Attendance
            </a>
          </li>`);
  }

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  sidebarLinks.forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });


  /* ------------------------------------------
     1a. NAVY PAGE HEADER ICON
     Each page's navy header (.admin-hero) gets
     the same icon as its sidebar tab, like the
     parishioner pages' headers. The rotating
     sacred art itself is added by sacred-art.js.
  ------------------------------------------ */
  const hero = document.querySelector('.admin-hero');
  const activeIcon = document.querySelector('.sidebar-link.active svg');
  if (hero && !hero.querySelector('.admin-hero-lead')) {
    const text = hero.querySelector(':scope > div:not(.sacred-art-frame):not(.sacred-header-tint)');
    if (text) {
      const lead = document.createElement('div');
      lead.className = 'admin-hero-lead';
      if (activeIcon) {
        const icon = document.createElement('div');
        icon.className = 'admin-hero-icon';
        icon.setAttribute('aria-hidden', 'true');
        const svg = activeIcon.cloneNode(true);
        svg.setAttribute('class', 'w-6 h-6');
        icon.appendChild(svg);
        lead.appendChild(icon);
      }
      text.replaceWith(lead);
      lead.appendChild(text);
    }
  }


  /* ------------------------------------------
     1b. PAGE HELP — "?" icon + tutorial modal
     Content lives in HELP_CONTENT above; the
     widget itself is shared (help-tutorial.js).
  ------------------------------------------ */
  initPageHelp(HELP_CONTENT[currentPage]);
  initUiPrefs(); // Light/Dark + English/Filipino controls (ui-prefs.js)


  /* ------------------------------------------
     2. MOBILE SIDEBAR TOGGLE
  ------------------------------------------ */
  const sidebar        = document.getElementById('sidebar');
  const sidebarToggle   = document.getElementById('sidebar-toggle');
  const sidebarOverlay  = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.remove('hidden');
    sidebarToggle?.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.add('hidden');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open');
      isOpen ? closeSidebar() : openSidebar();
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar automatically if a nav link is tapped on mobile
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        closeSidebar();
      }
    });
  });

  // Close sidebar on resize back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      closeSidebar();
    }
  });


  /* ------------------------------------------
     3. TOP BAR — live current date
  ------------------------------------------ */
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const today = new Date();
    const formatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    dateEl.textContent = formatted;
  }


  /* ------------------------------------------
     4. USER MENU — real dropdown
     Profile / Settings aren't built yet, so
     they're shown but marked "Soon" rather than
     linking to a page that doesn't exist. Log Out
     returns to the public site. Injected via JS
     so every admin page picks this up for free.
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
        Profile
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
        window.location.href = 'profile.html';
      } else if (item.dataset.action === 'logout') {
        window.location.href = 'index.html';
      }
    });
  }


  /* ------------------------------------------
     5. TOAST — add a manual dismiss control
     Each page keeps its own showToast()/timer,
     but every #toast on every page gets a
     persistent message span + × button here so
     a notification can be closed early. Pages
     write into .toast-message instead of the
     toast element directly so the button
     survives every re-render.
  ------------------------------------------ */
  const toastEl = document.getElementById('toast');
  if (toastEl) {
    toastEl.innerHTML = '<span class="toast-message"></span><button type="button" class="toast-dismiss" aria-label="Dismiss notification">&times;</button>';
    toastEl.querySelector('.toast-dismiss').addEventListener('click', () => {
      toastEl.classList.remove('show');
    });
  }

});