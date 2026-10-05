/* ============================================
   SacraDigit Media — one-time import of browser data
   Content Calendar, Post Templates and Event Coverage
   used to keep their data in each browser's
   localStorage, so nobody else could see it. They now
   use the database (ContentCalendarEntry, PostTemplate,
   EventCoverageRequest). The first time a page opens
   in a browser that still has old local entries, those
   are copied into the database once and the local copy
   is cleared.

   The demo rows the old pages pre-filled (ids c1…,
   t1…, r1… from the seed lists) are skipped, so every
   team member's browser doesn't add the same samples.
   ============================================ */

import { client } from '../amplify-init.js';

const SEED_IDS = new Set(['c1', 'c2', 'c3', 'c4', 't1', 't2', 't3', 'r1', 'r2', 'r3']);

/**
 * Copies `storageKey`'s entries into `modelName` (each mapped by `toInput`)
 * and removes the local copy once every entry is saved. Returns how many
 * were imported. Never throws; anything that fails stays local for next time.
 */
export async function importLocalEntries(storageKey, modelName, toInput) {
  let entries;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return 0;
    entries = JSON.parse(raw);
  } catch {
    return 0;
  }
  const model = client.models[modelName];
  if (!model || !Array.isArray(entries)) return 0;

  const toImport = entries.filter(e => e && !SEED_IDS.has(e.id));
  const failed = [];
  for (const entry of toImport) {
    try {
      const { errors } = await model.create(toInput(entry));
      if (errors) throw new Error(errors.map(e => e.message).join('; '));
    } catch (err) {
      console.warn(`Couldn't import a ${modelName} entry from this browser:`, err);
      failed.push(entry);
    }
  }
  try {
    if (failed.length) localStorage.setItem(storageKey, JSON.stringify(failed));
    else localStorage.removeItem(storageKey);
  } catch { /* storage blocked — harmless */ }
  return toImport.length - failed.length;
}
