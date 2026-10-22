/* ============================================
   SacraDigit — Public homepage (home.html)
   The page anyone can open without signing in:
   welcome pop-up, Mass schedule, parish info,
   sacrament guides, and the footer contacts.

   Live data is read with the public API key
   (no account needed), from models that allow
   public reads:
     WeeklyMassSchedule  the weekly Mass table
                         (defaults fill in any
                         day an admin hasn't saved,
                         see weekly-mass-schedule.js)
     ParishInfo          phone, email, Facebook,
                         office hours, location
     Announcement        newest one for "All
                         Parishioners", shown in
                         the welcome pop-up
   If any of these can't load, the page keeps the
   built-in text, so it never shows empty.
   ============================================ */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './amplify_outputs.json';
import { mergeWeeklySchedule, dayKeyForDate, timeToMinutes } from './weekly-mass-schedule.js';
import { massTypeInfo } from './mass-types.js';
import { initUiPrefs, currentLang } from './ui-prefs.js';

Amplify.configure(outputs);
const client = generateClient({ authMode: 'apiKey' });

const $ = (id) => document.getElementById(id);
const WELCOME_KEY = 'sacradigit_home_welcomed';

initUiPrefs();
$('hp-year').textContent = new Date().getFullYear();

/* ---------- helpers ---------- */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

/* ---------- top bar: shadow on scroll + mobile menu ---------- */

const nav = $('hp-nav');
const links = $('hp-links');
const menuBtn = $('hp-menu-btn');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
  links.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

// Highlight the section in view.
const navLinks = [...links.querySelectorAll('a')];
const spy = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });

/* ---------- Schedule of Masses ---------- */

function renderMasses(liveRows) {
  const schedule = mergeWeeklySchedule(liveRows);
  const todayKey = dayKeyForDate(todayIso());
  const grid = $('hp-mass-grid');
  grid.innerHTML = '';

  schedule.forEach(day => {
    const info = massTypeInfo(day.massType);
    const card = el('article', 'hp-mass-day');
    if (day.dayKey === todayKey) card.classList.add('is-today');
    card.style.setProperty('--accent', info.color);

    const head = el('div', 'hp-mass-head');
    head.append(el('h3', 'hp-mass-name', day.dayLabel));
    if (day.dayKey === todayKey) head.append(el('span', 'hp-mass-badge', 'Today'));
    card.append(head);
    card.append(el('p', 'hp-mass-type', day.displayType));

    const times = el('ul', 'hp-mass-times');
    times.setAttribute('data-no-translate', '');
    const sorted = [...day.times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    if (!sorted.length) times.append(el('li', 'hp-mass-none', 'No Mass'));
    sorted.forEach(t => times.append(el('li', null, t.replace(/^0/, ''))));
    card.append(times);
    grid.append(card);
  });

  const today = schedule.find(d => d.dayKey === todayKey);
  if (today?.times.length) {
    $('hp-today-times').textContent = [...today.times]
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
      .map(t => t.replace(/^0/, ''))
      .join(' · ');
    $('hp-today').hidden = false;
  }
  return schedule;
}

// Footer summary: consecutive days with the same times share a line ("Mon – Sat: …").
function renderFooterMasses(schedule) {
  const short = (label) => label.slice(0, 3);
  const fmt = (times) => [...times]
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
    .map(t => t.replace(/^0/, '').replace(/^12:00 PM$/, '12:00 NN'))
    .join(' · ');
  const groups = [];
  schedule.forEach(day => {
    const times = fmt(day.times);
    const last = groups[groups.length - 1];
    if (last && last.times === times) last.to = day.dayLabel;
    else groups.push({ from: day.dayLabel, to: null, times });
  });
  const box = $('hp-footer-masses');
  box.textContent = '';
  groups.forEach((g, i) => {
    if (i) box.append(document.createElement('br'));
    const days = g.to ? `${short(g.from)} – ${short(g.to)}` : g.from;
    box.append(`${days}: ${g.times || 'No Mass'}`);
  });
}

renderMasses([]); // defaults right away, live rows replace them below
client.models.WeeklyMassSchedule.list({ limit: 50 })
  .then(res => {
    const err = errorsOf(res); if (err) throw err;
    renderFooterMasses(renderMasses(res.data || []));
  })
  .catch(err => console.warn('Weekly Mass schedule unavailable, showing defaults:', err));

/* ---------- Parish contact (footer, columbary call-out, about) ---------- */

function setAll(key, fn) { document.querySelectorAll(`[data-contact="${key}"]`).forEach(fn); }

function renderContact(info) {
  if (!info) return;
  if (info.location) {
    setAll('location', n => { n.textContent = info.location; });
    $('hp-about-address').textContent = info.location;
  }
  const hours = currentLang() === 'fil' ? (info.officeHoursFil || info.officeHoursEn) : info.officeHoursEn;
  if (hours) setAll('hours', n => { n.textContent = `Office hours: ${hours}`; n.hidden = false; });
  if (info.phone) {
    setAll('phone', n => { n.textContent = info.phone; });
    setAll('phone-link', n => { n.href = `tel:${info.phone.replace(/[^0-9+]/g, '')}`; });
  }
  if (info.email) {
    setAll('email', n => { n.textContent = info.email; });
    setAll('email-link', n => { n.href = `mailto:${info.email}`; });
    setAll('email-inquiry', n => { n.href = `mailto:${info.email}?subject=Wedding%20Inquiry`; });
    setAll('email-row', n => { n.hidden = false; });
  }
  if (info.facebook) {
    setAll('facebook-link', n => { n.href = info.facebook; });
    setAll('facebook-row', n => { n.hidden = false; });
  }
}

let parishInfo = null;
if (client.models.ParishInfo) {
  client.models.ParishInfo.list({ limit: 50 })
    .then(res => {
      const err = errorsOf(res); if (err) throw err;
      parishInfo = (res.data || []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] || null;
      renderContact(parishInfo);
    })
    .catch(err => console.warn('Parish info unavailable, using defaults:', err));
}
document.addEventListener('sacradigit:lang', () => renderContact(parishInfo));

/* ---------- Welcome pop-up (once per browser session) ---------- */

const modal = $('hp-welcome');
let lastFocus = null;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 18) return 'Good afternoon!';
  return 'Good evening!';
}

function openWelcome() {
  lastFocus = document.activeElement;
  $('hp-greeting').textContent = greeting();
  modal.hidden = false;
  document.body.classList.add('hp-no-scroll');
  requestAnimationFrame(() => modal.classList.add('is-open'));
  modal.querySelector('.hp-modal-actions [data-close]').focus();
}

function closeWelcome() {
  modal.classList.remove('is-open');
  document.body.classList.remove('hp-no-scroll');
  try { sessionStorage.setItem(WELCOME_KEY, '1'); } catch { /* private mode */ }
  setTimeout(() => { modal.hidden = true; }, 200);
  lastFocus?.focus?.();
}

modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeWelcome(); });
document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeWelcome();
  if (e.key === 'Tab') { // keep focus inside the pop-up
    const focusable = [...modal.querySelectorAll('button, a[href]')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// Newest published announcement for everyone — a short preview in the pop-up.
async function loadLatestAnnouncement() {
  const res = await client.models.Announcement.list({ limit: 200 });
  const err = errorsOf(res); if (err) throw err;
  const latest = (res.data || [])
    .filter(a => a.published !== false && (!a.audience || a.audience === 'All Parishioners'))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  if (!latest) return;
  $('hp-welcome-ann-title').textContent = latest.title || '';
  const body = (latest.body || '').replace(/\s+/g, ' ').trim();
  $('hp-welcome-ann-body').textContent = body.length > 160 ? `${body.slice(0, 157)}…` : body;
  $('hp-welcome-ann').hidden = false;
}

let welcomed = false;
try { welcomed = sessionStorage.getItem(WELCOME_KEY) === '1'; } catch { /* private mode */ }
if (!welcomed) {
  loadLatestAnnouncement().catch(err => console.warn('Announcements unavailable:', err));
  setTimeout(openWelcome, 600);
}
