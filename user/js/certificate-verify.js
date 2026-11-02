/* ============================================
   SacraDigit — Find my certificate record
   The event already happened, so the parish already
   has the details. Instead of asking for them again,
   the parishioner proves who they are (full name,
   birthdate, date of the event; for marriage, both
   names and the wedding date), and sees their record
   to confirm.

   Parishioners can't read ParishRecord and must not
   be able to. The check runs in the backend query
   verifyRecord (BACKEND_CHANGES.md), which answers only
   when every field matches, so typing a name alone
   never shows anyone's data. Until it's deployed, and
   whenever nothing matches, the normal form is used
   and the office reviews by hand.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUser, currentUserName } from '../../shared/js/auth.js';
import { TODAY_ISO, MIN_DATE_ISO } from '../../shared/js/marriage-request-form.js';

export const verifyReady = () => !!client.queries?.verifyRecord;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateAttrs = `min="${MIN_DATE_ISO}" max="${TODAY_ISO}"`;

function fieldsHtml(isMarriage) {
  const text = (id, label) => `<div><label class="form-label" for="${id}">${label} <span class="text-red-500">*</span></label><input id="${id}" class="form-input" /></div>`;
  const date = (id, label) => `<div><label class="form-label" for="${id}">${label} <span class="text-red-500">*</span></label><input id="${id}" type="date" ${dateAttrs} class="form-input" /></div>`;
  return isMarriage
    ? `${text('cv-groom', 'Groom’s full name')}${text('cv-bride', 'Bride’s full name')}${date('cv-event', 'Wedding date')}`
    : `${text('cv-name', 'Full name on the record')}${date('cv-birth', 'Birthdate')}${date('cv-event', 'Date of the event')}`;
}

/**
 * Shows the check above the form and hides the form until it's needed.
 * Returns false when verifyRecord isn't deployed (the form stays as it is).
 * onDone(requestName) runs after a request is saved.
 */
export function mountRecordCheck(formWrap, selectedType, onDone) {
  if (!verifyReady()) return false;
  const isMarriage = /marriage/i.test(selectedType.name);
  const box = document.createElement('section');
  box.className = 'panel';
  box.id = 'cert-verify';
  box.innerHTML = `
    <div class="panel-header"><h2 class="panel-title">Find Your Record</h2></div>
    <div class="p-5 space-y-4">
      <p class="text-sm text-gray-600">The parish already has your details. Tell us these so we can find your record.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${fieldsHtml(isMarriage)}</div>
      <p class="form-error-msg hidden" id="cv-error" role="alert"></p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-lavender" id="cv-check">Find My Record</button>
        <button type="button" class="btn-secondary" id="cv-manual">Fill In the Form Instead</button>
      </div>
      <div id="cv-result"></div>
    </div>`;
  formWrap.before(box);
  formWrap.classList.add('hidden');

  const $ = (id) => box.querySelector(`#${id}`);
  const useForm = () => { box.remove(); formWrap.classList.remove('hidden'); };
  $('cv-manual').addEventListener('click', useForm);
  const fail = (message) => { $('cv-error').textContent = message; $('cv-error').classList.remove('hidden'); };

  function showRecord(record) {
    const row = (label, value) => (value ? `<div><p class="modal-detail-item-label">${esc(label)}</p><p class="modal-detail-item-value">${esc(value)}</p></div>` : '');
    $('cv-result').innerHTML = `
      <div class="modal-detail-grid">
        ${row('Name', record.fullName)}${row('Date of the event', record.dateOfEvent)}${row('Officiant', record.officiant)}
      </div>
      <p class="text-sm text-gray-600 mt-3">Is this your record?</p>
      <label class="form-label mt-2" for="cv-purpose">Purpose of this request <span class="text-red-500">*</span></label>
      <input id="cv-purpose" class="form-input" placeholder="e.g. School requirement" />
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn-lavender" id="cv-yes">Yes, Request This Certificate</button>
        <button type="button" class="btn-secondary" id="cv-no">No, This Isn’t Mine</button>
      </div>`;
    $('cv-no').addEventListener('click', useForm);
    $('cv-yes').addEventListener('click', async () => {
      const purpose = $('cv-purpose').value.trim();
      if (!purpose) { fail('Please say what the certificate is for.'); return; }
      $('cv-yes').disabled = true;
      try {
        const result = await client.models.CertificateRequest.create({
          requesterName: currentUserName(),
          certificateType: selectedType.name,
          email: currentUser()?.email || undefined,
          purpose,
          details: JSON.stringify({ 'Verified Against Record': 'Yes' }),
          linkedRecordId: record.recordId,
          status: 'pending',
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        box.remove();
        onDone();
      } catch (err) {
        console.error('Failed to save the certificate request:', err);
        fail(err.message || 'That didn’t save. Please try again.');
        $('cv-yes').disabled = false;
      }
    });
  }

  $('cv-check').addEventListener('click', async () => {
    $('cv-error').classList.add('hidden');
    $('cv-result').innerHTML = '';
    const input = isMarriage
      ? { groomName: $('cv-groom').value.trim(), brideName: $('cv-bride').value.trim(), eventDate: $('cv-event').value }
      : { fullName: $('cv-name').value.trim(), birthdate: $('cv-birth').value, eventDate: $('cv-event').value };
    if (Object.values(input).some(v => !v)) { fail('Please fill in every box.'); return; }
    $('cv-check').disabled = true;
    try {
      const res = await client.queries.verifyRecord({ certificateType: selectedType.name, ...input });
      if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (data?.match) showRecord(data);
      else fail('We couldn’t find that record. Check the details, or use Fill In the Form Instead and the parish office will look for it.');
    } catch (err) {
      console.error('Record check failed:', err);
      fail('The check isn’t working right now. Please use Fill In the Form Instead.');
    } finally {
      $('cv-check').disabled = false;
    }
  });
  return true;
}
