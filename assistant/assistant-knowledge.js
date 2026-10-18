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
  location: '',                       // e.g. 'Mariana St, Barangay Immaculate Conception, Cubao, Quezon City'
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

/**
 * Every page (tab) of the parishioner portal, grouped like the sidebar —
 * keep in step with the sidebar in user/*.html and user/user-shell.js.
 * The assistant uses this to tell people where to go, links page names in
 * its replies, and shows it all when someone asks for the directory.
 * `fil` names match i18n-fil.js so they read the same as the translated sidebar.
 */
export const PORTAL_DIRECTORY = [
  { section: { en: 'Main', fil: 'Pangunahin' }, pages: [
    { page: 'user-dashboard.html', en: 'Dashboard', fil: 'Dashboard',
      what: { en: "Overview: today's Masses, latest announcements, your recent requests, and the Mass check-in box.", fil: 'Buod: Misa ngayong araw, pinakabagong anunsyo, iyong mga huling request, at ang check-in sa Misa.' } },
  ] },
  { section: { en: 'Track Requests', fil: 'Subaybayan ang mga Hiling' }, pages: [
    { page: 'user-my-requests.html', en: 'My Requests', fil: 'Aking mga Hiling',
      what: { en: 'Track the status of your certificate requests.', fil: 'Subaybayan ang status ng iyong mga request ng certificate.' } },
    { page: 'user-requested-services.html', en: 'Requested Services', fil: 'Mga Hiniling na Serbisyo',
      what: { en: 'Track or cancel your sacraments, special Masses and blessings (filter by category). Blessings show "Awaiting Approval" until the parish office approves them.', fil: 'Subaybayan o kanselahin ang iyong mga sakramento, espesyal na Misa at bendisyon (i-filter ayon sa kategorya). Ang bendisyon ay "Naghihintay ng Pag-apruba" hanggang aprubahan ng parish office.' } },
  ] },
  { section: { en: 'Parish', fil: 'Parokya' }, pages: [
    { page: 'user-mass-schedule.html', en: 'Mass Schedule', fil: 'Iskedyul ng Misa',
      what: { en: 'Regular weekly Mass times and the full schedule (including special Masses) for any date.', fil: 'Regular na oras ng Misa bawat linggo at buong iskedyul (kasama ang espesyal na Misa) sa anumang petsa.' } },
    { page: 'user-announcements.html', en: 'Announcements', fil: 'Mga Anunsyo',
      what: { en: 'News and events from the parish, newest first.', fil: 'Mga balita at kaganapan sa parokya, pinakabago muna.' } },
    { page: 'user-messages.html', en: 'Messages', fil: 'Mga Mensahe',
      what: { en: 'Chat directly with the parish office (Head Admin or Secretary).', fil: 'Direktang makipag-chat sa parish office (Head Admin o Secretary).' } },
  ] },
  { section: { en: 'Services', fil: 'Mga Serbisyo' }, pages: [
    { page: 'user-request-certificate.html', en: 'Request a Certificate', fil: 'Humiling ng Sertipiko', also: ['Request Certificate'],
      what: { en: 'Request a Baptismal, Confirmation, First Communion or Marriage certificate.', fil: 'Humiling ng Baptismal, Confirmation, First Communion o Marriage certificate.' } },
    { page: 'user-request-service.html', en: 'Request a Service', fil: 'Humiling ng Serbisyo',
      what: { en: 'Book a sacrament (Baptism, Wedding, Confirmation…) or a special Mass (Funeral, Anniversary…) — booked right away — or request a blessing, which the parish office approves first.', fil: 'Mag-book ng sakramento (Binyag, Kasal, Kumpil…) o espesyal na Misa (Libing, Anibersaryo…) — agad na naka-book — o humiling ng bendisyon, na aaprubahan muna ng parish office.' } },
    { page: 'user-mass-intentions.html', en: 'Mass Intentions', fil: 'Mga Intensyon sa Misa',
      what: { en: 'Offer a Mass intention (Thanksgiving, Special Intention, or for a Soul) and track it.', fil: 'Mag-alay ng intensyon sa Misa (Pasasalamat, Espesyal na Intensyon, o para sa Kaluluwa) at subaybayan ito.' } },
    { page: 'user-facility-booking.html', en: 'Facility Booking', fil: 'Pag-book ng Pasilidad',
      what: { en: 'Book the Multi-Purpose Hall or the 3rd Floor Hall; see or cancel your bookings.', fil: 'Mag-book ng Multi-Purpose Hall o ng 3rd Floor Hall; tingnan o kanselahin ang iyong booking.' } },
  ] },
  { section: { en: 'Finance', fil: 'Pananalapi' }, pages: [
    { page: 'user-donations.html', en: 'Donations', fil: 'Mga Donasyon',
      what: { en: 'Give online to a parish fund and see your giving history.', fil: 'Magbigay online sa pondo ng parokya at tingnan ang kasaysayan ng iyong pagbibigay.' } },
  ] },
  { section: { en: 'Faith Journey', fil: 'Paglalakbay sa Pananampalataya' }, pages: [
    { page: 'user-prayer-wall.html', en: 'Prayer Wall', fil: 'Pader ng Panalangin',
      what: { en: 'Post a prayer request (anonymously if you like) and pray for others.', fil: 'Mag-post ng kahilingan sa panalangin (puwedeng anonymous) at ipanalangin ang iba.' } },
    { page: 'user-ministry.html', en: 'Ministry Sign-ups', fil: 'Pagpapalista sa Ministeryo',
      what: { en: 'Volunteer as lector, choir, altar server or usher; ask for or take swaps.', fil: 'Magboluntaryo bilang lector, koro, sakristan o usher; humingi o kumuha ng palit.' } },
    { page: 'user-badges.html', en: 'My Badges', fil: 'Aking mga Badge',
      what: { en: 'Your Faith Journey badges for Mass attendance, giving and parish life.', fil: 'Iyong mga badge sa Paglalakbay sa Pananampalataya para sa pagsisimba, pagbibigay at buhay-parokya.' } },
  ] },
  { section: { en: 'Account (your name, bottom of the menu)', fil: 'Account (iyong pangalan, sa ibaba ng menu)' }, pages: [
    { page: 'user-profile.html', en: 'My Profile', fil: 'Aking Profile',
      what: { en: 'Your details, password, two-factor sign-in and notification preferences.', fil: 'Iyong impormasyon, password, two-factor sign-in at mga abiso.' } },
    { page: 'user-settings.html', en: 'My Settings', fil: 'Aking Settings',
      what: { en: 'Light/Dark mode, English/Filipino, and larger text & high contrast.', fil: 'Light/Dark mode, English/Filipino, at mas malaking teksto at mataas na contrast.' } },
  ] },
];

/** Bookable facilities — keep in step with the list in user/user-facility-booking.js. */
export const FACILITIES = [
  { name: 'Multi-Purpose Hall', capacity: 150 },
  { name: '3rd Floor Hall', capacity: null }, // capacity not confirmed yet
];

/** Donation funds — keep in step with fundDefs in user/user-donations.js. */
export const FUNDS = [
  { name: 'Sunday Collection', desc: 'General parish fund for operations, utilities, and ministry.' },
  { name: 'Building Fund', desc: 'Supports construction, maintenance, and improvements to parish structures.' },
  { name: 'Poor Box', desc: 'Directly supports parishioners in need and charitable outreach programs.' },
  { name: 'Youth Ministry', desc: 'Funds retreats, formations, and youth activities throughout the year.' },
];
