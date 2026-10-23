/* ============================================
   SacraDigit — mobile numbers
   Every box that takes a person's contact number
   is an 11-digit mobile number, numbers only
   (09171234567), in every portal. Mark the box with
   data-mobile: typing keeps only digits, up to 11,
   and a pasted "+63 917 123 4567" becomes
   09171234567. Forms check with isMobile() before
   saving and save mobileDigits().
   (The parish office's own phone on Parish Info is
   a landline, so it isn't one of these.)
   ============================================ */

export const MOBILE_HINT = 'Enter an 11-digit mobile number, e.g. 09171234567.';
export const MOBILE_PLACEHOLDER = 'e.g. 09171234567';

/** Digits only; "+63 917…" / "63917…" becomes "0917…". */
export function mobileDigits(value) {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('63')) d = `0${d.slice(2)}`;
  return d.slice(0, 11);
}

/** Exactly 11 digits. */
export const isMobile = (value) => /^\d{11}$/.test(String(value ?? '').replace(/\D/g, '').replace(/^63(?=\d{10}$)/, '0'));

// One listener for every marked box, including ones added later (pop-ups, page views).
if (!window.__sdMobileInputs) {
  window.__sdMobileInputs = true;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.hasAttribute('data-mobile')) return;
    const clean = mobileDigits(el.value);
    if (clean !== el.value) el.value = clean;
  });
}
