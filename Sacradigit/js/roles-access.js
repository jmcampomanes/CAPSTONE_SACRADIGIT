/* ============================================
   SacraDigit Admin — Roles & Access
   Runs after dashboard.js. A read-only comparison of
   every role, from ../../shared/js/permissions.js.
   ============================================ */

import { matrixHtml } from '../../shared/js/permissions.js';

document.getElementById('roles-matrix').innerHTML = matrixHtml();
