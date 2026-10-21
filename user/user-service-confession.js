/* ============================================
   SacraDigit — Confession / Reconciliation Scripts
   Runs after user-shell.js. The form itself is
   shared with the other request pages: see
   service-request-page.js.
   ============================================ */

import { initServiceRequestPage } from './service-request-page.js';

document.addEventListener('DOMContentLoaded', () => {
  initServiceRequestPage('confession');
});
