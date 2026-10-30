/* ============================================
   SacraDigit — where parishioners send their offering
   Shown on the "Now send your offering" page after
   Confirm Offering (user/user-donations.js).

   FILL THESE IN with the parish's real accounts.
   Leave a value empty ('') until it's known: the page
   then tells people to call the parish office for it,
   instead of ever showing a wrong number.

   qr: the text inside the account's blank-amount
   "My QR" (GCash: Profile → My QR; Maya: My QR).
   Scan it with any QR reader app and paste the
   text here. The page adds the donor's amount to
   it (see qrph.js) and shows a QR they can scan.
   ============================================ */

export const PAYMENT_ACCOUNTS = {
  GCash: {
    number: '',        // e.g. '0917 123 4567'
    accountName: '',   // name shown in GCash, e.g. 'Our Lady of Fatima Parish'
    qr: '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDO29NFBA5204601653036085802PH5908KI**Y R.6008Napindan610412346304FEB5',
  },
  Maya: {
    number: '',
    accountName: '',
    qr: '00020101021127780012com.p2pqrpay0111PAPHPHM1XXX02089996440304126396961766010515+63-969-61766015204601653036085802PH5921ALTHEA MARIE LAURENTE6014Paranaque City63041A6B',
  },
  'Bank Transfer': {
    bank: '',          // e.g. 'BPI'
    accountName: '',
    accountNumber: '',
  },
};

// How soon the office confirms a GCash / Maya / bank offering.
export const CONFIRM_WITHIN = 'within 1 working day';
