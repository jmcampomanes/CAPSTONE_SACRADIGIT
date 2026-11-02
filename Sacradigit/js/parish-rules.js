/* ============================================
   SacraDigit Admin — Parish Rules & Fees
   Runs after dashboard.js. The Head Admin edits the
   fees, address, map pin and time limits that every
   page reads from ../../shared/js/parish-rules.js.
   The Secretary sees them read-only (permissions.js).
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { currentUser, currentUserName } from '../../shared/js/auth.js';
import { DEFAULT_RULES, FEE_LABELS, loadParishRules, parishRules, saveParishRules, parishSettingsReady } from '../../shared/js/parish-rules.js';
import { can } from '../../shared/js/permissions.js';
import { showToast } from './admin-ui.js';

const DAY_FIELDS = [
  ['paymentDeadlineDays', 'Days to pay after temporary approval'],
  ['freeCancelDays', 'Free cancellation until (days before)'],
  ['serverScoutDays', 'Admins start filling server slots (days before)'],
  ['serverSignupCloseDays', 'Server sign-ups close (days before)'],
];

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const editable = can(currentUser(), 'parishRules', 'edit') && parishSettingsReady(client);

  $('pr-unavailable').classList.toggle('hidden', parishSettingsReady(client));

  $('pr-fees').innerHTML = Object.entries(FEE_LABELS).map(([key, label]) => `
    <div>
      <label class="form-label" for="pr-fee-${key}">${esc(label)}</label>
      <input type="number" min="0" id="pr-fee-${key}" class="form-input" />
    </div>`).join('');
  $('pr-days').innerHTML = DAY_FIELDS.map(([key, label]) => `
    <div>
      <label class="form-label" for="pr-${key}">${esc(label)}</label>
      <input type="number" min="0" id="pr-${key}" class="form-input" />
    </div>`).join('');

  const bandRow = (band = {}) => `
    <div class="pr-band">
      <div><label class="form-label">Up to (km)</label><input type="number" min="0" step="0.5" class="form-input" data-band="upToKm" value="${esc(band.upToKm ?? '')}" /></div>
      <div><label class="form-label">Added fee (₱)</label><input type="number" min="0" class="form-input" data-band="surcharge" value="${esc(band.surcharge ?? '')}" /></div>
      <button type="button" class="btn-secondary" data-band-remove>Remove</button>
    </div>`;

  function fill(r) {
    $('pr-address').value = r.address;
    $('pr-lat').value = r.pin.lat;
    $('pr-lng').value = r.pin.lng;
    Object.keys(FEE_LABELS).forEach(k => { $(`pr-fee-${k}`).value = r.fees[k]; });
    DAY_FIELDS.forEach(([k]) => { $(`pr-${k}`).value = r[k]; });
    $('pr-refund').value = r.refundTerms || '';
    $('pr-bands').innerHTML = r.distanceBands.map(bandRow).join('');
    $('pr-bands-empty').classList.toggle('hidden', r.distanceBands.length > 0);
    document.querySelectorAll('#pr-form input, #pr-form textarea, #pr-form button').forEach(el => { el.disabled = !editable; });
    $('pr-actions').classList.toggle('hidden', !editable);
  }

  $('pr-band-add').addEventListener('click', () => {
    $('pr-bands').insertAdjacentHTML('beforeend', bandRow());
    $('pr-bands-empty').classList.add('hidden');
  });
  $('pr-bands').addEventListener('click', (e) => { if (e.target.matches('[data-band-remove]')) e.target.closest('.pr-band').remove(); });

  function readForm() {
    const fees = Object.fromEntries(Object.keys(FEE_LABELS).map(k => [k, Number($(`pr-fee-${k}`).value)]));
    const bands = [...document.querySelectorAll('.pr-band')].map(row => ({
      upToKm: Number(row.querySelector('[data-band="upToKm"]').value),
      surcharge: Number(row.querySelector('[data-band="surcharge"]').value),
    })).sort((a, b) => a.upToKm - b.upToKm);
    return {
      ...parishRules(),
      address: $('pr-address').value.trim(),
      pin: { lat: Number($('pr-lat').value), lng: Number($('pr-lng').value) },
      fees,
      ...Object.fromEntries(DAY_FIELDS.map(([k]) => [k, Number($(`pr-${k}`).value)])),
      refundTerms: $('pr-refund').value.trim(),
      distanceBands: bands,
    };
  }

  $('pr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = readForm();
    if (!next.address || !Number.isFinite(next.pin.lat) || !Number.isFinite(next.pin.lng)) { showToast('Please check the address and map pin.', true); return; }
    if (Object.values(next.fees).some(v => !(v >= 0))) { showToast('Fees can’t be blank or negative.', true); return; }
    if (next.fees.weddingDown > next.fees.weddingTotal) { showToast('The down payment can’t be more than the wedding total.', true); return; }
    if (next.distanceBands.some(b => !(b.upToKm > 0) || !(b.surcharge >= 0))) { showToast('Each distance band needs a distance and a fee.', true); return; }
    $('pr-save').disabled = true;
    try {
      await saveParishRules(client, next, currentUserName());
      showToast('Parish rules saved.');
    } catch (err) {
      console.error('Failed to save parish rules:', err);
      showToast(err.message || "Couldn't save the parish rules.", true);
    } finally {
      $('pr-save').disabled = false;
    }
  });

  $('pr-reset').addEventListener('click', () => fill(JSON.parse(JSON.stringify(DEFAULT_RULES))));

  fill(await loadParishRules(client));
});
