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

export const CHECKLIST_KEY = 'Preparation Checklist';

/** Requirements per service (keys = Blessing.type, i.e. the service name).
    Baptism and Wedding follow the parish's published rules (same as the
    homepage, index.html). Item ids are what's saved on each request, so
    keep an id when only its wording changes. */
export const REQUIREMENTS = {
  'Baptism': [
    ['birth-cert', 'Child’s birth certificate (CTC or PSA)'],
    ['parents-marriage', 'Parents’ marriage contract, if married (CTC or PSA)'],
    ['permission', 'Letter of Permission from the Parish Priest (if not from this parish)'],
    ['application', 'Application form filled up by a parent'],
    ['parents-id', 'Parents’ proof of identity / ID'],
    ['no-record', 'Certificate of No Baptismal Record from 3 nearby parishes (2 years old and above)'],
    ['seminar', 'Saturday 4:00 PM Catechism/Seminar attended (parents and at least 1 pair of sponsors)'],
    ['sponsor-docs', 'Sponsors are baptized and confirmed Catholics, 18 years old and above'],
    ['fee', 'Fee settled (Common ₱700 / Solo ₱3,000)'],
  ],
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
  'Wedding': [
    ['baptismal-certs', 'Baptismal certificates, for marriage purposes, issued within 6 months (both)'],
    ['confirmation-certs', 'Confirmation certificates, for marriage purposes (both)'],
    ['birth-certs', 'PSA birth certificates (both)'],
    ['cenomar', 'CENOMAR from PSA (both)'],
    ['license', 'Marriage license (or PSA marriage contract / affidavit of cohabitation)'],
    ['photos', '2×2 ID photos, 4 copies each (taken within 6 months)'],
    ['interview', 'Canonical interview (at least 1 month before the wedding)'],
    ['banns', 'Ecclesiastical banns published in both parishes'],
    ['bride-permit', 'Permit from the bride’s parish (if not from this parish)'],
    ['pre-cana', 'Pre-Cana seminar attended'],
    ['sponsors', 'Typewritten list of sponsors with addresses (6 pairs only)'],
    ['down-payment', '₱5,000 down payment paid and contract signed'],
    ['fee', '₱18,000 balance settled (1 month before the wedding)'],
  ],
};

export const hasChecklist = (type) => !!REQUIREMENTS[type];
export const isPrepKey = (key) => key === CHECKLIST_KEY;

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
  const state = stateOf(parseDetails(record.details));
  return list.map(([id, label]) => ({ id, label, done: !!state[id]?.done, by: state[id]?.by || '', at: state[id]?.at || '' }));
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
  const done = items.filter(i => i.done).length;
  const ordered = editable ? items : [...items.filter(i => !i.done), ...items.filter(i => i.done)];
  const rows = ordered.map(i => editable
    ? `<li class="prep-item${i.done ? ' done' : ''}">
        <label>
          <input type="checkbox" data-prep-item="${esc(i.id)}" ${i.done ? 'checked' : ''} />
          <span>${esc(i.label)}${i.done ? `<small>Ticked by ${esc(i.by || 'Parish Office')} · ${esc(when(i.at))}</small>` : ''}</span>
        </label>
      </li>`
    : `<li class="prep-item${i.done ? ' done' : ' missing'}">
        <span class="prep-mark" aria-hidden="true">${i.done ? '✓' : '✗'}</span>
        <span>${esc(i.label)}<small>${i.done ? `Received ${esc(when(i.at))}` : 'Still needed'}</small></span>
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
