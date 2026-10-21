/* ============================================
   SacraDigit — User Request Certificate Scripts
   Runs after user-shell.js.
   Lists the certificate types; each card opens that
   certificate's own request page (see
   certificate-request-page.js).
   ============================================ */

import { CERTIFICATE_TYPES } from './certificate-request-page.js';

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('cert-type-grid').innerHTML = CERTIFICATE_TYPES.map(c => `
    <a href="${c.page}" class="cert-type-card" data-id="${c.id}">
      <div class="cert-icon" style="background-color:${c.iconBg};color:${c.iconColor};">${c.icon}</div>
      <p class="cert-type-name">${c.name}</p>
      <p class="cert-type-desc">${c.desc}</p>
      <span class="cert-type-cta">Start request
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 12h14M13 6l6 6-6 6"/></svg>
      </span>
    </a>`).join('');

});
