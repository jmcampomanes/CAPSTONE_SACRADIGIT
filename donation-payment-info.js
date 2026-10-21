/* ============================================
   SacraDigit — where parishioners send their offering
   Shown on the "Now send your offering" page after
   Confirm Offering (user/user-donations.js).

   FILL THESE IN with the parish's real accounts.
   Leave a value empty ('') until it's known: the page
   then tells people to call the parish office for it,
   instead of ever showing a wrong number.
   ============================================ */

export const PAYMENT_ACCOUNTS = {
  GCash: {
    number: '',        // e.g. '0917 123 4567'
    accountName: '',   // name shown in GCash, e.g. 'Our Lady of Fatima Parish'
  },
  Maya: {
    number: '',
    accountName: '',
  },
  'Bank Transfer': {
    bank: '',          // e.g. 'BPI'
    accountName: '',
    accountNumber: '',
  },
};

// How soon the office confirms a GCash / Maya / bank offering.
export const CONFIRM_WITHIN = 'within 1 working day';
