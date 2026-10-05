/* ============================================
   SacraDigit Admin — Messages (parish office inbox)
   Runs after dashboard.js. Every parishioner's
   conversation with the parish office; Head Admin
   and Secretary both read and answer them.
   Parishioners start conversations from their
   portal's Messages page. See ../chat.js.
   ============================================ */

import { currentUserName } from '../auth.js';
import { chatReady, watchMessages, groupThreads, markRead, sendMessage, conversationHtml, wireComposer, escapeHtml, shortTime } from '../chat.js';

document.addEventListener('DOMContentLoaded', () => {

  const layout      = document.getElementById('chat-layout');
  const threadList  = document.getElementById('chat-thread-list');
  const threadEmpty = document.getElementById('chat-threads-empty');
  const search      = document.getElementById('chat-search');
  const paneHead    = document.getElementById('chat-pane-head');
  const paneTitle   = document.getElementById('chat-pane-title');
  const paneSub     = document.getElementById('chat-pane-sub');
  const list        = document.getElementById('chat-messages');
  const empty       = document.getElementById('chat-empty');
  const composerEl  = document.getElementById('chat-composer');
  const input       = document.getElementById('chat-input');
  const sendBtn     = document.getElementById('chat-send');
  const unavailable = document.getElementById('chat-unavailable');

  if (!chatReady()) {
    unavailable.classList.remove('hidden');
    layout.classList.add('hidden');
    return;
  }

  let threads = [];
  let activeId = null;

  const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  function renderThreads() {
    const q = search.value.trim().toLowerCase();
    const shown = threads.filter(t => !q || t.parishionerName.toLowerCase().includes(q) || t.messages.some(m => (m.body || '').toLowerCase().includes(q)));
    threadEmpty.classList.toggle('hidden', shown.length > 0);
    threadEmpty.textContent = threads.length ? 'No conversations match your search.' : 'No messages yet. Parishioners start a conversation from their portal’s Messages page.';
    threadList.innerHTML = shown.map(t => `
      <li>
        <button type="button" class="chat-thread${t.threadId === activeId ? ' active' : ''}${t.unread ? ' unread' : ''}" data-thread="${escapeHtml(t.threadId)}">
          <span class="chat-avatar" data-no-translate>${escapeHtml(initials(t.parishionerName))}</span>
          <span class="chat-thread-main">
            <span class="chat-thread-top">
              <span class="chat-thread-name" data-no-translate>${escapeHtml(t.parishionerName)}</span>
              <span class="chat-thread-time">${escapeHtml(shortTime(t.last.createdAt))}</span>
            </span>
            <span class="chat-thread-preview" data-no-translate>${t.last.fromOffice ? 'You: ' : ''}${escapeHtml(t.last.body)}</span>
          </span>
          ${t.unread ? `<span class="chat-thread-count">${t.unread}</span>` : ''}
        </button>
      </li>`).join('');
  }

  function renderPane() {
    const t = threads.find(x => x.threadId === activeId);
    paneHead.classList.toggle('hidden', !t);
    composerEl.classList.toggle('hidden', !t);
    list.classList.toggle('hidden', !t);
    empty.classList.toggle('hidden', !!t);
    if (!t) return;
    paneTitle.textContent = t.parishionerName;
    paneSub.textContent = `${t.messages.length} message${t.messages.length === 1 ? '' : 's'}`;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const switched = list.dataset.thread !== t.threadId;
    list.dataset.thread = t.threadId;
    list.innerHTML = conversationHtml(t.messages, m => m.fromOffice);
    if (atBottom || switched) list.scrollTop = list.scrollHeight;
    if (document.visibilityState === 'visible') markRead(t.messages, 'office');
  }

  watchMessages((items) => {
    threads = groupThreads(items);
    renderThreads();
    renderPane();
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderPane(); });

  threadList.addEventListener('click', (e) => {
    const btn = e.target.closest('.chat-thread');
    if (!btn) return;
    activeId = btn.dataset.thread;
    layout.classList.add('showing-thread');
    renderThreads();
    renderPane();
    input.focus();
  });

  document.getElementById('chat-back').addEventListener('click', () => {
    layout.classList.remove('showing-thread');
  });

  search.addEventListener('input', renderThreads);

  const composer = wireComposer(input, send);
  sendBtn.addEventListener('click', send);

  async function send() {
    const t = threads.find(x => x.threadId === activeId);
    if (!t || !input.value.trim() || sendBtn.disabled) return;
    sendBtn.disabled = true;
    try {
      await sendMessage({
        threadId: t.threadId,
        body: input.value,
        fromOffice: true,
        senderName: `${currentUserName() || 'Parish Office'} · Parish Office`,
        parishionerName: t.parishionerName,
        owner: t.owner,
      });
      composer.reset();
      list.scrollTop = list.scrollHeight;
    } catch (err) {
      console.error('Failed to send reply:', err);
      showToast(err.message || "Couldn't send the reply.", true);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

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
});
