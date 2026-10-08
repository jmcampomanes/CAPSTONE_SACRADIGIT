/* ============================================
   SacraDigit — Messages (parishioner)
   Runs after user-shell.js. One conversation
   with the parish office (Head Admin and
   Secretary answer it from the Admin portal's
   Messages inbox). See ../chat.js.
   ============================================ */

import { currentUser } from '../auth.js';
import { chatReady, watchMessages, markRead, sendMessage, conversationHtml, wireComposer } from '../chat.js';

document.addEventListener('DOMContentLoaded', () => {

  const list        = document.getElementById('chat-messages');
  const empty       = document.getElementById('chat-empty');
  const input       = document.getElementById('chat-input');
  const sendBtn     = document.getElementById('chat-send');
  const unavailable = document.getElementById('chat-unavailable');

  if (!chatReady()) {
    unavailable.classList.remove('hidden');
    empty.classList.add('hidden');
    input.disabled = true;
    sendBtn.disabled = true;
    return;
  }

  const me = currentUser() || {};
  const threadId = me.sub;
  let messages = [];

  function render() {
    empty.classList.toggle('hidden', messages.length > 0);
    list.classList.toggle('hidden', messages.length === 0);
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = conversationHtml(messages, m => !m.fromOffice);
    if (atBottom || !render.done) list.scrollTop = list.scrollHeight;
    render.done = true;
  }

  // The office's replies count as read once they're on screen.
  const markSeen = () => { if (document.visibilityState === 'visible') markRead(messages, 'parishioner'); };
  document.addEventListener('visibilitychange', markSeen);

  watchMessages((items) => {
    messages = items.filter(m => m.threadId === threadId);
    render();
    markSeen();
  }, { threadId });

  const composer = wireComposer(input, send);
  sendBtn.addEventListener('click', send);

  async function send() {
    if (!input.value.trim() || sendBtn.disabled) return;
    sendBtn.disabled = true;
    try {
      await sendMessage({
        threadId,
        body: input.value,
        fromOffice: false,
        senderName: me.name || 'Parishioner',
        parishionerName: me.name || 'Parishioner',
        owner: me.username,
      });
      composer.reset();
      list.scrollTop = list.scrollHeight;
    } catch (err) {
      console.error('Failed to send message:', err);
      window.showToast(err.message || "Couldn't send your message.", true);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }
});
