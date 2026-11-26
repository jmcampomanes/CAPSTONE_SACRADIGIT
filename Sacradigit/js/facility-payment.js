/* ============================================
   SacraDigit Admin — Facility booking payment panel
   Shown in a pending booking's details window. A facility
   booking with a fee is held as 'pending' until its payment is
   dealt with, in one of two ways:

   - the parishioner paid online while booking: the panel shows
     the amount, method and transaction number to check against
     the GCash/Maya history. Verify and Confirm saves the payment
     as verified (it then counts in Payment Reports) and confirms
     the booking. Reject Payment marks the payment rejected and
     leaves the booking pending.
   - the parishioner chose to pay at the parish: record what they
     paid at the office (a payment saved as already verified), which
     confirms the booking. "Confirm without payment" is there for
     a fee the parish waives.

   mount(el, booking) draws the panel into el.
   ============================================ */

import { currentUserName } from '../../shared/js/auth.js';
import { client } from '../../shared/js/amplify-init.js';
import { facilityFee, peso } from '../../shared/js/parish-rules.js';
import {
  paymentsReady, listPayments, paymentFor, reviewPayment, recordOfficePayment, duplicateReferences, normalizeReference, PAYMENT_METHODS,
} from '../../shared/js/payments.js';
import { trackingId } from '../../shared/js/tracking-id.js';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

const minutesOf = (t) => {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3] || '') || (!m[3] && Number(m[1]) >= 12)) h += 12;
  return h * 60 + Number(m[2]);
};

/** Whole hours a booking runs ("9:00 AM" to "11:00 AM" is 2). */
export const hoursOf = (b) => {
  const start = minutesOf(b?.startTime), end = minutesOf(b?.endTime);
  return start !== null && end !== null && end > start ? Math.max(1, Math.round((end - start) / 60)) : 1;
};

/** The fee for a booking, from the parish's current rates. */
export const feeOf = (b) => facilityFee(b?.facilityName, hoursOf(b));

export function initFacilityPayment({ showToast, onConfirmed = () => {} }) {
  let target = null;
  let booking = null;
  let payments = [];

  async function confirmBooking() {
    const res = await client.models.FacilityBooking.update({ id: booking.id, status: 'approved' });
    if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
    booking.status = 'approved';
    onConfirmed(booking);
  }

  async function draw() {
    if (!target || !booking) return;
    if (!paymentsReady()) { target.innerHTML = ''; return; }
    try { payments = await listPayments(); } catch (err) {
      console.error('Failed to load payments:', err);
      target.innerHTML = '<p class="bt-admin-warn">Couldn’t load the payment records.</p>';
      return;
    }
    const pay = paymentFor(payments, booking.id);
    const fee = feeOf(booking);
    const ref = trackingId('booking', booking.id);
    let body = '';

    if (booking.status === 'pending') {
      if (pay && pay.status === 'submitted') {
        const dup = duplicateReferences(payments).has(normalizeReference(pay.referenceNumber));
        body = `
          <p class="bt-admin-sub">Paid with the booking: ${esc(peso(pay.amount))} by ${esc(pay.method)}, transaction no. <strong>${esc(pay.referenceNumber)}</strong>.</p>
          <p class="bt-admin-sub">Check this against the ${esc(pay.method || 'payment')} history. Confirming saves the payment to the records and confirms the booking.</p>
          ${fee.min && Number(pay.amount) < fee.min ? `<p class="bt-admin-warn">Paid less than the ${esc(peso(fee.min))} fee.</p>` : ''}
          ${dup ? '<p class="bt-admin-warn">This transaction number was used on another payment.</p>' : ''}
          <div class="flex gap-2 mt-3">
            <button type="button" class="btn-lavender" data-fp="verify">Verify and Confirm</button>
            <button type="button" class="btn-danger-outline" data-fp="reject">Reject Payment</button>
          </div>`;
      } else if (fee.min > 0) {
        body = `
          <p class="bt-admin-sub">Fee: ${esc(fee.label)}.${pay?.status === 'rejected' ? ' The earlier payment was rejected.' : ' No payment yet: the parishioner chose to pay at the parish.'}</p>
          <p class="bt-admin-sub mt-2">Paid at the office? Record it here:</p>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <select id="fp-method" class="form-input">${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join('')}</select>
            <input id="fp-ref" class="form-input" placeholder="OR or transaction no." />
          </div>
          <input id="fp-amount" type="number" class="form-input mt-2" min="0" step="50" value="${fee.min}" aria-label="Amount received" />
          <div class="flex gap-2 mt-3">
            <button type="button" class="btn-lavender" data-fp="office">Record Payment and Confirm</button>
            <button type="button" class="btn-secondary" data-fp="waive">Confirm Without Payment</button>
          </div>`;
      }
    } else if (booking.status === 'approved' && pay) {
      body = `<p class="bt-admin-sub">Paid ${esc(peso(pay.amount))} by ${esc(pay.method)}, transaction no. ${esc(pay.referenceNumber)}: ${esc(pay.status)}${pay.verifiedBy ? ` by ${esc(pay.verifiedBy)}` : ''}.</p>`;
    }

    target.innerHTML = body ? `
      <section class="bn-panel ra-panel">
        <h4 class="bn-title">Payment <span class="badge badge-gray">${esc(booking.status === 'approved' ? 'Confirmed' : pay?.status === 'submitted' ? 'Paid, waiting for check' : 'Waiting for payment')}</span></h4>
        <p class="bt-admin-sub">Reference no. <strong>${esc(ref)}</strong>${pay ? ` · Payment ${esc(trackingId('payment', pay.id))}` : ''}</p>
        ${body}
      </section>` : '';
  }

  async function act(name) {
    const by = currentUserName() || 'Parish Office';
    const pay = paymentFor(payments, booking.id);
    if (name === 'verify') {
      await reviewPayment(pay.id, 'verified', by);
      await confirmBooking();
    } else if (name === 'reject') {
      await reviewPayment(pay.id, 'rejected', by);
      showToast('Payment rejected. The booking stays pending.');
    } else if (name === 'office') {
      const ref = target.querySelector('#fp-ref').value.trim();
      const amount = Number(target.querySelector('#fp-amount').value);
      const fee = feeOf(booking);
      if (!ref) throw new Error('Enter the receipt or transaction number.');
      if (!(amount >= fee.min)) throw new Error(`The fee is ${peso(fee.min)}.`);
      await recordOfficePayment({
        requestType: 'Facility Booking', requestId: booking.id, payerName: booking.requesterName, amount,
        method: target.querySelector('#fp-method').value, referenceNumber: ref, verifiedBy: by, note: 'Paid at the parish office',
      });
      await confirmBooking();
    } else if (name === 'waive') {
      await confirmBooking();
    }
  }

  return {
    mount(el, b) {
      target = el;
      booking = b;
      if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', async (e) => {
          const btn = e.target.closest('[data-fp]');
          if (!btn || !booking) return;
          btn.disabled = true;
          try {
            await act(btn.dataset.fp);
            await draw();
          } catch (err) {
            console.error('Facility payment step failed:', err);
            showToast(err.message || "Couldn't save that.", true);
            btn.disabled = false;
          }
        });
      }
      return draw();
    },
  };
}
