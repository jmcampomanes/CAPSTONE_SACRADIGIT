/* ============================================
   SacraDigit — Wedding rules
   Checks made on a wedding request, on the
   parishioner's form and at the office.

   Age is worked out at the wedding date, for each
   person, under the Family Code of the Philippines:
     under 18   can't marry (Art. 5)
     18 to 20   parental consent (Art. 14)
     21 to 24   parental advice (Art. 15)
   TO CONFIRM with the parish priest before use.

   The account holder must be the bride or groom:
   the form compares the account name with the couple's
   names, asks for a declaration, and staff check valid
   IDs. The office can still book for walk-ins.

   Documents an age adds go in details under
   AGE_DOCS_KEY as [{ id, label, why }], and
   sacrament-prep.js adds them to the checklist.
   ============================================ */

import { formatFullName } from './name-utils.js';

export const AGE_DOCS_KEY = 'Age-Based Documents';
export const GROOM_EMAIL = "Groom's Email";
export const BRIDE_EMAIL = "Bride's Email";
export const GROOM_BIRTH = "Groom's Birthdate";
export const BRIDE_BIRTH = "Bride's Birthdate";

/** Whole years old on `onDate` (both YYYY-MM-DD). */
export function ageOn(birthdate, onDate) {
  const [by, bm, bd] = birthdate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const WHO = { groom: 'Groom', bride: 'Bride' };

function ruleFor(side, age) {
  const who = WHO[side];
  if (age < 18) return { blocked: `${who} will be ${age} on the wedding date. The law requires both to be at least 18.` };
  if (age <= 20) return { doc: { id: `parental-consent-${side}`, label: `Parental consent (${who}, ${age} years old)`, why: `${who} will be ${age} on the wedding date. Ages 18 to 20 need parental consent.` } };
  if (age <= 24) return { doc: { id: `parental-advice-${side}`, label: `Parental advice (${who}, ${age} years old)`, why: `${who} will be ${age} on the wedding date. Ages 21 to 24 need parental advice.` } };
  return {};
}

/** { blocked: [reasons], docs: [{ id, label, why }] } for the couple on that date. */
export function checkCouple({ groomBirth, brideBirth, weddingDate }) {
  const results = [
    groomBirth && weddingDate ? ruleFor('groom', ageOn(groomBirth, weddingDate)) : {},
    brideBirth && weddingDate ? ruleFor('bride', ageOn(brideBirth, weddingDate)) : {},
  ];
  return { blocked: results.map(r => r.blocked).filter(Boolean), docs: results.map(r => r.doc).filter(Boolean) };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Same first and last name? Middle names and extensions are ignored. */
function samePerson(accountName, n) {
  const words = norm(accountName).split(' ');
  return !!n?.firstName && !!n?.lastName
    && norm(n.firstName).split(' ').every(w => words.includes(w))
    && norm(n.lastName).split(' ').every(w => words.includes(w));
}

export const accountIsInCouple = (accountName, groom, bride) => samePerson(accountName, groom) || samePerson(accountName, bride);

/** Both people's emails on a wedding request; [] for anything else. */
export function coupleEmails(record) {
  if (record?.type !== 'Wedding') return [];
  let d = {};
  try { d = (typeof record.details === 'string' ? JSON.parse(record.details) : record.details) || {}; } catch { /* no details */ }
  return [d[GROOM_EMAIL], d[BRIDE_EMAIL]].filter(Boolean);
}

export const coupleName = (groom, bride) => `${formatFullName(groom)} and ${formatFullName(bride)}`;
