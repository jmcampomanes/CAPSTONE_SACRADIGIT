/* The Villaruel family's documents for the Digital Archives demo.
   `file` is the renamed image in ./archive/. Each becomes one ParishRecord
   (see seed-mock-certificate-requests.js). Names follow the register: a
   marriage reads "Groom & Bride". The officiant is whoever signed: the priest
   for marriage, the bishop for confirmation, the birth attendant for birth.

   Types: 'marriage' is the parish register entry (the one "Verify Your Record"
   matches). 'civil-marriage' is the civil registry copy and is kept apart on
   purpose: two 'marriage' entries with the same names and date would make the
   verification ambiguous. */
export const ARCHIVE_DOCUMENTS = [
  { file: 'marriage_villaruel-ricardo-domingo_and_cruz-maria-elena-santos_2007-02-10.jpg', type: 'marriage',
    fullName: 'Ricardo Domingo Villaruel & Maria Elena Santos Cruz', dateOfEvent: '2007-02-10', officiant: 'Rev. Fr. Emmanuel D. Salazar' },
  { file: 'civil-marriage_villaruel-ricardo-domingo_and_cruz-maria-elena-santos_2007-02-10.jpg', type: 'civil-marriage',
    fullName: 'Ricardo Domingo Villaruel & Maria Elena Santos Cruz', dateOfEvent: '2007-02-10', officiant: 'Rev. Fr. Emmanuel D. Salazar' },

  { file: 'confirmation_villaruel-ricardo-domingo_1990-11-25.jpg', type: 'confirmation',
    fullName: 'Ricardo Domingo Villaruel', dateOfEvent: '1990-11-25', birthdate: '1978-08-14', officiant: 'Most Rev. Tomas R. Villanueva, D.D.' },
  { file: 'confirmation_cruz-maria-elena-santos_1992-05-17.jpg', type: 'confirmation',
    fullName: 'Maria Elena Santos Cruz', dateOfEvent: '1992-05-17', birthdate: '1981-01-22', officiant: 'Most Rev. Alfredo C. Navarro, D.D.' },
  { file: 'confirmation_villaruel-miguel-angelo-cruz_2019-11-30.jpg', type: 'confirmation',
    fullName: 'Miguel Angelo Cruz Villaruel', dateOfEvent: '2019-11-30', birthdate: '2008-03-05', officiant: 'Most Rev. Leonardo S. Medina, D.D.' },
  { file: 'confirmation_villaruel-sofia-isabel-cruz_2023-10-21.jpg', type: 'confirmation',
    fullName: 'Sofia Isabel Cruz Villaruel', dateOfEvent: '2023-10-21', birthdate: '2011-09-18', officiant: 'Most Rev. Leonardo S. Medina, D.D.' },

  { file: 'birth_villaruel-ricardo-domingo_1978-08-14.jpg', type: 'birth',
    fullName: 'Ricardo Domingo Villaruel', dateOfEvent: '1978-08-14', birthdate: '1978-08-14', officiant: 'Dr. Carmen A. Valdez' },
  { file: 'birth_cruz-maria-elena-santos_1981-01-22.jpg', type: 'birth',
    fullName: 'Maria Elena Santos Cruz', dateOfEvent: '1981-01-22', birthdate: '1981-01-22', officiant: 'Rosalinda M. De Leon, RM' },
  { file: 'birth_villaruel-miguel-angelo-cruz_2008-03-05.jpg', type: 'birth',
    fullName: 'Miguel Angelo Cruz Villaruel', dateOfEvent: '2008-03-05', birthdate: '2008-03-05', officiant: 'Dr. Rosario L. Mendoza' },
  { file: 'birth_villaruel-sofia-isabel-cruz_2011-09-18.jpg', type: 'birth',
    fullName: 'Sofia Isabel Cruz Villaruel', dateOfEvent: '2011-09-18', birthdate: '2011-09-18', officiant: 'Dr. Rosario L. Mendoza' },

  // A second family, so the demo has a record outside the Villaruels.
  { file: 'confirmation_salvador-andrea-nicole-mercado_2018-12-08.jpg', type: 'confirmation',
    fullName: 'Andrea Nicole Mercado Salvador', dateOfEvent: '2018-12-08', birthdate: '2007-04-03', officiant: 'Most Rev. Cornelio V. Yap, D.D.' },
];
