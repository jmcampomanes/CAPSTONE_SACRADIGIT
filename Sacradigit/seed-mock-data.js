/* ============================================
   SacraDigit Admin — Seed Mock Mass Intentions
   Dev-only utility, not linked from the app's nav.
   Creates realistic sample MassIntention records
   through the same client used everywhere else, so
   the Log tab, Reader's Sheet, and the Find bar all
   have real data to demo — no fixtures, no separate
   database, just rows in the real table.

   Every record this tool creates is tracked by id in
   localStorage (this browser only), so "Clear Mock
   Data" can remove exactly what it added and nothing
   the parish has actually entered.
   ============================================ */

import { client } from './amplify-init.js';

const STORAGE_KEY = 'sacradigit_mock_intention_ids';

/* Three upcoming masses to spread the sample data across. */
const MOCK_MASSES = [
  { massDate: '2026-08-22', massTime: '06:00 PM' }, // Sat anticipated
  { massDate: '2026-08-23', massTime: '08:00 AM' }, // Sun morning
  { massDate: '2026-08-23', massTime: '05:00 PM' }, // Sun evening
];

const MOCK_RECORDS = [
  // ---- Mass A: Sat Aug 22, 6:00 PM ----
  { mass: 0, type: 'Thanksgiving', names: ['Dela Cruz Family'], donor: 'Dela Cruz Family (Demo)', offering: 300 },
  { mass: 0, type: 'Birthday Blessing', names: ['Sofia B. Ramirez'], donor: 'Ramirez Family (Demo)', offering: 350 },
  { mass: 0, type: 'Healing', names: ['Antonio Villanueva'], donor: 'Villanueva Family (Demo)', offering: 300, startTime: '06:00 AM', endTime: '06:00 PM' },
  { mass: 0, type: 'Special Intention', names: ['Marites Coronel — Safe Travel (OFW)'], donor: 'Coronel Family (Demo)', offering: 250 },
  { mass: 0, type: 'For the Soul of...', names: ['Rogelio Santos Sr.', 'Herminia Santos'], donor: 'Santos Family (Demo)', offering: 400 },
  { mass: 0, type: 'For the Soul of...', names: ['Bienvenido Tan'], donor: 'Tan Family (Demo)', offering: 300 },
  { mass: 0, type: 'Thanksgiving', names: ['Reyes Family'], donor: 'Reyes Family (Demo)', offering: 300 },
  { mass: 0, type: 'Special Intention', names: ['Grace Espinosa — Safe Delivery'], donor: 'Espinosa Family (Demo)', offering: 300 },

  // ---- Mass B: Sun Aug 23, 8:00 AM ----
  { mass: 1, type: 'Birthday Blessing', names: ['Miguel Angelo Torres'], donor: 'Torres Family (Demo)', offering: 300 },
  { mass: 1, type: 'Thanksgiving', names: ['Lim Family', 'Chua Family'], donor: 'Lim-Chua Family (Demo)', offering: 500 },
  { mass: 1, type: 'For the Soul of...', names: ['Corazon Mendoza'], donor: 'Mendoza Family (Demo)', offering: 300 },
  { mass: 1, type: 'For the Soul of...', names: ['Eduardo Bautista', 'Remedios Bautista'], donor: 'Bautista Family (Demo)', offering: 400 },
  { mass: 1, type: 'Healing', names: ['Patricia Uy'], donor: 'Uy Family (Demo)', offering: 300 },
  { mass: 1, type: 'Special Intention', names: ['Jerome Alcantara — Bar Exam Success'], donor: 'Alcantara Family (Demo)', offering: 300 },
  { mass: 1, type: 'Thanksgiving', names: ['Maria P. Santos'], donor: 'Maria P. Santos', offering: 300 },
  { mass: 1, type: 'For the Soul of...', names: ['Ernesto D. Santos'], donor: 'Maria P. Santos', offering: 350 },

  // ---- Mass C: Sun Aug 23, 5:00 PM ----
  { mass: 2, type: 'Special Intention', names: ['Nicanor Aquino'], donor: 'Aquino Family (Demo)', offering: 250 },
  { mass: 2, type: 'Birthday Blessing', names: ['Ella Marie Domingo'], donor: 'Domingo Family (Demo)', offering: 300 },
  { mass: 2, type: 'For the Soul of...', names: ['Pacita Ocampo'], donor: 'Ocampo Family (Demo)', offering: 300, startTime: '07:00 AM', endTime: '07:00 PM' },
  { mass: 2, type: 'Healing', names: ['Rolando Fernandez'], donor: 'Fernandez Family (Demo)', offering: 300 },
  { mass: 2, type: 'Thanksgiving', names: ['Garcia Family'], donor: 'Garcia Family (Demo)', offering: 300 },
  { mass: 2, type: 'For the Soul of...', names: ['Teodoro Lopez', 'Concepcion Lopez'], donor: 'Lopez Family (Demo)', offering: 400 },
  { mass: 2, type: 'Special Intention', names: ['Parish Community — Peaceful Elections'], donor: 'Parish Council (Demo)', offering: 200 },

  // ---- Not yet assigned to a mass (Pending, "Awaiting assignment") ----
  { mass: null, type: 'Healing', names: ['Josefina Ramos'], donor: 'Ramos Family (Demo)', offering: 300 },
  { mass: null, type: 'Thanksgiving', names: ['Villafuerte Family'], donor: 'Villafuerte Family (Demo)', offering: 300 },
  { mass: null, type: 'For the Soul of...', names: ['Amparo Cruz'], donor: 'Maria P. Santos', offering: 300 },
];

document.addEventListener('DOMContentLoaded', () => {

  const seedBtn    = document.getElementById('btn-seed');
  const clearBtn     = document.getElementById('btn-clear');
  const statusEl        = document.getElementById('seed-status');
  const logEl              = document.getElementById('seed-log');

  function getStoredIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function setStoredIds(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function resetLog() {
    logEl.innerHTML = '';
    logEl.classList.remove('hidden');
  }
  function logLine(text, isError = false) {
    const line = document.createElement('div');
    if (isError) line.className = 'err';
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setBusy(busy) {
    seedBtn.disabled = busy;
    clearBtn.disabled = busy;
    seedBtn.style.opacity = busy ? '0.6' : '';
    clearBtn.style.opacity = busy ? '0.6' : '';
  }

  seedBtn.addEventListener('click', async () => {
    setBusy(true);
    resetLog();
    setStatus(`Seeding ${MOCK_RECORDS.length} mock intentions…`);

    const createdIds = getStoredIds();
    let successCount = 0;
    let errorCount = 0;

    for (const rec of MOCK_RECORDS) {
      const massInfo = rec.mass !== null ? MOCK_MASSES[rec.mass] : null;
      try {
        const result = await client.models.MassIntention.create({
          donor: rec.donor,
          type: rec.type,
          names: JSON.stringify(rec.names),
          startTime: rec.startTime || undefined,
          endTime: rec.endTime || undefined,
          massDate: massInfo ? massInfo.massDate : undefined,
          massTime: massInfo ? massInfo.massTime : undefined,
          offering: rec.offering,
          status: massInfo ? 'scheduled' : 'pending',
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        if (result.data?.id) createdIds.push(result.data.id);
        successCount++;
        logLine(`✓ ${rec.donor} — ${rec.type}${massInfo ? ` (${massInfo.massDate} ${massInfo.massTime})` : ' (unassigned)'}`);
      } catch (err) {
        errorCount++;
        logLine(`✗ ${rec.donor} — ${err.message || 'failed'}`, true);
      }
    }

    setStoredIds(createdIds);
    setStatus(`Done — ${successCount} created${errorCount ? `, ${errorCount} failed` : ''}. Open Mass Intentions to see them.`);
    setBusy(false);
  });

  clearBtn.addEventListener('click', async () => {
    const ids = getStoredIds();
    if (ids.length === 0) {
      setStatus('No mock data recorded on this browser to clear.');
      return;
    }

    setBusy(true);
    resetLog();
    setStatus(`Removing ${ids.length} mock record(s)…`);

    let removed = 0;
    for (const id of ids) {
      try {
        const result = await client.models.MassIntention.delete({ id });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        removed++;
        logLine(`✓ removed ${id}`);
      } catch (err) {
        logLine(`✗ ${id} — ${err.message || 'failed'}`, true);
      }
    }

    setStoredIds([]);
    setStatus(`Removed ${removed} of ${ids.length} mock record(s).`);
    setBusy(false);
  });

});