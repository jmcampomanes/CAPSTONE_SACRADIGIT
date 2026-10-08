/* ============================================
   SacraDigit — Chat with the Parish Office
   Shared by the parishioner Messages page
   (user/user-messages.js) and the admin inbox
   (Sacradigit/messages.js). Styles: Sacradigit/
   sacradigit-css/chat.css.

   Backed by the ChatMessage model — one row per
   message, grouped into one conversation per
   parishioner by `threadId` (their account id):
     threadId, fromOffice, senderName, body,
     parishionerName, readByOffice, readByParishioner
   The parishioner owns every message in their
   conversation (the office copies the conversation's
   `owner` onto its replies), so they can read the
   office's answers; Head Admin and Secretary see all.

   Until the backend has ChatMessage, chatReady() is
   false and both pages say so instead of breaking.
   ============================================ */

import { client } from './amplify-init.js';

export const MAX_MESSAGE_LENGTH = 1000;

export const chatReady = () => !!client.models.ChatMessage;

const byTime = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

/** Live list of messages (all the caller may read, or only `threadId`'s). Returns an unsubscribe function. */
export function watchMessages(onChange, { threadId } = {}) {
  if (!chatReady()) return () => {};
  const options = threadId ? { filter: { threadId: { eq: threadId } } } : {};
  const sub = client.models.ChatMessage.observeQuery(options).subscribe({
    next: ({ items }) => onChange(items.slice().sort(byTime)),
    error: (err) => console.error('Failed to load messages:', err),
  });
  return () => sub.unsubscribe();
}

/** Conversations, newest activity first: [{ threadId, owner, parishionerName, messages, last, unread }]. */
export function groupThreads(messages) {
  const map = new Map();
  for (const m of messages) {
    if (!map.has(m.threadId)) map.set(m.threadId, []);
    map.get(m.threadId).push(m);
  }
  return [...map.entries()].map(([threadId, list]) => {
    list.sort(byTime);
    // The parishioner's own messages carry their name and owner; office replies copy them.
    const fromParishioner = list.find(m => !m.fromOffice) || list[0];
    return {
      threadId,
      owner: fromParishioner.owner,
      parishionerName: fromParishioner.parishionerName || fromParishioner.senderName || 'Parishioner',
      messages: list,
      last: list[list.length - 1],
      unread: unreadFor(list, 'office'),
    };
  }).sort((a, b) => byTime(b.last, a.last));
}

/** How many messages `side` ('office' | 'parishioner') hasn't read yet. */
export function unreadFor(messages, side) {
  return side === 'office'
    ? messages.filter(m => !m.fromOffice && !m.readByOffice).length
    : messages.filter(m => m.fromOffice && !m.readByParishioner).length;
}

/** Marks the other side's messages as read by `side`. */
export async function markRead(messages, side) {
  const field = side === 'office' ? 'readByOffice' : 'readByParishioner';
  const unread = messages.filter(m => (side === 'office' ? !m.fromOffice : m.fromOffice) && !m[field]);
  await Promise.all(unread.map(m => client.models.ChatMessage.update({ id: m.id, [field]: true })
    .catch(err => console.error('Failed to mark message read:', err))));
}

/** Sends a message. `owner` must be the parishioner's own Cognito sub (owner-auth field) —
 *  the parishioner passes their own on every message; the office passes the conversation's
 *  existing `owner` on replies so the parishioner can still read them. */
export async function sendMessage({ threadId, body, fromOffice, senderName, parishionerName, owner }) {
  const text = (body || '').trim();
  if (!text) throw new Error('Type a message first.');
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`);
  const input = {
    threadId,
    body: text,
    fromOffice,
    senderName,
    parishionerName,
    readByOffice: fromOffice,
    readByParishioner: !fromOffice,
  };
  if (owner) input.owner = owner;
  const result = await client.models.ChatMessage.create(input);
  if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
  return result.data;
}

/* ---------- display helpers ---------- */

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/** "9:41 AM" today, "Yesterday", "Mon", or "Oct 3" further back. */
export function shortTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(now) - day(d)) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** The conversation as chat bubbles, with a date line whenever the day changes. `mine(m)` says which side is "me". */
export function conversationHtml(messages, mine) {
  let lastDay = '';
  return messages.map(m => {
    const day = m.createdAt ? new Date(m.createdAt).toDateString() : '';
    const divider = day && day !== lastDay ? `<li class="chat-day"><span>${escapeHtml(dayLabel(m.createdAt))}</span></li>` : '';
    lastDay = day || lastDay;
    const isMine = mine(m);
    const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Sending…';
    return `${divider}
      <li class="chat-msg ${isMine ? 'is-mine' : 'is-theirs'}">
        ${isMine ? '' : `<p class="chat-sender" data-no-translate>${escapeHtml(m.senderName || (m.fromOffice ? 'Parish Office' : 'Parishioner'))}</p>`}
        <div class="chat-bubble" data-no-translate>${escapeHtml(m.body).replace(/\n/g, '<br>')}</div>
        <p class="chat-time">${escapeHtml(time)}</p>
      </li>`;
  }).join('');
}

/** Sidebar unread badge on `link` for `side`. Returns an unsubscribe function. */
export function watchUnreadBadge(link, side, { threadId } = {}) {
  if (!link || !chatReady()) return () => {};
  let badge = link.querySelector('.chat-unread-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'chat-unread-badge hidden';
    link.appendChild(badge);
  }
  return watchMessages((messages) => {
    const n = unreadFor(messages, side);
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('hidden', n === 0);
  }, { threadId });
}

/** Enter sends, Shift+Enter adds a line; the box grows with the text. */
export function wireComposer(textarea, onSend) {
  const grow = () => { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px'; };
  textarea.addEventListener('input', grow);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onSend(); }
  });
  return { reset() { textarea.value = ''; grow(); } };
}
