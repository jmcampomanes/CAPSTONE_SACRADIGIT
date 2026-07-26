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

});