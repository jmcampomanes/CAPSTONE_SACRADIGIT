/* ============================================
   SacraDigit Admin — First Communion Certificate Print View
   Mirrors baptismal-certificate-print.js / confirmation-
   certificate-print.js — reads the draft stashed in
   sessionStorage by record-requests.js ("Generate
   Certificate" modal) and renders it into the print-ready
   First Communion Certificate layout.

   Also handles the "official copy once released" flow —
   see baptismal-certificate-print.js for the full rationale.
   One difference: the deployed ParishRecord schema's `type`
   enum only supports baptism/confirmation/marriage/death —
   there's no "communion" value — so the digitized record
   created here is saved without a `type` tag. Everything
   else (the file, the link back to the request, viewing it
   from My Requests) still works the same way.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

const CERT_STORAGE_KEY = 'sacradigit_first_communion_cert_draft';

document.addEventListener('DOMContentLoaded', () => {

  const certificate       = document.getElementById('certificate');
  const noDataNotice      = document.getElementById('no-data-notice');
  const printBtn          = document.getElementById('btn-print');
  const saveOfficialBtn   = document.getElementById('btn-save-official');
  const officialStatusEl  = document.getElementById('official-copy-status');

  function escapeOrDash(value) {
    return value && value.trim() ? value.trim() : '_______________';
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // "2024-04-20" -> "20th of April, 2024", matching the certificate's "Today" line.
  function formatOrdinalDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    const day = ordinal(d.getDate());
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    return `${day} of ${month}, ${d.getFullYear()}`;
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

  document.getElementById('out-name').textContent = escapeOrDash(data['fc-cert-name']);
  document.getElementById('out-catechist').textContent = escapeOrDash(data['fc-cert-catechist']);
  document.getElementById('out-priest').textContent = escapeOrDash(data['fc-cert-priest']);
  document.getElementById('out-book-no').textContent = data['fc-cert-book-no'] || '___';
  document.getElementById('out-page').textContent = data['fc-cert-page'] || '___';
  document.getElementById('out-line').textContent = data['fc-cert-line'] || '___';
  document.getElementById('out-purpose').textContent = escapeOrDash(data['fc-cert-purpose']);
  document.getElementById('out-communion-date').textContent = formatOrdinalDate(data['fc-cert-communion-date']) || '_______________';
  document.getElementById('out-dated').textContent = formatDatedLine(data['fc-cert-dated']) || '_______________';

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
      const canvas = await html2canvas(certificate, { scale: 2, backgroundColor: '#fffdf5' });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to capture the certificate image.');

      const path = `certificateUploads/first_communion_${Date.now()}.png`;
      await uploadData({ path, data: blob }).result;

      const recordResult = await client.models.ParishRecord.create({
        fullName: (data['fc-cert-name'] || '').trim() || 'Unnamed',
        // No 'communion' value exists in the deployed ParishRecordType
        // enum (baptism/confirmation/marriage/death only), so `type`
        // is left unset rather than sending an invalid value.
        dateOfEvent: data['fc-cert-communion-date'] || undefined,
        officiant: (data['fc-cert-priest'] || '').trim() || undefined,
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