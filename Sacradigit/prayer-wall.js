/* ============================================
   SacraDigit Admin — Prayer Wall moderation
   Runs after dashboard.js. The Secretary or Head Admin
   approves each prayer request before it appears to
   parishioners, rejects it (with a note the poster
   sees), or takes an approved one down.
   See ../prayer-wall.js.
   ============================================ */

import { isHeadAdmin } from '../auth.js';
import {
  prayerReady, watchRequests, watchReactions, moderateRequest, deleteRequest, tallyReactions,
  displayName, timeAgo, escapeHtml,
} from '../prayer-wall.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const list = $('pw-list');
  const empty = $('pw-empty');
  const tabs = document.querySelectorAll('.pw-tab');

  if (!prayerReady()) {
    $('pw-unavailable').classList.remove('hidden');
    $('pw-main').classList.add('hidden');
    return;
  }

  let requests = [];
  let counts = new Map();
  let activeTab = 'pending';

  watchRequests((items) => { requests = items; render(); });
  watchReactions((items) => { counts = tallyReactions(items).counts; render(); });

  tabs.forEach(tab => tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    tabs.forEach(t => { const on = t === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
    render();
  }));

  const inTab = (r, tab) => (tab === 'pending' ? r.status === 'pending'
    : tab === 'approved' ? r.status === 'approved'
    : r.status === 'rejected' || r.status === 'removed');

  function render() {
    ['pending', 'approved', 'rejected'].forEach(tab => { $(`count-${tab}`).textContent = requests.filter(r => inTab(r, tab)).length; });
    const shown = requests.filter(r => inTab(r, activeTab));
    if (activeTab === 'pending') shown.reverse(); // oldest waiting first
    empty.classList.toggle('hidden', shown.length > 0);
    empty.textContent = activeTab === 'pending' ? 'Nothing waiting for review.' : activeTab === 'approved' ? 'No requests on the wall.' : 'No rejected or removed requests.';

    list.innerHTML = shown.map(r => `
      <article class="pw-mod-card">
        <p class="pw-card-body" data-no-translate>${escapeHtml(r.body)}</p>
        <p class="pw-mod-meta">
          <span data-no-translate>${escapeHtml(displayName(r))}</span>${r.anonymous ? ' (posted anonymously)' : ''} · ${escapeHtml(timeAgo(r.createdAt))}
          ${r.status === 'approved' ? ` · 🙏 ${counts.get(r.id) || 0} prayed` : ''}
        </p>
        ${r.moderationNote ? `<p class="pw-mine-note">Note: <span data-no-translate>${escapeHtml(r.moderationNote)}</span></p>` : ''}
        <div class="pw-mod-actions">
          ${r.status === 'pending' ? `
            <button type="button" class="btn-lavender" data-act="approve" data-id="${r.id}">Approve</button>
            <button type="button" class="btn-secondary" data-act="reject" data-id="${r.id}">Reject</button>` : ''}
          ${r.status === 'approved' ? `<button type="button" class="btn-secondary" data-act="remove" data-id="${r.id}">Take Down</button>` : ''}
          ${r.status === 'rejected' || r.status === 'removed' ? `<button type="button" class="btn-secondary" data-act="approve" data-id="${r.id}">Approve After All</button>` : ''}
          ${isHeadAdmin() && r.status !== 'pending' ? `<button type="button" class="pw-delete" data-act="delete" data-id="${r.id}">Delete</button>` : ''}
        </div>
      </article>`).join('');
  }

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const r = requests.find(x => x.id === btn.dataset.id);
    if (!r) return;
    const act = btn.dataset.act;
    try {
      if (act === 'approve') {
        await moderateRequest(r.id, 'approved');
        showToast('Approved — it’s on the wall now.');
      } else if (act === 'reject' || act === 'remove') {
        const note = prompt(act === 'reject'
          ? 'Why isn’t this being posted? (The person who asked will see this.)'
          : 'Why is this being taken down? (The person who asked will see this.)');
        if (note === null) return;
        if (!note.trim()) { showToast('Please give a short reason.', true); return; }
        await moderateRequest(r.id, act === 'reject' ? 'rejected' : 'removed', note.trim());
        showToast(act === 'reject' ? 'Request not posted.' : 'Request taken down.');
      } else if (act === 'delete') {
        if (!confirm('Delete this prayer request for good?')) return;
        await deleteRequest(r.id);
        showToast('Request deleted.');
      }
    } catch (err) {
      console.error('Prayer wall moderation failed:', err);
      showToast(err.message || "Couldn't update the request.", true);
    }
  });

  const toast = $('toast');
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
});
