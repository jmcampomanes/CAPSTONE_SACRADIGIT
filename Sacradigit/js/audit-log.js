/* ============================================
   SacraDigit Admin — Audit Log
   Runs after dashboard.js. Who added, edited, deleted or opened
   a parishioner's data, and exactly which details changed.

   The entries are the AccessLog rows that activity-log.js already
   writes for every staff change (from any portal): who, role, what
   kind of record, and the values before and after. This page reads
   them, keeps the ones about parishioner data (archive records,
   certificate requests, parishioner profiles), and can export them
   as a CSV with one row per changed detail.

   Only roles with the "logs" permission see the page, and only those
   with "export" get the Export button (permissions.js).
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { can } from '../../shared/js/permissions.js';
import { logActivity } from '../../shared/js/activity-log.js';
import { showToast } from './admin-ui.js';

const PAGE_SIZE = 25;

// Which AccessLog rows are "parishioner data", and what to call them.
const DATA_TYPES = {
  ParishRecord: 'Archive record',
  CertificateRequest: 'Certificate request',
  ParishionerPreference: 'Parishioner profile',
  MockParishioner: 'Parishioner profile',
};
// Older entries have no targetType: their text starts with the model's label.
const LEGACY_PREFIX = [['Parish Record', 'ParishRecord'], ['Certificate Request', 'CertificateRequest']];

const FIELD_LABELS = {
  fullName: 'Name', type: 'Record type', dateOfEvent: 'Date of event', officiant: 'Officiant', status: 'Status',
  fileURL: 'Scanned file', birthdate: 'Birth date', addedByName: 'Added by', requesterName: 'Requester',
  certificateType: 'Certificate', purpose: 'Purpose', notes: 'Notes', rejectionReason: 'Reason', email: 'Email',
  linkedRecordId: 'Linked record', details: 'Form details', phone: 'Phone', address: 'Address', about: 'About',
  displayName: 'Display name', sex: 'Sex', isPwd: 'PWD', pwdType: 'PWD type', accommodations: 'Accommodations',
  showOnHonorRoll: 'Show on honor roll',
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = (text) => { try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const label = (k) => FIELD_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** A stored value as readable text (names are { firstName, … } objects). */
function show(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object') {
    if ('firstName' in v || 'lastName' in v) return [v.firstName, v.middleName, v.lastName, v.extension].map((x) => (x || '').trim()).filter(Boolean).join(' ');
    return JSON.stringify(v);
  }
  return String(v);
}

/** The details that changed in one log entry: [{ field, from, to }]. */
function changesOf(log) {
  const before = parse(log.before), after = parse(log.after);
  const out = [];
  const same = (a, b) => show(a) === show(b);
  const push = (field, from, to) => { if (!same(from, to)) out.push({ field, from: show(from), to: show(to) }); };
  if (log.action === 'Delete') { for (const [k, v] of Object.entries(before || {})) push(label(k), v, ''); return out; }
  if (log.action === 'Create') { for (const [k, v] of Object.entries(after || {})) push(label(k), '', v); return out; }
  if (log.action !== 'Edit' || !after) return out;
  for (const [k, now] of Object.entries(after)) {
    const was = before ? before[k] : undefined;
    if (k === 'details') { // a certificate request's form answers: compare them one by one
      const a = parse(typeof was === 'string' ? was : JSON.stringify(was ?? null)) || {}, b = parse(typeof now === 'string' ? now : JSON.stringify(now ?? null)) || {};
      if (Object.keys(a).length || Object.keys(b).length) {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) push(`Form: ${label(key)}`, a[key], b[key]);
        continue;
      }
    }
    push(label(k), was, now);
  }
  return out;
}

function dataTypeOf(log) {
  if (DATA_TYPES[log.targetType]) return DATA_TYPES[log.targetType];
  const hit = LEGACY_PREFIX.find(([prefix]) => String(log.fileName || '').startsWith(prefix));
  return hit ? DATA_TYPES[hit[1]] : '';
}

/** What the record is called, without the "Certificate Request — " prefix or the "(status: approved)" tail (the change column says that). */
const recordText = (log) => String(log.fileName || '').replace(/^[^—]*—\s*/, '').replace(/\s*\((?:status: [^)]*|published|draft)\)\s*$/, '');

/** "Maria Cruz · Secretary", or just the name when the role would repeat it ("Head Admin · Head Admin"). */
const whoLabel = (actor) => (actor.role && actor.role !== actor.name ? `${actor.name} · ${actor.role}` : actor.name);

function actorOf(log) {
  const [name, role] = String(log.userName || '').split(' · ');
  return { name: name || 'Unknown', role: log.actorRole || role || '' };
}

document.addEventListener('DOMContentLoaded', () => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('sacradigit_user')); } catch { /* signed out: dashboard.js redirects */ }
  const canExport = !!user && can(user, 'logs', 'export');
  $('au-export').classList.toggle('hidden', !canExport);

  let entries = []; // parishioner-data log entries, newest first
  let page = 1;
  let account = ''; // the account chip that is switched on

  const dayOf = (iso) => new Date(iso).toLocaleDateString('en-CA');

  function filtered() {
    const q = $('au-search').value.trim().toLowerCase();
    const data = $('au-data').value, action = $('au-action').value, from = $('au-from').value, to = $('au-to').value;
    return entries.filter((e) => {
      if (account && e.who !== account) return false;
      if (data && e.dataType !== data) return false;
      if (action === 'changes' ? !['Create', 'Edit', 'Delete'].includes(e.log.action) : action !== 'all' && e.log.action !== action) return false;
      if (q && !`${e.log.userName || ''} ${e.log.fileName || ''} ${e.changes.map((c) => `${c.field} ${c.from} ${c.to}`).join(' ')}`.toLowerCase().includes(q)) return false;
      const day = dayOf(e.log.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }

  const changeHtml = (c) => `<p class="au-change"><span class="au-field">${esc(c.field)}:</span> ${c.from ? `<span class="au-old">${esc(c.from.slice(0, 120))}</span> → ` : ''}<span class="au-new">${esc(c.to ? c.to.slice(0, 120) : '(removed)')}</span></p>`;

  function changesCell(e) {
    if (!e.changes.length) return `<span class="text-xs text-gray-500">${e.log.action === 'View' ? 'Opened the record' : 'No detail recorded'}</span>`;
    const first = e.changes.slice(0, 3).map(changeHtml).join('');
    const rest = e.changes.slice(3);
    return first + (rest.length ? `<details class="au-more"><summary>${rest.length} more</summary>${rest.map(changeHtml).join('')}</details>` : '');
  }

  function render() {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('au-rows').innerHTML = slice.length
      ? slice.map((e) => `
        <tr>
          <td class="text-gray-500" style="white-space:nowrap">${esc(new Date(e.log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td>
          <td><span class="font-medium text-gray-900">${esc(e.actor.name)}</span>${e.actor.role && e.actor.role !== e.actor.name ? `<br /><span class="text-xs text-gray-500">${esc(e.actor.role)}</span>` : ''}</td>
          <td><span class="au-tag" data-a="${esc(e.log.action)}">${esc(e.log.action === 'Create' ? 'Added' : e.log.action === 'Edit' ? 'Edited' : e.log.action === 'Delete' ? 'Deleted' : e.log.action)}</span></td>
          <td class="wrap"><span class="text-xs text-gray-500">${esc(e.dataType)}</span><br />${esc(recordText(e.log))}</td>
          <td class="wrap">${changesCell(e)}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="empty-state">${entries.length ? 'Nothing matches these filters.' : 'No changes to parishioner data have been recorded yet.'}</td></tr>`;
    $('au-count').textContent = rows.length === entries.length ? `${entries.length.toLocaleString()} entries` : `${rows.length.toLocaleString()} of ${entries.length.toLocaleString()} entries`;
    $('au-page').textContent = `Page ${page} of ${pages}`;
    $('au-prev').disabled = page <= 1;
    $('au-next').disabled = page >= pages;
  }

  function renderAccounts() {
    const counts = new Map();
    for (const e of entries) {
      if (!['Create', 'Edit', 'Delete'].includes(e.log.action)) continue;
      const k = e.who;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    $('au-summary').textContent = `${entries.filter((e) => ['Create', 'Edit', 'Delete'].includes(e.log.action)).length.toLocaleString()} changes by ${list.length} account${list.length === 1 ? '' : 's'}`;
    $('au-who').innerHTML = list.length
      ? list.map(([who, n]) => `<button type="button" data-who="${esc(who)}" aria-pressed="${who === account}">${esc(who)} <b>${n}</b></button>`).join('')
      : '<span class="text-sm text-gray-600">No account has changed parishioner data yet.</span>';
  }

  $('au-who').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-who]');
    if (!b) return;
    account = account === b.dataset.who ? '' : b.dataset.who;
    page = 1;
    renderAccounts();
    render();
  });

  ['au-search', 'au-data', 'au-action', 'au-from', 'au-to'].forEach((id) => $(id).addEventListener('input', () => { page = 1; render(); }));
  $('au-clear').addEventListener('click', () => {
    ['au-search', 'au-data', 'au-from', 'au-to'].forEach((id) => { $(id).value = ''; });
    $('au-action').value = 'changes';
    account = '';
    page = 1;
    renderAccounts();
    render();
  });
  $('au-prev').addEventListener('click', () => { page -= 1; render(); });
  $('au-next').addEventListener('click', () => { page += 1; render(); });

  /* ---------- export: one row per changed detail ---------- */

  $('au-export').addEventListener('click', () => {
    if (!canExport) return;
    const rows = filtered();
    if (!rows.length) { showToast('Nothing to export with these filters.', true); return; }
    const header = ['When', 'Account', 'Role', 'Action', 'Data type', 'Record', 'Field', 'Old value', 'New value', 'Record ID'];
    const lines = [header];
    for (const e of rows) {
      const base = [e.log.createdAt, e.actor.name, e.actor.role, e.log.action, e.dataType, recordText(e.log)];
      if (!e.changes.length) lines.push([...base, '', '', '', e.log.targetId || '']);
      else for (const c of e.changes) lines.push([...base, c.field, c.from, c.to, e.log.targetId || '']);
    }
    // A leading apostrophe stops Excel from running a cell that starts with = + - @ as a formula.
    const cell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
    const csv = '﻿' + lines.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sacradigit-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logActivity('Export', `Audit log — ${rows.length} entries (CSV)`);
    showToast(`Exported ${rows.length} audit entries.`);
  });

  /* ---------- load (live) ---------- */

  client.models.AccessLog.observeQuery().subscribe({
    next: ({ items }) => {
      entries = items
        .map((log) => ({ log, dataType: dataTypeOf(log), actor: actorOf(log) }))
        .filter((e) => e.dataType)
        .map((e) => ({ ...e, who: whoLabel(e.actor), changes: changesOf(e.log) }))
        .sort((a, b) => new Date(b.log.createdAt) - new Date(a.log.createdAt));
      renderAccounts();
      render();
    },
    error: (err) => {
      console.error('Failed to load the audit log:', err);
      $('au-rows').innerHTML = '<tr><td colspan="5" class="empty-state">Couldn’t load the audit log.</td></tr>';
    },
  });
});
