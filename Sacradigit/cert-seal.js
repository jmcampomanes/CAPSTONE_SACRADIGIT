/* ============================================
   SacraDigit Admin — parish seal on certificate previews
   A burgundy seal stamps down onto the on-screen
   certificate (motion-guide.html, "Certificate seal
   stamp"). It's decoration for the preview only:
   hidden when printing and left out of the saved
   official copy (html2canvas skips it).
   Imported by every *-certificate-print.js.
   ============================================ */

const STYLE = `
.cert-seal-stamp {
  position: absolute; right: 2.25rem; bottom: 2rem; z-index: 2; width: 5.25rem; height: 5.25rem; border-radius: 50%;
  display: grid; place-items: center; text-align: center; pointer-events: none;
  background: radial-gradient(circle, #a83a4c, #8a3040); border: 3px double #e9c9a0; color: #fbe7c6;
  font: 800 0.6rem/1.15 Georgia, serif; letter-spacing: 0.08em; opacity: 0.92;
  box-shadow: 0 6px 16px -6px rgba(90, 20, 32, 0.6); transform: rotate(-12deg);
  animation: cert-seal-stamp 0.55s cubic-bezier(.34, 1.56, .64, 1) 0.3s both;
}
@keyframes cert-seal-stamp {
  0% { opacity: 0; transform: scale(2.2) rotate(-25deg); }
  60% { opacity: 0.92; transform: scale(0.92) rotate(-12deg); }
  100% { transform: scale(1) rotate(-12deg); }
}
@media (prefers-reduced-motion: reduce) { .cert-seal-stamp { animation: none; } }
:root:is([data-a11y="on"], [data-motion="reduce"]) .cert-seal-stamp { animation: none; }
@media print { .cert-seal-stamp { display: none !important; } }
`;

function stamp() {
  const border = document.querySelector('#certificate .certificate-border');
  if (!border || border.querySelector('.cert-seal-stamp')) return;
  const st = document.createElement('style');
  st.textContent = STYLE;
  document.head.appendChild(st);
  const seal = document.createElement('div');
  seal.className = 'cert-seal-stamp no-print';
  seal.setAttribute('aria-hidden', 'true');
  seal.setAttribute('data-html2canvas-ignore', ''); // never part of the official copy
  seal.innerHTML = 'PARISH<br>SEAL';
  border.appendChild(seal);
}

try {
  if (localStorage.getItem('sacradigit_motion') === 'reduce') document.documentElement.dataset.motion = 'reduce';
} catch { /* private mode */ }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp, { once: true });
else stamp();
