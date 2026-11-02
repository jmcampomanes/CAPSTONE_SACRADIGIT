/* ============================================
   SacraDigit — Requirements & Rules (parishioner)
   Runs after user-shell.js. Shows what the parish
   publishes about Baptism and Weddings, from the same
   copy as the homepage (shared/js/sacrament-rules.js),
   plus the public baptism dates announced so far.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { baptismRulesHtml, weddingRulesHtml } from '../../shared/js/sacrament-rules.js';
import { loadParishRules } from '../../shared/js/parish-rules.js';
import { watchDates, upcomingDates, fmtLong, fmtShort } from '../../shared/js/public-baptism.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderRules() {
    $('req-baptism-rules').innerHTML = baptismRulesHtml();
    $('req-wedding-rules').innerHTML = weddingRulesHtml();
  }
  renderRules();
  loadParishRules(client).then(renderRules);

  function showTab(key) {
    ['baptism', 'wedding'].forEach(k => {
      $(`req-tab-${k}`).setAttribute('aria-selected', String(k === key));
      $(`req-tab-${k}`).classList.toggle('active', k === key);
      $(`req-panel-${k}`).classList.toggle('hidden', k !== key);
    });
  }
  $('req-tab-baptism').addEventListener('click', () => showTab('baptism'));
  $('req-tab-wedding').addEventListener('click', () => showTab('wedding'));
  if (location.hash === '#marriage') showTab('wedding');

  watchDates(client, (dates) => {
    const list = upcomingDates(dates);
    $('req-public-dates').classList.toggle('hidden', !list.length);
    $('req-public-dates-list').innerHTML = list.map(d => `
      <li><strong>${esc(fmtLong(d.date))}</strong> ${esc(d.time)}, ${esc(d.location)}.
        Register by ${esc(fmtShort(d.closesOn))}.${d.note ? ` ${esc(d.note)}` : ''}</li>`).join('');
  });
});
