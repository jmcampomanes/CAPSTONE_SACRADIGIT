/* ============================================
   Sacra ITech — Roles & Access
   Full create / edit / delete for the Role model
   (role, permissions, users). Permissions are stored
   as JSON [{ label, granted }] — the shape the old
   admin Cloud Access page used, so roles created
   there before the move still load correctly here.
   Every change is written to Activity Logs.
   ============================================ */

import { client } from '../amplify-init.js';
import { escapeHtml, showToast, logItAction, openModal, closeModal, wireModals } from './itech-shell.js';

const $ = (id) => document.getElementById(id);

/* The permission catalog shown as checkboxes. Labels are what gets saved. */
const PERMISSIONS = [
  { label: 'View Parish Records',          desc: 'Digital archives and certificate requests' },
  { label: 'Edit Parish Records',          desc: 'Add, correct and issue records' },
  { label: 'Approve & Reschedule Requests', desc: 'Blessings, services, facility bookings' },
  { label: 'Manage Mass Schedules',        desc: 'Masses, weekly and special schedules' },
  { label: 'Manage Finances',              desc: 'Donations and Mass intentions' },
  { label: 'Publish Announcements',        desc: 'Parish announcements' },
  { label: 'Manage Media & Livestream',    desc: 'Media library, calendar, livestream' },
  { label: 'Submit Service Requests',      desc: 'Parishioner requests and bookings' },
  { label: 'Manage Cloud Storage',         desc: 'Uploads, folders, file cleanup' },
  { label: 'View Activity Logs',           desc: 'Audit trail of actions' },
  { label: 'Manage Roles & Access',        desc: 'Create and change roles' },
  { label: 'Back Up & Export Data',        desc: 'Download data exports' },
];

/* Starter set for a fresh system — offered only while no roles exist. */
const DEFAULT_ROLES = [
  { role: 'Parish Admin', users: 'Admin User', grants: ['View Parish Records', 'Edit Parish Records', 'Approve & Reschedule Requests', 'Manage Mass Schedules', 'Manage Finances', 'Publish Announcements', 'Manage Cloud Storage', 'View Activity Logs'] },
  { role: 'Media Team', users: 'Media Team', grants: ['Publish Announcements', 'Manage Media & Livestream'] },
  { role: 'Parishioner', users: 'Maria P. Santos', grants: ['Submit Service Requests'] },
  { role: 'Sacra ITech', users: 'IT Team', grants: ['View Activity Logs', 'Manage Roles & Access', 'Manage Cloud Storage', 'Back Up & Export Data'] },
];

const permsJson = (grants, extraLabels = []) => JSON.stringify(
  [...PERMISSIONS.map(p => p.label), ...extraLabels].map(label => ({ label, granted: grants.includes(label) })),
);

function parsePerms(role) {
  try {
    const parsed = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
    return Array.isArray(parsed) ? parsed.filter(p => p && p.label) : [];
  } catch { return []; }
}

const splitUsers = (s) => (s || '').split(',').map(u => u.trim()).filter(Boolean);

let roles = [];
let editingId = null;

const roleModal = $('role-modal');
wireModals(roleModal);

/* ---------- List ---------- */

function render() {
  $('btn-seed-roles').classList.toggle('hidden', roles.length > 0);
  if (roles.length === 0) {
    $('roles-grid').innerHTML = '<p class="empty-state" style="grid-column:1/-1;">No roles defined yet. Click “Load Default Roles” for a starter set, or create one.</p>';
    return;
  }
  $('roles-grid').innerHTML = roles.slice().sort((a, b) => a.role.localeCompare(b.role)).map(r => {
    const granted = parsePerms(r).filter(p => p.granted);
    const users = splitUsers(r.users);
    return `
      <div class="role-card">
        <div class="role-card-head">
          <p class="role-card-name">${escapeHtml(r.role)}</p>
          <span class="role-card-count">${granted.length} permission${granted.length === 1 ? '' : 's'}</span>
        </div>
        <div class="role-perms">
          ${granted.length ? granted.map(p => `<span class="role-perm">${escapeHtml(p.label)}</span>`).join('') : '<span class="role-perm none">No permissions</span>'}
        </div>
        <div>
          <p class="role-users-label">Assigned users (${users.length})</p>
          <p class="role-users">${users.length ? users.map(escapeHtml).join(', ') : '<span class="text-gray-400">Nobody yet</span>'}</p>
        </div>
        <div class="role-card-actions">
          <button type="button" class="btn-link" data-edit="${r.id}">Edit</button>
          <button type="button" class="btn-link danger" data-delete="${r.id}">Delete</button>
        </div>
      </div>`;
  }).join('');
}

client.models.Role.observeQuery().subscribe({
  next: ({ items }) => { roles = items; render(); },
  error: (err) => {
    console.error('Failed to load roles:', err);
    $('roles-grid').innerHTML = '<p class="empty-state" style="grid-column:1/-1;">Couldn’t load roles. Check the connection and refresh.</p>';
  },
});

/* ---------- Editor ---------- */

function openEditor(role = null) {
  editingId = role?.id || null;
  $('role-modal-title').textContent = role ? `Edit Role — ${role.role}` : 'New Role';
  $('role-name').value = role?.role || '';
  $('role-name').classList.remove('has-error');
  $('role-users').value = splitUsers(role?.users).join(', ');

  const saved = role ? parsePerms(role) : [];
  const grantedSet = new Set(saved.filter(p => p.granted).map(p => p.label));
  // Keep any custom permissions an older role already has, not just the catalog
  const extras = saved.filter(p => !PERMISSIONS.some(c => c.label === p.label)).map(p => ({ label: p.label, desc: 'Custom permission' }));
  $('role-permissions').innerHTML = [...PERMISSIONS, ...extras].map((p, i) => `
    <label class="perm-item">
      <input type="checkbox" value="${escapeHtml(p.label)}" ${grantedSet.has(p.label) ? 'checked' : ''} id="perm-${i}" />
      <span><span class="perm-name block">${escapeHtml(p.label)}</span><span class="perm-desc">${escapeHtml(p.desc)}</span></span>
    </label>`).join('');

  $('role-save').disabled = false;
  openModal(roleModal);
  $('role-name').focus();
}

$('btn-new-role').addEventListener('click', () => openEditor());

$('roles-grid').addEventListener('click', async (e) => {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  if (editId) { openEditor(roles.find(r => r.id === editId)); return; }

  const delId = e.target.closest('[data-delete]')?.dataset.delete;
  if (!delId) return;
  const role = roles.find(r => r.id === delId);
  if (!role || !confirm(`Delete the “${role.role}” role? Assigned users lose these permissions.`)) return;
  try {
    const { errors } = await client.models.Role.delete({ id: delId });
    if (errors?.length) throw new Error(errors[0].message);
    logItAction('Delete Role', `Role: ${role.role}`);
    showToast(`Role “${role.role}” deleted.`);
  } catch (err) {
    console.error('Failed to delete role:', err);
    showToast(err.message || 'Couldn’t delete the role.', true);
  }
});

$('role-save').addEventListener('click', async () => {
  const name = $('role-name').value.trim();
  if (!name) { $('role-name').classList.add('has-error'); showToast('Please give the role a name.', true); return; }
  const duplicate = roles.find(r => r.role.toLowerCase() === name.toLowerCase() && r.id !== editingId);
  if (duplicate) { $('role-name').classList.add('has-error'); showToast(`A role named “${duplicate.role}” already exists.`, true); return; }

  const boxes = [...$('role-permissions').querySelectorAll('input[type="checkbox"]')];
  const grants = boxes.filter(b => b.checked).map(b => b.value);
  const extras = boxes.map(b => b.value).filter(l => !PERMISSIONS.some(p => p.label === l));
  const payload = { role: name, permissions: permsJson(grants, extras), users: splitUsers($('role-users').value).join(', ') };

  $('role-save').disabled = true;
  try {
    const result = editingId
      ? await client.models.Role.update({ id: editingId, ...payload })
      : await client.models.Role.create(payload);
    if (result.errors?.length) throw new Error(result.errors[0].message);
    logItAction(editingId ? 'Edit Role' : 'Create Role', `Role: ${name} — ${grants.length} permission(s)`);
    closeModal(roleModal);
    showToast(editingId ? `Role “${name}” updated.` : `Role “${name}” created.`);
  } catch (err) {
    console.error('Failed to save role:', err);
    showToast(err.message || 'Couldn’t save the role.', true);
    $('role-save').disabled = false;
  }
});

$('role-name').addEventListener('input', () => $('role-name').classList.remove('has-error'));

/* ---------- Default roles ---------- */

$('btn-seed-roles').addEventListener('click', async () => {
  const btn = $('btn-seed-roles');
  btn.disabled = true;
  try {
    for (const d of DEFAULT_ROLES) {
      const { errors } = await client.models.Role.create({ role: d.role, users: d.users, permissions: permsJson(d.grants) });
      if (errors?.length) throw new Error(errors[0].message);
    }
    logItAction('Create Role', `Loaded ${DEFAULT_ROLES.length} default roles`);
    showToast('Default roles loaded.');
  } catch (err) {
    console.error('Failed to seed roles:', err);
    showToast(err.message || 'Couldn’t load the default roles.', true);
  } finally {
    btn.disabled = false;
  }
});
