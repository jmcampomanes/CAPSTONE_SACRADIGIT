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

  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

  function renderStatus() {
    const state = current || { isLive: false, platform: 'Facebook', url: '', updatedAt: '' };
    if (!fieldsDirty) {
      platformField.value = state.platform || 'Facebook';
      urlField.value = state.url || '';
    }

    if (state.isLive) {
      statusBadge.textContent = 'Live Now';
      statusBadge.className = 'badge badge-live';
      toggleBtn.textContent = 'End Stream';
      toggleBtn.classList.add('is-live');
    } else {
      statusBadge.textContent = 'Off';
      statusBadge.className = 'badge badge-draft';
      toggleBtn.textContent = 'Go Live';
      toggleBtn.classList.remove('is-live');
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

  watchLivestream(client, (status) => { current = status; renderStatus(); });
  watchLivestreamHistory(client, renderHistory);

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
