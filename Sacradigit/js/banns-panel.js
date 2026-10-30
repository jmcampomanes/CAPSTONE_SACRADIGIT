/* ============================================
   SacraDigit Admin — Marriage banns panel
   Shown inside a Wedding booking on Schedule Offers.
   The Secretary (or Head Admin) publishes the banns
   for three Sundays, prints them for Mass, the
   bulletin board and the other party's parish, and
   can withdraw them. See ../../shared/js/banns.js.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import {
  watchBanns, coupleFromBooking, firstSundayChoices, suggestedFirstSunday, threeSundays, publishBanns, withdrawBanns,
  timeOfAsking, bannsReading, fmtLong, fmtShort, ORDINAL, THIS_PARISH, isoOf,
} from '../../shared/js/banns.js';
import { printReport, esc } from '../../shared/js/print-report.js';
import { confirmDialog } from './admin-ui.js';

const STATUS_DONE = new Set(['declined', 'cancelled']);

export function initBannsPanel(el, { showToast }) {
  let all = [];
  let booking = null;
  let busy = false;

  watchBanns(client, (list) => { all = list; if (booking) render(); });

  const bannsFor = (id) => all.filter(b => b.bookingId === id)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;

  function sundayList(sundays, today) {
    const asking = timeOfAsking(sundays, today);
    return `<ol class="bn-sundays">${sundays.map((s, i) => {
      const state = asking > i + 1 ? 'done' : asking === i + 1 ? 'next' : '';
      return `<li class="${state ? `is-${state}` : ''}"><span>${ORDINAL[i + 1][0].toUpperCase()}${ORDINAL[i + 1].slice(1)}</span>${esc(fmtLong(s))}</li>`;
    }).join('')}</ol>`;
  }

  function formHtml(couple, today, again) {
    const strict = firstSundayChoices(couple.weddingDate, today);
    const loose = strict.length ? strict : firstSundayChoices(couple.weddingDate, today, 1);
    const pick = strict.length ? suggestedFirstSunday(couple.weddingDate, today) : loose[loose.length - 1];
    if (!loose.length) {
      return `<p class="bn-warn">The wedding (${esc(fmtLong(couple.weddingDate))}) is too soon for three Sundays of banns. Ask the parish priest about a dispensation from the banns.</p>`;
    }
    return `
      ${strict.length ? '' : `<p class="bn-warn">The third Sunday will be less than two weeks before the wedding (${esc(fmtShort(couple.weddingDate))}) — the other parish may not return its certificate in time.</p>`}
      <div class="bn-grid">
        <div>
          <label class="form-label" for="bn-groom-parish">Groom’s parish</label>
          <input id="bn-groom-parish" class="form-input" value="${esc(couple.groomParish)}" placeholder="${esc(THIS_PARISH)}" />
        </div>
        <div>
          <label class="form-label" for="bn-bride-parish">Bride’s parish</label>
          <input id="bn-bride-parish" class="form-input" value="${esc(couple.brideParish)}" placeholder="${esc(THIS_PARISH)}" />
        </div>
        <div class="bn-span2">
          <label class="form-label" for="bn-first">First Sunday</label>
          <select id="bn-first" class="form-input">
            ${loose.map(s => `<option value="${s}" ${s === pick ? 'selected' : ''}>${esc(fmtLong(s))}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="bn-preview">${sundayList(threeSundays(pick), today)}</div>
      <p class="bn-hint">Leave a parish blank if that person belongs to ${esc(THIS_PARISH)}. Only the names and parishes are published — not the wedding date or any contact details.</p>
      <div class="bn-actions">
        <button type="button" class="btn-lavender" data-banns="publish">${again ? 'Publish Again' : 'Publish Banns'}</button>
      </div>`;
  }

  function render() {
    if (!booking || booking.type !== 'Wedding') { el.innerHTML = ''; return; }
    const today = isoOf(new Date());
    const couple = coupleFromBooking(booking);
    const b = bannsFor(booking.id);
    const closed = STATUS_DONE.has(booking.status) || (couple.weddingDate && couple.weddingDate < today);
    let inner;

    if (b && b.published && b.sundays) {
      const asking = timeOfAsking(b.sundays, today);
      const status = asking === 4
        ? '<span class="bn-pill is-done">Completed</span>'
        : `<span class="bn-pill is-live">Published · ${asking === 1 ? 'first Sunday coming' : `${ORDINAL[asking]} Sunday coming`}</span>`;
      inner = `
        ${status}
        ${sundayList(b.sundays, today)}
        ${asking === 4
          ? '<p class="bn-hint">Published here on all three Sundays. Tick “Ecclesiastical banns published in both parishes” once the other parish returns its certificate.</p>'
          : '<p class="bn-hint">Showing on the parish website and in the parishioner portal until the third Sunday.</p>'}
        <div class="bn-actions">
          <button type="button" class="btn-secondary" data-banns="print">Print for Mass, Bulletin & Other Parish</button>
          ${asking === 4 || closed ? '' : '<button type="button" class="btn-danger-outline" data-banns="withdraw">Withdraw</button>'}
        </div>`;
    } else if (closed) {
      inner = '<p class="bn-hint">No banns were published for this booking.</p>';
    } else {
      inner = `${b ? '<span class="bn-pill is-off">Withdrawn</span>' : '<p class="bn-hint">Not published yet. Publish them so the three Sundays finish before the wedding.</p>'}
        ${formHtml(couple, today, !!b)}`;
    }

    el.innerHTML = `
      <section class="bn-panel">
        <h4 class="bn-title">Marriage Banns</h4>
        ${inner}
      </section>`;
  }

  el.addEventListener('change', (e) => {
    if (e.target.id !== 'bn-first') return;
    el.querySelector('#bn-preview').innerHTML = sundayList(threeSundays(e.target.value), isoOf(new Date()));
  });

  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-banns]');
    if (!btn || !booking || busy) return;
    const act = btn.dataset.banns;
    const couple = coupleFromBooking(booking);
    const existing = bannsFor(booking.id);

    if (act === 'print') return printBanns(existing);

    busy = true;
    btn.disabled = true;
    try {
      if (act === 'publish') {
        if (!couple.groomName || !couple.brideName) throw new Error('This booking is missing the groom’s or bride’s name.');
        couple.groomParish = el.querySelector('#bn-groom-parish').value.trim();
        couple.brideParish = el.querySelector('#bn-bride-parish').value.trim();
        const first = el.querySelector('#bn-first').value;
        await publishBanns(client, couple, first, existing?.id || null);
        showToast('Banns published — they’re on the parish website and in the portal now.');
      } else if (act === 'withdraw') {
        const sure = await confirmDialog({
          title: 'Withdraw these banns?',
          message: 'They come down from the parish website and the parishioner portal. You can publish them again later.',
          confirmLabel: 'Withdraw',
          tone: 'danger',
        });
        if (!sure) return;
        await withdrawBanns(client, existing.id);
        showToast('Banns withdrawn.');
      }
    } catch (err) {
      console.error('Banns update failed:', err);
      showToast(err.message || 'Couldn’t update the banns.', true);
    } finally {
      busy = false;
      btn.disabled = false;
    }
  });

  return {
    render(o) { booking = o; render(); },
    clear() { booking = null; el.innerHTML = ''; },
  };
}

/* ---------- printout ---------- */

const PRINT_CSS = `
  .bn-page { break-before: page; }
  .bn-read { margin: 0 0 18px; break-inside: avoid; }
  .bn-read h2 { margin-top: 14px; }
  .bn-notice { margin-top: 24px; padding: 28px 30px; border: 3px double #1e2a4a; border-radius: 6px; text-align: center; }
  .bn-notice .k { margin: 0; font-family: 'Cinzel', Georgia, serif; font-size: 22pt; font-weight: 700; letter-spacing: 0.08em; color: #1e2a4a; }
  .bn-notice .names { margin: 18px 0 4px; font-size: 18pt; font-weight: 800; }
  .bn-notice .of { margin: 0; font-size: 11pt; color: #4b5563; }
  .bn-notice .and { margin: 10px 0; font-family: 'Cinzel', Georgia, serif; font-size: 13pt; color: #8a6d1f; }
  .bn-notice .when { margin: 22px 0 0; font-size: 11pt; }
  .bn-notice .imp { margin: 18px auto 0; max-width: 32em; font-size: 11pt; line-height: 1.6; font-style: italic; }
  .bn-letter p { font-size: 11pt; line-height: 1.7; margin: 0 0 10px; }
  .bn-cut { margin: 48px 0 18px; border-top: 1.5px dashed #9ca3af; text-align: center; font-size: 8pt; color: #9ca3af; }
  .bn-cut span { position: relative; top: -0.7em; padding: 0 8px; background: #fff; }
  .bn-blank { display: inline-block; min-width: 9em; border-bottom: 1px solid #111827; }
  .bn-box { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #111827; margin-right: 6px; vertical-align: -1px; }
  .bn-sign { display: flex; gap: 40px; margin-top: 34px; }
  .bn-sign div { flex: 1; text-align: center; font-size: 9pt; color: #4b5563; border-top: 1px solid #111827; padding-top: 4px; }
`;

function printBanns(b) {
  if (!b?.sundays) return;
  const couple = { ...b };
  const readings = b.sundays.map((s, i) => `
    <div class="bn-read">
      <h2>${ORDINAL[i + 1][0].toUpperCase()}${ORDINAL[i + 1].slice(1)} time of asking — ${esc(fmtLong(s))}</h2>
      <p class="flow">${esc(bannsReading(couple, i + 1))}</p>
    </div>`).join('');

  const notice = `
    <div class="bn-page bn-notice">
      <p class="k">Promise of Marriage</p>
      <p class="names">${esc(b.groomName)}</p>
      <p class="of">of ${esc(b.groomParish || THIS_PARISH)}</p>
      <p class="and">and</p>
      <p class="names">${esc(b.brideName)}</p>
      <p class="of">of ${esc(b.brideParish || THIS_PARISH)}</p>
      <p class="when">Banns published on ${b.sundays.map(s => esc(fmtShort(s))).join(' · ')}</p>
      <p class="imp">Anyone who knows of any impediment to this marriage is bound in conscience to make it known to the parish priest.</p>
    </div>`;

  // A request letter + return certificate for each party from another parish.
  const others = [...new Set([b.groomParish, b.brideParish].filter(p => p && p.toLowerCase() !== THIS_PARISH.toLowerCase()))];
  const letters = others.map(parish => `
    <div class="bn-page bn-letter">
      <h2>Request for the Publication of Banns</h2>
      <p>The Parish Priest<br/><strong>${esc(parish)}</strong></p>
      <p>Reverend Father,</p>
      <p>The following persons intend to be married at Our Lady of Fatima Parish, Diocese of Cubao. We respectfully ask that you publish their banns of marriage in your parish on three consecutive Sundays, and return the certificate below to us after the third publication.</p>
      <p style="text-align:center;font-size:13pt;font-weight:700;margin:14px 0">${esc(b.groomName)} &nbsp;and&nbsp; ${esc(b.brideName)}</p>
      <p>Our parish is publishing them on ${b.sundays.map(s => esc(fmtShort(s))).join(', ')}.</p>
      <div class="bn-sign"><div>Parish Priest, Our Lady of Fatima Parish</div><div>Date</div></div>

      <p class="bn-cut"><span>✂ cut here and return to Our Lady of Fatima Parish, 57 L. Castillo St., Don Manuel, Quezon City</span></p>

      <h2>Certificate of Publication of Banns</h2>
      <p>This is to certify that the banns of marriage between <strong>${esc(b.groomName)}</strong> and <strong>${esc(b.brideName)}</strong> were published in <strong>${esc(parish)}</strong> on
        <span class="bn-blank"></span>, <span class="bn-blank"></span> and <span class="bn-blank"></span>, and that</p>
      <p><span class="bn-box"></span>no impediment was found.</p>
      <p><span class="bn-box"></span>the following impediment was found: <span class="bn-blank" style="min-width:20em"></span></p>
      <div class="bn-sign"><div>Parish Priest</div><div>Parish Seal</div><div>Date</div></div>
    </div>`).join('');

  printReport({
    title: 'Marriage Banns',
    subtitle: `${b.groomName} & ${b.brideName}`,
    chips: [['Sundays', b.sundays.map(fmtShort).join(' · ')]],
    className: 'reader',
    body: `<style>${PRINT_CSS}</style>
      <p class="note">Read at every Mass on each of these Sundays. The next page is the notice for the bulletin board${others.length ? `, followed by the request letter for ${others.length === 1 ? 'the other parish' : 'the other parishes'}` : ''}.</p>
      ${readings}${notice}${letters}`,
  });
}
