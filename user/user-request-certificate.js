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
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
      </span>
    </a>`).join('');

});
