/* ============================================
   SacraDigit — Payment box
   The QR with the amount filled in, then a transaction
   number box and a confirm button. Shared by service
   requests, Mass intentions and donations.

   Nothing is recorded until the person presses confirm,
   so leaving the page saves nothing. The app can't see
   money arrive: staff check the number against the
   GCash/Maya history afterwards (payments.js).

   Styles: parish-common.css (.pay-*).
   ============================================ */

import QRCode from 'qrcode';
import { withAmount, qrPhField } from './qrph.js';
import { PAYMENT_ACCOUNTS } from './donation-payment-info.js';
import { peso } from './parish-rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QR_METHODS = ['GCash', 'Maya'];

/** A transaction number is at least 6 letters or digits. */
export const referenceOk = (ref) => String(ref || '').replace(/[\s-]/g, '').length >= 6;

/**
 * Draws the box in `el`.
 * onConfirm({ method, referenceNumber }) may throw: the message is shown and the box stays.
 */
export function mountPaymentBox(el, { amount, title = 'Pay Now', confirmLabel = 'I Have Paid', onConfirm }) {
  el.innerHTML = `
    <div class="pay-box">
      <p class="pay-title">${esc(title)}</p>
      <p class="pay-amount">${esc(peso(amount))}</p>
      <label class="form-label" for="pay-method">Pay with</label>
      <select id="pay-method" class="form-input">${QR_METHODS.map(m => `<option>${m}</option>`).join('')}</select>
      <figure class="pay-qr" id="pay-qr"></figure>
      <p class="pay-hint">Scan the QR in your app and pay the exact amount. Then type the transaction number from your receipt.</p>
      <label class="form-label" for="pay-ref">Transaction number <span class="text-red-500">*</span></label>
      <input id="pay-ref" class="form-input" autocomplete="off" inputmode="text" />
      <p class="form-error-msg hidden" id="pay-error" role="alert"></p>
      <button type="button" class="btn-lavender pay-confirm" id="pay-confirm">${esc(confirmLabel)}</button>
    </div>`;

  const q = (sel) => el.querySelector(sel);

  async function drawQr() {
    const method = q('#pay-method').value;
    const acct = PAYMENT_ACCOUNTS[method];
    const figure = q('#pay-qr');
    const qr = acct?.qr ? withAmount(acct.qr, amount) : null;
    if (!qr) { figure.innerHTML = '<figcaption>This QR isn’t available. Please ask the parish office.</figcaption>'; return; }
    try {
      const svg = await QRCode.toString(qr, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
      figure.innerHTML = `<div class="pay-qr-code" role="img" aria-label="${esc(method)} QR code for ${esc(peso(amount))}">${svg}</div>
        <figcaption>to ${esc(acct.accountName || qrPhField(qr, '59') || 'the parish')}</figcaption>`;
    } catch (err) {
      console.error('Failed to draw QR:', err);
      figure.innerHTML = '<figcaption>This QR couldn’t be drawn. Please ask the parish office.</figcaption>';
    }
  }
  q('#pay-method').addEventListener('change', drawQr);
  drawQr();

  q('#pay-confirm').addEventListener('click', async () => {
    const error = q('#pay-error');
    const referenceNumber = q('#pay-ref').value.trim();
    error.classList.add('hidden');
    if (!referenceOk(referenceNumber)) {
      error.textContent = 'Please type the transaction number from your receipt.';
      error.classList.remove('hidden');
      q('#pay-ref').focus();
      return;
    }
    const btn = q('#pay-confirm');
    btn.disabled = true;
    try {
      await onConfirm({ method: q('#pay-method').value, referenceNumber });
    } catch (err) {
      console.error('Payment could not be saved:', err);
      error.textContent = err.message || 'That didn’t save. Please try again.';
      error.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}
