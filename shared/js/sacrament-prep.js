/* ============================================
   SacraDigit — Sacrament preparation tracker
   Baptism, Confirmation, First Communion and Wedding
   requests come with requirements (seminars, sponsor
   documents, CENOMAR, banns …). The Secretary ticks
   them off on Schedule Offers; the parishioner sees
   what's done and what's left on Requested Services.

   Stored inside the request's own `details` JSON
   (Blessing model) under CHECKLIST_KEY, as
     { [itemId]: { done: true, by: 'Name', at: ISO } }
   so no backend change is needed. Pages that list
   the request details skip that key (isPrepKey).
   Styles: service-schedule.css (.prep-*).
   ============================================ */

import { baptismChecklist, weddingChecklist } from './sacrament-rules.js';
import { isHiddenBaptismKey } from './public-baptism.js';
import { TEMP_KEY } from './request-status.js';
import { AGE_DOCS_KEY } from './wedding-rules.js';

export const CHECKLIST_KEY = 'Preparation Checklist';
export const UPLOADS_KEY = 'Uploaded Requirements';
export const PRIEST_KEY = 'Assigned Priest';

/* Things that can't be sent as a file: seminars, interviews, payments, and the
   items the parish must see in person. Everything else may be uploaded. */
const BRING_TO_OFFICE = new Set([
  'application', 'seminar', 'sponsor-docs', 'fee', 'catechism', 'confession', 'niche-paid',
  'photos', 'interview', 'banns', 'pre-cana', 'down-payment',
]);
export const requirementMode = (itemId) => (BRING_TO_OFFICE.has(itemId) ? 'bring' : 'upload');

/** Requirements per service (keys = Blessing.type, i.e. the service name).
    Baptism and Wedding follow the parish's published rules, kept in
    sacrament-rules.js. Item ids are what's saved on each request, so
    keep an id when only its wording changes. */
export const REQUIREMENTS = {
  get Baptism() { return baptismChecklist(); },
  'Confirmation': [
    ['baptismal-cert', 'Baptismal certificate (for confirmation purposes)'],
    ['seminar', 'Confirmation seminar / recollection attended'],
    ['sponsor-docs', 'Sponsor’s confirmation certificate'],
    ['fee', 'Stipend settled'],
  ],
  'First Communion': [
    ['baptismal-cert', 'Baptismal certificate'],
    ['catechism', 'Catechism classes completed'],
    ['confession', 'First Confession done'],
  ],
  'Inurnment': [
    ['death-cert', 'Death Certificate received'],
    ['cremation-cert', 'Cremation Certificate received'],
    ['niche-paid', 'Niche fully paid (see Columbary)'],
  ],
  get Wedding() { return weddingChecklist(); },
};

export const hasChecklist = (type) => !!REQUIREMENTS[type];
export const isPrepKey = (key) => key === CHECKLIST_KEY || key === UPLOADS_KEY || key === TEMP_KEY || key === AGE_DOCS_KEY || isHiddenBaptismKey(key);

function parseDetails(detailsJson) {
  if (!detailsJson) return {};
  if (typeof detailsJson === 'object') return { ...detailsJson };
  try { const d = JSON.parse(detailsJson); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}

function stateOf(details) {
  const raw = details[CHECKLIST_KEY];
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

/** [{ id, label, done, by, at }] for a request (empty when its service has no checklist). */
export function checklistFor(record) {
  const list = REQUIREMENTS[record?.type];
  if (!list) return [];
  const details = parseDetails(record.details);
  const state = stateOf(details);
  // Documents this couple's ages add (wedding-rules.js), with the reason for staff.
  const ageDocs = Array.isArray(details[AGE_DOCS_KEY]) ? details[AGE_DOCS_KEY].map(d => [d.id, d.why ? `${d.label}. ${d.why}` : d.label]) : [];
  return [...list, ...ageDocs].map(([id, label]) => ({ id, label, done: !!state[id]?.done, by: state[id]?.by || '', at: state[id]?.at || '' }));
}

/** { [itemId]: { path, name, review, reason } } */
export const uploadsOf = (record) => {
  const raw = parseDetails(record?.details)[UPLOADS_KEY];
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
};

/** Staff accept or reject an uploaded document. Accepting also ticks the item. */
export function detailsWithUploadReview(detailsJson, itemId, review, byWho, reason = '') {
  const details = parseDetails(detailsJson);
  const uploads = { ...uploadsOf({ details: JSON.stringify(details) }) };
  uploads[itemId] = { ...uploads[itemId], review, reason, by: byWho };
  details[UPLOADS_KEY] = uploads;
  const state = { ...stateOf(details) };
  if (review === 'accepted') state[itemId] = { done: true, by: byWho, at: new Date().toISOString() };
  else delete state[itemId];
  details[CHECKLIST_KEY] = state;
  return JSON.stringify(details);
}

/** { done, total } — total 0 when the service has no checklist. */
export function checklistProgress(record) {
  const items = checklistFor(record);
  return { done: items.filter(i => i.done).length, total: items.length };
}

/** The request's details JSON with one item ticked or unticked by `byWho`. */
export function detailsWithChecklistItem(detailsJson, itemId, done, byWho) {
  const details = parseDetails(detailsJson);
  const state = { ...stateOf(details) };
  if (done) state[itemId] = { done: true, by: byWho, at: new Date().toISOString() };
  else delete state[itemId];
  details[CHECKLIST_KEY] = state;
  return JSON.stringify(details);
}

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** Small "3/5 requirements" chip for list rows ('' when there's no checklist). */
export function progressChipHtml(record) {
  const { done, total } = checklistProgress(record);
  if (!total) return '';
  const complete = done === total;
  return `<span class="prep-chip${complete ? ' complete' : ''}" title="Preparation requirements done">${complete ? '✓ ' : ''}${done}/${total} requirements</span>`;
}

/**
 * The checklist block. editable → checkboxes the Secretary ticks
 * (data-prep-item); otherwise ✓ / ✗ rows for the parishioner, with what's left first.
 */
export function checklistHtml(record, { editable = false } = {}) {
  const items = checklistFor(record);
  if (!items.length) return '';
  const uploads = uploadsOf(record);
  const done = items.filter(i => i.done).length;
  const ordered = editable ? items : [...items.filter(i => !i.done), ...items.filter(i => i.done)];
  const rows = ordered.map(i => editable
    ? `<li class="prep-item${i.done ? ' done' : ''}">
        <label>
          <input type="checkbox" data-prep-item="${esc(i.id)}" ${i.done ? 'checked' : ''} />
          <span>${esc(i.label)}${i.done ? `<small>Ticked by ${esc(i.by || 'Parish Office')} · ${esc(when(i.at))}</small>` : ''}</span>
        </label>
        ${uploads[i.id] ? `<div class="prep-upload">
          <button type="button" class="btn-link-sm" data-prep-open="${esc(i.id)}">View ${esc(uploads[i.id].name)}</button>
          ${uploads[i.id].review ? `<small>${uploads[i.id].review === 'accepted' ? 'Accepted' : 'Rejected'}</small>` : ''}
          <button type="button" class="btn-link-sm" data-prep-review="accepted" data-item="${esc(i.id)}">Accept</button>
          <button type="button" class="btn-link-sm" data-prep-review="rejected" data-item="${esc(i.id)}">Reject</button>
        </div>` : ''}
      </li>`
    : `<li class="prep-item${i.done ? ' done' : ' missing'}">
        <span class="prep-mark" aria-hidden="true">${i.done ? '✓' : '✗'}</span>
        <span>${esc(i.label)}<small>${i.done ? `Received ${esc(when(i.at))}` : uploads[i.id]?.review === 'rejected' ? `Your file wasn’t accepted${uploads[i.id].reason ? `: ${esc(uploads[i.id].reason)}` : ''}` : uploads[i.id] ? 'File sent, waiting for review' : 'Still needed'}</small></span>
      </li>`).join('');
  const left = items.length - done;
  return `
    <div class="prep-box">
      <div class="prep-head">
        <p class="prep-title">Preparation Checklist</p>
        <span class="prep-count">${done} of ${items.length} done</span>
      </div>
      <div class="prep-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${done}" aria-label="Requirements done"><span style="width:${Math.round((done / items.length) * 100)}%"></span></div>
      ${!editable ? `<p class="prep-note">${left ? `${left} requirement${left === 1 ? '' : 's'} left — bring ${left === 1 ? 'it' : 'them'} to the parish office.` : 'All requirements are complete. Thank you!'}</p>` : ''}
      <ul class="prep-list">${rows}</ul>
    </div>`;
}

/**
 * What the service needs, shown before the form starts. With canUpload, items
 * that can be sent get a file box (data-upload-item); the rest say to bring them.
 */
export function requirementsBeforeFormHtml(type, { canUpload = false } = {}) {
  const list = REQUIREMENTS[type];
  if (!list) return '';
  return `
    <details class="prep-before" open>
      <summary>What you’ll need (${list.length})</summary>
      <ul>
        ${list.map(([id, label]) => {
          const upload = canUpload && requirementMode(id) === 'upload';
          return `<li>
            <span>${esc(label)}</span>
            ${upload
              ? `<label class="prep-file">Upload (optional)<input type="file" accept="image/jpeg,image/png,application/pdf" data-upload-item="${esc(id)}" /></label>`
              : '<small>Bring to the parish office</small>'}
          </li>`;
        }).join('')}
      </ul>
      ${canUpload ? '<p class="prep-note">Anything you don’t upload now, bring to the parish office.</p>' : ''}
      <a class="btn-link-sm" href="user-requirements.html">See all rules and fees</a>
    </details>`;
}
