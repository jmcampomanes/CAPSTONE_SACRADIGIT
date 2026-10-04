/* ============================================
   Sacra ITech — Parish Info
   Edits the parish contact details the Parish
   Assistant gives out (see ../parish-info.js).
   Every save is recorded in Activity Logs.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUserName } from '../auth.js';
import { showToast, logItAction, ITECH_USER } from './itech-shell.js';
import { initParishInfoEditor } from '../parish-info.js';

initParishInfoEditor({
  client,
  canEdit: true,
  userName: currentUserName() || ITECH_USER,
  showToast,
  onSaved: (summary) => logItAction('Updated parish contact info', summary),
});
