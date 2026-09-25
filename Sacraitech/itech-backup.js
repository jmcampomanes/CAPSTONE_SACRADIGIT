/* ============================================
   Sacra ITech — Data Backup
   Read-only exports of every data model:
   - per module as JSON or CSV
   - everything at once as one JSON file
     ({ exportedAt, app, modules: { Model: [...] } })
   Every export is recorded in Activity Logs.
   ============================================ */

import { DATA_MODULES, listAll, escapeHtml, downloadFile, toCsv, todayStamp, logItAction, showToast } from './itech-shell.js';

const $ = (id) => document.getElementById(id);
const counts = new Map();

async function loadCounts() {
  $('backup-tbody').innerHTML = DATA_MODULES.map(m => `
    <tr>
      <td class="font-medium text-gray-900">${escapeHtml(m.label)}</td>
      <td><span class="badge badge-gray">${escapeHtml(m.area)}</span></td>
      <td class="text-right font-semibold text-gray-900" id="count-${m.model}">…</td>
      <td><div class="backup-actions">
        <button type="button" class="btn-filter btn-sm" data-export="${m.model}" data-format="json">JSON</button>
        <button type="button" class="btn-filter btn-sm" data-export="${m.model}" data-format="csv">CSV</button>
      </div></td>
    </tr>`).join('');

  await Promise.all(DATA_MODULES.map(async m => {
    try {
      const items = await listAll(m.model);
      counts.set(m.model, items.length);
      $(`count-${m.model}`).textContent = items.length.toLocaleString();
    } catch (err) {
      console.error(`Count failed for ${m.model}:`, err);
      $(`count-${m.model}`).innerHTML = '<span class="badge badge-red">Error</span>';
    }
  }));
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  $('backup-total').textContent = `${total.toLocaleString()} records in ${DATA_MODULES.length} modules`;
}

$('backup-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-export]');
  if (!btn) return;
  const m = DATA_MODULES.find(x => x.model === btn.dataset.export);
  const format = btn.dataset.format;
  btn.disabled = true;
  try {
    const items = await listAll(m.model);
    if (!items.length) { showToast(`${m.label} has no records to export.`, true); return; }
    const base = `sacradigit-${m.model.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-${todayStamp()}`;
    if (format === 'csv') downloadFile(`${base}.csv`, toCsv(items), 'text/csv');
    else downloadFile(`${base}.json`, JSON.stringify(items, null, 2));
    logItAction('Export', `${m.label} — ${items.length} records (${format.toUpperCase()})`);
    showToast(`Exported ${items.length} ${m.label.toLowerCase()} records.`);
  } catch (err) {
    console.error('Export failed:', err);
    showToast(err.message || 'Export failed.', true);
  } finally {
    btn.disabled = false;
  }
});

$('btn-export-all').addEventListener('click', async () => {
  const btn = $('btn-export-all');
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.textContent = 'Preparing backup…';
  try {
    const modules = {};
    const failed = [];
    for (const m of DATA_MODULES) {
      try { modules[m.model] = await listAll(m.model); } catch (err) { failed.push(m.label); console.error(err); }
    }
    const total = Object.values(modules).reduce((s, a) => s + a.length, 0);
    downloadFile(`sacradigit-full-backup-${todayStamp()}.json`, JSON.stringify({
      app: 'SacraDigit',
      exportedAt: new Date().toISOString(),
      exportedBy: 'Sacra ITech',
      recordCount: total,
      modules,
    }, null, 2));
    logItAction('Export', `Full backup — ${total} records in ${Object.keys(modules).length} modules (JSON)`);
    showToast(failed.length ? `Backup saved, but skipped: ${failed.join(', ')}.` : `Full backup saved — ${total.toLocaleString()} records.`, failed.length > 0);
  } catch (err) {
    console.error('Full backup failed:', err);
    showToast(err.message || 'Backup failed.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

loadCounts();
