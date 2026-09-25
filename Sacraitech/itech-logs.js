/* ============================================
   Sacra ITech — Activity Logs
   The full AccessLog audit trail (admin bookings
   actions, file access, reschedules, IT changes),
   live, newest first. Search by user/details,
   filter by action and date range, page through,
   and export exactly what's filtered as CSV.
   ============================================ */

import { client } from '../amplify-init.js';
import { escapeHtml, formatDateTime, actionKind, downloadFile, toCsv, todayStamp, logItAction, showToast } from './itech-shell.js';

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 25;

let logs = [];
let page = 1;

function filtered() {
  const q = $('log-search').value.trim().toLowerCase();
  const action = $('log-action').value;
  const from = $('log-from').value; // yyyy-mm-dd, local
  const to = $('log-to').value;
  return logs.filter(l => {
    if (action && l.action !== action) return false;
    if (q && !`${l.userName || ''} ${l.fileName || ''}`.toLowerCase().includes(q)) return false;
    const day = new Date(l.createdAt).toLocaleDateString('en-CA'); // local yyyy-mm-dd
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

function render() {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (page > pages) page = pages;
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  $('log-tbody').innerHTML = slice.length === 0
    ? `<tr><td colspan="4" class="empty-state">${logs.length ? 'No log entries match these filters.' : 'No activity recorded yet.'}</td></tr>`
    : slice.map(l => `
      <tr>
        <td class="text-gray-500">${escapeHtml(formatDateTime(l.createdAt))}</td>
        <td class="font-medium text-gray-900">${escapeHtml(l.userName || '—')}</td>
        <td><span class="action-tag" data-kind="${actionKind(l.action)}">${escapeHtml(l.action || '—')}</span></td>
        <td class="wrap text-gray-600">${escapeHtml(l.fileName || '')}</td>
      </tr>`).join('');

  $('log-count').textContent = rows.length === logs.length
    ? `${logs.length.toLocaleString()} entries`
    : `${rows.length.toLocaleString()} of ${logs.length.toLocaleString()} entries`;
  $('log-page').textContent = `Page ${page} of ${pages}`;
  $('log-prev').disabled = page <= 1;
  $('log-next').disabled = page >= pages;
}

function refreshActionOptions() {
  const select = $('log-action');
  const current = select.value;
  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All actions</option>' + actions.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  if (actions.includes(current)) select.value = current;
}

client.models.AccessLog.observeQuery().subscribe({
  next: ({ items }) => {
    logs = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    refreshActionOptions();
    render();
  },
  error: (err) => {
    console.error('Failed to load logs:', err);
    $('log-tbody').innerHTML = '<tr><td colspan="4" class="empty-state">Couldn’t load the activity logs.</td></tr>';
  },
});

['log-search', 'log-action', 'log-from', 'log-to'].forEach(id => $(id).addEventListener('input', () => { page = 1; render(); }));
$('log-clear').addEventListener('click', () => {
  ['log-search', 'log-action', 'log-from', 'log-to'].forEach(id => { $(id).value = ''; });
  page = 1;
  render();
});
$('log-prev').addEventListener('click', () => { page -= 1; render(); });
$('log-next').addEventListener('click', () => { page += 1; render(); });

$('btn-export-logs').addEventListener('click', () => {
  const rows = filtered();
  if (!rows.length) { showToast('Nothing to export with these filters.', true); return; }
  const csv = toCsv(rows.map(l => ({ when: l.createdAt, user: l.userName || '', action: l.action || '', details: l.fileName || '' })));
  downloadFile(`sacradigit-activity-logs-${todayStamp()}.csv`, csv, 'text/csv');
  logItAction('Export', `Activity logs — ${rows.length} entries (CSV)`);
  showToast(`Exported ${rows.length} log entries.`);
});
