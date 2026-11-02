/* ============================================
   SacraDigit Admin — Approval and payment panel
   The steps a service request goes through
   (../../shared/js/request-status.js), for staff:
   temporarily approve it with the amount to pay, check
   the transaction number, then confirm, or mark it void.
   Used on Schedule Offers and Blessings.

   mount(el, record) draws it in a page; open(record)
   shows it in its own window.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUserName } from '../../shared/js/auth.js';
import { logActivity } from '../../shared/js/activity-log.js';
import { feeFor, peso } from '../../shared/js/parish-rules.js';
import {
  liveStatus, tempApprovalOf, detailsWithTempApproval, suggestedAmount, STATUS_LABELS, DISTANCE_CHECK_KEY,
} from '../../shared/js/request-status.js';
import {
  paymentsReady, listPayments, paymentFor, reviewPayment, recordOfficePayment, duplicateReferences, normalizeReference, PAYMENT_METHODS,
} from '../../shared/js/payments.js';
import { baptismTypeOf, serviceLabel, fmtLong } from '../../shared/js/public-baptism.js';
import { notifyServiceUpdate } from '../../shared/js/email-notify.js';
import { coupleEmails } from '../../shared/js/wedding-rules.js';
import { reportEmail } from './admin-ui.js';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const detailsOf = (r) => { try { return (typeof r.details === 'string' ? JSON.parse(r.details) : r.details) || {}; } catch { return {}; } };

export function initRequestApproval({ showToast, onChange = () => {} }) {
  let target = null;   // the element showing the panel
  let record = null;
  let payments = [];

  document.body.insertAdjacentHTML('beforeend', `
    <div id="ra-modal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header"><h3 class="modal-title" id="ra-title">Approval and Payment</h3>
          <button type="button" class="modal-close" id="ra-close" aria-label="Close">×</button></div>
        <div class="modal-body" id="ra-body"></div>
      </div>
    </div>`);
  const modal = document.getElementById('ra-modal');
  document.getElementById('ra-close').addEventListener('click', () => modal.classList.add('hidden'));

  async function update(fields) {
    const res = await client.models.Blessing.update({ id: record.id, ...fields });
    if (res.errors) throw new Error(res.errors.map(e => e.message).join('; '));
    Object.assign(record, res.data || fields);
    onChange(record);
  }

  const email = (status, message, declineReason, extraLines = []) => reportEmail(notifyServiceUpdate({
        copyTo: coupleEmails(record),
    to: record.email, name: record.requesterName, serviceType: serviceLabel(record), status,
    date: record.date ? fmtLong(record.date) : '', time: record.time, location: record.location, contact: record.contact,
    declineReason, detailsLines: extraLines,
  }), record.requesterName, message);

  async function draw() {
    if (!target || !record) return;
    if (!paymentsReady()) { target.innerHTML = ''; return; }
    try { payments = await listPayments(); } catch (err) {
      console.error('Failed to load payments:', err);
      target.innerHTML = '<p class="bt-admin-warn">Couldn’t load the payment records.</p>';
      return;
    }
    const status = liveStatus(record);
    const temp = tempApprovalOf(record);
    const pay = paymentFor(payments, record.id);
    const dup = pay && duplicateReferences(payments).has(normalizeReference(pay.referenceNumber));
    const needsDistanceCheck = detailsOf(record)[DISTANCE_CHECK_KEY];
    const type = baptismTypeOf(record);
    const fee = feeFor(record.type, { baptismType: type });
    let body = '';

    if (status === 'pending') {
      body = `
        ${needsDistanceCheck ? '<p class="bt-admin-warn">Outside the distance bands. Check that the priest can go before approving.</p>' : ''}
        <p class="bt-admin-sub">Standard fee: ${esc(fee.label)}</p>
        <label class="form-label mt-2" for="ra-amount">Amount to pay (₱) <span class="text-red-500">*</span></label>
        <input id="ra-amount" type="number" min="0" class="form-input" value="${fee.kind === 'quoted' && !detailsOf(record)['Offered Amount'] ? '' : esc(suggestedAmount(record, fee.amount))}" />
        <label class="form-label mt-2" for="ra-note">What the amount covers ${fee.kind === 'quoted' ? '<span class="text-red-500">*</span>' : '(optional)'}</label>
        <textarea id="ra-note" class="form-input" rows="2" placeholder="e.g. Stipend ₱500, additional sponsors ₱100"></textarea>
        <button type="button" class="btn-lavender mt-3" data-ra="approve">Temporarily Approve</button>`;
    } else if (status === 'temporary-approval') {
      body = `
        <p class="bt-admin-sub">${esc(peso(temp?.amount))} due by ${esc(fmtLong(temp?.deadline))}.${temp?.note ? ` ${esc(temp.note)}` : ''}</p>
        <p class="bt-admin-sub mt-2">Paid at the office? Record it here:</p>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <select id="ra-method" class="form-input">${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join('')}</select>
          <input id="ra-ref" class="form-input" placeholder="OR or transaction no." />
        </div>
        <button type="button" class="btn-lavender mt-3" data-ra="office-paid">Record Payment and Confirm</button>`;
    } else if (status === 'payment-submitted') {
      body = `
        <p class="bt-admin-sub">${esc(peso(pay?.amount))} by ${esc(pay?.method)}, transaction no. <strong>${esc(pay?.referenceNumber)}</strong>.</p>
        <p class="bt-admin-sub">Check this against the ${esc(pay?.method || 'payment')} history before confirming.</p>
        ${dup ? '<p class="bt-admin-warn">This transaction number was used on another payment.</p>' : ''}
        <div class="flex gap-2 mt-3">
          <button type="button" class="btn-lavender" data-ra="verify">Verify and Confirm</button>
          <button type="button" class="btn-danger-outline" data-ra="reject">Reject Payment</button>
        </div>`;
    } else if (status === 'void') {
      body = `
        <p class="bt-admin-warn">Void: not paid by ${esc(fmtLong(temp?.deadline))}.</p>
        ${record.status === 'void' ? '' : '<button type="button" class="btn-secondary mt-2" data-ra="void">Mark Void and Tell Them</button>'}`;
    } else if (status === 'scheduled' && pay) {
      body = `<p class="bt-admin-sub">Paid ${esc(peso(pay.amount))}, ${esc(pay.status)}${pay.verifiedBy ? ` by ${esc(pay.verifiedBy)}` : ''}.</p>`;
    }
    target.innerHTML = body ? `
      <section class="bn-panel ra-panel">
        <h4 class="bn-title">Approval and Payment <span class="badge badge-gray">${esc(STATUS_LABELS[status] || status)}</span></h4>
        ${body}
      </section>` : '';
  }

  async function act(name) {
    const by = currentUserName() || 'Parish Office';
    const label = serviceLabel(record);
    if (name === 'approve') {
      const amount = Number(target.querySelector('#ra-amount').value);
      const note = target.querySelector('#ra-note').value.trim();
      const fee = feeFor(record.type, { baptismType: baptismTypeOf(record) });
      if (!(amount > 0) && fee.kind !== 'quoted') throw new Error('Enter the amount to pay.');
      if (target.querySelector('#ra-amount').value === '') throw new Error('Enter the amount to pay.');
      if (fee.kind === 'minimum' && amount < fee.amount) throw new Error(`The minimum is ${peso(fee.amount)}.`);
      if (fee.kind === 'quoted' && !note) throw new Error('Say what the amount covers.');
      await update({ status: 'temporary-approval', details: detailsWithTempApproval(record, { amount, note, by }) });
      const t = tempApprovalOf(record);
      email('approved', `${label} temporarily approved for ${record.requesterName}.`, undefined, [`Amount to pay: ${peso(amount)}`, `Pay by: ${fmtLong(t.deadline)}, or this request becomes void.`]);
    } else if (name === 'office-paid') {
      const ref = target.querySelector('#ra-ref').value.trim();
      await recordOfficePayment({
        requestType: 'Service', requestId: record.id, payerName: record.requesterName, amount: tempApprovalOf(record).amount,
        method: target.querySelector('#ra-method').value, referenceNumber: ref, verifiedBy: by, note: 'Paid at the parish office',
      });
      await update({ status: 'scheduled' });
      logActivity('Approve', `Payment recorded at the office — ${label} for ${record.requesterName}`, { targetType: 'Blessing', targetId: record.id });
      email('approved', `${label} confirmed for ${record.requesterName}.`);
    } else if (name === 'verify') {
      await reviewPayment(paymentFor(payments, record.id).id, 'verified', by);
      await update({ status: 'scheduled' });
      logActivity('Approve', `Payment verified — ${label} for ${record.requesterName}`, { targetType: 'Blessing', targetId: record.id });
      email('approved', `${label} confirmed for ${record.requesterName}.`);
    } else if (name === 'reject') {
      await reviewPayment(paymentFor(payments, record.id).id, 'rejected', by);
      await update({ status: 'temporary-approval' });
      logActivity('Decline', `Payment rejected — ${label} for ${record.requesterName}`, { targetType: 'Blessing', targetId: record.id });
      email('rescheduled', `Payment rejected. ${record.requesterName} was told to check it.`, 'We could not find your payment. Please check your transaction number and send it again before the deadline.');
    } else if (name === 'void') {
      await update({ status: 'void', declineReason: 'Payment was not received by the deadline.' });
      logActivity('Cancel', `Voided, unpaid — ${label} for ${record.requesterName}`, { targetType: 'Blessing', targetId: record.id });
      email('cancelled', `${label} marked void.`, 'Payment was not received by the deadline.');
    }
  }

  const root = (el) => el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ra]');
    if (!btn || !record) return;
    btn.disabled = true;
    try {
      await act(btn.dataset.ra);
      await draw();
    } catch (err) {
      console.error('Approval step failed:', err);
      showToast(err.message || "Couldn't save that.", true);
      btn.disabled = false;
    }
  });
  root(document.getElementById('ra-body'));
  const wired = new WeakSet();

  return {
    mount(el, r) {
      if (!wired.has(el)) { wired.add(el); root(el); }
      target = el;
      record = r;
      return draw();
    },
    open(r) {
      target = document.getElementById('ra-body');
      record = r;
      modal.classList.remove('hidden');
      return draw();
    },
  };
}
