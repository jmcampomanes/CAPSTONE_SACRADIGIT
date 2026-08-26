/* ============================================
   SacraDigit Admin — Seed Mock Masses & Special Schedules
   Dev-only utility, not linked from the app's nav.
   Creates realistic sample Mass records (and, when the
   backend supports it, SpecialSchedule records) through
   the same client used everywhere else, so the new
   Calendar View on both pages has real data to demo —
   no fixtures, no separate database, just rows in the
   real tables.

   Every record this tool creates is tracked by id in
   localStorage (this browser only), so "Clear Mock
   Data" can remove exactly what it added and nothing
   the parish has actually entered.

   NOTE on Mass.type: the deployed MassType enum is
   ('daily' | 'anticipated' | 'special' | 'binyag') —
   NOT the "Daily Mass" / "Sunday Mass" / "Anticipated
   Mass" / "Special Mass" strings the Schedule Mass modal
   dropdown submits. That mismatch predates this tool; it
   likely means submitting that modal against the real
   backend fails validation. This seed script uses the
   real enum values so it actually succeeds, and keeps a
   human-readable label in `title` for display.
   ============================================ */

import { client } from './amplify-init.js';

const STORAGE_KEY_MASSES    = 'sacradigit_mock_mass_ids';
const STORAGE_KEY_SCHEDULES = 'sacradigit_mock_schedule_ids';

const todayISO = new Date().toISOString().slice(0, 10);

function isoAdd(baseIso, days) {
  const d = new Date(baseIso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const RANGE_START = isoAdd(todayISO, -6);  // about a week before today
const RANGE_END   = isoAdd(todayISO, 40);  // ~5.5 weeks after today, so three months are touched

/* ---------- Mass records ---------- */
function buildMockMasses() {
  const records = [];
  let cursor = RANGE_START;

  while (cursor <= RANGE_END) {
    const dow = new Date(cursor + 'T00:00:00').getDay(); // 0 = Sun … 6 = Sat

    if (dow >= 1 && dow <= 5) {
      // Weekday Daily Masses
      records.push({ date: cursor, time: '06:00 AM', type: 'daily', title: 'Daily Mass', isSpecial: false });
      records.push({ date: cursor, time: '07:00 AM', type: 'daily', title: 'Daily Mass', isSpecial: false });
    } else if (dow === 6) {
      // Saturday: morning Daily Mass + evening Anticipated Mass
      records.push({ date: cursor, time: '07:00 AM', type: 'daily', title: 'Daily Mass', isSpecial: false });
      records.push({ date: cursor, time: '05:30 PM', type: 'anticipated', title: 'Anticipated Sunday Mass', isSpecial: false });
    } else {
      // Sunday
      ['06:00 AM', '08:00 AM', '10:00 AM', '05:00 PM'].forEach(t => {
        records.push({ date: cursor, time: t, type: 'daily', title: 'Sunday Mass', isSpecial: false });
      });
    }

    cursor = isoAdd(cursor, 1);
  }

  // A handful of named special / baptism masses sprinkled through the range.
  const NOTABLE = [
    { offset: 2,  time: '06:00 PM', type: 'special', title: 'First Friday Devotion',           note: 'Adoration follows the 6 PM Mass' },
    { offset: 9,  time: '10:00 AM', type: 'binyag',  title: 'Baptism Mass',                     note: '' },
    { offset: 16, time: '05:00 PM', type: 'special', title: 'Feast of Our Lady of Sorrows',      note: 'Procession follows' },
    { offset: 23, time: '06:00 PM', type: 'special', title: 'Exaltation of the Holy Cross',      note: '' },
    { offset: 30, time: '10:00 AM', type: 'binyag',  title: 'Baptism Mass',                      note: '' },
    { offset: 34, time: '06:00 PM', type: 'special', title: 'Feast of the Holy Guardian Angels', note: 'Family blessing after Mass' },
  ];

  NOTABLE.forEach(n => {
    const date = isoAdd(todayISO, n.offset);
    if (date < RANGE_START || date > RANGE_END) return;
    records.push({ date, time: n.time, type: n.type, title: n.title, note: n.note, isSpecial: n.type === 'special' });
  });

  return records;
}

/* ---------- Special Schedule records (only used if the model is deployed) ---------- */
function buildMockSchedules() {
  return [
    { name: 'Ordinary Time', type: 'Liturgical Season', status: 'Ongoing',
      startDate: isoAdd(todayISO, -30), endDate: isoAdd(todayISO, 60), note: 'Green vestments' },
    { name: 'Novena to Our Lady of Sorrows', type: 'Novena', status: 'Upcoming',
      startDate: isoAdd(todayISO, 8), endDate: isoAdd(todayISO, 16), note: 'Daily masses at 5 PM' },
    { name: 'Feast of the Holy Cross Triduum', type: 'Feast Day Series', status: 'Upcoming',
      startDate: isoAdd(todayISO, 21), endDate: isoAdd(todayISO, 23), note: '' },
    { name: 'Parish Fiesta Week', type: 'Special Event', status: 'Upcoming',
      startDate: isoAdd(todayISO, 33), endDate: isoAdd(todayISO, 37), note: 'Special morning and evening masses' },
  ];
}

document.addEventListener('DOMContentLoaded', () => {

  const seedBtn    = document.getElementById('btn-seed');
  const clearBtn     = document.getElementById('btn-clear');
  const statusEl        = document.getElementById('seed-status');
  const logEl              = document.getElementById('seed-log');
  const schedulesWarning     = document.getElementById('schedules-warning');

  const hasSpecialSchedule = !!client.models.SpecialSchedule;
  if (!hasSpecialSchedule) schedulesWarning.classList.remove('hidden');

  function getStoredIds(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }
  function setStoredIds(key, ids) {
    localStorage.setItem(key, JSON.stringify(ids));
  }

  function resetLog() {
    logEl.innerHTML = '';
    logEl.classList.remove('hidden');
  }
  function logLine(text, kind) {
    const line = document.createElement('div');
    if (kind === 'error') line.className = 'err';
    if (kind === 'warn') line.className = 'warn';
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

    const mockMasses = buildMockMasses();
    const mockSchedules = hasSpecialSchedule ? buildMockSchedules() : [];
    setStatus(`Seeding ${mockMasses.length} mock masses${hasSpecialSchedule ? ` + ${mockSchedules.length} special schedules` : ''}…`);

    /* --- Masses --- */
    const createdMassIds = getStoredIds(STORAGE_KEY_MASSES);
    let massSuccess = 0;
    let massError = 0;

    for (const m of mockMasses) {
      try {
        const result = await client.models.Mass.create({
          date: m.date,
          time: m.time,
          type: m.type,
          title: m.title,
          note: m.note || undefined,
          isSpecial: m.isSpecial,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        if (result.data?.id) createdMassIds.push(result.data.id);
        massSuccess++;
        logLine(`✓ Mass — ${m.date} ${m.time} — ${m.title}`);
      } catch (err) {
        massError++;
        logLine(`✗ Mass — ${m.date} ${m.time} — ${m.title}: ${err.message || 'failed'}`, 'error');
      }
    }
    setStoredIds(STORAGE_KEY_MASSES, createdMassIds);

    /* --- Special Schedules (only if the backend model exists) --- */
    let scheduleSuccess = 0;
    let scheduleError = 0;

    if (hasSpecialSchedule) {
      const createdScheduleIds = getStoredIds(STORAGE_KEY_SCHEDULES);
      for (const s of mockSchedules) {
        try {
          const result = await client.models.SpecialSchedule.create({
            name: s.name,
            type: s.type,
            status: s.status,
            startDate: s.startDate,
            endDate: s.endDate,
            note: s.note,
          });
          if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
          if (result.data?.id) createdScheduleIds.push(result.data.id);
          scheduleSuccess++;
          logLine(`✓ Schedule — ${s.name} (${s.startDate} – ${s.endDate})`);
        } catch (err) {
          scheduleError++;
          logLine(`✗ Schedule — ${s.name}: ${err.message || 'failed'}`, 'error');
        }
      }
      setStoredIds(STORAGE_KEY_SCHEDULES, createdScheduleIds);
    } else {
      logLine("⚠ Skipped Special Schedules — the SpecialSchedule model isn't deployed to the backend yet.", 'warn');
    }

    const massSummary = `${massSuccess} mass${massSuccess === 1 ? '' : 'es'} created${massError ? `, ${massError} failed` : ''}`;
    const scheduleSummary = hasSpecialSchedule
      ? `; ${scheduleSuccess} schedule${scheduleSuccess === 1 ? '' : 's'} created${scheduleError ? `, ${scheduleError} failed` : ''}`
      : '; schedules skipped (model not deployed)';
    setStatus(`Done — ${massSummary}${scheduleSummary}. Open Masses / Special Schedules to see them.`);
    setBusy(false);
  });

  clearBtn.addEventListener('click', async () => {
    const massIds = getStoredIds(STORAGE_KEY_MASSES);
    const scheduleIds = hasSpecialSchedule ? getStoredIds(STORAGE_KEY_SCHEDULES) : [];

    if (massIds.length === 0 && scheduleIds.length === 0) {
      setStatus('No mock data recorded on this browser to clear.');
      return;
    }

    setBusy(true);
    resetLog();
    setStatus(`Removing ${massIds.length} mass(es)${scheduleIds.length ? ` and ${scheduleIds.length} schedule(s)` : ''}…`);

    let massRemoved = 0;
    for (const id of massIds) {
      try {
        const result = await client.models.Mass.delete({ id });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        massRemoved++;
        logLine(`✓ removed mass ${id}`);
      } catch (err) {
        logLine(`✗ mass ${id} — ${err.message || 'failed'}`, 'error');
      }
    }
    setStoredIds(STORAGE_KEY_MASSES, []);

    let scheduleRemoved = 0;
    if (hasSpecialSchedule) {
      for (const id of scheduleIds) {
        try {
          const result = await client.models.SpecialSchedule.delete({ id });
          if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
          scheduleRemoved++;
          logLine(`✓ removed schedule ${id}`);
        } catch (err) {
          logLine(`✗ schedule ${id} — ${err.message || 'failed'}`, 'error');
        }
      }
      setStoredIds(STORAGE_KEY_SCHEDULES, []);
    }

    setStatus(`Removed ${massRemoved} of ${massIds.length} mass(es)${hasSpecialSchedule ? `, ${scheduleRemoved} of ${scheduleIds.length} schedule(s)` : ''}.`);
    setBusy(false);
  });

});