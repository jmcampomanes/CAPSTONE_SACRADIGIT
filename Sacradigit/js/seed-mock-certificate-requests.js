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
import { DEMO_REQUESTS } from './seed-data/demo-record-requests.js';

// The renamed scans, as URLs. They stay out of the production build (this page isn't built).
const ARCHIVE_IMAGES = import.meta.glob('./seed-data/archive/*.jpg', { query: '?url', import: 'default', eager: true });

const STORAGE_KEY = 'sacradigit_mock_csv_requests';
const ARCHIVE_KEY = 'sacradigit_mock_archive_documents';
const DEMO_KEY = 'sacradigit_mock_demo_requests'; // ids of the presentation requests (this browser only)
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
  const busy = (on) => {
    seedBtn.disabled = clearBtn.disabled = on;
    ['btn-seed-archive', 'btn-seed-demo', 'btn-clear-demo'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = on; });
  };
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
    busy(true);
    logEl.innerHTML = '';
    // Skip documents already in Digital Archives (same type, name and date), so running
    // this again only adds what's new.
    const existing = new Set();
    try {
      let nextToken = null;
      do {
        const res = await client.models.ParishRecord.list({ limit: 1000, nextToken });
        res.data.forEach(x => existing.add(`${x.type}|${x.fullName}|${x.dateOfEvent}`));
        nextToken = res.nextToken;
      } while (nextToken);
    } catch (err) { log(`Couldn't check existing records (${err.message || 'failed'}); adding everything.`, true); }
    const todo = ARCHIVE_DOCUMENTS.filter(d => !existing.has(`${d.type}|${d.fullName}|${d.dateOfEvent}`));
    if (!todo.length) { statusEl.textContent = 'Every archive document is already in Digital Archives.'; busy(false); return; }
    const r = await inBatches(todo, 'Archive documents', async (doc) => {
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

  /* Presentation requests: ten pending requests, two per certificate type, each with
     every answer the request form asks for (see seed-data/demo-record-requests.js). */
  const loadDemoIds = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch { return []; } };
  document.getElementById('btn-seed-demo')?.addEventListener('click', async () => {
    const ids = loadDemoIds();
    if (ids.length && !confirm(`${ids.length} demo requests were already added from this browser. Add them again (duplicates)?`)) return;
    busy(true);
    logEl.innerHTML = '';

    // The verified request points at Andrea's archive record, if it has been added.
    let archive = [];
    try {
      let nextToken = null;
      do {
        const res = await client.models.ParishRecord.list({ limit: 1000, nextToken });
        archive.push(...res.data);
        nextToken = res.nextToken;
      } while (nextToken);
    } catch (err) { log(`Couldn't read Digital Archives (${err.message || 'failed'}); verified requests are added without the link.`, true); }

    const r = await inBatches(DEMO_REQUESTS, 'Demo requests', async (req) => {
      const details = { ...req.details };
      let linkedRecordId;
      if (req.verifiedRecord) {
        const v = req.verifiedRecord;
        const rec = archive.find(x => x.type === v.type && x.fullName === v.fullName && x.dateOfEvent === v.dateOfEvent);
        if (rec) linkedRecordId = rec.id;
        else log(`${v.fullName}: not in Digital Archives yet — click Add Archive Documents first to link it. Added without the link.`, true);
        // The saved copy of the record, as the real "Verify Your Record" flow keeps it.
        details['Record Name'] = v.fullName; details['Record Event Date'] = v.dateOfEvent; details['Record Officiant'] = v.officiant;
      }
      const row = check(await client.models.CertificateRequest.create({
        requesterName: req.requesterName,
        certificateType: req.certificateType,
        purpose: req.purpose,
        details: JSON.stringify(details),
        status: 'pending',
        linkedRecordId,
      }));
      ids.push(row.id);
      localStorage.setItem(DEMO_KEY, JSON.stringify(ids));
      log(`✓ ${req.certificateType}: ${req.requesterName}`);
    });
    statusEl.textContent = `Done — ${r.done} demo requests added${r.failed ? `, ${r.failed} failed` : ''}. Open Record Requests to see them.`;
    busy(false);
  });

  document.getElementById('btn-clear-demo')?.addEventListener('click', async () => {
    const ids = loadDemoIds();
    if (!ids.length) { statusEl.textContent = 'No demo requests recorded on this browser to remove.'; return; }
    busy(true);
    logEl.innerHTML = '';
    const a = await inBatches(ids, 'Removing demo requests', async (id) => check(await client.models.CertificateRequest.delete({ id })));
    localStorage.setItem(DEMO_KEY, JSON.stringify([]));
    statusEl.textContent = `Removed ${a.done} demo requests.`;
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
