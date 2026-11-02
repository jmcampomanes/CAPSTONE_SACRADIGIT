/* ============================================
   SacraDigit Admin — Payment Reports
   Runs after dashboard.js. Every payment recorded
   (../../shared/js/payments.js), by request type,
   method, status and date range, with totals, a CSV
   export and a printed report. Only verified payments
   count as received.
   ============================================ */

import { listPayments, paymentsReady, duplicateReferences, normalizeReference, PAYMENT_METHODS, PAYMENT_STATUS_LABELS } from '../../shared/js/payments.js';
import { printReport, tableHtml } from '../../shared/js/print-report.js';
import { logActivity } from '../../shared/js/activity-log.js';
import { peso } from '../../shared/js/parish-rules.js';
import { showToast } from './admin-ui.js';

const REQUEST_TYPES = ['Service', 'Mass Intention', 'Donation'];

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let rows = [];

  if (!paymentsReady()) {
    $('pay-unavailable').classList.remove('hidden');
    return;
  }

  $('pay-type').innerHTML = `<option value="">All requests</option>${REQUEST_TYPES.map(t => `<option>${t}</option>`).join('')}`;
  $('pay-method-filter').innerHTML = `<option value="">All methods</option>${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join('')}`;
  $('pay-status').innerHTML = `<option value="">All statuses</option>${Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}`;

  const dayOf = (r) => (r.createdAt || '').slice(0, 10);
  function filtered() {
    const [type, method, status, from, to] = ['pay-type', 'pay-method-filter', 'pay-status', 'pay-from', 'pay-to'].map(id => $(id).value);
    return rows.filter(r => (!type || r.requestType === type) && (!method || r.method === method) && (!status || r.status === status)
      && (!from || dayOf(r) >= from) && (!to || dayOf(r) <= to))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function render() {
    const shown = filtered();
    const verified = shown.filter(r => r.status === 'verified');
    const sum = (list) => list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const dup = duplicateReferences(rows);
    $('pay-total').textContent = peso(sum(verified));
    $('pay-waiting').textContent = peso(sum(shown.filter(r => r.status === 'submitted')));
    $('pay-count').textContent = String(shown.length);
    $('pay-by-type').innerHTML = REQUEST_TYPES.map(t => `<li><span>${t}</span><strong>${peso(sum(verified.filter(r => r.requestType === t)))}</strong></li>`).join('');
    $('pay-rows').innerHTML = shown.length ? shown.map(r => `
      <tr>
        <td>${esc(dayOf(r))}</td><td>${esc(r.requestType)}</td><td>${esc(r.payerName)}</td>
        <td>${esc(peso(r.amount))}</td><td>${esc(r.method)}</td>
        <td>${esc(r.referenceNumber)}${dup.has(normalizeReference(r.referenceNumber)) ? ' <span class="badge badge-red">Used twice</span>' : ''}</td>
        <td>${esc(PAYMENT_STATUS_LABELS[r.status] || r.status)}</td>
      </tr>`).join('') : '<tr><td colspan="7" class="text-center text-gray-400 py-6">No payments match.</td></tr>';
  }

  ['pay-type', 'pay-method-filter', 'pay-status', 'pay-from', 'pay-to'].forEach(id => $(id).addEventListener('change', render));

  const HEAD = ['Date', 'Request', 'Payer', 'Amount', 'Method', 'Transaction No.', 'Status'];
  const cells = (r) => [dayOf(r), r.requestType, r.payerName, r.amount, r.method, r.referenceNumber, PAYMENT_STATUS_LABELS[r.status] || r.status];

  $('pay-export').addEventListener('click', () => {
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [HEAD, ...filtered().map(cells)].map(row => row.map(quote).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `sacradigit-payments-${new Date().toLocaleDateString('en-CA')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    logActivity('Download', 'Exported the payment report');
  });

  $('pay-print').addEventListener('click', () => {
    printReport({ title: 'Payments Received', subtitle: $('pay-from').value ? `${$('pay-from').value} to ${$('pay-to').value || 'today'}` : 'All dates', body: tableHtml(HEAD.map(label => ({ label })), filtered().map(r => cells(r).map(esc))) });
  });

  try {
    rows = await listPayments();
    render();
  } catch (err) {
    console.error('Failed to load payments:', err);
    showToast("Couldn't load the payments.", true);
  }
});
