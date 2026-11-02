/* ============================================
   SacraDigit — Terms and Data Privacy consent
   The versioned text people accept, and the record
   of who accepted which version and when.

   DRAFT: written around the Data Privacy Act of 2012
   (RA 10173). The parish must review this text before
   it is used. When the wording changes, raise
   CONSENT_VERSION so the record shows which text each
   person saw.

   Purposes: 'sign-up', 'parish-server', 'profile',
   'service-request'.

   Saved in ConsentRecord (BACKEND_CHANGES.md). Sign-up
   happens before there is a session, so that consent
   waits in this browser and is saved at first sign-in
   by flushPendingConsent(). Until the model is
   deployed, consents stay queued in the browser.
   ============================================ */

export const CONSENT_VERSION = '2026-11-draft';
const PENDING_KEY = 'sacradigit_pending_consent';

export const TERMS_SECTIONS = [
  ['What we collect', 'Your name, contact details, address, the sacraments and services you request, documents you submit, payment references, and, only if you choose to give them, your birthdate, sex, PWD status and any accommodations you need.'],
  ['Why we collect it', 'To process your requests, keep the parish’s sacramental records, contact you, schedule services, and prepare statistics that do not identify anyone.'],
  ['Who can see it', 'Only parish staff who need it for their work. Your data is not sold. It is shared with others only when you ask, or when the law requires it.'],
  ['How long we keep it', 'Sacramental records are kept permanently by the parish. Other data is kept only as long as needed for the purpose above.'],
  ['Your rights', 'Under the Data Privacy Act of 2012 (RA 10173) you may ask to see your data, correct it, withdraw your consent, or file a complaint with the National Privacy Commission. To do so, contact the parish office.'],
  ['Using this system', 'Give true information and use only your own account. Requests may be cancelled if the details are false or the requirements and payment are not completed on time.'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The readable text, in a box that opens in place. */
export const termsHtml = () => `
  <details class="consent-terms">
    <summary>Read the Terms and Data Privacy Statement</summary>
    <div class="consent-text">
      ${TERMS_SECTIONS.map(([title, text]) => `<p><strong>${esc(title)}.</strong> ${esc(text)}</p>`).join('')}
    </div>
  </details>`;

/** A required checkbox with the text above it. */
export const consentBoxHtml = (id, label = 'I have read and agree to the Terms and Data Privacy Statement.') => `
  <div class="consent-box" id="${id}-box">
    ${termsHtml()}
    <label class="consent-check">
      <input type="checkbox" id="${id}" />
      <span>${esc(label)} <span class="text-red-500">*</span></span>
    </label>
  </div>`;

function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function writePending(list) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* private mode */ }
}

/** Remembers a consent until it can be saved. */
export function queueConsent(purpose) {
  writePending([...readPending(), { purpose, version: CONSENT_VERSION, acceptedAt: new Date().toISOString() }]);
}

async function save(client, subjectKey, c) {
  const res = await client.models.ConsentRecord.create({ subjectKey, ...c });
  if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
}

/** Saves a consent now, or queues it when the model isn't deployed. */
export async function recordConsent(client, subjectKey, purpose) {
  const c = { purpose, version: CONSENT_VERSION, acceptedAt: new Date().toISOString() };
  if (!client.models.ConsentRecord || !subjectKey) { writePending([...readPending(), c]); return; }
  try { await save(client, subjectKey, c); } catch (err) {
    console.warn('Could not save consent yet:', err);
    writePending([...readPending(), c]);
  }
}

/** Sends anything queued. Called once the person is signed in. */
export async function flushPendingConsent(client, subjectKey) {
  const list = readPending();
  if (!list.length || !client.models.ConsentRecord || !subjectKey) return;
  const left = [];
  for (const c of list) {
    try { await save(client, subjectKey, c); } catch { left.push(c); }
  }
  writePending(left);
}
