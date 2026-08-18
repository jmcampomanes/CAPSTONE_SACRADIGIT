/* ============================================
   SacraDigit Admin — Dashboard Scripts
   ============================================ */

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
      <button type="button" class="user-menu-item" role="menuitem" data-action="profile" aria-disabled="true">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        Profile
        <span class="user-menu-item-soon">Soon</span>
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
      if (item.dataset.action === 'logout') {
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