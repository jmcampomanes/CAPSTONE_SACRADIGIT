/* ============================================
   SacraDigit Media — Livestream Manager Scripts
   Client-side prototype: current status lives at
   'sacradigit_media_livestream', past links at
   'sacradigit_media_livestream_history'. Once this
   is wired to Amplify, the parishioner dashboard's
   "Today's Schedule" panel could read the same
   record to surface a "Watch Live" banner
   automatically when isLive is true.
   ============================================ */

const CURRENT_KEY = 'sacradigit_media_livestream';
const HISTORY_KEY = 'sacradigit_media_livestream_history';

function readCurrent() {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : { isLive: false, platform: 'Facebook', url: '', updatedAt: '' };
  } catch {
    return { isLive: false, platform: 'Facebook', url: '', updatedAt: '' };
  }
}

function writeCurrent(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('livestream-status-badge');
  const toggleBtn = document.getElementById('toggle-live-btn');
  const platformField = document.getElementById('livestream-platform');
  const urlField = document.getElementById('livestream-url');
  const saveBtn = document.getElementById('save-livestream-btn');
  const updatedEl = document.getElementById('livestream-updated');
  const historyList = document.getElementById('livestream-history-list');

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
    const state = readCurrent();
    platformField.value = state.platform || 'Facebook';
    urlField.value = state.url || '';

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

  function renderHistory() {
    const history = readHistory();
    if (history.length === 0) {
      historyList.innerHTML = '<li class="list-row text-sm text-gray-400">No history yet.</li>';
      return;
    }
    historyList.innerHTML = history.slice(0, 8).map(h => `
      <li class="list-row text-sm">
        <p class="list-name truncate">${escapeHtml(h.platform)}</p>
        <p class="list-time">${new Date(h.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
      </li>
    `).join('');
  }

  toggleBtn.addEventListener('click', () => {
    const state = readCurrent();
    const goingLive = !state.isLive;

    if (goingLive && !urlField.value.trim()) {
      showToast('Add the stream link before going live.', true);
      return;
    }

    const next = {
      isLive: goingLive,
      platform: platformField.value,
      url: urlField.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeCurrent(next);

    if (goingLive) {
      const history = readHistory();
      history.unshift({ platform: platformField.value, url: urlField.value.trim(), startedAt: next.updatedAt });
      writeHistory(history);
      renderHistory();
      showToast('Marked as live. The stream link is now visible to parishioners.');
    } else {
      showToast('Stream ended.');
    }

    renderStatus();
  });

  saveBtn.addEventListener('click', () => {
    const state = readCurrent();
    writeCurrent({
      ...state,
      platform: platformField.value,
      url: urlField.value.trim(),
      updatedAt: new Date().toISOString(),
    });
    renderStatus();
    showToast('Livestream details saved.');
  });

  renderStatus();
  renderHistory();
});
