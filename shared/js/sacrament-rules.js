/* ============================================
   SacraDigit — Baptism and marriage rules
   What the parish publishes about Baptism and
   Weddings: documents, rules and fees. This is the
   one copy. The public homepage (index.html, mounted
   by landing/home.js), Requirements & Rules in the
   parishioner portal (user/user-requirements.html)
   and the Preparation Checklist staff tick
   (sacrament-prep.js) all read it, and every amount
   comes from parish-rules.js.

   The markup uses the homepage's .hp-* classes.
   Portal styles: user/css/user-requirements.css.
   ============================================ */

import { parishRules, peso } from './parish-rules.js';

const amt = (n) => `${peso(n)}<small>.00</small>`;

/** Baptism: requirements, fees, rules. */
export function baptismRulesHtml(f = parishRules().fees) {
  return `
<div class="hp-sacrament">
  <div class="hp-panel">
    <h3 class="hp-panel-title">Requirements</h3>
    <ul class="hp-check">
      <li>Birth Certificate of the child (photocopy with original CTC or PSA)</li>
      <li>Marriage Contract, if married (photocopy with original CTC or PSA)</li>
      <li>Letter of Permission from the Parish Priest, if the candidate is not from this parish</li>
      <li>Application Form to be filled up by the father or mother of the child c/o OLFP</li>
      <li>Proof of identity of parents / ID</li>
      <li>Certificate of No Baptismal Record from 3 parishes near your residence (for 2 years old and above)</li>
      <li>Seminar/Catechism every Saturday, 4:00 PM, prior to your scheduled date — <strong>No Seminar, No Baptism</strong></li>
    </ul>
  </div>

  <div class="hp-fees">
    <h3 class="hp-panel-title">Fees</h3>
    <div class="hp-fee">
      <div>
        <h4>Public Baptism (Common)</h4>
        <p>With other families, on the dates the parish announces</p>
        <p class="hp-muted">Includes 1 pair of sponsors; additional sponsors ${peso(f.sponsorExtraPublic)}.00 per person</p>
      </div>
      <p class="hp-price">${amt(f.baptismPublic)}</p>
    </div>
    <div class="hp-fee">
      <div>
        <h4>Private Baptism (Solo)</h4>
        <p>By appointment, at least a week before your desired date</p>
        <p class="hp-muted">Includes 1 pair of sponsors; additional sponsors ${peso(f.sponsorExtraPrivate)}.00 per person</p>
      </div>
      <p class="hp-price">${amt(f.baptismPrivate)}</p>
    </div>
    <p class="hp-fine">Prices are subject to change without prior notice.</p>
  </div>
</div>

<div class="hp-panel hp-rules">
  <h3 class="hp-panel-title">Rules &amp; Regulations</h3>
  <ol class="hp-numbered hp-cols">
    <li>Bookings/reservations are to be made at least <strong>2 weeks</strong> before your desired date.</li>
    <li>Reservation fee is non-refundable and non-transferable.</li>
    <li>Cancellation means forfeiture of payment.</li>
    <li>Parents and at least 1 pair of sponsors must attend the Catechism/Seminar prior to the scheduled date of Baptism (every Saturday at 4:00 PM).</li>
    <li>Strictly <strong>white dress and cap</strong> for the child.</li>
    <li>Sponsors must be baptized and confirmed Catholics, <strong>18 years old and above</strong>.</li>
    <li>Parents, sponsors and guests must wear proper attire inside the Church (no sleeveless, tube, mini skirts or shorts).</li>
    <li>If you invite your own priest, please notify us in writing with his full name, title/designation, and a photocopy of his Celebret ID.</li>
    <li>Punctuality is a must — other church/priest services may be scheduled.</li>
    <li>The baptismal certificate will be available one (1) month after the baptism date. The first copy contains the complete list of sponsors and is free of charge if claimed within one (1) year from the date of baptism; succeeding copies will contain only the names of the principal sponsors and will be charged accordingly.</li>
  </ol>
</div>`;
}

/** Wedding: basic and additional requirements, regulations, what to bring. */
export function weddingRulesHtml(f = parishRules().fees) {
  return `
<p class="hp-alert"><strong>Very important:</strong> please read everything below. All documents must be <strong>ORIGINAL</strong>.</p>

<div class="hp-wedding">
  <div class="hp-panel">
    <h3 class="hp-panel-title"><span class="hp-letter">A</span> Basic Requirements <small>(all couples)</small></h3>
    <ol class="hp-numbered">
      <li>Newly issued (within 6 months) <strong>Baptismal Certificates</strong> of the groom and bride from the church where they were baptized, with the notation: <em>For Marriage Purposes</em>.</li>
      <li><strong>Confirmation Certificates</strong> of the groom and bride from the church where they received the Sacrament of Confirmation, with the notation: <em>For Marriage Purposes</em>.</li>
      <li><strong>Marriage License</strong> issued by the Civil Registrar of the city or town of either the bride or groom.</li>
      <li>If the couple has been civilly married: a copy of the <strong>Marriage Contract</strong> from the Philippine Statistics Authority.</li>
      <li>If the couple has been living-in for five years or more: 4 copies of an <strong>Affidavit of Cohabitation</strong>.</li>
      <li><strong>Birth Certificates</strong> of the groom and bride issued by the Philippine Statistics Authority.</li>
      <li><strong>Single Status Certificates</strong> (Civil Status Certificate of No Marriage / CENOMAR) of the groom and bride issued by the Philippine Statistics Authority.</li>
      <li>Four (4) copies of a newly taken (within 6 months) <strong>2×2 inch ID photo</strong> of the groom and bride.</li>
      <li><strong>Canonical Interview</strong> of the groom and bride, conducted at least 1 month before the wedding date.</li>
      <li><strong>Ecclesiastical Banns</strong> — announcement/publication of the marriage in the parishes of the groom and bride. The forms will be provided by this parish; please bring them to your respective parishes and return them after publication.</li>
      <li><strong>Permit from the parish of the bride</strong>, if she does not belong to this parish. The appropriate form will be provided by our parish office.</li>
      <li><strong>Pre-Cana Seminar</strong> to be attended by the groom and bride.</li>
      <li>A list of the sponsors with their complete addresses, submitted in typewritten form. (Note: <strong>6 pairs only</strong>.)</li>
      <li>It is highly recommended that the groom and bride receive the Sacrament of Penance (confession) for a fruitful reception of the Sacrament of Marriage.</li>
    </ol>
  </div>

  <aside class="hp-glance">
    <p class="hp-glance-label">At a Glance</p>
    <h3>Church Wedding Fee</h3>
    <p class="hp-glance-price">${peso(f.weddingTotal)}</p>
    <ul>
      <li>${peso(f.weddingDown)} non-refundable down payment upon reservation</li>
      <li>Balance due 1 month before the wedding</li>
      <li>Includes: church, candles, servers, coordinator, organist &amp; soloist, aisle flowers, priest’s stipend, document processing</li>
      <li>Book at least <strong>3 months</strong> ahead</li>
      <li>Requirements complete <strong>2 weeks</strong> before the date</li>
      <li>Sponsors: <strong>6 pairs only</strong>, typewritten list with addresses</li>
    </ul>
    <p class="hp-glance-fine">Prices are subject to change without prior notice.</p>
    <a class="hp-btn hp-btn-gold" data-contact="email-inquiry" href="mailto:ourladyofatimaparish74@gmail.com?subject=Wedding%20Inquiry">Email a Wedding Inquiry</a>
    <p class="hp-glance-fine">or call the Parish Office <a data-contact="phone-link" href="tel:+63287117200"><span data-contact="phone">(02) 8711-7200</span></a></p>
  </aside>
</div>

<h3 class="hp-subhead">Additional Requirements</h3>
<p class="hp-muted hp-subhead-note">Open the case that applies to you.</p>
<div class="hp-accordion">
  <details>
    <summary><span class="hp-letter">B</span> Previous Marriage</summary>
    <ol class="hp-numbered">
      <li>A Certified True Copy of the Marriage Contract, duly annotated (of court decision), from the Philippine Statistics Authority.</li>
      <li>A widower or widow must present the Death Certificate of his/her deceased partner from the Philippine Statistics Authority.</li>
      <li>Those whose marriage has been annulled must present the Document of Nullity from the competent Matrimonial Tribunal, and the Court Annulment Decision with Certificate of Finality, with a letter of approval from the Chancery Office of the Diocese of Cubao (41 Lantana St., Cubao, Quezon City).</li>
      <li>Those whose civil marriage has been annulled must present the Court Annulment Decision with Certificate of Finality.</li>
      <li>A divorcee must present a Certified True Copy of the Decree of Divorce from the County Court Recorder.</li>
    </ol>
  </details>
  <details>
    <summary><span class="hp-letter">C</span> Marriage with a Foreigner</summary>
    <ol class="hp-numbered">
      <li>Photocopy of Passport.</li>
      <li>Search of Marriage (Proof of Singleness) from the State or Country Recorder / Registry of Marriages abroad.</li>
      <li>Photocopy of the ACR/ICR for resident foreigners in the Philippines.</li>
      <li>Newly issued “Certification of Freedom to Marry” from his/her present parish priest abroad, certifying that he/she has no trace of marriage found in the parish registry and no canonical impediment to contract marriage in the Roman Catholic Church.</li>
      <li>A Certificate of Legal Capacity to Marry or Embassy Clearance from the foreigner’s consulate/embassy.</li>
      <li>A Letter of Clearance from the Chancery Office of the Diocese of Cubao (41 Lantana St., Cubao, Quezon City).</li>
    </ol>
  </details>
  <details>
    <summary><span class="hp-letter">D</span> Catholic &amp; Non-Catholic</summary>
    <ol class="hp-numbered">
      <li>Newly issued certificate of baptism or dedication, or certification of being a bona fide member of a non-Catholic religion.</li>
      <li>A newly issued “Certification of No Impediment” from his/her present pastor, certifying that he/she is free from any marriage impediment and is allowed to get married in the Roman Catholic Church.</li>
      <li>Additional canonical forms for the application of marriage clearance:
        <ul class="hp-sublist">
          <li>I. Formula for mixed marriage (disparity of worship/cult) — declaration of promise by the Catholic party</li>
          <li>II. Request letter for Mass (from the couple)</li>
          <li>III. Endorsement letter from the Parish Priest</li>
          <li>IV. Result of Canonical Interview/Interrogation</li>
          <li>V. Marriage Expectation Inventory</li>
          <li>VI. Affidavit of the applicant’s freedom to marry — must be executed before a priest-interviewer together with two witnesses: (a) an immediate family member and (b) a friend of at least five years (bride &amp; groom)</li>
        </ul>
      </li>
      <li>Publication of Banns for the Catholic party.</li>
      <li>For No Religion / Iglesia Ni Cristo / Muslim: a notarized “Affidavit of Affirmation for the Religion and Singleness.”</li>
      <li>Dispensation for mixed religion or <em>disparitas cultus</em> from the Chancery Office of the Diocese of Cubao (41 Lantana St., Cubao, Quezon City).</li>
    </ol>
  </details>
  <details>
    <summary><span class="hp-letter">E</span> Immigrants / Permanent Residents Abroad</summary>
    <ol class="hp-numbered">
      <li>Photocopy of the Permanent Resident ID for an immigrant / permanent resident abroad.</li>
      <li>Photocopy of Proof of Residency abroad.</li>
      <li>Photocopy of Passport.</li>
      <li>Search of Marriage (Proof of Singleness) from the State or Country Recorder / Registry of Marriages abroad.</li>
      <li>Newly issued “Certification of Freedom to Marry” from his/her present parish priest abroad, certifying that he/she has no trace of marriage found in the parish registry and no canonical impediment to contract marriage in the Roman Catholic Church.</li>
      <li>A Letter of Clearance from the Chancery Office of the Diocese of Cubao (41 Lantana St., Cubao, Quezon City).</li>
    </ol>
  </details>
  <details>
    <summary><span class="hp-letter">F</span> Seafarers</summary>
    <ol class="hp-numbered">
      <li>Photocopy of Passport, Seaman’s Book and Company ID.</li>
      <li>Newly issued “Certification of Affirmation of No Claimed Marriage” from the ship captain or company, certifying that there is no known marriage and no impediment to contract marriage.</li>
    </ol>
  </details>
</div>

<div class="hp-panel hp-rules">
  <h3 class="hp-panel-title"><span class="hp-letter">G</span> Parish Regulations</h3>
  <ol class="hp-numbered hp-cols">
    <li>Bookings and reservations are to be made at least <strong>three (3) months</strong> before the scheduled date to give ample time for preparations and processing of documents. Please inform us in writing of any changes in date or time as early as possible through e-mail or fax.</li>
    <li>A non-refundable <strong>${peso(f.weddingDown)}.00 down payment</strong> is made and the contract signed for reservation.</li>
    <li>We charge a total of <strong>${peso(f.weddingTotal)}.00</strong> for the wedding (price is subject to change without prior notice). This includes use of the church, candles, servers, church coordinator, organist and soloist during the Mass (pictorial not included), flowers (aisle only), stipend for the officiating priest, and processing of documents. The balance must be paid one (1) month before the wedding.</li>
    <li>All requirements must be completed at least <strong>two (2) weeks</strong> before the date of the wedding. We reserve the right to cancel a wedding if the requirements are not complete.</li>
    <li>If you get your own priest, please advise us a month before, in writing, of his full name, title or designation, the number and expiry date of his Authority to Solemnize Marriages (with photocopy), a photocopy of his Faculty from the Diocese of Cubao, and his Celebret ID.</li>
    <li>If you prepare your own missalette, please follow the official rites from the parish.</li>
    <li>Please observe basic rules of decency in dress for the entire entourage.</li>
    <li>Throwing of confetti or rice and use of a fog machine are <strong>not allowed</strong>.</li>
    <li>Only liturgical songs are to be sung during the Mass. Love songs and other secular songs may be sung after the rites (during the contract signing, picture taking, etc.).</li>
    <li>Punctuality is a must — the wedding ceremony should start as scheduled. Please be aware that there may be other church services scheduled.</li>
  </ol>
  <div class="hp-provide">
    <h4>The couple must provide the following:</h4>
    <ul class="hp-check">
      <li><strong>Offerings:</strong> one pair of candles in glass, bread and wine (host and Mass wine), and any kind offering such as fruits, goods, etc.</li>
      <li>Wedding rings, arrhae, Bible (optional), veil, cord, and match or lighter.</li>
    </ul>
  </div>
</div>`;
}

/* The Preparation Checklist: short forms of the rules above, ticked by staff.
   Item ids are saved on each request, so keep an id when only its wording changes. */
export const baptismChecklist = (f = parishRules().fees) => [
  ['birth-cert', 'Child’s birth certificate (CTC or PSA)'],
  ['parents-marriage', 'Parents’ marriage contract, if married (CTC or PSA)'],
  ['permission', 'Letter of Permission from the Parish Priest (if not from this parish)'],
  ['application', 'Application form filled up by a parent'],
  ['parents-id', 'Parents’ proof of identity / ID'],
  ['no-record', 'Certificate of No Baptismal Record from 3 nearby parishes (2 years old and above)'],
  ['seminar', 'Saturday 4:00 PM Catechism/Seminar attended (parents and at least 1 pair of sponsors)'],
  ['sponsor-docs', 'Sponsors are baptized and confirmed Catholics, 18 years old and above'],
  ['fee', `Fee settled (Public/Common ${peso(f.baptismPublic)} / Private/Solo ${peso(f.baptismPrivate)})`],
];

export const weddingChecklist = (f = parishRules().fees) => [
  ['baptismal-certs', 'Baptismal certificates, for marriage purposes, issued within 6 months (both)'],
  ['confirmation-certs', 'Confirmation certificates, for marriage purposes (both)'],
  ['birth-certs', 'PSA birth certificates (both)'],
  ['cenomar', 'CENOMAR from PSA (both)'],
  ['license', 'Marriage license (or PSA marriage contract / affidavit of cohabitation)'],
  ['photos', '2×2 ID photos, 4 copies each (taken within 6 months)'],
  ['interview', 'Canonical interview (at least 1 month before the wedding)'],
  ['banns', 'Ecclesiastical banns published in both parishes'],
  ['bride-permit', 'Permit from the bride’s parish (if not from this parish)'],
  ['pre-cana', 'Pre-Cana seminar attended'],
  ['sponsors', 'Typewritten list of sponsors with addresses (6 pairs only)'],
  ['down-payment', `${peso(f.weddingDown)} down payment paid and contract signed`],
  ['fee', `${peso(f.weddingTotal - f.weddingDown)} balance settled (1 month before the wedding)`],
];
