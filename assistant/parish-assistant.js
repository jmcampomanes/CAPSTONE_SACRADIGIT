/* ============================================
   SacraDigit — Parish Assistant (chat window)
   A floating "Ask" button on every parishioner
   page that opens a small chat. Answers come from
   OpenRouter (see server/ai-chat), grounded with
   the same live data the portal pages show (Mass
   schedule, special Masses, closures, livestream,
   and the parishioner's own requests) plus the
   static parish knowledge base — see buildContext()
   below and server/ai-chat/server.js's system prompt.

   Uses a real AI service (OpenRouter). The chat is
   kept for this tab only.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUser } from '../auth.js';
import { currentLang } from '../ui-prefs.js';
import { mergeWeeklySchedule } from '../weekly-mass-schedule.js';
import { closuresFrom } from '../service-schedule.js';
import { askAssistant } from './ai-chat-client.js';
import { FACILITIES, FUNDS, REQUIREMENTS, CERTIFICATES, OFFERING_PER_INTENTION, PORTAL_DIRECTORY } from './assistant-knowledge.js';
import { loadParishContact } from '../parish-info.js';

const toISO = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const STARTER_CHIPS = {
  en: ['What time is Mass on Sunday?', 'What do I need for a baptism?', 'How do I get a certificate?', 'Status of my requests', 'Show all pages (directory)'],
  fil: ['Anong oras ang Misa sa Linggo?', 'Ano ang kailangan sa binyag?', 'Paano kumuha ng certificate?', 'Status ng mga request ko', 'Ipakita lahat ng page (directory)'],
};

/* ---------- portal directory (answered here, no AI call needed) ---------- */

// "directory", "what pages are there?", "lahat ng tab", "anong mga page"…
const DIRECTORY_ASK = /\b(directory|direktoryo|site ?map|all (the )?(pages|tabs)|list of (pages|tabs)|(what|which) (pages|tabs)|lahat ng (page|tab|pahina)|(anong|ano ang) mga (page|tab|pahina))\b/i;

const currentPage = () => window.location.pathname.split('/').pop() || 'user-dashboard.html';

// Every name a page goes by (English, Filipino, sidebar wording) → its file.
const PAGE_BY_NAME = new Map();
PORTAL_DIRECTORY.forEach(({ pages }) => pages.forEach(p => {
  [p.en, p.fil, ...(p.also || [])].forEach(name => PAGE_BY_NAME.set(name, p.page));
}));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAGE_NAME_RE = new RegExp(
  `(?<![\\w-])(${[...PAGE_BY_NAME.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![\\w-])`,
  'g',
);

/* ---------- live data (fetched on demand, reused for a minute) ---------- */

const CACHE_MS = 60 * 1000;
const cache = new Map();
function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = load().catch(err => { cache.delete(key); throw err; });
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function listAll(model, options = {}) {
  const items = [];
  let nextToken;
  do {
    const res = await model.list({ ...options, limit: 1000, nextToken });
    if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
    items.push(...res.data);
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

// Admin/staff can open the parishioner portal and can read everyone's
// requests — "my requests" must only ever mean the signed-in person's own.
const mine = (records) => {
  const sub = currentUser()?.sub;
  return sub ? records.filter(r => (r.owner || '').split('::')[0] === sub) : [];
};

const data = {
  weekly: () => cached('weekly', async () => mergeWeeklySchedule(await listAll(client.models.WeeklyMassSchedule))),
  masses: () => cached('masses', () => listAll(client.models.Mass, { filter: { date: { ge: toISO(new Date()) } } })),
  closures: () => cached('closures', async () => closuresFrom(await listAll(client.models.SpecialSchedule))),
  livestream: () => cached('livestream', async () => {
    const items = await listAll(client.models.LivestreamStatus);
    return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] || null;
  }),
  myCertificates: () => cached('certs', async () => mine(await listAll(client.models.CertificateRequest))),
  myServices: () => cached('services', async () => mine(await listAll(client.models.Blessing))),
  contact: () => cached('contact', () => loadParishContact(client)),
  announcements: () => cached('announcements', () => listAll(client.models.Announcement, { filter: { published: { eq: true } } })),
};

/* ------------------------------------------
   Grounding facts sent to the AI with every
   message (see server/ai-chat/server.js's
   system prompt) — the same live data and
   static knowledge base the portal pages use,
   so the assistant never disagrees with the
   rest of the site. Trimmed to keep the
   request small.
   ------------------------------------------ */
async function buildContext() {
  const today = new Date();
  const todayISO = toISO(today);
  const in14 = toISO(addDays(today, 14));
  const in60 = toISO(addDays(today, 60));
  const signedIn = !!currentUser();

  const [weekly, masses, closures, livestream, contact, announcements, myCertificates, myServices] = await Promise.all([
    data.weekly(), data.masses(), data.closures(), data.livestream(), data.contact(), data.announcements(),
    signedIn ? data.myCertificates() : [], signedIn ? data.myServices() : [],
  ]);

  return {
    today: todayISO,
    weeklyMassSchedule: weekly.map(d => ({ day: d.dayLabel, times: d.times, type: d.massType, label: d.label })),
    upcomingSpecialMasses: masses
      .filter(m => m.isSpecial && m.date >= todayISO && m.date <= in14)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map(m => ({ date: m.date, time: m.time, title: m.title || m.note || '' })),
    closures: closures.filter(c => c.end >= todayISO && c.start <= in60),
    livestream: livestream?.isLive ? { isLive: true, platform: livestream.platform, url: livestream.url } : { isLive: false },
    parishContact: contact,
    recentAnnouncements: announcements.slice(0, 5).map(a => ({ title: a.title, date: a.createdAt })),
    serviceRequirements: REQUIREMENTS,
    certificates: CERTIFICATES,
    facilities: FACILITIES,
    funds: FUNDS,
    offeringPerMassIntention: OFFERING_PER_INTENTION,
    // All pages of this portal, so the assistant can say where to go. Name pages exactly as listed.
    portalDirectory: PORTAL_DIRECTORY.map(({ section, pages }) => ({
      section: section.en,
      pages: pages.map(p => ({ name: p.en, filipinoName: p.fil, does: p.what.en })),
    })),
    currentPage: PORTAL_DIRECTORY.flatMap(s => s.pages).find(p => p.page === currentPage())?.en || null,
    signedIn,
    myRequests: signedIn ? {
      certificates: myCertificates.slice(0, 5).map(r => ({ type: r.certificateType, status: r.status, rejectionReason: r.rejectionReason || null })),
      services: myServices.slice(0, 5).map(r => ({ type: r.type, status: r.status, date: r.date || null, time: r.time || null })),
    } : null,
  };
}

/* ---------- wording for the window itself ---------- */

const UI = {
  en: {
    open: 'Ask the Parish Assistant', title: 'Parish Assistant', sub: 'Answers from SacraDigit’s parish info',
    hello: 'Hello! 👋 I can help with Mass times, services and their requirements, certificates, your requests, and finding your way around the portal. What would you like to know?',
    dirIntro: 'Here’s every page in the portal. Tap one to open it:', dirHere: 'you are here',
    placeholder: 'Ask about Mass, baptism, certificates…', send: 'Send', close: 'Close',
    note: 'Automated answers. For pastoral concerns, please talk to a priest or the parish office.',
  },
  fil: {
    open: 'Magtanong sa Parish Assistant', title: 'Parish Assistant', sub: 'Sagot mula sa impormasyon ng parokya',
    hello: 'Magandang araw! 👋 Matutulungan kita sa oras ng Misa, mga serbisyo at kailangan dito, certificate, iyong mga request, at paghahanap ng page sa portal. Ano ang gusto mong malaman?',
    dirIntro: 'Narito ang lahat ng page sa portal. I-tap para buksan:', dirHere: 'narito ka',
    placeholder: 'Magtanong tungkol sa Misa, binyag, certificate…', send: 'Ipadala', close: 'Isara',
    note: 'Awtomatikong sagot. Para sa mga pastoral na usapin, kausapin ang pari o ang parish office.',
  },
};

const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12c0 4.4-4 8-9 8a9.9 9.9 0 01-4.3-.9L3 20l1.4-3.7A7.4 7.4 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const STYLE = `
  body.has-parish-assistant .pwa-banner { bottom: calc(5.25rem + env(safe-area-inset-bottom)); }
  body.has-parish-assistant .pwa-offline { bottom: calc(5.25rem + env(safe-area-inset-bottom)); }

  .pa-launcher {
    position: fixed; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom)); z-index: 65;
    width: 3.5rem; height: 3.5rem; border-radius: 999px; border: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: #1e2a4a; color: #ffffff; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
    transition: transform 0.15s ease, background-color 0.15s ease;
  }
  .pa-launcher:hover { background: #2a3963; transform: translateY(-2px); }
  .pa-launcher svg { width: 1.6rem; height: 1.6rem; }
  .pa-launcher-dot {
    position: absolute; top: 0.2rem; right: 0.2rem; width: 0.8rem; height: 0.8rem; border-radius: 999px;
    background: #c9a84c; border: 2px solid #ffffff;
  }
  .pa-open .pa-launcher { display: none; }

  .pa-panel {
    position: fixed; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom)); z-index: 90;
    width: 24rem; height: min(38rem, calc(100vh - 2rem)); display: none; flex-direction: column;
    background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 1rem; overflow: hidden;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25); font-size: 0.875rem;
  }
  .pa-open .pa-panel { display: flex; }
  @media (max-width: 640px) {
    .pa-panel { inset: 0; width: auto; height: auto; border-radius: 0; border: 0; padding-bottom: env(safe-area-inset-bottom); }
  }

  .pa-head { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: #1e2a4a; color: #ffffff; }
  .pa-head-icon { width: 2.25rem; height: 2.25rem; border-radius: 999px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pa-head-icon svg { width: 1.25rem; height: 1.25rem; }
  .pa-head-text { flex: 1; min-width: 0; }
  .pa-head-text strong { display: block; font-size: 0.95rem; }
  .pa-head-text span { font-size: 0.75rem; opacity: 0.75; }
  .pa-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .pa-close:hover { background: rgba(255,255,255,0.14); }
  .pa-close svg { width: 1.2rem; height: 1.2rem; }

  .pa-log { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; background: #f7f8fb; overscroll-behavior: contain; }
  .pa-msg { max-width: 88%; line-height: 1.5; padding: 0.625rem 0.875rem; border-radius: 1rem; word-wrap: break-word; }
  .pa-msg p { margin: 0 0 0.4rem; } .pa-msg p:last-child { margin-bottom: 0; }
  .pa-bot { align-self: flex-start; background: #ffffff; border: 1px solid #eceef3; border-bottom-left-radius: 0.3rem; }
  .pa-user { align-self: flex-end; background: #1e2a4a; color: #ffffff; border-bottom-right-radius: 0.3rem; white-space: pre-wrap; }
  .pa-list { margin: 0.25rem 0 0.5rem; padding-left: 1.1rem; } .pa-list li { margin: 0.2rem 0; }
  ol.pa-list { list-style: decimal; } ul.pa-list { list-style: disc; }
  .pa-pill { display: inline-block; font-size: 0.75rem; font-weight: 600; padding: 0.05rem 0.5rem; border-radius: 999px; background: #eef0f8; color: #3f4577; margin: 0.1rem 0; white-space: nowrap; }
  .pa-muted { color: #6b7280; font-size: 0.8rem; }
  .pa-understood { font-style: italic; margin-bottom: 0.35rem !important; }
  .pa-link { display: inline-block; margin-top: 0.35rem; font-weight: 600; color: #4b50a0; text-decoration: none; }
  .pa-link:hover, .pa-link-inline:hover { text-decoration: underline; }
  .pa-link-inline { color: #4b50a0; font-weight: 600; }
  .pa-typing { display: inline-flex; gap: 0.25rem; } .pa-typing i { width: 0.4rem; height: 0.4rem; border-radius: 999px; background: #9ca3af; animation: pa-bounce 1s infinite; }
  .pa-typing i:nth-child(2) { animation-delay: 0.15s; } .pa-typing i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes pa-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .pa-typing i { animation: none; } .pa-launcher { transition: none; } }

  .pa-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; align-self: flex-start; max-width: 100%; }
  .pa-chip { font: inherit; font-size: 0.78rem; font-weight: 600; color: #3f4577; background: #ffffff; border: 1px solid #cfd2ea; border-radius: 999px; padding: 0.35rem 0.75rem; cursor: pointer; text-align: left; }
  .pa-chip:hover { background: #eef0f8; }

  .pa-form { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid #eceef3; background: #ffffff; }
  .pa-input { flex: 1; min-width: 0; font: inherit; font-size: 16px; /* 16px stops iPhone zooming in */ padding: 0.6rem 0.875rem; border: 1px solid #d1d5db; border-radius: 999px; outline: none; background: #ffffff; color: inherit; }
  .pa-input:focus { border-color: #8b8fc7; box-shadow: 0 0 0 3px rgba(139,143,199,0.25); }
  .pa-send { width: 2.6rem; height: 2.6rem; flex-shrink: 0; border: 0; border-radius: 999px; background: #1e2a4a; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .pa-send:disabled { opacity: 0.45; cursor: default; }
  .pa-send svg { width: 1.15rem; height: 1.15rem; }
  .pa-note { margin: 0; padding: 0 0.875rem 0.625rem; font-size: 0.7rem; color: #9ca3af; background: #ffffff; text-align: center; }

  :root[data-theme="dark"] .pa-panel { background: #1a2131; color: #e5e8ef; border-color: #2c3547; }
  :root[data-theme="dark"] .pa-log { background: #121826; }
  :root[data-theme="dark"] .pa-bot { background: #1f2738; border-color: #2c3547; }
  :root[data-theme="dark"] .pa-user, :root[data-theme="dark"] .pa-send, :root[data-theme="dark"] .pa-launcher { background: #8b8fc7; color: #0f1420; }
  :root[data-theme="dark"] .pa-head { background: #242c3e; }
  :root[data-theme="dark"] .pa-pill { background: #2c3547; color: #d7d9f0; }
  :root[data-theme="dark"] .pa-muted, :root[data-theme="dark"] .pa-note { color: #9aa3b5; }
  :root[data-theme="dark"] .pa-link, :root[data-theme="dark"] .pa-link-inline { color: #b3b6e6; }
  :root[data-theme="dark"] .pa-chip { background: #1f2738; color: #d7d9f0; border-color: #3a4459; }
  :root[data-theme="dark"] .pa-form, :root[data-theme="dark"] .pa-note { background: #1a2131; border-color: #2c3547; }
  :root[data-theme="dark"] .pa-input { border-color: #3a4459; background: #121826; color: #e5e8ef; }
  :root[data-theme="dark"] .pa-input::placeholder { color: #7d8699; }
  :root[data-theme="dark"] .pa-launcher-dot { border-color: #0f1420; }
`;

/* ---------- the window ---------- */

export function initParishAssistant() {
  if (document.querySelector('.pa-root')) return;
  let lang = currentLang(); // follows the language menu (see 'sacradigit:lang' below)
  let ui = UI[lang];

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'pa-root';
  root.setAttribute('data-no-translate', ''); // the assistant writes its own English/Filipino
  root.innerHTML = `
    <button type="button" class="pa-launcher" aria-label="${ui.open}" title="${ui.open}" aria-expanded="false" aria-controls="pa-panel">
      ${ICON_CHAT}<span class="pa-launcher-dot" aria-hidden="true"></span>
    </button>
    <section class="pa-panel" id="pa-panel" role="dialog" aria-modal="false" aria-label="${ui.title}">
      <header class="pa-head">
        <div class="pa-head-icon">${ICON_CHAT}</div>
        <div class="pa-head-text"><strong>${ui.title}</strong><span>${ui.sub}</span></div>
        <button type="button" class="pa-close" aria-label="${ui.close}">${ICON_CLOSE}</button>
      </header>
      <div class="pa-log" aria-live="polite"></div>
      <form class="pa-form" autocomplete="off">
        <input class="pa-input" type="text" maxlength="300" placeholder="${ui.placeholder}" aria-label="${ui.placeholder}" enterkeyhint="send" />
        <button type="submit" class="pa-send" aria-label="${ui.send}" disabled>${ICON_SEND}</button>
      </form>
      <p class="pa-note">${ui.note}</p>
    </section>`;
  document.body.appendChild(root);
  document.body.classList.add('has-parish-assistant');

  const launcher = root.querySelector('.pa-launcher');
  const log = root.querySelector('.pa-log');
  const form = root.querySelector('.pa-form');
  const input = root.querySelector('.pa-input');
  const send = root.querySelector('.pa-send');
  let greeted = false;
  let busy = false;
  const history = []; // {role: 'user'|'assistant', content}[] — this tab only, sent with each turn for context

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function addMessage(who, content, { html = false } = {}) {
    const el = document.createElement('div');
    el.className = `pa-msg pa-${who}`;
    if (html) el.innerHTML = content; else el.textContent = content;
    log.appendChild(el);
    scrollDown();
    return el;
  }

  // The AI's reply is plain text — escape it before inserting as HTML, then
  // turn blank lines / line breaks into <p>/<br> so replies still read well.
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  // Page names in a reply ("Mass Schedule", "Aking mga Hiling"…) become links to that page.
  const linkPages = (html) => html.replace(PAGE_NAME_RE, (name) =>
    `<a class="pa-link-inline" href="${PAGE_BY_NAME.get(name)}">${name}</a>`);
  // The model sometimes writes markdown emphasis (**like this**) — render it as real bold
  // instead of leaking literal asterisks into the chat bubble.
  const renderBold = (html) => html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  function formatReply(text) {
    return text.split(/\n{2,}/).map(p => `<p>${linkPages(renderBold(escapeHtml(p))).replace(/\n/g, '<br>')}</p>`).join('');
  }

  function directoryHtml(lang) {
    const here = currentPage();
    const t = UI[lang];
    return `<p>${t.dirIntro}</p>` + PORTAL_DIRECTORY.map(({ section, pages }) => `
      <p class="pa-muted" style="margin-top:0.5rem;font-weight:600">${escapeHtml(section[lang])}</p>
      <ul class="pa-list">${pages.map(p => `
        <li><a class="pa-link-inline" href="${p.page}"><strong>${escapeHtml(p[lang])}</strong></a>${p.page === here ? ` <span class="pa-pill">${t.dirHere}</span>` : ''}
          <br><span class="pa-muted">${escapeHtml(p.what[lang])}</span></li>`).join('')}
      </ul>`).join('');
  }

  function addChips(chips) {
    log.querySelectorAll('.pa-chips').forEach(c => c.remove()); // only the latest suggestions stay
    if (!chips?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'pa-chips';
    chips.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pa-chip';
      b.textContent = text;
      b.addEventListener('click', () => ask(text));
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    scrollDown();
  }

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    busy = true;
    send.disabled = true;
    log.querySelectorAll('.pa-chips').forEach(c => c.remove());
    addMessage('user', q);
    const typing = addMessage('bot', '<span class="pa-typing"><i></i><i></i><i></i></span>', { html: true });
    const started = Date.now();
    const uiLang = currentLang();
    if (DIRECTORY_ASK.test(q)) {
      await new Promise(r => setTimeout(r, 300));
      typing.innerHTML = directoryHtml(uiLang);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: '(Showed the full list of portal pages.)' });
      scrollDown();
      addChips(STARTER_CHIPS[uiLang]);
      busy = false;
      send.disabled = !input.value.trim();
      return;
    }
    try {
      const context = await buildContext();
      const reply = await askAssistant(q, history, context, uiLang);
      await new Promise(r => setTimeout(r, Math.max(0, 450 - (Date.now() - started)))); // brief "typing…" so replies don't flash
      typing.innerHTML = formatReply(reply);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: reply });
    } catch (err) {
      console.error('Parish Assistant:', err);
      typing.innerHTML = `<p>${uiLang === 'fil'
        ? 'Pasensya na, hindi ako makasagot ngayon. 🙏 Subukan ulit mamaya, o itanong sa parish office.'
        : 'Sorry, I can’t answer right now. 🙏 Please try again later, or ask the parish office.'}</p>`;
    }
    scrollDown();
    addChips(STARTER_CHIPS[uiLang]);
    busy = false;
    send.disabled = !input.value.trim();
  }

  function open() {
    root.classList.add('pa-open');
    launcher.setAttribute('aria-expanded', 'true');
    launcher.querySelector('.pa-launcher-dot')?.remove();
    if (!greeted) {
      greeted = true;
      addMessage('bot', `<p>${ui.hello}</p>`, { html: true });
      addChips(STARTER_CHIPS[lang]);
    }
    // On phones, don't pop the keyboard over the greeting.
    if (window.matchMedia('(min-width: 641px)').matches) input.focus();
  }

  function close() {
    root.classList.remove('pa-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  // Language switched in the top bar (no page reload): relabel the window.
  // Messages already in the chat stay as they were; new replies follow the new language.
  document.addEventListener('sacradigit:lang', () => {
    lang = currentLang();
    ui = UI[lang];
    launcher.setAttribute('aria-label', ui.open);
    launcher.title = ui.open;
    root.querySelector('.pa-panel').setAttribute('aria-label', ui.title);
    root.querySelector('.pa-head-text').innerHTML = `<strong>${ui.title}</strong><span>${ui.sub}</span>`;
    root.querySelector('.pa-close').setAttribute('aria-label', ui.close);
    input.placeholder = ui.placeholder;
    input.setAttribute('aria-label', ui.placeholder);
    send.setAttribute('aria-label', ui.send);
    root.querySelector('.pa-note').textContent = ui.note;
    if (log.querySelector('.pa-chips') && !busy) addChips(STARTER_CHIPS[lang]);
  });

  launcher.addEventListener('click', open);
  root.querySelector('.pa-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('pa-open')) close(); });
  input.addEventListener('input', () => { send.disabled = busy || !input.value.trim(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    send.disabled = true;
    ask(q);
  });
}
