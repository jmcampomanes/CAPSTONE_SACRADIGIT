/* ============================================
   Name autofill for the Scan Document screen.

   Uses the names already in the archive:
     1. While typing, a short list of matching known
        names appears under the name boxes; click one
        and all the boxes fill in.
     2. After a scan, if the name the reader found is
        close to a known name ("MARLA CLARA DELA CRVZ"
        vs "Maria Clara Dela Cruz"), a "Did you mean…?"
        line offers it. Nothing is changed unless the
        person clicks it.
   Archive records with two names ("A & B", marriages)
   count as two people.
   ============================================ */

import { splitName } from './scan-engine.js';
import { readNameFields, setNameFields, formatFullName } from '../../../shared/js/name-utils.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

function distance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Unique people from the archive's records: [{ display, parts, key, short }]. */
export function knownNames(records) {
  const seen = new Map();
  for (const r of records || []) {
    for (const piece of String(r.fullName || '').split(/\s*&\s*/)) {
      const key = norm(piece);
      if (!key || seen.has(key)) continue;
      const parts = splitName(piece);
      if (!parts.firstName || !parts.lastName) continue;
      const short = norm(`${parts.firstName} ${parts.lastName}`);
      seen.set(key, { display: formatFullName(parts), parts, key, short });
    }
  }
  return [...seen.values()];
}

/** Names that start with what has been typed (every typed word starts some word of the name). */
export function matchTyped(known, query, limit = 6) {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length || norm(query).length < 2) return [];
  return known
    .filter((k) => {
      const kw = k.key.split(' ');
      return words.every((w) => kw.some((x) => x.startsWith(w)));
    })
    .sort((a, b) => a.display.localeCompare(b.display))
    .slice(0, limit);
}

/** The known name closest to a scanned one, or null if none is close (or it already matches exactly). */
export function closestKnown(known, name) {
  const full = norm(formatFullName({ ...name, extension: '' }));
  const short = norm(`${name.firstName} ${name.lastName}`);
  if (full.length < 5) return null;
  let best = null;
  for (const k of known) {
    const d = Math.min(distance(full, k.key), distance(short, k.short));
    if (d === 0) return null; // already a known person
    const limit = Math.max(1, Math.floor(Math.min(full.length, k.key.length) * 0.18));
    if (d <= limit && (!best || d < best.d)) best = { d, k };
  }
  return best ? best.k : null;
}

const STYLE = `
  .name-suggest-box { position: absolute; left: 0; right: 0; z-index: 20; margin-top: 0.15rem; background: #fff; border: 1px solid #d1d5db; border-radius: 0.5rem; box-shadow: 0 8px 20px rgba(15,23,42,0.15); overflow: hidden; }
  .name-suggest-box button { display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; border: 0; background: none; font-size: 0.875rem; color: #111827; cursor: pointer; }
  .name-suggest-box button:hover, .name-suggest-box button:focus-visible { background: #f5f6fb; outline: none; }
  .name-suggest-head { padding: 0.3rem 0.75rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; }
  .name-did-you-mean { margin-top: 0.35rem; font-size: 0.8125rem; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.5rem; padding: 0.4rem 0.6rem; }
  .name-did-you-mean button { margin-left: 0.4rem; font-weight: 600; text-decoration: underline; border: 0; background: none; color: inherit; cursor: pointer; }
  :root[data-theme="dark"] .name-suggest-box { background: #1a2131; border-color: #2a3346; }
  :root[data-theme="dark"] .name-suggest-box button { color: #f1f3f7; }
  :root[data-theme="dark"] .name-suggest-box button:hover, :root[data-theme="dark"] .name-suggest-box button:focus-visible { background: #242c3e; }
  :root[data-theme="dark"] .name-suggest-head { color: #b6bdca; }
  :root[data-theme="dark"] .name-did-you-mean { background: #3b2f12; border-color: #6b5a1f; color: #fde68a; }
`;

/**
 * Wires one name group (the four boxes sharing `prefix`).
 *   getKnown() → knownNames(...) list
 * Returns { check(), clear() }: check() offers "Did you mean…?" for the
 * name currently in the boxes; clear() hides any suggestion.
 */
export function attachNameSuggest(prefix, getKnown) {
  if (!document.getElementById('name-suggest-style')) {
    const st = document.createElement('style');
    st.id = 'name-suggest-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  const first = document.getElementById(`${prefix}-first`);
  const group = first?.closest('.name-field-group');
  if (!group) return { check() {}, clear() {} };
  group.style.position = 'relative';

  const box = document.createElement('div');
  box.className = 'name-suggest-box hidden';
  const hint = document.createElement('div');
  hint.className = 'name-did-you-mean hidden';
  group.append(box, hint);

  const apply = (k) => { setNameFields(prefix, k.parts); clear(); };

  function clear() {
    box.classList.add('hidden'); box.innerHTML = '';
    hint.classList.add('hidden'); hint.innerHTML = '';
  }

  function showTyped() {
    hint.classList.add('hidden');
    const n = readNameFields(prefix);
    const hits = matchTyped(getKnown(), [n.firstName, n.middleName, n.lastName].join(' '));
    if (!hits.length || (hits.length === 1 && norm(hits[0].display) === norm(formatFullName({ ...n, extension: '' })))) {
      box.classList.add('hidden'); box.innerHTML = ''; return;
    }
    box.innerHTML = '<div class="name-suggest-head">Already in the archive</div>';
    for (const k of hits) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = k.display;
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus so the list isn't closed first
      b.addEventListener('click', () => apply(k));
      box.appendChild(b);
    }
    box.classList.remove('hidden');
  }

  for (const part of ['first', 'middle', 'last']) {
    const el = document.getElementById(`${prefix}-${part}`);
    el?.addEventListener('input', showTyped);
  }
  group.addEventListener('focusout', () => setTimeout(() => { if (!group.contains(document.activeElement)) box.classList.add('hidden'); }, 120));

  function check() {
    box.classList.add('hidden');
    const k = closestKnown(getKnown(), readNameFields(prefix));
    if (!k) { hint.classList.add('hidden'); hint.innerHTML = ''; return; }
    hint.innerHTML = '';
    hint.append('Did you mean ');
    const strong = document.createElement('strong');
    strong.textContent = k.display;
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'Use this name';
    yes.addEventListener('click', () => apply(k));
    hint.append(strong, '?', yes);
    hint.classList.remove('hidden');
  }

  return { check, clear };
}
