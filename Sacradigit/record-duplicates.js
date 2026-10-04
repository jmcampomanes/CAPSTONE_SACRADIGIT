/* ============================================
   SacraDigit Admin — duplicate parish records
   Warns the Secretary before saving a record that
   looks like one already in Digital Archives, and
   flags existing look-alikes in the table.

   Two records "look alike" when they are the same
   record type and the same person: same first and
   last name, ignoring capitals, accents, punctuation,
   middle names and suffixes (Jr., III …). When both
   have a date of event, the dates must match too —
   two people can share a name, but not also the same
   baptism day.

   Used by digital-archives.js (New Record, Upload,
   Edit) and scanner/scan-screen.js (Scan Document).
   ============================================ */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** "Juan M. Dela Cruz Jr." → "juan|cruz" (first|last name, normalized). */
export function personKey(fullName) {
  const words = (fullName || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/).filter(w => w && !SUFFIXES.has(w));
  if (!words.length) return '';
  return `${words[0]}|${words[words.length - 1]}`;
}

/** Existing records that look like `candidate` ({ fullName, type, dateOfEvent }). */
export function findDuplicates(records, candidate, { excludeId } = {}) {
  const key = personKey(candidate.fullName);
  if (!key) return [];
  const type = (candidate.type || '').toLowerCase();
  return records.filter(r =>
    r.id !== excludeId &&
    (r.type || '').toLowerCase() === type &&
    personKey(r.fullName) === key &&
    (!r.dateOfEvent || !candidate.dateOfEvent || r.dateOfEvent === candidate.dateOfEvent));
}

/** Ids of records that have at least one look-alike, for flagging rows. */
export function duplicateIds(records) {
  const groups = new Map();
  for (const r of records) {
    const key = `${(r.type || '').toLowerCase()}#${personKey(r.fullName)}`;
    if (!personKey(r.fullName)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const ids = new Set();
  for (const list of groups.values()) {
    for (const r of list) {
      if (list.some(o => o !== r && (!o.dateOfEvent || !r.dateOfEvent || o.dateOfEvent === r.dateOfEvent))) ids.add(r.id);
    }
  }
  return ids;
}

const fmt = (iso) => (iso ? new Date(iso.length > 10 ? iso : iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/**
 * True when it's fine to save: no look-alikes, or the Secretary confirms
 * it's a different person / a deliberate second copy.
 */
export function confirmNotDuplicate(records, candidate, options) {
  const matches = findDuplicates(records, candidate, options);
  if (!matches.length) return true;
  const lines = matches.slice(0, 3).map(r => {
    const bits = [r.fullName];
    if (r.dateOfEvent) bits.push(`event ${fmt(r.dateOfEvent)}`);
    bits.push(`added ${fmt(r.createdAt)}${r.addedByName ? ` by ${r.addedByName}` : ''}`);
    return `• ${bits.join(' — ')}`;
  });
  const more = matches.length > 3 ? `\n…and ${matches.length - 3} more` : '';
  return confirm(
    `Possible duplicate: this ${candidate.type} record looks like ${matches.length === 1 ? 'one' : `${matches.length}`} already in the archive:\n\n` +
    `${lines.join('\n')}${more}\n\nSave it anyway?`);
}
