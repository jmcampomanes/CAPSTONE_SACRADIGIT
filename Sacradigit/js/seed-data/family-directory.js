/* Demo families the Generate Certificate form can look up by name, so the
   first / middle / last boxes and the parents fill themselves in. This is mock
   data, like the rest of seed-data/: real people come from the request itself
   and the archive record. Names are exactly as the office wants them split
   (a two-word first name stays together: "Maria Elena" / "Cruz" / "Villaruel"). */

const n = (firstName, middleName, lastName) => ({ firstName, middleName, lastName, extension: '' });

const RICARDO = n('Ricardo', 'Domingo', 'Villaruel');
const MARIA   = n('Maria Elena', 'Cruz', 'Villaruel');

export const FAMILY_DIRECTORY = [
  // The Villaruel family (marriage in church, 2007)
  { name: RICARDO, birthdate: '1978-08-14' },
  // The archive's marriage entry reads the bride by her maiden name.
  { name: MARIA, aliases: ['Maria Elena Santos Cruz'], birthdate: '1981-01-22' },
  { name: n('Miguel Angelo', 'Cruz', 'Villaruel'), birthdate: '2008-03-05', father: RICARDO, mother: MARIA },
  { name: n('Sofia Isabel', 'Cruz', 'Villaruel'),  birthdate: '2011-09-18', father: RICARDO, mother: MARIA },

  // The Salvador family
  { name: n('Andrea Nicole', 'Mercado', 'Salvador'), birthdate: '2007-04-03', birthplace: 'Pasig City',
    father: n('Danilo', 'Torres', 'Salvador'), mother: n('Rowena', 'Dizon', 'Salvador') },
];

const clean = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const fullOf = (p) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

const INDEX = new Map();
for (const person of FAMILY_DIRECTORY) {
  INDEX.set(clean(fullOf(person.name)), person);
  (person.aliases || []).forEach((a) => INDEX.set(clean(a), person));
}

/** The directory entry for a full name (or alias) such as "Andrea Nicole Mercado Salvador", else null. */
export function lookupPerson(fullName) {
  return INDEX.get(clean(fullName)) || null;
}

const PARTICLES = new Set(['de', 'del', 'dela', 'delos', 'la', 'las', 'san', 'santa', 'van', 'von']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/** "Maria Elena Cruz Villaruel" → { firstName: 'Maria Elena', middleName: 'Cruz', lastName: 'Villaruel' }.
    The directory decides when it knows the person; otherwise the last word is the surname
    (with "Dela", "De los"… kept with it), the word before it the middle name, the rest the first name. */
export function splitFullName(fullName) {
  const known = lookupPerson(fullName);
  if (known) return { ...known.name };
  const words = String(fullName || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  let extension = '';
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase().replace(/\./g, ''))) extension = words.pop();
  if (words.length <= 1) return { firstName: words[0] || '', middleName: '', lastName: '', extension };
  let lastStart = words.length - 1;
  while (lastStart > 1 && PARTICLES.has(words[lastStart - 1].toLowerCase())) lastStart--;
  const lastName = words.slice(lastStart).join(' ');
  const rest = words.slice(0, lastStart);
  if (rest.length === 1) return { firstName: rest[0], middleName: '', lastName, extension };
  return { firstName: rest.slice(0, -1).join(' '), middleName: rest[rest.length - 1], lastName, extension };
}
