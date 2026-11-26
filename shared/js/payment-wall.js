/* ============================================
   SacraDigit — Payment wall (pop-up)
   The pop-up a parishioner must deal with before a booking
   is sent. Three ways out:

     { type: 'paid', amount, method, referenceNumber }
         they paid online (at least the minimum, more is fine)
         and typed the transaction number
     { type: 'parish' }
         they will settle it at the parish office instead
     { type: 'cancel' }
         they closed it (×, Cancel, Esc, or a click outside);
         nothing changes

   askPayment() only asks. It never saves anything: the page
   decides what to do with the answer (payments.js saves the
   PaymentRecord when the booking itself is saved).

   Uses the shared QR box (payment-box.js) and the modal
   styles of the parishioner portal (user-shell.css).
   ============================================ */

import { mountPaymentBox } from './payment-box.js';
import { peso } from './parish-rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * min    the least they may pay (₱)
 * label  how the fee is worked out, e.g. "₱500 per hour × 2 hours = ₱1,000"
 * title  heading of the pop-up
 * parishNote  what "Pay at the parish instead" means for this booking
 */
export function askPayment({ min, label = '', title = 'Payment', parishNote = 'Your booking goes to the office without a payment, and you settle the fee at the parish office.' }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pw-title');
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="pw-title">${esc(title)}</h3>
          <button type="button" class="modal-close" data-pw="cancel" aria-label="Cancel payment">&times;</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-gray-600">${esc(label ? `The fee is ${label}. ` : '')}You can pay more, but not less than ${esc(peso(min))}. After you pay, you’ll come back to press Submit.</p>
          <label class="form-label mt-3" for="pw-amount">Amount to pay (₱) <span class="text-red-500">*</span></label>
          <input type="number" id="pw-amount" class="form-input" step="50" min="${Number(min)}" value="${Number(min)}" />
          <p class="form-error-msg hidden" id="pw-amount-error" role="alert"></p>
          <div id="pw-box" class="mt-3"></div>
          <div class="flex flex-wrap gap-2 mt-4">
            <button type="button" class="btn-secondary" data-pw="cancel">Cancel</button>
            <button type="button" class="btn-secondary" data-pw="parish">Pay at the parish instead</button>
          </div>
          <p class="text-xs text-gray-500 mt-2">${esc(parishNote)}</p>
        </div>
      </div>`;
    document.body.appendChild(modal);

    let finished = false;
    const onKey = (e) => { if (e.key === 'Escape') finish({ type: 'cancel' }); };
    function finish(answer) {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey);
      modal.remove();
      resolve(answer);
    }
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) return finish({ type: 'cancel' });
      const btn = e.target.closest('[data-pw]');
      if (btn) finish({ type: btn.dataset.pw });
    });

    const input = modal.querySelector('#pw-amount');
    const err = modal.querySelector('#pw-amount-error');
    const box = modal.querySelector('#pw-box');
    let drawn = '';

    function draw() {
      const amount = Number(input.value);
      if (!(amount >= min)) {
        err.textContent = `The minimum is ${peso(min)}.`;
        err.classList.remove('hidden');
        box.innerHTML = '';
        drawn = '';
        return;
      }
      err.classList.add('hidden');
      if (drawn === String(amount)) return;
      const keepRef = box.querySelector('#pay-ref')?.value || '';
      drawn = String(amount);
      mountPaymentBox(box, {
        amount,
        title: 'Pay Now',
        confirmLabel: 'I Have Paid',
        onConfirm: async ({ method, referenceNumber }) => {
          const chosen = Number(input.value);
          if (!(chosen >= min)) throw new Error(`The minimum is ${peso(min)}.`);
          finish({ type: 'paid', amount: chosen, method, referenceNumber });
        },
      });
      const ref = box.querySelector('#pay-ref');
      if (ref && keepRef) ref.value = keepRef;
    }

    let typing = 0;
    input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(draw, 450); });
    draw();
    modal.querySelector('[data-pw="cancel"]').focus({ preventScroll: true });
  });
}
