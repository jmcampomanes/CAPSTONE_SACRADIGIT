/* ============================================
   SacraDigit Admin — Marriage Certificate Print View
   Mirrors baptismal-certificate-print.js / confirmation-
   certificate-print.js / first-communion-certificate-print.js
   — reads the draft stashed in sessionStorage by
   record-requests.js ("Generate Certificate" modal) and
   renders it into the print-ready Certificate of Marriage
   layout. A streamlined parish-style certificate, not the
   full PSA civil-registrar form.

   Also handles the "official copy once released" flow —
   see baptismal-certificate-print.js for the full rationale.
   ============================================ */

import { client } from '../amplify-init.js';
import { uploadData } from 'aws-amplify/storage';

const CERT_STORAGE_KEY = 'sacradigit_marriage_cert_draft';

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

  // Splits an ISO date into separate Day / Month / Year values, matching
  // the certificate's "(Day) (Month) (Year)" boxed sub-fields.
  function splitDateParts(iso) {
    if (!iso) return { day: '', month: '', year: '' };
    const d = new Date(iso + 'T00:00:00');
    return {
      day: String(d.getDate()),
      month: d.toLocaleDateString('en-US', { month: 'long' }),
      year: String(d.getFullYear()),
    };
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

  const groomName = escapeOrDash(data['marriage-cert-groom-name']);
  const brideName = escapeOrDash(data['marriage-cert-bride-name']);

  document.getElementById('out-groom-name').textContent = groomName;
  document.getElementById('out-groom-name-2').textContent = groomName;
  document.getElementById('out-groom-father').textContent = escapeOrDash(data['marriage-cert-groom-father']);
  document.getElementById('out-groom-mother').textContent = escapeOrDash(data['marriage-cert-groom-mother']);
  document.getElementById('out-bride-name').textContent = brideName;
  document.getElementById('out-bride-name-2').textContent = brideName;
  document.getElementById('out-bride-father').textContent = escapeOrDash(data['marriage-cert-bride-father']);
  document.getElementById('out-bride-mother').textContent = escapeOrDash(data['marriage-cert-bride-mother']);
  document.getElementById('out-marriage-place').textContent = escapeOrDash(data['marriage-cert-marriage-place']);
  document.getElementById('out-priest').textContent = escapeOrDash(data['marriage-cert-priest']);
  document.getElementById('out-witness-1').textContent = escapeOrDash(data['marriage-cert-witness-1']);
  document.getElementById('out-witness-2').textContent = escapeOrDash(data['marriage-cert-witness-2']);
  document.getElementById('out-book-no').textContent = data['marriage-cert-book-no'] || '___';
  document.getElementById('out-page').textContent = data['marriage-cert-page'] || '___';
  document.getElementById('out-line').textContent = data['marriage-cert-line'] || '___';

  const marriageDateParts = splitDateParts(data['marriage-cert-marriage-date']);
  document.getElementById('out-marriage-day').textContent = marriageDateParts.day || '__';
  document.getElementById('out-marriage-month').textContent = marriageDateParts.month || '_______';
  document.getElementById('out-marriage-year').textContent = marriageDateParts.year || '____';

  document.getElementById('out-dated').textContent = formatDatedLine(data['marriage-cert-dated']) || '_______________';

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

      const path = `certificateUploads/marriage_${Date.now()}.png`;
      await uploadData({ path, data: blob }).result;

      const groomName = (data['marriage-cert-groom-name'] || '').trim();
      const brideName = (data['marriage-cert-bride-name'] || '').trim();
      const coupleName = groomName && brideName ? `${groomName} & ${brideName}` : (groomName || brideName || 'Unnamed');

      const recordResult = await client.models.ParishRecord.create({
        fullName: coupleName,
        type: 'marriage',
        dateOfEvent: data['marriage-cert-marriage-date'] || undefined,
        officiant: (data['marriage-cert-priest'] || '').trim() || undefined,
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