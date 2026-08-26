/* ============================================
   SacraDigit Admin — Death Certificate Print View
   Mirrors baptismal-certificate-print.js — reads the draft
   stashed in sessionStorage by record-requests.js ("Generate
   Certificate" modal) and renders it into the print-ready
   Certificate of Death layout. No physical template was
   supplied for this cert type, so it's designed in the same
   blue-ink cursive style as the Baptismal/Confirmation
   certificates rather than copying a specific photo.

   Also handles the "official copy once released" flow —
   see baptismal-certificate-print.js for the full rationale.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

const CERT_STORAGE_KEY = 'sacradigit_death_cert_draft';

document.addEventListener('DOMContentLoaded', () => {

  const certificate       = document.getElementById('certificate');
  const noDataNotice      = document.getElementById('no-data-notice');
  const printBtn          = document.getElementById('btn-print');
  const saveOfficialBtn   = document.getElementById('btn-save-official');
  const officialStatusEl  = document.getElementById('official-copy-status');

  function escapeOrDash(value) {
    return value && value.trim() ? value.trim() : '_______________';
  }

  function formatDatedLine(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function setOfficialStatus(message) {
    officialStatusEl.textContent = message;
    officialStatusEl.classList.toggle('hidden', !message);
  }

  let data = null;
  try {
    data = JSON.parse(sessionStorage.getItem(CERT_STORAGE_KEY) || 'null');
  } catch {
    data = null;
  }

  if (!data) {
    certificate.classList.add('hidden');
    noDataNotice.classList.remove('hidden');
    printBtn.disabled = true;
    return;
  }

  document.getElementById('out-deceased-name').textContent = escapeOrDash(data['death-cert-name']);
  document.getElementById('out-age').textContent = (data['death-cert-age'] || '').trim() || '____';
  document.getElementById('out-death-date').textContent = formatDatedLine(data['death-cert-death-date']) || '_______________';
  document.getElementById('out-place-of-death').textContent = escapeOrDash(data['death-cert-place-of-death']);
  document.getElementById('out-burial-date').textContent = formatDatedLine(data['death-cert-burial-date']) || '_______________';
  document.getElementById('out-burial-place').textContent = escapeOrDash(data['death-cert-burial-place']);
  document.getElementById('out-priest').textContent = escapeOrDash(data['death-cert-priest']);
  document.getElementById('out-book-no').textContent = data['death-cert-book-no'] || '___';
  document.getElementById('out-page').textContent = data['death-cert-page'] || '___';
  document.getElementById('out-line').textContent = data['death-cert-line'] || '___';
  document.getElementById('out-dated').textContent = formatDatedLine(data['death-cert-dated']) || '_______________';

  printBtn.addEventListener('click', () => window.print());

  /* ------------------------------------------
     OFFICIAL COPY — only offered when this tab
     was opened from an actual request row (has
     a requestId) and that request exists.
  ------------------------------------------ */
  const requestId = data.requestId;
  if (!requestId) return; // no linked request — print-only tab, nothing more to do

  refreshOfficialCopyState();

  async function refreshOfficialCopyState() {
    let request;
    try {
      const result = await client.models.CertificateRequest.get({ id: requestId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      request = result.data;
    } catch (err) {
      console.error('Failed to load the originating request:', err);
      return;
    }
    if (!request) return;

    if (request.linkedRecordId) {
      saveOfficialBtn.classList.add('hidden');
      setOfficialStatus('✓ Official copy saved — visible to the parishioner in My Requests.');
      return;
    }

    if (request.status !== 'released') {
      saveOfficialBtn.classList.add('hidden');
      setOfficialStatus('This will be saved as the official copy once the request is marked Released.');
      return;
    }

    saveOfficialBtn.classList.remove('hidden');
    setOfficialStatus('');
  }

  saveOfficialBtn.addEventListener('click', async () => {
    if (typeof html2canvas !== 'function') {
      setOfficialStatus("Couldn't save — the capture library failed to load.");
      return;
    }

    saveOfficialBtn.disabled = true;
    saveOfficialBtn.textContent = 'Saving…';
    setOfficialStatus('');

    try {
      const canvas = await html2canvas(certificate, { scale: 2, backgroundColor: '#fffefb' });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to capture the certificate image.');

      const path = `certificateUploads/death_${Date.now()}.png`;
      await uploadData({ path, data: blob }).result;

      const recordResult = await client.models.ParishRecord.create({
        fullName: (data['death-cert-name'] || '').trim() || 'Unnamed',
        type: 'death',
        dateOfEvent: data['death-cert-death-date'] || undefined,
        officiant: (data['death-cert-priest'] || '').trim() || undefined,
        status: 'digitized',
        fileURL: path,
        addedByName: 'Admin User',
      });
      if (recordResult.errors) throw new Error(recordResult.errors.map(e => e.message).join('; '));

      const linkResult = await client.models.CertificateRequest.update({
        id: requestId,
        linkedRecordId: recordResult.data.id,
      });
      if (linkResult.errors) throw new Error(linkResult.errors.map(e => e.message).join('; '));

      saveOfficialBtn.classList.add('hidden');
      setOfficialStatus('✓ Official copy saved — visible to the parishioner in My Requests.');
    } catch (err) {
      console.error('Failed to save the official copy:', err);
      saveOfficialBtn.disabled = false;
      saveOfficialBtn.textContent = 'Save as Official Copy';
      setOfficialStatus(err.message || "Couldn't save the official copy.");
    }
  });

});