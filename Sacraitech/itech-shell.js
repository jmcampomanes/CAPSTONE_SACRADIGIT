/* ============================================
   Sacra ITech — Shared Shell Script + helpers
   Loaded as a module by every Sacra ITech page.
   On load it wires the shared chrome (active
   sidebar link, mobile sidebar, top-bar date,
   user menu, toast dismiss) — same behaviour as
   the admin and media shells. It also exports
   small helpers the IT pages share.
   ============================================ */

import { client } from '../amplify-init.js';

export const ITECH_USER = 'Sacra ITech';

/** Every data model in the app, grouped by the portal area that owns it. */
export const DATA_MODULES = [
  { model: 'ParishRecord',          label: 'Parish Records',           area: 'Records' },
  { model: 'CertificateRequest',    label: 'Certificate Requests',     area: 'Records' },
  { model: 'Blessing',              label: 'Service & Blessing Requests', area: 'Services' },
  { model: 'FacilityBooking',       label: 'Facility Bookings',        area: 'Services' },
  { model: 'Mass',                  label: 'Masses',                   area: 'Masses' },
  { model: 'WeeklyMassSchedule',    label: 'Weekly Mass Schedule',     area: 'Masses' },
  { model: 'SpecialSchedule',       label: 'Special Schedules',        area: 'Masses' },
  { model: 'MassIntention',         label: 'Mass Intentions',          area: 'Finance' },
  { model: 'Donation',              label: 'Donations',                area: 'Finance' },
  { model: 'Announcement',          label: 'Announcements',            area: 'Communications' },
  { model: 'ContentCalendarEntry',  label: 'Content Calendar',         area: 'Media' },
  { model: 'PostTemplate',          label: 'Post Templates',           area: 'Media' },
  { model: 'EventCoverageRequest',  label: 'Event Coverage Requests',  area: 'Media' },
  { model: 'LivestreamSession',     label: 'Livestream Sessions',      area: 'Media' },
  { model: 'LivestreamStatus',      label: 'Livestream Status',        area: 'Media' },
  { model: 'CloudFile',             label: 'Cloud Files (metadata)',   area: 'System' },
  { model: 'Role',                  label: 'Roles',                    area: 'System' },
  { model: 'AccessLog',             label: 'Activity Logs',            area: 'System' },
  { model: 'ServiceSlot',           label: 'Service Slots',            area: 'System' },
].filter(m => client.models[m.model]);

/* ---------- Cloud storage folders ----------
   CloudFile.folder keys used by uploads (Cloud Access, Media Library).
   The livestream feature also keeps its status/history as CloudFile
   records (see ../livestream-status.js) — those aren't files, so every
   storage view hides SYSTEM_FOLDERS and must never delete them. */
export const STORAGE_FOLDERS = [
  { key: 'baptism',       name: 'Baptismal Records' },
  { key: 'confirmation',  name: 'Confirmation Records' },
  { key: 'marriage',      name: 'Marriage Records' },
  { key: 'death',         name: 'Death Records' },
  { key: 'announcements', name: 'Parish Announcements' },
  { key: 'financial',     name: 'Financial Documents' },
  { key: 'media',         name: 'Media Library' },
];
export const SYSTEM_FOLDERS = new Set(['livestream', 'livestream-history']);

export function folderName(key) {
  return STORAGE_FOLDERS.find(f => f.key === key)?.name || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unsorted');
}

export const isExternalUrl = (url) => /^https?:\/\//i.test(url || '');

/** CloudFile records that are real uploads/links (not livestream bookkeeping). */
export const userFiles = (items) => items.filter(f => !SYSTEM_FOLDERS.has(f.folder));

/* ---------- Helpers ---------- */

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Colour group for an AccessLog action tag. */
export function actionKind(action = '') {
  const a = action.toLowerCase();
  if (/(create|upload|add|seed)/.test(a)) return 'create';
  if (/(delete|remove|cancel|decline)/.test(a)) return 'delete';
  if (/(export|backup|download)/.test(a)) return 'export';
  if (/(reschedule|move)/.test(a)) return 'move';
  if (/(edit|update|role)/.test(a)) return 'edit';
  return '';
}

let toastTimer = null;
export function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  const msgEl = toast.querySelector('.toast-message');
  if (msgEl) msgEl.textContent = message; else toast.textContent = message;
  toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }, 3500);
}

/**
 * Audit trail for IT actions (role changes, file deletions, exports).
 * Writes to the shared AccessLog model (shown on Activity Logs and the
 * admin Profile activity tab). Never throws — a failed log must not undo the action.
 */
export async function logItAction(action, detail) {
  try {
    await client.models.AccessLog.create({ userName: ITECH_USER, fileName: detail, action });
  } catch (err) {
    console.warn('Could not write audit log entry:', err);
  }
}

/** Fetches every record of a model, following pagination. */
export async function listAll(modelName) {
  const model = client.models[modelName];
  if (!model) return [];
  const items = [];
  let nextToken = null;
  do {
    const { data, errors, nextToken: next } = await model.list({ limit: 1000, nextToken });
    if (errors?.length) throw new Error(errors[0].message);
    items.push(...(data || []));
    nextToken = next;
  } while (nextToken);
  return items;
}

/** Triggers a download of `text` as a file. */
export function downloadFile(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rows (array of plain objects) → CSV text, columns from the union of keys. */
export function toCsv(rows) {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
}

export function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
export function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

/** Wires [data-close-modal] buttons, backdrop clicks and Escape for the given modals. */
export function wireModals(...modals) {
  modals.forEach(m => {
    m.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(m)));
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modals.forEach(closeModal); });
}

/* ---------- Shell chrome ---------- */

function initShell() {
  // 1. Active sidebar link — matches the current page filename
  const currentPage = window.location.pathname.split('/').pop() || 'itech-dashboard.html';
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === currentPage));

  // 2. Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const openSidebar = () => { sidebar.classList.add('open'); sidebarOverlay.classList.remove('hidden'); sidebarToggle?.setAttribute('aria-expanded', 'true'); };
  const closeSidebar = () => { sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden'); sidebarToggle?.setAttribute('aria-expanded', 'false'); };
  sidebarToggle?.addEventListener('click', () => (sidebar.classList.contains('open') ? closeSidebar() : openSidebar()));
  sidebarOverlay?.addEventListener('click', closeSidebar);
  sidebarLinks.forEach(link => link.addEventListener('click', () => { if (window.innerWidth < 768) closeSidebar(); }));
  window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeSidebar(); });

  // 3. Top bar date
  const dateEl = document.getElementById('current-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // 4. User menu — Log Out returns to the portal launcher
  const userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) {
    const wrap = userMenuBtn.parentElement;
    wrap.style.position = 'relative';
    const menu = document.createElement('div');
    menu.className = 'user-menu-dropdown hidden';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" class="user-menu-item" role="menuitem" data-action="launcher">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 12h16M4 18h7"/></svg>
        Switch Portal
      </button>
      <div class="user-menu-divider"></div>
      <button type="button" class="user-menu-item user-menu-item-danger" role="menuitem" data-action="logout">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1"/></svg>
        Log Out
      </button>`;
    wrap.appendChild(menu);
    const close = () => { menu.classList.add('hidden'); userMenuBtn.setAttribute('aria-expanded', 'false'); };
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('hidden') === false;
      userMenuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.user-menu-item');
      if (!item) return;
      close();
      window.location.href = '../index.html';
    });
  }

  // 5. Toast — persistent message span + dismiss button
  const toastEl = document.getElementById('toast');
  if (toastEl) {
    toastEl.innerHTML = '<span class="toast-message"></span><button type="button" class="toast-dismiss" aria-label="Dismiss notification">&times;</button>';
    toastEl.querySelector('.toast-dismiss').addEventListener('click', () => toastEl.classList.remove('show'));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShell);
else initShell();
