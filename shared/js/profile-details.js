/* ============================================
   SacraDigit — Remembered profile details
   People type their details once. My Profile keeps
   them on ParishionerPreference, and forms prefill
   from there and offer to save changes back.

   Birthdate, sex, PWD status and accommodations are
   sensitive. They need the fields in
   BACKEND_CHANGES.md, and appear on My Profile only
   once amplify_outputs.json has them, because sending
   a field the model lacks fails the whole save.
   ============================================ */

import outputs from '../../amplify_outputs.json';
import { getPreference, preferencesReady, saveProfileDetails } from './mass-checkin.js';

export const profileDetailsReady = () => !!outputs.data?.model_introspection?.models?.ParishionerPreference?.fields?.birthdate;

/** The saved details, or {} when there are none or they can't load. */
export async function myDetails(name) {
  if (!preferencesReady()) return {};
  try { return (await getPreference(name)) || {}; } catch (err) {
    console.warn('Could not load saved details:', err);
    return {};
  }
}

/** Fills a box only when it's empty, so nothing typed is overwritten. */
export function prefill(input, value) {
  if (input && value && !input.value.trim()) input.value = value;
}

/** A checkbox offering to remember what was typed. */
export const rememberHtml = (id) => `
  <label class="consent-check">
    <input type="checkbox" id="${id}" />
    <span>Save these details to my profile for next time.</span>
  </label>`;

export const rememberDetails = (name, fields) => saveProfileDetails(name, fields);
