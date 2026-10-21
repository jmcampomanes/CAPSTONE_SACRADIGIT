/* ============================================
   SacraDigit — Request First Communion Certificate Scripts
   Runs after user-shell.js. The form itself is
   shared with the other request pages: see
   certificate-request-page.js.
   ============================================ */

import { initCertificateRequestPage } from './certificate-request-page.js';

document.addEventListener('DOMContentLoaded', () => {
  initCertificateRequestPage('first-communion');
});
