/* ============================================
   SacraDigit — Motion behaviours
   The JavaScript half of the motion guide
   (motion-guide.html); the styles are motion.css.
   Imported by ui-prefs.js, so it runs on every
   portal page, the homepage and the sign-in page.

     splash         once per browser session, on the first
                    page opened (homepage, sign-in or portal)
     progress bar   thin gold bar when a link is clicked;
                    it runs most of the way at once and the
                    next page finishes it, so it always
                    crosses the whole screen
     page parts     sidebar + top bar stay put while only
                    <main> slides (cross-page View Transitions)
     sidebar glide  the gold highlight glides from the old
                    page's link to the new one
     skeletons      "Loading…" placeholders become shimmer
                    rows until the real content arrives
     busy buttons   a spinner on a button the page disabled
                    right after it was clicked (saving…),
                    then a green check when it worked
     step forms     remembers Next / Back so the panel
                    slides the right way
     count-up       dashboard numbers count up the first
                    time they're filled in
     status pop     a request's status chip pops once when
                    it changed since you last saw it
     live rows      new rows from real-time updates slide in
                    gold (trackArrivals / isFresh)
     hand-off       short portal loader after signing in
   Everything is skipped when the device asks for
   reduced motion, "Reduce motion" is on, or
   Accessibility mode is on.
   ============================================ */

const root = document.documentElement;
const MOTION_KEY = 'sacradigit_motion';
try { if (localStorage.getItem(MOTION_KEY) === 'reduce') root.dataset.motion = 'reduce'; } catch { /* private mode */ }

export const motionReduced = () =>
  root.dataset.a11y === 'on' || root.dataset.motion === 'reduce'
  || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const session = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  drop(k) { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

/** Runs `fn` once the page is showing (after the sign-in check, if there is one). */
function whenShown(fn) {
  if (!root.classList.contains('auth-pending')) { requestAnimationFrame(fn); return; }
  const watch = new MutationObserver(() => {
    if (!root.classList.contains('auth-pending')) { watch.disconnect(); clearTimeout(cap); requestAnimationFrame(fn); }
  });
  watch.observe(root, { attributes: true, attributeFilter: ['class'] });
  const cap = setTimeout(() => { watch.disconnect(); fn(); }, 9000);
}

/** A same-site link to another page that this tab will follow. */
function pageLink(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target.closest?.('a[href]');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null; // same page / #anchor
  return a;
}

/* ---------- Splash (first page of the visit) ----------
   Once per browser session, on whichever page opens first:
   portal pages (html.auth-pending) close it when the sign-in check
   passes; the homepage and sign-in page (html.sd-splash-pending, set
   in their <head> so they don't flash first) close it once loaded. */
const SPLASH_KEY = 'sdSplashSeen';
const STAGES = ['Checking your sign-in…', 'Loading parish info…', 'Opening your portal…', 'Almost ready…'];
const PUBLIC_STAGES = ['Preparing your parish…', 'Loading parish info…', 'Gathering this week’s Masses…', 'Almost ready…'];
const SPLASH_MIN_MS = 1400; // long enough for the bar and status to read

/** Runs `fn` once the page and its images have loaded (capped, so a slow image never holds it). */
function whenLoaded(fn) {
  if (document.readyState === 'complete') { requestAnimationFrame(fn); return; }
  const done = () => { clearTimeout(cap); window.removeEventListener('load', done); fn(); };
  window.addEventListener('load', done);
  const cap = setTimeout(done, 4000);
}

function splash() {
  const gated = root.classList.contains('auth-pending');
  const held = root.classList.contains('sd-splash-pending');
  const release = () => root.classList.remove('sd-splash-pending');
  let seen = false;
  try { seen = sessionStorage.getItem(SPLASH_KEY) === '1'; } catch { seen = true; }
  if (seen || motionReduced() || !(gated || held)) { release(); return; }
  try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* private mode */ }
  const stages = gated ? STAGES : PUBLIC_STAGES;

  const logo = new URL('./sacradigit-images/scaradigit-logo.png', import.meta.url).href;
  const el = document.createElement('div');
  el.id = 'sd-splash';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="sd-splash-motes" aria-hidden="true">${Array.from({ length: 12 }, (_, i) =>
      `<span style="left:${5 + i * 8}%;animation-delay:${i * 0.5}s"></span>`).join('')}</div>
    <div class="sd-splash-inner">
      <div class="sd-splash-halo" aria-hidden="true">
        <div class="sd-splash-ring"></div><div class="sd-splash-ring is-soft"></div>
        <div class="sd-splash-core"><img class="sd-splash-logo" src="${logo}" alt="" /></div>
      </div>
      <p class="sd-splash-name">SacraDigit</p>
      <p class="sd-splash-parish">Our Lady of Fatima Parish</p>
      <div class="sd-splash-bar" aria-hidden="true"><span></span></div>
      <p class="sd-splash-status">${stages[0]}</p>
    </div>`;
  root.appendChild(el); // on <html>: <body> stays hidden until sign-in is confirmed
  release(); // the splash covers the page now

  const bar = el.querySelector('.sd-splash-bar span');
  const status = el.querySelector('.sd-splash-status');
  let stage = 0;
  const advance = () => {
    stage = Math.min(stage + 1, stages.length - 1);
    status.textContent = stages[stage];
    bar.style.transform = `scaleX(${0.3 + stage * 0.2})`;
  };
  requestAnimationFrame(() => { bar.style.transform = 'scaleX(0.3)'; });
  const timer = setInterval(advance, 650);

  const shownAt = performance.now();
  const finish = () => {
    // Long enough to read, never long enough to be in the way.
    setTimeout(() => {
      clearInterval(timer);
      bar.style.transform = 'scaleX(1)';
      status.textContent = 'Welcome!';
      setTimeout(() => {
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 320);
      }, 350);
    }, Math.max(0, SPLASH_MIN_MS - (performance.now() - shownAt)));
  };
  (gated ? whenShown : whenLoaded)(finish);
}

/* ---------- Top progress bar on page links ----------
   Pages here open in a few hundred milliseconds, so the bar jumps most of
   the way at once, then creeps. The next page picks it up where it was and
   runs it to the end once it's showing (<body> is hidden during the
   sign-in check, so the bar lives on <html>). */
const NAV_KEY = 'sdNavProgress';

function progressBar() {
  const bar = document.createElement('div');
  bar.id = 'sd-progress';
  bar.setAttribute('aria-hidden', 'true');
  root.appendChild(bar);

  let anim = null;
  let cancelTimer;
  const scaleNow = () => {
    const m = getComputedStyle(bar).transform;
    return m && m !== 'none' ? new DOMMatrixReadOnly(m).a : 0;
  };
  const play = (frames, options) => {
    anim?.cancel();
    anim = bar.animate(frames, { fill: 'forwards', ...options });
    return anim;
  };
  const hide = () => {
    bar.classList.remove('is-on'); // opacity fades out (motion.css)
    clearTimeout(cancelTimer);
  };
  const finish = (from) => {
    bar.classList.add('is-on');
    play([{ transform: `scaleX(${from})` }, { transform: 'scaleX(1)' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' })
      .finished.then(hide, () => {});
  };
  const start = () => {
    bar.classList.add('is-on');
    play([
      { transform: 'scaleX(0)', easing: 'cubic-bezier(.22,1,.36,1)' },
      { transform: 'scaleX(0.72)', offset: 0.06, easing: 'cubic-bezier(.1,.6,.3,1)' },
      { transform: 'scaleX(0.94)' },
    ], { duration: 9000 });
    clearTimeout(cancelTimer);
    cancelTimer = setTimeout(() => { anim?.cancel(); hide(); }, 12000); // the navigation never happened
  };

  // Arriving from a link click on the previous page: carry on from there.
  const carried = session.get(NAV_KEY);
  session.drop(NAV_KEY);
  if (carried && Date.now() - carried.at < 10000 && !document.getElementById('sd-splash')) {
    bar.classList.add('is-on');
    bar.style.transform = `scaleX(${carried.scale})`;
    play([{ transform: `scaleX(${carried.scale})` }, { transform: `scaleX(${Math.min(0.97, carried.scale + 0.06)})` }], { duration: 1500, easing: 'ease-out' });
    whenShown(() => finish(scaleNow()));
  }

  document.addEventListener('click', (e) => {
    if (!pageLink(e)) return;
    start();
  });
  // Leaving: hand the bar's position to the next page.
  window.addEventListener('pagehide', () => {
    if (bar.classList.contains('is-on')) session.set(NAV_KEY, { at: Date.now(), scale: scaleNow() });
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { anim?.cancel(); hide(); } }); // back/forward cache
}

/* ---------- Page parts: sidebar and top bar stay put, only <main> moves ----------
   Names are given only while a cross-page View Transition runs, so they
   never change how the page stacks the rest of the time. */
function namedParts() {
  const main = document.querySelector('main');
  const header = main?.parentElement?.querySelector(':scope > header');
  return [[document.getElementById('sidebar'), 'sd-sidebar'], [header, 'sd-topbar'], [main, 'sd-main']]
    .filter(([el]) => el && el.getClientRects().length);
}
function pageTransitions() {
  const name = (on) => namedParts().forEach(([el, n]) => { el.style.viewTransitionName = on ? n : ''; });
  window.addEventListener('pageswap', (e) => { if (e.viewTransition) name(true); });
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) return;
    if (motionReduced()) { e.viewTransition.skipTransition(); return; }
    name(true);
    e.viewTransition.finished.finally(() => name(false));
  });
  window.addEventListener('pageshow', () => name(false)); // back/forward cache keeps old names
}

/* ---------- Sidebar: the gold highlight glides to the new page ---------- */
const PILL_KEY = 'sdNavFrom';

function sidebarGlide() {
  document.addEventListener('click', (e) => {
    const a = pageLink(e);
    if (!a || !a.classList.contains('sidebar-link') || a.classList.contains('active')) return;
    const from = document.querySelector('#sidebar .sidebar-link.active');
    if (!from) return;
    const r = from.getBoundingClientRect();
    session.set(PILL_KEY, { at: Date.now(), top: r.top, path: location.pathname.split('/').slice(0, -1).join('/') });
  });

  const from = session.get(PILL_KEY);
  session.drop(PILL_KEY);
  if (!from || Date.now() - from.at > 10000) return;
  if (from.path !== location.pathname.split('/').slice(0, -1).join('/')) return; // another portal's sidebar
  whenShown(() => {
    const to = document.querySelector('#sidebar .sidebar-link.active');
    if (!to) return;
    const r = to.getBoundingClientRect();
    if (!r.width || r.right <= 0 || Math.abs(r.top - from.top) < 2) return; // drawer closed, or no move
    const pill = document.createElement('div');
    pill.id = 'sd-nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    Object.assign(pill.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: `translateY(${from.top - r.top}px)` });
    root.appendChild(pill);
    to.classList.add('sd-pill-target');
    requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transform = 'none'; }));
    setTimeout(() => {
      to.classList.remove('sd-pill-target'); // the link's own highlight fades back in under the pill
      pill.classList.add('is-leaving');
      setTimeout(() => pill.remove(), 200);
    }, 300);
  });
}

/* ---------- Skeletons in place of "Loading…" ----------
   Tables, lists and panels start with a "Loading…" line; it becomes shimmer
   rows until the page writes the real content (which replaces them). */
const LOADING = /^(Loading|Counting)\b.*(…|\.\.\.)$/;
const skRow = (flat) => `<div class="sk-row${flat ? ' is-flat' : ''}"><span class="sk sk-circle"></span><span class="sk-lines"><span class="sk sk-line w-60"></span><span class="sk sk-line w-40"></span></span></div>`;
const liveNote = (text) => `<span class="sr-only-live" role="status">${text.replace(/[<&]/g, '')}</span>`;

function busyUntilFilled(container) {
  container.setAttribute('aria-busy', 'true');
  const watch = new MutationObserver(() => {
    if (container.querySelector('.sk')) return; // still our skeleton
    watch.disconnect();
    container.removeAttribute('aria-busy');
    container.setAttribute('data-sd-filled', '');
    setTimeout(() => container.removeAttribute('data-sd-filled'), 900); // later refreshes don't re-animate
  });
  watch.observe(container, { childList: true });
}

function skeletons() {
  const candidates = document.querySelectorAll('main td[colspan], main li, main p, main span.stat-sub');
  candidates.forEach((el) => {
    if (el.children.length || !el.isConnected) return;
    const text = el.textContent.trim();
    if (!LOADING.test(text)) return;
    const parent = el.parentElement;

    // A table's only row: three shimmer rows across the whole table.
    if (el.tagName === 'TD' && parent.parentElement?.tagName === 'TBODY' && parent.parentElement.children.length === 1 && parent.children.length === 1) {
      const tbody = parent.parentElement;
      const cols = el.colSpan;
      tbody.innerHTML = [0, 1, 2].map(i => `<tr class="sd-sk-tr"${i ? ' aria-hidden="true"' : ''}><td colspan="${cols}" style="padding:0 1rem">${i ? '' : liveNote(text)}${skRow(true)}</td></tr>`).join('');
      busyUntilFilled(tbody);
      return;
    }
    // A list's only item, or a panel's only line: shimmer rows in its place.
    if ((el.tagName === 'LI' || el.tagName === 'P') && parent.children.length === 1 && parent.id) {
      const item = el.tagName === 'LI' ? (html) => `<li class="sd-sk-li" style="list-style:none">${html}</li>` : (html) => html;
      parent.innerHTML = [0, 1, 2].map(i => item((i ? '' : liveNote(text)) + skRow(true))).join('');
      busyUntilFilled(parent);
      return;
    }
    // A line of text filled in later (e.g. a stat's subtitle): shimmer the line itself.
    el.classList.add('sk-text');
    el.setAttribute('aria-busy', 'true');
    const watch = new MutationObserver(() => {
      if (LOADING.test(el.textContent.trim())) return;
      el.classList.remove('sk-text'); el.removeAttribute('aria-busy'); watch.disconnect();
    });
    watch.observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { watch.disconnect(); el.classList.remove('sk-text'); el.removeAttribute('aria-busy'); }, 20000);
  });
}

/* ---------- Busy → success buttons ----------
   Pages already disable a button while they save. A button disabled within a
   moment of being clicked gets a spinner until it's enabled again; if a
   success message shows as it finishes, it turns green with a check. */
function busyButtons() {
  let last = { btn: null, at: 0 };
  let justFreed = { btn: null, at: 0 };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) last = { btn, at: performance.now() };
  }, true);
  const clear = (btn) => { btn.classList.remove('sd-busy'); btn.removeAttribute('aria-busy'); clearTimeout(btn._sdBusyTimer); };
  const done = (btn) => {
    if (!btn?.isConnected || btn.disabled) return;
    btn.classList.add('sd-done');
    setTimeout(() => btn.classList.remove('sd-done'), 1600);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      const btn = m.target;
      if (btn.tagName !== 'BUTTON') continue;
      if (!btn.disabled) {
        if (btn.classList.contains('sd-busy')) { clear(btn); justFreed = { btn, at: performance.now() }; }
        continue;
      }
      if (btn !== last.btn || performance.now() - last.at > 1500) continue;
      if (btn.closest('.ui-prefs, .mstep-bar, .pager, .col-cell')) continue;
      btn.classList.add('sd-busy');
      btn.setAttribute('aria-busy', 'true');
      btn._sdBusyTimer = setTimeout(() => clear(btn), 20000); // a button that stays disabled on purpose
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  // toast.js / the portal shells announce every toast.
  document.addEventListener('sacradigit:toast', (e) => {
    if (e.detail?.isError) return;
    const near = (t) => performance.now() - t.at < 1500;
    if (near(justFreed)) done(justFreed.btn);
    else setTimeout(() => { if (near(justFreed)) done(justFreed.btn); }, 300); // toast shown just before re-enabling
  });
}

/* ---------- Step forms: which way to slide ---------- */
function stepDirection() {
  document.addEventListener('click', (e) => {
    const back = e.target.closest('.mstep-back, .mi-back, [data-step-back]');
    const next = e.target.closest('.mstep-next, .mi-next, [data-step-next]');
    const dot = e.target.closest('.mstep-dot');
    if (!back && !next && !dot) return;
    let dir = back ? 'back' : 'next';
    if (dot) {
      const dots = [...dot.parentElement.parentElement.querySelectorAll('.mstep-dot')];
      const current = dots.findIndex(d => d.classList.contains('is-current'));
      dir = dots.indexOf(dot) < current ? 'back' : 'next';
    }
    root.dataset.stepDir = dir;
    clearTimeout(stepDirection.t);
    stepDirection.t = setTimeout(() => { delete root.dataset.stepDir; }, 600);
  }, true);
}

/* ---------- Count-up numbers (first fill only) ---------- */
const COUNT_SELECTOR = '.stat-value, .fj-stat-value, .donation-stat-value, .col-stat-value, .kpi-value, [data-countup]';
const NUMBER = /^(₱\s?)?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;

function countUp(el) {
  const text = el.textContent.trim();
  if (!NUMBER.test(text)) return false;
  const prefix = text.startsWith('₱') ? text.match(/^₱\s?/)[0] : '';
  const target = Number(text.slice(prefix.length).replace(/,/g, ''));
  if (!(target > 0)) return false;
  const decimals = (text.split('.')[1] || '').length;
  const fmt = (v) => prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const start = performance.now();
  const dur = 800;
  let written = null;
  el._sdCounting = true;
  const tick = (now) => {
    // The page wrote a newer value meanwhile: stop and keep theirs.
    if (written !== null && el.textContent !== written) { el._sdCounting = false; return; }
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    written = fmt(t < 1 ? (decimals ? target * eased : Math.round(target * eased)) : target);
    el.textContent = written;
    if (t < 1) requestAnimationFrame(tick);
    else el._sdCounting = false;
  };
  requestAnimationFrame(tick);
  // Animation frames pause in background tabs: always end on the real number.
  setTimeout(() => {
    if (el._sdCounting && el.textContent === written) { el.textContent = fmt(target); el._sdCounting = false; }
  }, dur + 150);
  return true;
}

function countUps() {
  const els = [...document.querySelectorAll(COUNT_SELECTOR)];
  if (!els.length) return;
  const watcher = new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target.closest(COUNT_SELECTOR) : m.target.parentElement?.closest(COUNT_SELECTOR);
      if (!el || el._sdCounted || el._sdCounting) continue;
      el._sdCounted = countUp(el); // a "0" or "–" placeholder doesn't use up the count-up
    }
  });
  const stopAll = setTimeout(() => watcher.disconnect(), 15000); // only the first load counts up
  els.forEach(el => {
    // Already filled before we got here: count it up now.
    if (NUMBER.test(el.textContent.trim())) el._sdCounted = countUp(el);
    watcher.observe(el, { childList: true, characterData: true, subtree: true });
  });
  window.addEventListener('pagehide', () => clearTimeout(stopAll), { once: true });
}

/* ---------- Status pop ----------
   Status chips carry data-sd-status="<id>:<status>". The last status seen on
   this device is remembered; a chip whose status changed since then pops once. */
const STATUS_KEY = 'sdSeenStatus';

function statusPops() {
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; } catch { /* private mode */ }
  let saveTimer;
  const check = (el) => {
    const [id, status] = el.dataset.sdStatus.split(':');
    if (seen[id] && seen[id] !== status) el.classList.add('sd-status-changed');
    if (seen[id] !== status) {
      delete seen[id]; seen[id] = status; // newest last, so trimming drops the oldest
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const keys = Object.keys(seen);
        if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete seen[k]);
        try { localStorage.setItem(STATUS_KEY, JSON.stringify(seen)); } catch { /* full or private */ }
      }, 2500); // after the pop has played on this visit
    }
  };
  document.querySelectorAll('[data-sd-status]').forEach(check);
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.dataset?.sdStatus) check(n);
      n.querySelectorAll?.('[data-sd-status]').forEach(check);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/* ---------- Live rows ----------
   Pages with real-time lists call trackArrivals() on every update, and mark a
   row with .sd-row-new while isFresh() says it just arrived. The first full
   load only seeds the list, so nothing flashes when the page opens. */
const arrivals = new Map();

export function trackArrivals(key, ids, synced = true) {
  let s = arrivals.get(key);
  if (!s) { s = { seen: new Set(), at: new Map(), ready: false }; arrivals.set(key, s); }
  const now = performance.now();
  ids.forEach((id) => {
    if (s.seen.has(id)) return;
    s.seen.add(id);
    if (s.ready && !motionReduced()) s.at.set(id, now);
  });
  if (synced) s.ready = true;
}
export const isFresh = (key, id) => {
  const t = arrivals.get(key)?.at.get(id);
  return t !== undefined && performance.now() - t < 2500;
};

/* ---------- Portal hand-off (login.js, right before it opens the portal) ---------- */
const PORTALS = [
  { folder: 'Sacradigit', code: 'AD', name: 'Admin', color: '#8a3040' },
  { folder: 'user', code: 'US', name: 'Parishioner', color: '#5b5fa8' },
  { folder: 'Sacraitech', code: 'IT', name: 'ITech', color: '#0f8a7a' },
  { folder: 'Sacramedia', code: 'MD', name: 'Media', color: '#c9a84c' },
];

export function portalHandoff(url) {
  if (motionReduced() || document.getElementById('sd-handoff')) return;
  const path = new URL(url, location.href).pathname;
  const target = PORTALS.find(p => path.includes(`/${p.folder}/`));
  if (!target) return;
  const el = document.createElement('div');
  el.id = 'sd-handoff';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="sd-handoff-inner">
      <div class="sd-handoff-icons" aria-hidden="true">${PORTALS.map(p =>
        `<span class="${p === target ? 'is-target' : ''}" style="background:${p.color}">${p.code}</span>`).join('')}</div>
      <p class="sd-handoff-text">Opening ${target.name} portal…</p>
    </div>`;
  root.appendChild(el);
  window.addEventListener('pageshow', (e) => { if (e.persisted) el.remove(); }, { once: true });
}

/* ---------- Pause endless animations when the tab is hidden ---------- */
function pauseWhenHidden() {
  document.addEventListener('visibilitychange', () => {
    document.getAnimations?.().forEach(a => { if (a.effect?.getTiming?.().iterations === Infinity) document.hidden ? a.pause() : a.play(); });
  });
}

/* ---------- Theme switch crossfade (used by ui-prefs.js) ---------- */
export function withViewTransition(change) {
  if (document.startViewTransition && !motionReduced()) document.startViewTransition(change);
  else change();
}

/* ---------- Reduce motion preference (ui-prefs.js / My Settings) ---------- */
export const reduceMotionOn = () => root.dataset.motion === 'reduce';
export function setReduceMotion(on) {
  if (on) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
  try { localStorage.setItem(MOTION_KEY, on ? 'reduce' : 'full'); } catch { /* private mode */ }
  document.dispatchEvent(new CustomEvent('sacradigit:motion', { detail: on }));
}

/* ---------- Start ---------- */
function start() {
  if (motionReduced()) return;
  progressBar();
  sidebarGlide();
  skeletons();
  busyButtons();
  stepDirection();
  countUps();
  statusPops();
  pauseWhenHidden();
}

splash(); // as early as possible: <html> exists before the body is parsed
pageTransitions(); // before the first frame, so the new page's parts get their names in time
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
