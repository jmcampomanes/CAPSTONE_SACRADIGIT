/* ============================================
   Special Masses Import Tool — Scripts
   Writes real records to the SpecialSchedule
   model using the same Amplify client every other
   admin page uses (amplify-init.js). This is a
   temporary utility, not part of the permanent
   app — delete this whole tools/ folder once
   you've run the import you need.
   ============================================ */

import { client } from '../amplify-init.js';
import { SPECIAL_MASSES_2026_PH } from './special-masses-2026-ph-data.js';

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('masses-tbody');
  const headerCheckbox = document.getElementById('header-checkbox');
  const selectAllBtn = document.getElementById('select-all-btn');
  const selectNoneBtn = document.getElementById('select-none-btn');
  const rankFilter = document.getElementById('rank-filter');
  const importBtn = document.getElementById('import-btn');
  const selectedCountEl = document.getElementById('selected-count');
  const logEl = document.getElementById('import-log');
  const toast = document.getElementById('toast');

  let toastTimer = null;
  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3500);
  }

  function log(line) {
    logEl.classList.remove('hidden');
    logEl.textContent += line + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // Give each row a stable id for DOM lookups
  const rows = SPECIAL_MASSES_2026_PH.map((m, i) => ({ ...m, rowId: 'row' + i, imported: false }));

  function render() {
    const filter = rankFilter.value;
    tbody.innerHTML = rows
      .filter(r => filter === 'all' || r.rank === filter)
      .map(r => `
        <tr data-row-id="${r.rowId}" id="tr-${r.rowId}">
          <td><input type="checkbox" class="row-checkbox" data-row-id="${r.rowId}" ${r.imported ? 'disabled' : 'checked'} /></td>
          <td class="whitespace-nowrap">${formatDate(r.date)}</td>
          <td>
            <p class="font-medium text-gray-900">${escapeHtml(r.name)}</p>
            ${r.note ? `<p class="text-xs text-gray-400">${escapeHtml(r.note)}</p>` : ''}
          </td>
          <td><span class="rank-badge rank-${r.rank}">${r.rank}</span></td>
          <td><input type="text" class="row-time-input" data-field="suggestedTime" data-row-id="${r.rowId}" value="${escapeHtml(r.suggestedTime || '')}" placeholder="e.g. 6:00 PM" ${r.imported ? 'disabled' : ''} /></td>
          <td><input type="text" class="row-note-input" data-field="note" data-row-id="${r.rowId}" value="${escapeHtml(r.note || '')}" placeholder="Optional note" ${r.imported ? 'disabled' : ''} /></td>
          <td><span class="row-status pending" data-row-id="${r.rowId}">${r.imported ? '✓ Imported' : 'Pending'}</span></td>
        </tr>
      `).join('');
    updateSelectedCount();
  }

  function updateSelectedCount() {
    const checked = tbody.querySelectorAll('.row-checkbox:checked:not(:disabled)').length;
    selectedCountEl.textContent = `${checked} selected`;
    importBtn.disabled = checked === 0;
  }

  tbody.addEventListener('input', (e) => {
    const rowId = e.target.dataset.rowId;
    const field = e.target.dataset.field;
    if (!rowId || !field) return;
    const row = rows.find(r => r.rowId === rowId);
    if (row) row[field] = e.target.value;
  });

  tbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) updateSelectedCount();
  });

  headerCheckbox.addEventListener('change', () => {
    tbody.querySelectorAll('.row-checkbox:not(:disabled)').forEach(cb => { cb.checked = headerCheckbox.checked; });
    updateSelectedCount();
  });

  selectAllBtn.addEventListener('click', () => {
    tbody.querySelectorAll('.row-checkbox:not(:disabled)').forEach(cb => { cb.checked = true; });
    updateSelectedCount();
  });

  selectNoneBtn.addEventListener('click', () => {
    tbody.querySelectorAll('.row-checkbox:not(:disabled)').forEach(cb => { cb.checked = false; });
    updateSelectedCount();
  });

  rankFilter.addEventListener('change', render);

  importBtn.addEventListener('click', async () => {
    if (!client.models.SpecialSchedule) {
      showToast('SpecialSchedule model is missing from the deployed backend schema.', true);
      log('✗ client.models.SpecialSchedule is undefined — check amplify_outputs.json / your deployed schema.');
      return;
    }

    const checkedBoxes = [...tbody.querySelectorAll('.row-checkbox:checked:not(:disabled)')];
    if (checkedBoxes.length === 0) return;

    importBtn.disabled = true;
    importBtn.textContent = 'Importing…';
    log(`\n— Starting import of ${checkedBoxes.length} record(s) —`);

    let successCount = 0;
    let errorCount = 0;

    for (const cb of checkedBoxes) {
      const rowId = cb.dataset.rowId;
      const row = rows.find(r => r.rowId === rowId);
      if (!row) continue;

      const statusEl = document.querySelector(`.row-status[data-row-id="${rowId}"]`);
      const trEl = document.getElementById(`tr-${rowId}`);

      try {
        const result = await client.models.SpecialSchedule.create({
          name: row.name,
          type: row.rank === 'Triduum' ? 'Special Event' : 'Feast Day Series',
          status: 'Upcoming',
          startDate: row.date,
          endDate: row.date,
          note: [row.suggestedTime ? `Mass: ${row.suggestedTime}` : '', row.note || '']
            .filter(Boolean)
            .join(' — '),
        });

        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

        row.imported = true;
        statusEl.textContent = '✓ Imported';
        statusEl.className = 'row-status ok';
        trEl.classList.add('row-imported');
        cb.disabled = true;
        successCount++;
        log(`✓ ${row.date}  ${row.name}`);
      } catch (err) {
        statusEl.textContent = '✗ Failed';
        statusEl.className = 'row-status error';
        trEl.classList.add('row-error');
        errorCount++;
        log(`✗ ${row.date}  ${row.name} — ${err.message || 'unknown error'}`);
      }
    }

    importBtn.disabled = false;
    importBtn.textContent = 'Import Selected to SpecialSchedule';
    updateSelectedCount();

    log(`— Done: ${successCount} imported, ${errorCount} failed —`);
    showToast(
      errorCount === 0
        ? `${successCount} special mass${successCount === 1 ? '' : 'es'} imported.`
        : `${successCount} imported, ${errorCount} failed — see log below.`,
      errorCount > 0
    );
  });

  render();
});
