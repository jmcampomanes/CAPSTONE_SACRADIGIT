/* ============================================
   SacraDigit — Parish Assistant: what it knows
   Plain facts the assistant answers from, in
   English and Filipino. The parish office can
   edit this file without touching any code.

   Live facts are NOT kept here — Mass times,
   service schedules, facilities, funds and a
   parishioner's own requests are read from the
   same sources the portal pages use (see
   parish-assistant.js), so the assistant never
   disagrees with the rest of the site.

   ⚠ REVIEW WITH THE PARISH OFFICE: the document
   requirements below are the ones most parishes
   in the Diocese of Cubao ask for. Confirm or
   correct them before real parishioners rely on
   them.
   ============================================ */

/** Contact details. Leave a value '' to have the assistant skip it. */
export const PARISH_CONTACT = {
  name: 'Our Lady of Fatima Parish',
  officeHours: { en: '', fil: '' },  // e.g. { en: 'Tue–Sun, 8:00 AM – 5:00 PM', fil: 'Martes–Linggo, 8:00 AM – 5:00 PM' }
  phone: '',                          // e.g. '(02) 8123 4567'
  email: '',
  facebook: '',                       // e.g. 'https://facebook.com/…'
};

/** Typical documents per service, keyed by the service name in service-catalog.js. */
export const REQUIREMENTS = {
  'Baptism': {
    en: ["Child's PSA birth certificate (photocopy)", "Parents' marriage certificate, if married in church", 'Pre-baptism seminar for parents and godparents', 'Godparents should be practicing Catholics who are already confirmed'],
    fil: ['PSA birth certificate ng bata (kopya)', 'Marriage certificate ng mga magulang, kung kasal sa simbahan', 'Pre-baptism seminar para sa mga magulang at ninong/ninang', 'Ang ninong at ninang ay dapat aktibong Katoliko at kumpil na'],
  },
  'Confirmation': {
    en: ['Baptismal certificate (for confirmation purposes)', 'Confirmation seminar / catechesis', 'One sponsor who is a confirmed, practicing Catholic'],
    fil: ['Baptismal certificate (for confirmation purposes)', 'Seminar o katekesis para sa Kumpil', 'Isang sponsor na kumpil at aktibong Katoliko'],
  },
  'First Communion': {
    en: ['Baptismal certificate', 'First Communion catechesis classes', 'First Confession before the First Communion Mass'],
    fil: ['Baptismal certificate', 'Klase sa katekesis para sa Unang Komunyon', 'Unang Kumpisal bago ang Misa ng Unang Komunyon'],
  },
  'Wedding': {
    en: ['Baptismal and confirmation certificates of both (for marriage purposes, issued within 6 months)', 'PSA birth certificates and CENOMAR of both', 'Marriage license (or affidavit of cohabitation)', 'Pre-Cana seminar and canonical interview with the parish priest', 'Marriage banns posted in both parishes', 'Book at least 2 months ahead'],
    fil: ['Baptismal at confirmation certificate ng dalawa (for marriage purposes, hindi lalampas sa 6 na buwan)', 'PSA birth certificate at CENOMAR ng dalawa', 'Marriage license (o affidavit of cohabitation)', 'Pre-Cana seminar at canonical interview sa kura paroko', 'Marriage banns sa parokya ng dalawa', 'Mag-book nang hindi bababa sa 2 buwan bago ang kasal'],
  },
  'Funeral Mass': {
    en: ["Death certificate of the deceased (photocopy)", 'Name of the funeral home and the preferred Mass time'],
    fil: ['Death certificate ng yumao (kopya)', 'Pangalan ng punerarya at gustong oras ng Misa'],
  },
  'Anointing of the Sick': {
    en: ['Name and complete address of the sick person (home or hospital room)', 'In an emergency, call or go to the parish office right away — don’t wait for an online slot'],
    fil: ['Pangalan at kumpletong address ng may sakit (bahay o kuwarto sa ospital)', 'Kung emergency, tumawag o pumunta agad sa parish office — huwag nang hintayin ang online na slot'],
  },
  'Confession / Reconciliation': {
    en: ['No documents needed — just come with a contrite heart'],
    fil: ['Walang kailangang dokumento — pumunta lamang nang may pusong nagsisisi'],
  },
};

/** Certificates a parishioner can request (same list as the Request Certificate page). */
export const CERTIFICATES = {
  en: ['Baptismal Certificate', 'Confirmation Certificate', 'First Communion Certificate', 'Marriage Certificate'],
  fil: ['Baptismal Certificate', 'Confirmation Certificate', 'First Communion Certificate', 'Marriage Certificate'],
  processing: { en: '3–5 working days', fil: '3–5 araw na may pasok' },
};

/** Suggested Mass intention offering per name — same default as the Mass Intentions page. */
export const OFFERING_PER_INTENTION = 300;

/** Filipino names for the services in service-catalog.js. */
export const SERVICE_NAMES_FIL = {
  'Baptism': 'Binyag',
  'Confirmation': 'Kumpil',
  'First Communion': 'Unang Komunyon',
  'Confession / Reconciliation': 'Kumpisal',
  'Anointing of the Sick': 'Pagpapahid ng Langis sa Maysakit',
  'Wedding': 'Kasal',
  'Holy Orders': 'Ordinasyon',
  'Funeral Mass': 'Misa para sa Yumao',
  'House Blessing': 'Pagbabasbas ng Bahay',
  'Vehicle / Item Blessing': 'Pagbabasbas ng Sasakyan / Gamit',
  'Business Dedication': 'Pagbabasbas ng Negosyo',
  'Anniversary Mass': 'Misa ng Anibersaryo',
  'Pet Blessing': 'Pagbabasbas ng Alagang Hayop',
  'Baccalaureate Mass': 'Misa ng Pagtatapos',
};

/** Extra words people use for each service (English + Filipino/Taglish). */
export const SERVICE_KEYWORDS = {
  'Baptism': ['baptism', 'baptismal', 'baptize', 'baptise', 'christening', 'binyag', 'binyagan', 'bautismo', 'bautizo', 'pabinyag', 'ipabinyag', 'magpabinyag', 'ninong', 'ninang', 'godparent', 'godparents'],
  'Confirmation': ['confirmation', 'confirm', 'confirmed', 'kumpil', 'kumpilan', 'sponsor'],
  'First Communion': ['first communion', 'communion', 'unang komunyon', 'komunyon'],
  'Confession / Reconciliation': ['confession', 'confess', 'reconciliation', 'penance', 'kumpisal', 'mangumpisal', 'kumpisalan'],
  'Anointing of the Sick': ['anointing', 'sick', 'last rites', 'maysakit', 'may sakit', 'pahid', 'langis', 'hospital', 'ospital', 'dying', 'naghihingalo'],
  'Wedding': ['wedding', 'marriage', 'marry', 'married', 'kasal', 'ikasal', 'magpakasal', 'kasalan', 'pre-cana', 'precana', 'cenomar', 'banns'],
  'Holy Orders': ['holy orders', 'ordination', 'ordinasyon', 'priesthood', 'pagpapari'],
  'Funeral Mass': ['funeral', 'burial', 'wake', 'deceased', 'died', 'patay', 'namatay', 'yumao', 'libing', 'lamay', 'burol', 'punerarya'],
  'House Blessing': ['house blessing', 'house', 'home', 'bahay', 'bagong bahay', 'condo', 'apartment'],
  'Vehicle / Item Blessing': ['vehicle', 'car', 'motorcycle', 'motor', 'kotse', 'sasakyan', 'jeep', 'tricycle'],
  'Business Dedication': ['business', 'store', 'shop', 'office blessing', 'negosyo', 'tindahan', 'opisina'],
  'Anniversary Mass': ['anniversary', 'anibersaryo', 'jubilee'],
  'Pet Blessing': ['pet', 'pets', 'dog', 'cat', 'aso', 'pusa', 'alaga', 'alagang hayop'],
  'Baccalaureate Mass': ['baccalaureate', 'graduation', 'graduating', 'pagtatapos', 'gradweyt'],
};

/** Bookable facilities — keep in step with the list in user/user-facility-booking.js. */
export const FACILITIES = [
  { name: 'Parish Hall', capacity: 200 },
  { name: 'Adoration Chapel', capacity: 40 },
  { name: 'Catechetical Room A', capacity: 30 },
  { name: 'Catechetical Room B', capacity: 20 },
  { name: 'Multi-Purpose Hall', capacity: 150 },
];

/** Donation funds — keep in step with fundDefs in user/user-donations.js. */
export const FUNDS = [
  { name: 'Sunday Collection', desc: 'General parish fund for operations, utilities, and ministry.' },
  { name: 'Building Fund', desc: 'Supports construction, maintenance, and improvements to parish structures.' },
  { name: 'Poor Box', desc: 'Directly supports parishioners in need and charitable outreach programs.' },
  { name: 'Youth Ministry', desc: 'Funds retreats, formations, and youth activities throughout the year.' },
];
