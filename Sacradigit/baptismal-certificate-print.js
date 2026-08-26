/* ============================================
   SacraDigit Admin — Baptismal Certificate Print View
   Reads the draft stashed in sessionStorage by
   record-requests.js ("Generate Certificate" modal)
   and renders it into the print-ready Certificate of
   Baptism layout.

   Also handles the "official copy once released" flow:
   once the originating CertificateRequest is Released,
   admin can click "Save as Official Copy" here, which
   captures the rendered certificate as an image, uploads
   it to Storage, creates a digitized ParishRecord pointing
   at it, and links that record back to the request
   (CertificateRequest.linkedRecordId) — so the parishioner
   can view/print this exact official copy from their own
   My Requests page.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

const CERT_STORAGE_KEY = 'sacradigit_baptismal_cert_draft';

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

  // Splits an ISO date (YYYY-MM-DD) into "15th" and "August, 2026",
  // matching the certificate's "on the ___ day of ___" phrasing.
  function splitDate(iso) {
    if (!iso) return { day: '', month: '' };
    const d = new Date(iso + 'T00:00:00');
    const day = ordinal(d.getDate());
    const month = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { day, month };
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

  document.getElementById('out-child-name').textContent = escapeOrDash(data['cert-child-name']);
  document.getElementById('out-father-name').textContent = escapeOrDash(data['cert-father-name']);
  document.getElementById('out-mother-name').textContent = escapeOrDash(data['cert-mother-name']);
  document.getElementById('out-birthplace').textContent = escapeOrDash(data['cert-birthplace']);

  const birth = splitDate(data['cert-birth-date']);
  document.getElementById('out-birth-day').textContent = birth.day || '____';
  document.getElementById('out-birth-month').textContent = birth.month || '_______________';

  const baptism = splitDate(data['cert-baptism-date']);
  document.getElementById('out-baptism-day').textContent = baptism.day || '____';
  document.getElementById('out-baptism-month').textContent = baptism.month || '_______________';

  document.getElementById('out-priest').textContent = escapeOrDash(data['cert-priest']);
  document.getElementById('out-sponsor-1').textContent = escapeOrDash(data['cert-sponsor-1']);
  document.getElementById('out-sponsor-2').textContent = escapeOrDash(data['cert-sponsor-2']);
  document.getElementById('out-book-no').textContent = data['cert-book-no'] || '___';
  document.getElementById('out-page').textContent = data['cert-page'] || '___';
  document.getElementById('out-line').textContent = data['cert-line'] || '___';
  document.getElementById('out-dated').textContent = formatDatedLine(data['cert-dated']) || '_______________';

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

      const path = `certificateUploads/baptismal_${Date.now()}.png`;
      await uploadData({ path, data: blob }).result;

      const recordResult = await client.models.ParishRecord.create({
        fullName: (data['cert-child-name'] || '').trim() || 'Unnamed',
        type: 'baptism',
        dateOfEvent: data['cert-baptism-date'] || data['cert-birth-date'] || undefined,
        officiant: (data['cert-priest'] || '').trim() || undefined,
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