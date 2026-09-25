/* ============================================
   Sacra ITech — Storage
   Built on the CloudFile model (one record per
   upload: name, url = S3 path or external link,
   folder, bytes) and Amplify Storage (S3).
   - Space used / files / folders, usage by folder
   - All files: search, folder filter, sort, open, delete
     (delete removes the S3 object and the record)
   - Consistency check: records whose S3 object is
     missing, and S3 objects under cloudFiles/ that
     no record points to (orphans)
   ============================================ */

import { client } from '../amplify-init.js';
import { list, getUrl, remove } from 'aws-amplify/storage';
import { escapeHtml, formatBytes, formatDateTime, showToast, logItAction, folderName, isExternalUrl as isExternal, userFiles, listAll } from './itech-shell.js';

const $ = (id) => document.getElementById(id);

let files = [];

/* ---------- Summary + usage ---------- */

function renderSummary() {
  const stored = files.filter(f => !isExternal(f.url));
  const used = stored.reduce((s, f) => s + (f.bytes || 0), 0);
  const byFolder = new Map();
  files.forEach(f => {
    const k = f.folder || '';
    const entry = byFolder.get(k) || { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += isExternal(f.url) ? 0 : (f.bytes || 0);
    byFolder.set(k, entry);
  });

  $('stat-used').textContent = formatBytes(used);
  $('stat-files').textContent = files.length.toLocaleString();
  $('stat-files-sub').textContent = files.length - stored.length
    ? `${stored.length} uploaded · ${files.length - stored.length} external link${files.length - stored.length === 1 ? '' : 's'}`
    : 'in the SacraDigit bucket';
  $('stat-folders').textContent = byFolder.size;

  const rows = [...byFolder.entries()].sort((a, b) => b[1].bytes - a[1].bytes || b[1].count - a[1].count);
  const max = Math.max(1, ...rows.map(([, v]) => v.bytes));
  $('folder-usage').innerHTML = rows.length === 0
    ? '<p class="empty-state">No files uploaded yet.</p>'
    : rows.map(([k, v]) => `
      <div>
        <div class="usage-row-head">
          <span class="usage-name">${escapeHtml(folderName(k))}</span>
          <span class="usage-meta">${formatBytes(v.bytes)} · ${v.count} file${v.count === 1 ? '' : 's'}</span>
        </div>
        <div class="usage-bar"><div class="usage-bar-fill" style="width:${Math.max(2, Math.round((v.bytes / max) * 100))}%;"></div></div>
      </div>`).join('');

  const folderSelect = $('file-folder');
  const current = folderSelect.value;
  folderSelect.innerHTML = '<option value="">All folders</option>' + rows.map(([k]) => `<option value="${escapeHtml(k)}">${escapeHtml(folderName(k))}</option>`).join('');
  if (rows.some(([k]) => k === current)) folderSelect.value = current;
}

/* ---------- File table ---------- */

function renderFiles() {
  const q = $('file-search').value.trim().toLowerCase();
  const folder = $('file-folder').value;
  const sort = $('file-sort').value;
  let rows = files.filter(f => (!folder || (f.folder || '') === folder) && (!q || (f.name || '').toLowerCase().includes(q)));
  rows.sort(sort === 'largest' ? (a, b) => (b.bytes || 0) - (a.bytes || 0)
    : sort === 'name' ? (a, b) => (a.name || '').localeCompare(b.name || '')
    : (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  $('files-count').textContent = `${rows.length} of ${files.length}`;
  $('file-tbody').innerHTML = rows.length === 0
    ? `<tr><td colspan="5" class="empty-state">${files.length ? 'No files match.' : 'No files uploaded yet.'}</td></tr>`
    : rows.map(f => `
      <tr>
        <td><p class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</p></td>
        <td><span class="badge badge-gray">${escapeHtml(folderName(f.folder))}</span></td>
        <td class="text-right">${isExternal(f.url) ? '<span class="badge badge-blue">Link</span>' : formatBytes(f.bytes)}</td>
        <td class="text-gray-400">${escapeHtml(formatDateTime(f.createdAt))}</td>
        <td><div class="file-actions">
          <button type="button" class="btn-link" data-open="${f.id}">Open</button>
          <button type="button" class="btn-link danger" data-delete="${f.id}">Delete</button>
        </div></td>
      </tr>`).join('');
}

client.models.CloudFile.observeQuery().subscribe({
  next: ({ items }) => { files = userFiles(items); renderSummary(); renderFiles(); },
  error: (err) => {
    console.error('Failed to load files:', err);
    $('file-tbody').innerHTML = '<tr><td colspan="5" class="empty-state">Couldn’t load files.</td></tr>';
  },
});

['file-search', 'file-folder', 'file-sort'].forEach(id => $(id).addEventListener('input', renderFiles));

$('file-tbody').addEventListener('click', async (e) => {
  const openId = e.target.closest('[data-open]')?.dataset.open;
  if (openId) {
    const f = files.find(x => x.id === openId);
    if (!f) return;
    // Open the tab synchronously (so popup blockers allow it), then point it at the signed URL
    const win = window.open('about:blank', '_blank');
    try {
      const href = isExternal(f.url) ? f.url : (await getUrl({ path: f.url, options: { expiresIn: 900 } })).url.toString();
      if (win) { win.opener = null; win.location.href = href; } else window.location.href = href;
    } catch (err) {
      win?.close();
      console.error('Failed to open file:', err);
      showToast('Couldn’t open that file — it may be missing from storage.', true);
    }
    return;
  }

  const delId = e.target.closest('[data-delete]')?.dataset.delete;
  if (!delId) return;
  const f = files.find(x => x.id === delId);
  if (!f || !confirm(`Permanently delete “${f.name}”? This removes it for everyone and can’t be undone.`)) return;
  try {
    if (!isExternal(f.url)) {
      await remove({ path: f.url }).catch(err => console.warn('S3 object not removed (may already be gone):', err));
    }
    const { errors } = await client.models.CloudFile.delete({ id: delId });
    if (errors?.length) throw new Error(errors[0].message);
    logItAction('Delete File', `${f.name} (${folderName(f.folder)}, ${formatBytes(f.bytes)})`);
    showToast(`“${f.name}” deleted.`);
  } catch (err) {
    console.error('Failed to delete file:', err);
    showToast(err.message || 'Couldn’t delete the file.', true);
  }
});

/* ---------- Consistency check ---------- */

$('btn-check').addEventListener('click', async () => {
  const btn = $('btn-check');
  btn.disabled = true;
  $('check-results').innerHTML = '<p class="text-xs text-gray-400">Scanning the bucket…</p>';
  try {
    const { items } = await list({ path: 'cloudFiles/', options: { listAll: true } });
    const objects = new Map(items.map(o => [o.path, o]));
    const tracked = files.filter(f => !isExternal(f.url));
    // Digital Archives uploads (cloudFiles/parishRecords/) are tracked by
    // ParishRecord.fileURL rather than CloudFile, so count those as tracked too
    const records = await listAll('ParishRecord').catch(() => []);
    const trackedPaths = new Set([...tracked.map(f => f.url), ...records.map(p => p.fileURL).filter(u => u && !isExternal(u))]);

    const missing = tracked.filter(f => !objects.has(f.url));
    const orphans = items.filter(o => !trackedPaths.has(o.path) && !o.path.endsWith('/'));
    const orphanBytes = orphans.reduce((s, o) => s + (o.size || 0), 0);

    const tile = (value, label, bad) => `<div class="check-tile ${bad ? 'bad' : 'good'}"><p class="check-tile-value">${value}</p><p class="check-tile-label">${label}</p></div>`;
    const listHtml = (title, rows) => rows.length ? `<p class="check-list-title">${title}</p><ul class="check-list">${rows.join('')}</ul>` : '';

    $('check-results').innerHTML = `
      <div class="check-summary">
        ${tile(tracked.length - missing.length, 'files OK', false)}
        ${tile(missing.length, 'records with missing file', missing.length > 0)}
        ${tile(orphans.length, `untracked files (${formatBytes(orphanBytes)})`, orphans.length > 0)}
      </div>
      ${missing.length || orphans.length ? '' : '<p class="text-xs text-green-700 font-semibold">Everything matches — every record has its file and every file has a record.</p>'}
      ${listHtml('Records whose file is missing from storage', missing.map(f => `<li><b>${escapeHtml(f.name)}</b> — ${escapeHtml(f.url)}</li>`))}
      ${listHtml('Files in storage that no record points to', orphans.map(o => `<li>${escapeHtml(o.path)} · ${formatBytes(o.size)}</li>`))}
      <p class="form-hint mt-3">Checks uploads under <code>cloudFiles/</code> — Cloud Access, Media Library and Digital Archives.</p>`;
    logItAction('Storage Check', `${tracked.length} tracked · ${missing.length} missing · ${orphans.length} untracked`);
  } catch (err) {
    console.error('Consistency check failed:', err);
    $('check-results').innerHTML = `<p class="text-xs text-red-600">Couldn’t scan storage: ${escapeHtml(err.message || 'unknown error')}. The bucket may not allow listing for this account.</p>`;
  } finally {
    btn.disabled = false;
  }
});
