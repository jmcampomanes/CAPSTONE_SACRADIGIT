/* ============================================
   SacraDigit Admin — Seed Mock Certificate Requests
   Dev-only utility, not linked from the app's nav.
   Writes the requests of the people in
   fake-account-candidates.csv (built into
   seed-data/csv-certificate-requests.json by
   tools/mock-community/seed-csv-requests.mjs):

     1. each register entry  -> ParishRecord (Digital Archives)
     2. each request         -> CertificateRequest (Record Requests),
                                linkedRecordId pointing at its entry

   Rows this tool creates are tracked by id in localStorage
   (this browser only) so "Clear Mock Data" removes exactly
   them and nothing the parish entered.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { uploadData } from 'aws-amplify/storage';
import seed from './seed-data/csv-certificate-requests.json';
import { ARCHIVE_DOCUMENTS } from './seed-data/archive-documents.js';

// The renamed scans, as URLs. They stay out of the production build (this page isn't built).
const ARCHIVE_IMAGES = import.meta.glob('./seed-data/archive/*.jpg', { query: '?url', import: 'default', eager: true });

const STORAGE_KEY = 'sacradigit_mock_csv_requests';
const ARCHIVE_KEY = 'sacradigit_mock_archive_documents';
const BATCH = 8; // rows written at once

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { records: [], requests: [] }; } catch { return { records: [], requests: [] }; } };
const save = (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v));

document.addEventListener('DOMContentLoaded', () => {
  const seedBtn = document.getElementById('btn-seed');
  const clearBtn = document.getElementById('btn-clear');
  const statusEl = document.getElementById('seed-status');
  const logEl = document.getElementById('seed-log');

  const log = (text, isError = false) => {
    logEl.classList.remove('hidden');
    const line = document.createElement('div');
    if (isError) line.className = 'err';
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  };
  const busy = (on) => { seedBtn.disabled = clearBtn.disabled = on; const a = document.getElementById('btn-seed-archive'); if (a) a.disabled = on; };
  const check = (res) => { if (res.errors) throw new Error(res.errors.map(e => e.message).join('; ')); return res.data; };

  /** Runs fn over items, BATCH at a time, and reports progress. */
  async function inBatches(items, label, fn) {
    let done = 0, failed = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      await Promise.all(items.slice(i, i + BATCH).map(async (item) => {
        try { await fn(item); done++; } catch (err) { failed++; log(`✗ ${label}: ${err.message || 'failed'}`, true); }
      }));
      statusEl.textContent = `${label}: ${done + failed} of ${items.length}…`;
    }
    return { done, failed };
  }

  /* Archive documents: upload each renamed scan, then add its Digital Archives record. */
  document.getElementById('btn-seed-archive')?.addEventListener('click', async () => {
    let ids = []; try { ids = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch { /* none yet */ }
    if (ids.length && !confirm(`${ids.length} archive documents were already added from this browser. Add them again (duplicates)?`)) return;
    busy(true);
    logEl.innerHTML = '';
    const r = await inBatches(ARCHIVE_DOCUMENTS, 'Archive documents', async (doc) => {
      const url = ARCHIVE_IMAGES[`./seed-data/archive/${doc.file}`];
      if (!url) throw new Error(`${doc.file} is missing`);
      const blob = await (await fetch(url)).blob();
      const path = `cloudFiles/parishRecords/${Date.now()}_${doc.file}`; // same folder the Upload Record button uses
      await uploadData({ path, data: blob, options: { contentType: 'image/jpeg' } }).result;
      const row = check(await client.models.ParishRecord.create({
        fullName: doc.fullName, type: doc.type, dateOfEvent: doc.dateOfEvent, officiant: doc.officiant,
        birthdate: doc.birthdate || undefined, addedByName: 'Parish Office', status: 'digitized', fileURL: path,
      }));
      ids.push(row.id);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids));
      log(`✓ ${doc.type}: ${doc.fullName}`);
    });
    statusEl.textContent = `Done — ${r.done} archive documents added${r.failed ? `, ${r.failed} failed` : ''}.`;
    busy(false);
  });

  seedBtn.addEventListener('click', async () => {
    const stored = load();
    if (stored.requests.length && !confirm(`${stored.requests.length} mock requests were already seeded from this browser. Seed again (duplicates)?`)) return;
    busy(true);
    logEl.innerHTML = '';
    const keep = { records: [...stored.records], requests: [...stored.requests] };
    const recordIds = new Map(); // register key -> ParishRecord id

    const r1 = await inBatches(seed.records, 'Records', async (rec) => {
      const { key, ...fields } = rec;
      const row = check(await client.models.ParishRecord.create({
        ...fields,
        birthdate: fields.birthdate || undefined,
        officiant: fields.officiant || undefined,
      }));
      recordIds.set(key, row.id);
      keep.records.push(row.id);
      save(keep);
    });

    const r2 = await inBatches(seed.requests, 'Requests', async (req) => {
      const row = check(await client.models.CertificateRequest.create({
        requesterName: req.requesterName,
        certificateType: req.certificateType,
        email: req.email,
        purpose: req.purpose,
        notes: req.notes || undefined,
        details: JSON.stringify(req.details),
        status: req.status,
        rejectionReason: req.rejectionReason || undefined,
        linkedRecordId: req.recordKey ? recordIds.get(req.recordKey) : undefined,
      }));
      keep.requests.push(row.id);
      save(keep);
    });

    statusEl.textContent = `Done — ${r1.done} records and ${r2.done} requests created${r1.failed + r2.failed ? `, ${r1.failed + r2.failed} failed` : ''}.`;
    busy(false);
  });

  clearBtn.addEventListener('click', async () => {
    const stored = load();
    if (!stored.requests.length && !stored.records.length) { statusEl.textContent = 'No mock data recorded on this browser to clear.'; return; }
    busy(true);
    logEl.innerHTML = '';
    const a = await inBatches(stored.requests, 'Removing requests', async (id) => check(await client.models.CertificateRequest.delete({ id })));
    const b = await inBatches(stored.records, 'Removing records', async (id) => check(await client.models.ParishRecord.delete({ id })));
    save({ records: [], requests: [] });
    statusEl.textContent = `Removed ${a.done} requests and ${b.done} records.`;
    busy(false);
  });
});
