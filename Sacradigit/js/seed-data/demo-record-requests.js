/* Ten certificate requests for presenting Record Requests: two for each certificate
   type, all pending, each carrying every answer the parishioner's request form asks
   for (the same `details` keys user/js/certificate-request-page.js saves).

   Open one with View to see the details laid out, approve it, then Generate to see
   the certificate built from them. Names match seed-data/family-directory.js, so the
   family is consistent across requests.

   The first confirmation (Andrea Salvador) is a *verified* request: it carries no typed
   answers, only the link to her archive record, so View and Generate fill everything
   from the record and the family directory. Add Archive Documents first so the link
   resolves; without it the saved copy of the record is used. */

const n = (firstName, middleName, lastName, extension = '') => ({ firstName, middleName, lastName, extension });

const RICARDO = n('Ricardo', 'Domingo', 'Villaruel');
const MARIA   = n('Maria Elena', 'Cruz', 'Villaruel');
const DANILO  = n('Danilo', 'Torres', 'Salvador');
const ROWENA  = n('Rowena', 'Dizon', 'Salvador');

const PARISH = 'Our Lady of Fatima Parish';
const BIRTH = { 'birth-region': 'National Capital Region', 'birth-city': 'Pasig City', birthplace: 'Pasig City' };

export const DEMO_REQUESTS = [
  // --- Baptismal ---
  { requesterName: 'Ricardo Domingo Villaruel', certificateType: 'Baptismal Certificate', purpose: 'School enrollment requirement',
    details: { 'baptized-name': n('Miguel Angelo', 'Cruz', 'Villaruel'), 'birth-date': '2008-03-05', ...BIRTH, 'baptism-date': '2008-06-15',
      'father-name': RICARDO, 'mother-name': MARIA,
      'sponsor-1': n('Jose Ramon', 'Santos', 'Cruz'), 'sponsor-2': n('Carmela', 'Reyes', 'Cruz') } },
  { requesterName: 'Maria Elena Cruz Villaruel', certificateType: 'Baptismal Certificate', purpose: 'First Communion preparation',
    details: { 'baptized-name': n('Sofia Isabel', 'Cruz', 'Villaruel'), 'birth-date': '2011-09-18', ...BIRTH, 'baptism-date': '2012-01-22',
      'father-name': RICARDO, 'mother-name': MARIA,
      'sponsor-1': n('Antonio', 'Reyes', 'Cruz'), 'sponsor-2': n('Luz', 'Santos', 'Mendoza') } },

  // --- Confirmation ---
  // Verified against the archive record: no typed answers (see the note above).
  { requesterName: 'Andrea Nicole Mercado Salvador', certificateType: 'Confirmation Certificate', purpose: 'Scholarship application',
    verifiedRecord: { type: 'confirmation', fullName: 'Andrea Nicole Mercado Salvador', dateOfEvent: '2018-12-08', officiant: 'Most Rev. Cornelio V. Yap, D.D.' },
    details: { 'Verified Against Record': 'Yes' } },
  { requesterName: 'Maria Elena Cruz Villaruel', certificateType: 'Confirmation Certificate', purpose: 'Church wedding requirement',
    details: { 'confirmed-name': n('Miguel Angelo', 'Cruz', 'Villaruel'), 'baptism-date': '2008-06-15', 'baptism-church': PARISH,
      'confirmation-name': 'Michael', 'confirmation-date': '2019-11-30',
      'father-name': RICARDO, 'mother-name': MARIA, 'sponsor-name': n('Jose Ramon', 'Santos', 'Cruz') } },

  // --- First Communion ---
  { requesterName: 'Ricardo Domingo Villaruel', certificateType: 'First Communion Certificate', purpose: 'Confirmation class requirement',
    details: { 'fc-name': n('Miguel Angelo', 'Cruz', 'Villaruel'), 'fc-communion-date': '2017-05-13' } },
  { requesterName: 'Rowena Dizon Salvador', certificateType: 'First Communion Certificate', purpose: 'School records',
    details: { 'fc-name': n('Andrea Nicole', 'Mercado', 'Salvador'), 'fc-communion-date': '2016-05-14' } },

  // --- Marriage ---
  { requesterName: 'Ricardo Domingo Villaruel', certificateType: 'Marriage Certificate', purpose: 'Visa application',
    details: { 'groom-name': RICARDO, 'groom-father': n('Eduardo', 'Santos', 'Villaruel'), 'groom-mother': n('Teresita', 'Domingo', 'Reyes'),
      'bride-name': n('Maria Elena', 'Santos', 'Cruz'), 'bride-father': n('Antonio', 'Reyes', 'Cruz'), 'bride-mother': n('Luz', 'Santos', 'Mendoza'),
      'marriage-date': '2007-02-10', 'marriage-place': PARISH,
      'witness-1': n('Ramon', 'Cruz', 'Aquino'), 'witness-2': n('Cristina', 'Santos', 'Bautista') } },
  { requesterName: 'Danilo Torres Salvador', certificateType: 'Marriage Certificate', purpose: 'Insurance claim',
    details: { 'groom-name': DANILO, 'groom-father': n('Alfredo', 'Mendoza', 'Salvador'), 'groom-mother': n('Gloria', 'Torres', 'Navarro'),
      'bride-name': n('Rowena', 'Dizon', 'Mercado'), 'bride-father': n('Rodrigo', 'Santos', 'Mercado'), 'bride-mother': n('Elena', 'Dizon', 'Cruz'),
      'marriage-date': '2005-11-19', 'marriage-place': PARISH,
      'witness-1': n('Liza', 'Mercado', 'Ramos'), 'witness-2': n('Pedro', 'Santos', 'Dizon') } },

  // --- Death ---
  { requesterName: 'Ricardo Domingo Villaruel', certificateType: 'Death Certificate', purpose: 'Estate settlement',
    details: { 'deceased-name': n('Eduardo', 'Santos', 'Villaruel'), age: '79', 'death-date': '2021-03-14', 'place-of-death': 'Pasig City',
      'burial-date': '2021-03-17', 'burial-place': 'Holy Cross Memorial Park, Pasig City', 'requester-rel': 'Son' } },
  { requesterName: 'Danilo Torres Salvador', certificateType: 'Death Certificate', purpose: 'Bank account closure',
    details: { 'deceased-name': n('Gloria', 'Torres', 'Navarro'), age: '76', 'death-date': '2023-09-02', 'place-of-death': 'Taguig City',
      'burial-date': '2023-09-05', 'burial-place': 'Libingan ng Pamilya, Pasig City', 'requester-rel': 'Son' } },
];
