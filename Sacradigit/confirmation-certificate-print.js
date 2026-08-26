/* ============================================
   SacraDigit Admin — Confirmation Certificate Print View
   Mirrors baptismal-certificate-print.js — reads the
   draft stashed in sessionStorage by record-requests.js
   ("Generate Certificate" modal) and renders it into the
   print-ready Confirmation Certificate layout.

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

const CERT_STORAGE_KEY = 'sacradigit_confirmation_cert_draft';

document.addEventListener('DOMContentLoaded', () => {

  const certificate       = document.getElementById('certificate');
  const noDataNotice      = document.getElementById('no-data-notice');
  const printBtn          = document.getElementById('btn-print');
  const saveOfficialBtn   = document.getElementById('btn-save-official');
  const officialStatusEl  = document.getElementById('official-copy-status');

  function escapeOrDash(value) {
    return value && value.trim() ? value.trim() : '_______________';
  }

  // Splits an ISO date (YYYY-MM-DD) into "March 15" and "24",
  // matching the certificate's "on ___, 20__" phrasing.
  function splitDate(iso) {
    if (!iso) return { monthDay: '', yy: '' };
    const d = new Date(iso + 'T00:00:00');
    const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const yy = String(d.getFullYear()).slice(-2);
    return { monthDay, yy };
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

  document.getElementById('out-confirmand-name').textContent = escapeOrDash(data['confirm-cert-name']);
  document.getElementById('out-father-name').textContent = escapeOrDash(data['confirm-cert-father-name']);
  document.getElementById('out-mother-name').textContent = escapeOrDash(data['confirm-cert-mother-name']);
  document.getElementById('out-baptism-church').textContent = escapeOrDash(data['confirm-cert-baptism-church']);
  document.getElementById('out-received-name').textContent = escapeOrDash(data['confirm-cert-received-name']);
  document.getElementById('out-bishop').textContent = escapeOrDash(data['confirm-cert-bishop']);
  document.getElementById('out-sponsor').textContent = escapeOrDash(data['confirm-cert-sponsor']);

  const baptism = splitDate(data['confirm-cert-baptism-date']);
  document.getElementById('out-baptism-date').textContent = baptism.monthDay || '_______________';
  document.getElementById('out-baptism-year').textContent = baptism.yy || '__';

  const confirmation = splitDate(data['confirm-cert-date']);
  document.getElementById('out-confirmation-date').textContent = confirmation.monthDay || '_______________';
  document.getElementById('out-confirmation-year').textContent = confirmation.yy || '__';

  document.getElementById('out-dated').textContent = formatDatedLine(data['confirm-cert-dated']) || '_______________';

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

      const path = `certificateUploads/confirmation_${Date.now()}.png`;
      await uploadData({ path, data: blob }).result;

      const recordResult = await client.models.ParishRecord.create({
        fullName: (data['confirm-cert-name'] || '').trim() || 'Unnamed',
        type: 'confirmation',
        dateOfEvent: data['confirm-cert-date'] || data['confirm-cert-baptism-date'] || undefined,
        officiant: (data['confirm-cert-bishop'] || '').trim() || undefined,
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