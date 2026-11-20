/* ============================================
   Turns the generated mock community into rows for the
   MockParishioner table (the "mock_data" storage).

   One row per person. The family tree is copied onto
   the row, so the form autofill needs a single read:

     family: {
       father, mother,
       spouses:  [{ ...person, kind, weddingDate, weddingPlace, endReason, children: [person] }],
       children: [person],     every child, whoever the other parent is
       siblings: [person],     same father or mother
     }

   where person = { id, name, birthName, birthDate, deathDate }; name is what they use now,
   birthName is the one in the registers (a mother appears under her maiden name on a baptism).

   Pure functions, no AWS: seed-aws.mjs sends the result,
   and --dry-run prints it without touching anything.
   ============================================ */

const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lookup key for a name part: lower case, no accents, letters only ("Dela Cruz" -> "delacruz"). */
export const key = (s) => stripAccents(s).toLowerCase().replace(/[^a-z]/g, '');

/** Lookup key for a first name: only the first word, so "Juan Miguel" is found by "Juan" or "Juan Miguel". */
export const firstKey = (s) => key(s);

const clean = (n) => ({
  firstName: n?.firstName || '',
  middleName: n?.middleName || '',
  lastName: n?.lastName || '',
  extension: n?.extension || '',
});

const placeText = (p) => (p ? [p.city, p.region].filter(Boolean).join(', ') : null);
const addressText = (a) => (a ? [a.line, a.barangay && `Brgy. ${a.barangay}`, a.city, a.region].filter(Boolean).join(', ') : null);

export function buildMockParishionerRows({ persons, unions, households = [], records = [] }) {
  const byId = new Map(persons.map(p => [p.id, p]));
  const unionById = new Map(unions.map(u => [u.id, u]));
  const householdById = new Map(households.map(h => [h.id, h]));

  // children of each parent, so siblings and children come without scanning everyone each time
  const childrenOf = new Map();
  for (const p of persons) {
    for (const parent of new Set([p.fatherId, p.motherId].filter(Boolean))) {
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent).push(p.id);
    }
  }

  // the parish's own registers, by person
  const recordsOf = new Map();
  for (const r of records) {
    for (const pid of r.personIds || []) {
      if (!recordsOf.has(pid)) recordsOf.set(pid, []);
      recordsOf.get(pid).push({ type: r.type, recordId: r.id, date: r.date || null, register: r.register || null });
    }
  }

  const ref = (id) => {
    const p = byId.get(id);
    if (!p) return null;
    return { id: p.id, name: clean(p.currentName), birthName: clean(p.birthName), birthDate: p.birthDate || null, deathDate: p.deathDate || null };
  };
  const refs = (ids) => [...new Set(ids)].map(ref).filter(Boolean)
    .sort((a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'));

  return persons.map(p => {
    const cur = clean(p.currentName);
    const birth = clean(p.birthName);

    const spouses = (p.unionIds || []).map(uid => unionById.get(uid)).filter(Boolean).map(u => {
      const spouseId = u.husbandId === p.id ? u.wifeId : u.husbandId;
      return {
        ...(ref(spouseId) || { id: spouseId, name: clean(null), birthName: clean(null), birthDate: null, deathDate: null }),
        unionId: u.id,
        kind: u.kind,
        weddingDate: u.weddingDate || u.startDate || null,
        weddingPlace: u.weddingPlace || null,
        endReason: u.endReason || null,
        children: refs(u.childrenIds || []),
      };
    }).sort((a, b) => (a.weddingDate || '').localeCompare(b.weddingDate || ''));

    const siblingIds = [...(childrenOf.get(p.fatherId) || []), ...(childrenOf.get(p.motherId) || [])].filter(id => id !== p.id);
    const household = householdById.get(p.householdId);

    const sacraments = {};
    if (p.baptizedElsewhere) sacraments.baptism = { ...p.baptizedElsewhere, elsewhere: true };
    if (p.confirmedElsewhere) sacraments.confirmation = { ...p.confirmedElsewhere, elsewhere: true };
    const here = recordsOf.get(p.id);
    if (here) sacraments.parishRecords = here;

    return {
      id: p.id, // same id as the generator, so family links keep pointing at the right row
      firstName: cur.firstName,
      middleName: cur.middleName || null,
      lastName: cur.lastName,
      extension: cur.extension || null,
      maidenLastName: birth.lastName && birth.lastName !== cur.lastName ? birth.lastName : null,
      firstKey: firstKey(cur.firstName),
      lastKey: key(cur.lastName),
      maidenKey: key(birth.lastName || cur.lastName),
      sex: p.sex || null,
      birthDate: p.birthDate || null,
      birthPlace: placeText(p.birthPlace),
      deathDate: p.deathDate || null,
      civilStatus: p.civilStatus || null,
      address: addressText(household?.address),
      mobile: p.contact?.mobile || null,
      email: p.contact?.email || null,
      family: {
        father: ref(p.fatherId),
        mother: ref(p.motherId),
        spouses,
        children: refs(childrenOf.get(p.id) || []),
        siblings: refs(siblingIds),
      },
      sacraments: Object.keys(sacraments).length ? sacraments : null,
      source: 'mock-community',
      isMock: true,
    };
  });
}
