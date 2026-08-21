/* ============================================
   SacraDigit — User Portal Shell Scripts
   Shared across ALL user pages (user-shell.js)
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

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