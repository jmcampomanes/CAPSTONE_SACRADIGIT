/* ============================================
   SacraDigit — Parish Assistant AI chat client

   Talks to the small Express server in
   server/ai-chat, which holds the OpenRouter API
   key server-side and forwards chat requests to
   it (see its .env.example to run it). The key
   never reaches the browser.

   Requires the signed-in parishioner's Cognito ID
   token — the server rejects anonymous requests.
   ============================================ */

// Point this at wherever server/ai-chat is actually running.
// Local dev default — update for a deployed proxy.
const CHAT_BASE_URL = 'http://localhost:3002';

// Must match CHAT_API_KEY in server/ai-chat/.env.
const CHAT_API_KEY = 'cdc033554e6c5f907a8946cd67c8975545e15649d6153696';

async function authToken() {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    return (await fetchAuthSession()).tokens?.idToken?.toString();
  } catch { return undefined; } // not signed in — server will reject, which is correct
}

/**
 * Sends one chat turn to the AI proxy.
 * @param {string} message - the parishioner's new message
 * @param {{role: 'user'|'assistant', content: string}[]} history - prior turns, oldest first
 * @param {object} context - live parish facts (schedule, closures, requirements…) the model may use
 * @param {'en'|'fil'} lang
 * @returns {Promise<string>} the assistant's reply text
 */
export async function askAssistant(message, history, context, lang) {
  const token = await authToken();
  const res = await fetch(`${CHAT_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-chat-key': CHAT_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history, context, lang }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(body.error || `Chat proxy failed (${res.status})`);
  return body.reply;
}
