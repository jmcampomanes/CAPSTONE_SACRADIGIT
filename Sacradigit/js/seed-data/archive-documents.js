/* The document the Digital Archives demo is seeded with: Andrea Nicole Mercado
   Salvador's Certificate of Confirmation.
   `file` is the image in ./archive/. Each entry becomes one ParishRecord
   (see seed-mock-certificate-requests.js). Names follow the register. The
   officiant is whoever signed: the bishop for confirmation. */
export const ARCHIVE_DOCUMENTS = [
  { file: 'confirmation_salvador-andrea-nicole-mercado_2018-12-08.jpg', type: 'confirmation',
    fullName: 'Andrea Nicole Mercado Salvador', dateOfEvent: '2018-12-08', birthdate: '2007-04-03', officiant: 'Most Rev. Cornelio V. Yap, D.D.' },
];
