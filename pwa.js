/* ============================================
   SacraDigit — installable app (PWA)
   Imported by ui-prefs.js, so it runs on every
   page. Registers the service worker (public/sw.js,
   production builds only) and shows a small
   "Install app" banner:
   - Android / desktop Chrome & Edge: an Install
     button (the browser's own install prompt)
   - iPhone / iPad Safari: how to use Share →
     Add to Home Screen (Safari has no prompt)
   Dismissing hides it for 14 days; it never shows
   inside the installed app.
   ============================================ */

const DISMISS_KEY = 'sacradigit_install_dismissed';
const DISMISS_DAYS = 14;

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(err => console.error('Service worker registration failed:', err));
  });
}

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIpad = () =>
  /ipad/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const isIos = () => /iphone|ipod/i.test(navigator.userAgent) || isIpad();

// Safari's Share button: square with an up arrow.
const SHARE_ICON = '<svg class="pwa-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>';

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

const STYLE = `
  .pwa-banner {
    position: fixed; left: 0.75rem; right: 0.75rem; bottom: calc(0.75rem + env(safe-area-inset-bottom));
    z-index: 70; max-width: 26rem; margin: 0 auto;
    display: flex; align-items: center; gap: 0.75rem;
    background: #ffffff; color: #1e2a4a; border: 1px solid #e5e7eb; border-radius: 0.875rem;
    padding: 0.75rem 0.75rem 0.75rem 0.875rem; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    font-size: 0.8125rem; line-height: 1.35;
  }
  .pwa-banner img { width: 2.5rem; height: 2.5rem; border-radius: 0.6rem; flex-shrink: 0; }
  .pwa-banner-text { flex: 1; min-width: 0; }
  .pwa-banner-text strong { display: block; font-size: 0.875rem; }
  .pwa-banner-text span { color: #6b7280; }
  .pwa-banner-install {
    flex-shrink: 0; font: inherit; font-weight: 600; color: #ffffff; background: #1e2a4a;
    border: 0; border-radius: 0.55rem; padding: 0.5rem 0.9rem; cursor: pointer;
  }
  .pwa-banner-close {
    flex-shrink: 0; width: 1.75rem; height: 1.75rem; border: 0; background: none; color: #9ca3af;
    font-size: 1.25rem; line-height: 1; cursor: pointer; border-radius: 999px;
  }
  .pwa-banner-close:hover { background: #f3f4f6; color: #1e2a4a; }
  /* Tablets and laptops: tuck it into the bottom-right corner, clear of the page's content. */
  @media (min-width: 768px) {
    .pwa-banner { left: auto; right: 1.25rem; bottom: calc(1.25rem + env(safe-area-inset-bottom)); width: 23rem; margin: 0; }
  }
  .pwa-share-icon { display: inline-block; width: 1rem; height: 1rem; vertical-align: -0.2em; margin: 0 0.1rem; color: #3b82f6; }
  :root[data-theme="dark"] .pwa-banner { background: #1a2131; color: #f1f3f7; border-color: #2c3547; }
  :root[data-theme="dark"] .pwa-banner-text span { color: #b6bdca; }
  :root[data-theme="dark"] .pwa-banner-install { background: #8b8fc7; color: #0f1420; }
  :root[data-theme="dark"] .pwa-banner-close:hover { background: #242c3e; color: #f1f3f7; }
`;

function showBanner({ text, icon = '', onInstall }) {
  // Installing needs a connection; the offline notice uses the same spot.
  if (document.querySelector('.pwa-banner') || !navigator.onLine) return;
  const st = document.createElement('style');
  st.textContent = STYLE;
  document.head.appendChild(st);

  const banner = document.createElement('div');
  banner.className = 'pwa-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Install the SacraDigit app');
  banner.innerHTML = `
    <img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" />
    <div class="pwa-banner-text"><strong>Get the SacraDigit app</strong><span>${icon}${text}</span></div>
    ${onInstall ? '<button type="button" class="pwa-banner-install">Install</button>' : ''}
    <button type="button" class="pwa-banner-close" aria-label="Not now">×</button>`;
  document.body.appendChild(banner);

  banner.querySelector('.pwa-banner-close').addEventListener('click', () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    banner.remove();
  });
  banner.querySelector('.pwa-banner-install')?.addEventListener('click', async () => {
    banner.remove();
    await onInstall();
  });
}

if (!isInstalled() && !recentlyDismissed()) {
  // Chrome / Edge / Android: the browser tells us when the site can be installed.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    showBanner({
      text: 'Install it on your phone for one-tap access to Mass times, requests and your badges.',
      onInstall: async () => {
        e.prompt();
        await e.userChoice.catch(() => {});
      },
    });
  });

  // iPhone / iPad Safari never fires that event — explain the manual steps instead.
  if (isIos()) {
    // iPad Safari keeps Share at the top right; iPhone at the bottom of the screen.
    const text = isIpad()
      ? ' Tap Share (top right), then “Add to Home Screen”.'
      : ' Tap Share (bottom of the screen), then “Add to Home Screen”.';
    const start = () => showBanner({ text, icon: SHARE_ICON });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
}

window.addEventListener('appinstalled', () => document.querySelector('.pwa-banner')?.remove());

/* ---------- "You're offline" notice ----------
   Pages the app has cached still open without a connection, but their
   live parish data can't load — say so instead of showing empty lists. */
const OFFLINE_STYLE = `
  .pwa-offline {
    position: fixed; bottom: calc(0.75rem + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
    z-index: 80; max-width: calc(100% - 1.5rem); text-align: center;
    background: #1e2a4a; color: #ffffff; border-radius: 999px; padding: 0.45rem 0.95rem;
    font-size: 0.75rem; font-weight: 600; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
  }
  :root[data-theme="dark"] .pwa-offline { background: #8b8fc7; color: #0f1420; }
`;

function paintOffline() {
  const existing = document.querySelector('.pwa-offline');
  if (navigator.onLine) { existing?.remove(); return; }
  if (existing || !document.body) return;
  document.querySelector('.pwa-banner')?.remove();
  if (!document.getElementById('pwa-offline-style')) {
    const st = document.createElement('style');
    st.id = 'pwa-offline-style';
    st.textContent = OFFLINE_STYLE;
    document.head.appendChild(st);
  }
  const note = document.createElement('div');
  note.className = 'pwa-offline';
  note.setAttribute('role', 'status');
  note.textContent = 'You’re offline — showing what’s saved on this device';
  document.body.appendChild(note);
}

window.addEventListener('offline', paintOffline);
window.addEventListener('online', paintOffline);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintOffline); else paintOffline();
