/* ============================================
   SacraDigit — Parish contact info
   The office hours, phone, email and Facebook
   page the Parish Assistant gives out. Stored
   as ONE ParishInfo record that ITech and the
   Head Admin edit (Sacraitech/itech-parish-info,
   Sacradigit/parish-info). Until that record
   exists — or if it can't be loaded — the
   defaults in assistant/assistant-knowledge.js
   are used, so the assistant always has an
   answer.

   Also wires the shared editor form both pages
   use (initParishInfoEditor).
   ============================================ */

import { PARISH_CONTACT } from './assistant/assistant-knowledge.js';

/** The newest ParishInfo record, or null. */
async function loadRecord(client) {
  if (!client.models.ParishInfo) return null; // backend not updated yet
  const res = await client.models.ParishInfo.list({ limit: 50 });
  if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
  return res.data.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] || null;
}

/** Turns a record (or nothing) into the PARISH_CONTACT shape the assistant uses. */
export function toContact(record) {
  if (!record) return PARISH_CONTACT;
  return {
    name: PARISH_CONTACT.name,
    officeHours: { en: record.officeHoursEn || '', fil: record.officeHoursFil || record.officeHoursEn || '' },
    phone: record.phone || '',
    email: record.email || '',
    facebook: record.facebook || '',
  };
}

/** Contact details for the assistant: the saved record, else the file defaults. */
export async function loadParishContact(client) {
  try {
    return toContact(await loadRecord(client));
  } catch (err) {
    console.warn('Parish info unavailable, using defaults:', err);
    return PARISH_CONTACT;
  }
}

/* ---------- editor (shared by the ITech and Admin pages) ---------- */

const FIELDS = ['officeHoursEn', 'officeHoursFil', 'phone', 'email', 'facebook'];

/** Returns an error message per invalid field (empty object = all good). */
function validate(v) {
  const errors = {};
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Enter a valid email address.';
  if (v.phone && !/^[0-9+()\-\s./]{7,40}$/.test(v.phone)) errors.phone = 'Use numbers, spaces, +, ( ) or - only.';
  if (v.facebook && !/^https:\/\/(www\.|m\.)?(facebook\.com|fb\.com)\/\S+$/i.test(v.facebook)) errors.facebook = 'Paste the full link, e.g. https://facebook.com/yourparish';
  return errors;
}

/**
 * Wires the form. Inputs are #pi-<field>; also #pi-save, #pi-reset,
 * #pi-updated (last-saved note), #pi-readonly (shown when canEdit is false)
 * and #pi-preview (what the assistant will say).
 * onSaved(summary) runs after a successful save (e.g. to write an audit log).
 */
export function initParishInfoEditor({ client, canEdit, userName, showToast, onSaved }) {
  const $ = (id) => document.getElementById(id);
  const inputs = Object.fromEntries(FIELDS.map(f => [f, $(`pi-${f}`)]));
  const saveBtn = $('pi-save');
  const resetBtn = $('pi-reset');
  let record = null;

  const values = () => Object.fromEntries(FIELDS.map(f => [f, inputs[f].value.trim()]));

  function fill(r) {
    const c = toContact(r);
    inputs.officeHoursEn.value = c.officeHours.en || '';
    inputs.officeHoursFil.value = r ? (r.officeHoursFil || '') : (c.officeHours.fil || '');
    inputs.phone.value = c.phone || '';
    inputs.email.value = c.email || '';
    inputs.facebook.value = c.facebook || '';
    $('pi-updated').textContent = r?.updatedAt
      ? `Last saved ${new Date(r.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${r.updatedByName ? ` by ${r.updatedByName}` : ''}`
      : 'Not saved yet — the assistant is using the built-in defaults.';
    renderPreview();
  }

  function showErrors(errors) {
    FIELDS.forEach(f => {
      inputs[f].classList.toggle('has-error', !!errors[f]);
      const msg = $(`pi-${f}-error`);
      if (msg) { msg.textContent = errors[f] || ''; msg.classList.toggle('hidden', !errors[f]); }
    });
  }

  // A plain-text version of the assistant's contact answer, so editors see the result.
  function renderPreview() {
    const v = values();
    const rows = [
      v.officeHoursEn && `Office hours: ${v.officeHoursEn}`,
      v.phone && `Phone: ${v.phone}`,
      v.email && `Email: ${v.email}`,
      v.facebook && `Facebook: ${PARISH_CONTACT.name}`,
    ].filter(Boolean);
    const box = $('pi-preview');
    box.innerHTML = '';
    const lead = document.createElement('p');
    lead.className = 'pi-preview-lead';
    lead.textContent = rows.length ? PARISH_CONTACT.name : `For anything else, please visit or contact the ${PARISH_CONTACT.name} parish office.`;
    box.appendChild(lead);
    if (rows.length) {
      const ul = document.createElement('ul');
      rows.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      box.appendChild(ul);
    }
  }

  FIELDS.forEach(f => inputs[f].addEventListener('input', () => { renderPreview(); showErrors({}); }));

  if (!canEdit) {
    FIELDS.forEach(f => { inputs[f].disabled = true; });
    saveBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    $('pi-readonly').classList.remove('hidden');
  }

  resetBtn.addEventListener('click', () => { fill(record); showErrors({}); });

  saveBtn.addEventListener('click', async () => {
    const v = values();
    const errors = validate(v);
    showErrors(errors);
    if (Object.keys(errors).length) { showToast('Please fix the highlighted fields.', true); return; }
    saveBtn.disabled = true;
    try {
      const fields = { ...v, updatedByName: userName || '' };
      const res = record
        ? await client.models.ParishInfo.update({ id: record.id, ...fields })
        : await client.models.ParishInfo.create(fields);
      if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
      record = res.data;
      fill(record);
      showToast('Parish contact info saved. The assistant now uses it.');
      onSaved?.(FIELDS.filter(f => v[f]).length + ' of ' + FIELDS.length + ' fields filled');
    } catch (err) {
      console.error('Could not save parish info:', err);
      showToast(err.message || 'Could not save. Please try again.', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  if (!client.models.ParishInfo) {
    fill(null);
    FIELDS.forEach(f => { inputs[f].disabled = true; });
    saveBtn.disabled = true;
    showToast('Parish Info isn’t set up on the backend yet.', true);
    return;
  }
  loadRecord(client)
    .then(r => { record = r; fill(r); })
    .catch(err => { console.error('Could not load parish info:', err); fill(null); showToast('Could not load the saved info.', true); });
}
