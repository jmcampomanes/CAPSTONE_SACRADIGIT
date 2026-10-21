/* ============================================
   SacraDigit Media — Livestream Manager Scripts (AWS Amplify)
   Status and history are shared through
   ../livestream-status.js, so every device sees the
   same state — and when the stream is live, the
   parishioner dashboard shows a "Watch Live" banner
   with this link automatically.
   ============================================ */

import { client } from '../amplify-init.js';
import { watchLivestream, saveLivestream, addLivestreamHistory, watchLivestreamHistory } from '../livestream-status.js';
import { showToast, confirmDialog } from '../Sacradigit/admin-ui.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function isValidUrl(str) {
  return /^https?:\/\/\S+$/i.test(str);
}

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('livestream-status-badge');
  const toggleBtn = document.getElementById('toggle-live-btn');
  const platformField = document.getElementById('livestream-platform');
  const urlField = document.getElementById('livestream-url');
  const saveBtn = document.getElementById('save-livestream-btn');
  const updatedEl = document.getElementById('livestream-updated');
  const historyList = document.getElementById('livestream-history-list');

  let current = null;       // last status from the backend
  let fieldsDirty = false;  // don't overwrite what the person is typing on live updates

  [platformField, urlField].forEach(el => el.addEventListener('input', () => { fieldsDirty = true; }));
  platformField.addEventListener('change', () => { fieldsDirty = true; });



  function renderStatus() {
    const state = current || { isLive: false, platform: 'Facebook', url: '', updatedAt: '' };
    if (!fieldsDirty) {
      platformField.value = state.platform || 'Facebook';
      urlField.value = state.url || '';
    }

    const strip = document.getElementById('live-strip');
    const stripText = document.getElementById('live-strip-text');
    strip.classList.toggle('is-live', !!state.isLive);
    if (state.isLive) {
      statusBadge.textContent = 'Live Now';
      statusBadge.className = 'badge badge-live';
      const since = liveSince || state.updatedAt;
      const at = since ? new Date(since).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
      stripText.textContent = `LIVE${at ? ` since ${at}` : ''} · ${state.platform || 'Facebook'}. Parishioners see the “Watch Live” banner.`;
      toggleBtn.textContent = 'End stream…';
    } else {
      statusBadge.textContent = 'Off';
      statusBadge.className = 'badge badge-draft';
      stripText.textContent = 'Not live. Parishioners don’t see a “Watch Live” banner.';
      toggleBtn.textContent = '● Go live…';
    }

    updatedEl.textContent = state.updatedAt
      ? `Last updated ${new Date(state.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : '';
  }

  function renderHistory(history) {
    if (history.length === 0) {
      historyList.innerHTML = '<li class="list-row text-sm text-gray-400">No history yet.</li>';
      return;
    }
    historyList.innerHTML = history.slice(0, 8).map(h => `
      <li class="list-row text-sm">
        <div class="min-w-0">
          <p class="list-name truncate">${escapeHtml(h.platform)}</p>
          ${h.url ? `<a href="${escapeHtml(h.url)}" target="_blank" rel="noopener" class="list-time truncate block" style="color:#6c6fb0;">${escapeHtml(h.url)}</a>` : ''}
        </div>
        <p class="list-time">${h.startedAt ? new Date(h.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</p>
      </li>
    `).join('');
  }

  let liveSince = null; // start of the latest session, for "LIVE since 9:02 AM"
  watchLivestream(client, (status) => { current = status; renderStatus(); });
  watchLivestreamHistory(client, (history) => {
    liveSince = history[0]?.startedAt || null;
    renderHistory(history);
    renderStatus();
  });

  toggleBtn.addEventListener('click', async () => {
    const goingLive = !(current && current.isLive);
    const url = urlField.value.trim();

    if (goingLive && !url) {
      showToast('Add the stream link before going live.', true);
      return;
    }
    if (goingLive && !isValidUrl(url)) {
      showToast('The stream link must start with http:// or https://', true);
      return;
    }

    // Every parishioner sees the result at once, so check before switching either way.
    const platform = platformField.value;
    const sure = goingLive
      ? await confirmDialog({
          title: 'Go live now?',
          message: 'Parishioners will see this banner on their Dashboard straight away:',
          previewHtml: `
            <div class="live-preview">● We’re live now<span>Join us online on ${escapeHtml(platform)}</span></div>
            <a class="live-preview-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>
            <p class="text-sm text-gray-600 mt-1">Open the link first to check it’s the right stream.</p>`,
          confirmLabel: 'Go live',
          tone: 'danger',
        })
      : await confirmDialog({
          title: 'End the stream?',
          message: 'The “Watch Live” banner disappears for parishioners right away.',
          confirmLabel: 'End stream',
        });
    if (!sure) return;

    toggleBtn.disabled = true;
    try {
      current = await saveLivestream(client, current, { isLive: goingLive, platform: platformField.value, url });
      fieldsDirty = false;
      if (goingLive) {
        await addLivestreamHistory(client, { platform: platformField.value, url });
        showToast('You\'re live. Parishioners now see a "Watch Live" banner on their dashboard.');
      } else {
        showToast('Stream ended. The banner is hidden for parishioners.');
      }
      renderStatus();
    } catch (err) {
      console.error('Failed to update livestream:', err);
      showToast("Couldn't update the livestream status.", true);
    } finally {
      toggleBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const url = urlField.value.trim();
    if (url && !isValidUrl(url)) {
      showToast('The stream link must start with http:// or https://', true);
      return;
    }
    saveBtn.disabled = true;
    try {
      current = await saveLivestream(client, current, {
        isLive: !!(current && current.isLive),
        platform: platformField.value,
        url,
      });
      fieldsDirty = false;
      renderStatus();
      showToast('Livestream details saved.');
    } catch (err) {
      console.error('Failed to save livestream details:', err);
      showToast("Couldn't save the livestream details.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  renderStatus();
});
