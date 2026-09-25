/* ============================================
   Sacra ITech — System Overview
   - Stat tiles: records stored (all modules), storage
     used (CloudFile bytes), roles defined, activity today
   - System Health: live checks, re-runnable —
     Data API (timed query), File Storage (timed list),
     Network (browser online state), Livestream status
   - Data by Module: record count + last change per model
   - Recent Activity: latest AccessLog entries
   ============================================ */

import { client } from '../amplify-init.js';
import { list } from 'aws-amplify/storage';
import { DATA_MODULES, listAll, escapeHtml, formatBytes, timeAgo, formatDateTime, actionKind, userFiles } from './itech-shell.js';

const $ = (id) => document.getElementById(id);

/* ---------- System Health ---------- */

const CHECKS = [
  { key: 'api',     name: 'Data API',     desc: 'Database (Amplify Data / AppSync)' },
  { key: 'storage', name: 'File Storage', desc: 'Cloud bucket (Amplify Storage / S3)' },
  { key: 'network', name: 'Network',      desc: 'This device’s internet connection' },
  { key: 'live',    name: 'Livestream',   desc: 'Parish livestream status' },
];

function renderHealthCards() {
  $('health-grid').innerHTML = CHECKS.map(c => `
    <div class="health-card" id="health-${c.key}" data-state="checking">
      <span class="health-dot" aria-hidden="true"></span>
      <div class="min-w-0">
        <p class="health-name">${c.name}</p>
        <p class="health-status">Checking…</p>
        <p class="health-meta">${c.desc}</p>
      </div>
    </div>`).join('');
}

function setHealth(key, state, status, meta) {
  const card = $(`health-${key}`);
  if (!card) return;
  card.dataset.state = state;
  card.querySelector('.health-status').textContent = status;
  if (meta) card.querySelector('.health-meta').textContent = meta;
}

async function timed(fn) {
  const start = performance.now();
  await fn();
  return Math.round(performance.now() - start);
}

async function runChecks() {
  const btn = $('btn-run-checks');
  btn.disabled = true;
  renderHealthCards();

  const net = navigator.onLine;
  setHealth('network', net ? 'ok' : 'down', net ? 'Online' : 'Offline', net ? 'Browser reports a working connection' : 'No internet — cloud checks will fail');

  await Promise.all([
    (async () => {
      try {
        const ms = await timed(async () => {
          const { errors } = await client.models.AccessLog.list({ limit: 1 });
          if (errors?.length) throw new Error(errors[0].message);
        });
        setHealth('api', ms > 1500 ? 'warn' : 'ok', ms > 1500 ? `Slow — ${ms} ms` : `Operational — ${ms} ms`, 'Timed a live database query');
      } catch (err) {
        setHealth('api', 'down', 'Unreachable', err.message || 'Query failed');
      }
    })(),
    (async () => {
      try {
        const ms = await timed(() => list({ path: 'cloudFiles/', options: { pageSize: 1 } }));
        setHealth('storage', ms > 2000 ? 'warn' : 'ok', ms > 2000 ? `Slow — ${ms} ms` : `Operational — ${ms} ms`, 'Timed a live bucket listing');
      } catch (err) {
        setHealth('storage', 'down', 'Unreachable', err.message || 'Listing failed');
      }
    })(),
    (async () => {
      try {
        const { data, errors } = await client.models.LivestreamStatus.list({ limit: 10 });
        if (errors?.length) throw new Error(errors[0].message);
        const live = (data || []).find(s => s.isLive);
        setHealth('live', 'ok', live ? `LIVE on ${live.platform || 'stream'}` : 'Offline (not streaming)', live?.url || 'Managed by the Media Team');
      } catch (err) {
        setHealth('live', 'warn', 'Unknown', err.message || 'Could not read status');
      }
    })(),
  ]);

  $('health-checked').textContent = `Checked ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  btn.disabled = false;
}

window.addEventListener('online', runChecks);
window.addEventListener('offline', runChecks);

/* ---------- Data by Module + stat tiles ---------- */

async function loadModules() {
  const results = await Promise.all(DATA_MODULES.map(async m => {
    try {
      const items = await listAll(m.model);
      const last = items.reduce((max, r) => (r.updatedAt && r.updatedAt > max ? r.updatedAt : max), '');
      return { ...m, count: items.length, last, items };
    } catch (err) {
      console.error(`Count failed for ${m.model}:`, err);
      return { ...m, count: null, last: '', items: [] };
    }
  }));

  $('module-tbody').innerHTML = results
    .slice().sort((a, b) => (b.count ?? -1) - (a.count ?? -1))
    .map(r => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(r.label)}</td>
        <td><span class="badge badge-gray">${escapeHtml(r.area)}</span></td>
        <td class="text-right font-semibold text-gray-900">${r.count === null ? '<span class="badge badge-red">Error</span>' : r.count.toLocaleString()}</td>
        <td class="text-gray-400" title="${escapeHtml(formatDateTime(r.last))}">${r.last ? timeAgo(r.last) : '—'}</td>
      </tr>`).join('');

  const total = results.reduce((s, r) => s + (r.count || 0), 0);
  $('stat-records').textContent = total.toLocaleString();
  $('stat-records-sub').textContent = `across ${results.length} modules`;

  const files = userFiles(results.find(r => r.model === 'CloudFile')?.items || []);
  $('stat-storage').textContent = formatBytes(files.reduce((s, f) => s + (f.bytes || 0), 0));
  $('stat-storage-sub').textContent = `${files.length} file${files.length === 1 ? '' : 's'} tracked`;

  const roles = results.find(r => r.model === 'Role')?.items || [];
  const users = new Set(roles.flatMap(r => (r.users || '').split(',').map(u => u.trim()).filter(Boolean)));
  $('stat-roles').textContent = roles.length;
  $('stat-roles-sub').textContent = `${users.size} assigned user${users.size === 1 ? '' : 's'}`;
}

/* ---------- Recent Activity (live) ---------- */

client.models.AccessLog.observeQuery().subscribe({
  next: ({ items }) => {
    const sorted = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const today = new Date().toDateString();
    const todayCount = items.filter(a => new Date(a.createdAt).toDateString() === today).length;
    $('stat-activity').textContent = todayCount;
    $('stat-activity-sub').textContent = `${items.length.toLocaleString()} log entries in total`;

    const recent = sorted.slice(0, 8);
    $('activity-list').innerHTML = recent.length === 0
      ? '<li class="empty-state">No activity recorded yet.</li>'
      : recent.map(a => `
        <li class="activity-row">
          <span class="action-tag" data-kind="${actionKind(a.action)}">${escapeHtml(a.action || '—')}</span>
          <div class="activity-main">
            <p class="activity-detail">${escapeHtml(a.fileName || '')}</p>
            <p class="activity-meta">${escapeHtml(a.userName || 'Unknown')} · ${timeAgo(a.createdAt)}</p>
          </div>
        </li>`).join('');
  },
  error: (err) => {
    console.error('Failed to load activity:', err);
    $('activity-list').innerHTML = '<li class="empty-state">Couldn’t load activity.</li>';
  },
});


$('btn-run-checks').addEventListener('click', runChecks);
runChecks();
loadModules();
