/* ============================================
   SacraDigit — Scripts (scripts.js)
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     1. STICKY NAVBAR — add .scrolled class
        when user scrolls past the hero
  ------------------------------------------ */
  const navbar = document.getElementById('navbar');

  const handleNavbarScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll(); // run once on load


  /* ------------------------------------------
     2. MOBILE MENU TOGGLE
  ------------------------------------------ */
  const menuToggle  = document.getElementById('menu-toggle');
  const mobileMenu  = document.getElementById('mobile-menu');
  const iconOpen    = document.getElementById('icon-open');
  const iconClose   = document.getElementById('icon-close');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = !mobileMenu.classList.contains('hidden');

      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close menu when a mobile link is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!navbar.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  function openMobileMenu() {
    mobileMenu.classList.remove('hidden');
    menuToggle.setAttribute('aria-expanded', 'true');
    iconOpen.classList.add('hidden');
    iconClose.classList.remove('hidden');
  }

  function closeMobileMenu() {
    mobileMenu.classList.add('hidden');
    menuToggle.setAttribute('aria-expanded', 'false');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }


  /* ------------------------------------------
     3. ACTIVE NAV LINK — highlight based on
        scroll position (Intersection Observer)
  ------------------------------------------ */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          setActiveLink(id);
        }
      });
    },
    {
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0,
    }
  );

  sections.forEach(section => sectionObserver.observe(section));

  function setActiveLink(sectionId) {
    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${sectionId}` || (sectionId === 'hero' && href === '#')) {
        link.classList.add('active');
      }
    });
  }


  /* ------------------------------------------
     4. SMOOTH SCROLL for anchor links
        (handles # hrefs that aren't just "#")
  ------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return; // Let browser handle top-scroll

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navbarHeight = navbar.offsetHeight;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 12;

        window.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });
      }
    });
  });


  /* ------------------------------------------
     5. SCROLL-REVEAL — trigger .fade-in-up
        for cards when they enter the viewport
  ------------------------------------------ */
  const revealElements = document.querySelectorAll('.fade-in-up');

  // Start hidden (animation controlled by JS, not CSS delay alone)
  revealElements.forEach(el => {
    el.style.animationPlayState = 'paused';
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
    }
  );

  revealElements.forEach(el => revealObserver.observe(el));

});