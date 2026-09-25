/* ============================================
   SacraDigit Admin — Dashboard Scripts
   ============================================ */

import { initPageHelp } from '../help-tutorial.js';
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
      'Older requests from before fixed schedules still show Approve / Decline.',
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
      'Click “Blessing Schedule” to book a walk-in or phone request into one of the same fixed slots.',
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
  'special-schedules.html': {
    title: 'Special Schedules',
    intro: 'Manage seasonal and special liturgical schedules, like Simbang Gabi or Holy Week.',
    steps: [
      'Click “Add Schedule” to create a new seasonal schedule with its own dates and description.',
      'Switch to Calendar View to see all special schedules laid out by date.',
      'Mark a schedule Completed once the season has ended.',
      'Review Upcoming Special Schedules for what’s coming next.',
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
     1b. PAGE HELP — "?" icon + tutorial modal
     Content lives in HELP_CONTENT above; the
     widget itself is shared (help-tutorial.js).
  ------------------------------------------ */
  initPageHelp(HELP_CONTENT[currentPage]);


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