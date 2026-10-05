/* ============================================
   SacraDigit — Prayer Wall (parishioner)
   Runs after user-shell.js. Post a prayer request
   (optionally anonymous) — the parish office reviews
   it before it appears — and pray for others.
   See ../prayer-wall.js.
   ============================================ */

import { currentUser } from '../auth.js';
import {
  prayerReady, watchRequests, watchReactions, submitRequest, prayFor, tallyReactions,
  isOnWall, displayName, timeAgo, escapeHtml, MAX_PRAYER_LENGTH, WALL_DAYS,
} from '../prayer-wall.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const wallEl = $('pw-wall');
  const mineEl = $('pw-mine');
  const input = $('pw-body');
  const anonBox = $('pw-anonymous');
  const submitBtn = $('pw-submit');
  const counter = $('pw-counter');

  if (!prayerReady()) {
    $('pw-unavailable').classList.remove('hidden');
    $('pw-main').classList.add('hidden');
    return;
  }

  const me = currentUser() || {};
  const myKey = me.sub;
  let requests = [];
  let reactions = [];

  watchRequests((items) => { requests = items; render(); });
  watchReactions((items) => { reactions = items; render(); });

  input.maxLength = MAX_PRAYER_LENGTH;
  const updateCounter = () => { counter.textContent = `${input.value.length}/${MAX_PRAYER_LENGTH}`; };
  input.addEventListener('input', updateCounter);
  updateCounter();

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    try {
      await submitRequest({ body: input.value, anonymous: anonBox.checked, authorName: me.name, authorKey: myKey });
      input.value = '';
      anonBox.checked = false;
      updateCounter();
      window.showToast('Thank you. The parish office will review your request before it appears on the wall.');
    } catch (err) {
      console.error('Failed to post prayer request:', err);
      window.showToast(err.message || "Couldn't post your prayer request.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  const STATUS = {
    pending: ['Waiting for review', 'pw-status-pending'],
    approved: ['On the wall', 'pw-status-approved'],
    rejected: ['Not posted', 'pw-status-rejected'],
    removed: ['Taken down', 'pw-status-rejected'],
  };

  function render() {
    const { counts, mine } = tallyReactions(reactions, myKey);

    // My own requests (any status), newest first
    const own = requests.filter(r => myKey && r.authorKey === myKey).slice(0, 5);
    $('pw-mine-wrap').classList.toggle('hidden', own.length === 0);
    mineEl.innerHTML = own.map(r => {
      const [label, cls] = STATUS[r.status] || STATUS.pending;
      return `
        <li class="pw-mine-item">
          <p class="pw-mine-body" data-no-translate>${escapeHtml(r.body)}</p>
          <p class="pw-mine-meta"><span class="pw-status ${cls}">${label}</span> · ${escapeHtml(timeAgo(r.createdAt))}${r.anonymous ? ' · Anonymous' : ''}${r.status === 'approved' ? ` · 🙏 ${counts.get(r.id) || 0}` : ''}</p>
          ${r.moderationNote && r.status !== 'approved' ? `<p class="pw-mine-note">Note from the parish office: <span data-no-translate>${escapeHtml(r.moderationNote)}</span></p>` : ''}
        </li>`;
    }).join('');

    // The wall: approved requests from the last WALL_DAYS days
    const wall = requests.filter(r => isOnWall(r));
    $('pw-empty').classList.toggle('hidden', wall.length > 0);
    $('pw-count').textContent = `${wall.length} request${wall.length === 1 ? '' : 's'}`;
    wallEl.innerHTML = wall.map(r => {
      const n = counts.get(r.id) || 0;
      const prayed = mine.has(r.id);
      const isMine = myKey && r.authorKey === myKey;
      return `
        <article class="pw-card">
          <p class="pw-card-body" data-no-translate>${escapeHtml(r.body)}</p>
          <div class="pw-card-foot">
            <span class="pw-card-who"><span data-no-translate>${escapeHtml(displayName(r))}</span> · ${escapeHtml(timeAgo(r.createdAt))}</span>
            ${isMine ? `<span class="pw-pray prayed">🙏 ${n} praying for you</span>` : `<button type="button" class="pw-pray${prayed ? ' prayed' : ''}" data-pray="${escapeHtml(r.id)}" ${prayed ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'}>
              🙏 <span>${prayed ? 'You prayed' : 'I prayed for this'}</span>${n ? ` <b>${n}</b>` : ''}
            </button>`}
          </div>
        </article>`;
    }).join('');
  }

  wallEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-pray]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      await prayFor(btn.dataset.pray, myKey);
    } catch (err) {
      console.error('Failed to record prayer:', err);
      window.showToast("Couldn't save that — please try again.", true);
      btn.disabled = false;
    }
  });

  $('pw-days').textContent = String(WALL_DAYS);
});
