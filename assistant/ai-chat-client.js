/* ============================================
   SacraDigit — Parish Assistant AI chat client

   Calls the chatWithAssistant mutation (see
   sacradigit-amplify/amplify/functions/parish-assistant-chat),
   an AWS Lambda that holds the OpenRouter API key
   server-side and forwards chat requests to it. The
   key never reaches the browser.

   AppSync requires a signed-in Cognito user for this
   mutation — amplify-init.js's client already carries
   that session, so there's nothing extra to attach
   here (no manual token header, no shared API key).
   ============================================ */

import { client } from '../amplify-init.js';

/**
 * Sends one chat turn to the AI proxy.
 * @param {string} message - the parishioner's new message
 * @param {{role: 'user'|'assistant', content: string}[]} history - prior turns, oldest first
 * @param {object} context - live parish facts (schedule, closures, requirements…) the model may use
 * @param {'en'|'fil'} lang
 * @returns {Promise<string>} the assistant's reply text
 */
export async function askAssistant(message, history, context, lang) {
  const res = await client.mutations.chatWithAssistant({
    message,
    history: JSON.stringify(history || []),
    context: JSON.stringify(context || {}),
    lang,
  });
  if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
  if (!res.data) throw new Error('The assistant is unavailable right now');
  return res.data;
}
