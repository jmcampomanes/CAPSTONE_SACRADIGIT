/* ============================================
   SacraDigit — Role matrix
   Who may do what, in one table. Navigation, page
   guards and buttons read it, and the Roles & Access
   page shows it. It matches the rules the backend
   enforces (see BACKEND_CHANGES.md): hiding a button
   is not security, so a change here needs the same
   change in the backend.

   The Role records on Sacra ITech → Roles are older,
   saved labels; nothing reads them for access.

   Markup: data-perm="module:action" hides an element
   for anyone without that permission, after
   applyPermissions(user).
   ============================================ */

export const ACTIONS = ['view', 'create', 'edit', 'approve', 'delete', 'export'];
export const ROLE_COLUMNS = [
  ['admin', 'Head Admin'], ['staff', 'Secretary'], ['itech', 'IT Team'],
  ['media', 'Media Team'], ['server', 'Parish Server'], ['parishioner', 'Parishioner'],
];

const ALL = ACTIONS;
const VIEW = ['view'];
const NONE = [];
// What every parishioner may do with their own requests (a Parish Server is also a parishioner).
const OWN = ['view', 'create'];

export const MATRIX = {
  records:       { label: 'Parish Records',            admin: ALL, staff: ['view', 'create', 'edit', 'export'], itech: VIEW, media: NONE, server: NONE, parishioner: NONE },
  certificates:  { label: 'Certificate Requests',      admin: ALL, staff: ['view', 'create', 'edit', 'approve', 'export'], itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  masses:        { label: 'Masses and Schedules',      admin: ALL, staff: VIEW, itech: VIEW, media: NONE, server: VIEW, parishioner: VIEW },
  services:      { label: 'Service Requests',          admin: ALL, staff: ALL, itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  baptismDates:  { label: 'Public Baptism Dates',      admin: ALL, staff: ['view', 'create', 'edit'], itech: VIEW, media: VIEW, server: VIEW, parishioner: VIEW },
  facilities:    { label: 'Facility Bookings',         admin: ALL, staff: ALL, itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  payments:      { label: 'Payments',                  admin: ALL, staff: ['view', 'create', 'approve'], itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  donations:     { label: 'Donations and Goals',       admin: ALL, staff: ['view', 'create', 'approve'], itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  intentions:    { label: 'Mass Intentions',           admin: ALL, staff: ALL, itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  announcements: { label: 'Announcements',             admin: ALL, staff: ['view', 'create', 'edit'], itech: VIEW, media: ['view', 'create', 'edit', 'approve', 'delete'], server: VIEW, parishioner: VIEW },
  ministry:      { label: 'Ministry and Parish Servers', admin: ALL, staff: ['view', 'create', 'edit', 'delete'], itech: VIEW, media: NONE, server: OWN, parishioner: OWN },
  media:         { label: 'Media and Livestream',      admin: ALL, staff: NONE, itech: VIEW, media: ALL, server: NONE, parishioner: NONE },
  reports:       { label: 'Reports and Statistics',    admin: ALL, staff: ['view', 'export'], itech: NONE, media: NONE, server: NONE, parishioner: NONE },
  parishRules:   { label: 'Parish Rules and Fees',     admin: ALL, staff: VIEW, itech: VIEW, media: NONE, server: NONE, parishioner: NONE },
  logs:          { label: 'Activity Logs',             admin: ['view', 'export'], staff: NONE, itech: ['view', 'export'], media: NONE, server: NONE, parishioner: NONE },
  roles:         { label: 'Accounts and Roles',        admin: VIEW, staff: NONE, itech: ALL, media: NONE, server: NONE, parishioner: NONE },
  system:        { label: 'Backups and Cloud Storage', admin: NONE, staff: NONE, itech: ALL, media: NONE, server: NONE, parishioner: NONE },
};

/** New admin-portal pages and the module each belongs to (checked by dashboard.js). */
export const PAGE_MODULES = {
  'parish-rules.html': 'parishRules',
  'payment-reports.html': 'reports',
  'statistics.html': 'reports',
  'roles-access.html': 'roles',
};

function rolesOf(user) {
  if (!user) return [];
  return [...new Set([...(user.groups || []), user.role].filter(Boolean)), 'parishioner'];
}

/** True when any of the person's roles allows it. */
export function can(user, module, action = 'view') {
  const row = MATRIX[module];
  if (!row) return false;
  return rolesOf(user).some(role => (row[role] || []).includes(action));
}

/** Hides everything marked data-perm that this person may not use. */
export function applyPermissions(user, root = document) {
  root.querySelectorAll('[data-perm]').forEach(el => {
    const [module, action] = el.dataset.perm.split(':');
    el.classList.toggle('hidden', !can(user, module, action));
  });
}

const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', approve: 'Approve', delete: 'Delete', export: 'Export' };

/** The comparison table on the Roles & Access pages. */
export function matrixHtml() {
  const cell = (list) => (list.length === ACTIONS.length
    ? '<span class="rm-all">Full access</span>'
    : list.length ? list.map(a => `<span class="rm-action">${ACTION_LABELS[a]}</span>`).join(' ') : '<span class="rm-none" aria-label="No access">—</span>');
  return `
    <div class="rm-wrap">
      <table class="rm-table">
        <thead><tr><th scope="col">Area</th>${ROLE_COLUMNS.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
        <tbody>
          ${Object.values(MATRIX).map(row => `
            <tr><th scope="row">${row.label}</th>${ROLE_COLUMNS.map(([role]) => `<td>${cell(row[role])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="rm-note">Parishioners and Parish Servers only see and create their own requests.</p>`;
}
