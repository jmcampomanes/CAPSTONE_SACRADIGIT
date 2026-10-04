/* ============================================
   SacraDigit Admin — Parish Info
   Edits the parish contact details the Parish
   Assistant gives out (see ../parish-info.js).
   Head Admin only; a Secretary sees them
   read-only (the backend refuses their saves).
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUserName, isHeadAdmin } from '../auth.js';
import { initParishInfoEditor } from '../parish-info.js';

const toast = document.getElementById('toast');
let toastTimer;
function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }, 3000);
}

initParishInfoEditor({
  client,
  canEdit: isHeadAdmin(),
  userName: currentUserName() || 'Head Admin',
  showToast,
  onSaved: async (summary) => {
    try {
      await client.models.AccessLog.create({ userName: currentUserName() || 'Head Admin', fileName: summary, action: 'Updated parish contact info' });
    } catch (err) { console.warn('Could not write audit log entry:', err); }
  },
});
