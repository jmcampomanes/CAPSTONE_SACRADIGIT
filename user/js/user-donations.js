/* ============================================
   SacraDigit — User Donations Scripts (AWS Amplify)
   Runs after user-shell.js.
   Fund totals are computed live from actual
   Donation records (sum by purpose) instead of
   static numbers. "My Giving History" filters
   client-side by donor === hardcoded demo name.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { loadDonationTotals } from '../../shared/js/public-data.js';
import { currentUserName } from '../../shared/js/auth.js';
import { mountFaithfulGivers } from './faith-journey-widgets.js';
import { loadParishContact } from '../../shared/js/parish-info.js';
import { PAYMENT_ACCOUNTS, CONFIRM_WITHIN } from '../../shared/js/donation-payment-info.js';
import { withAmount, qrPhField } from '../../shared/js/qrph.js';
import QRCode from 'qrcode';
import { downloadDonationReceipt } from '../../shared/js/donation-receipt.js';

document.addEventListener('DOMContentLoaded', () => {

  mountFaithfulGivers(document.getElementById('fj-faithful-givers'));

  const DONOR_NAME = currentUserName(); // the signed-in parishioner (auth.js)
  const monthPrefix = new Date().toISOString().slice(0, 7);

  const fundDefs = [
    { id: 'sunday', name: 'Sunday Collection', desc: 'General parish fund for operations, utilities, and ministry.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>` },
    { id: 'building', name: 'Building Fund', desc: 'Supports construction, maintenance, and improvements to parish structures.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1"/></svg>` },
    { id: 'poor-box', name: 'Poor Box', desc: 'Directly supports parishioners in need and charitable outreach programs.',
      iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
    { id: 'youth', name: 'Youth Ministry', desc: 'Funds retreats, formations, and youth activities throughout the year.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3.5-5.93"/></svg>` },
  ];

  let allDonations = [];
  // Parish-wide totals per fund/goal, without names (see public-data.js)
  let fundTotals = {};
  const refreshTotals = () => loadDonationTotals()
    .then(t => { fundTotals = t; renderFundGrid(); renderGoalGrid(); })
    .catch(err => console.error('Failed to load fund totals:', err));
  setTimeout(refreshTotals, 0);
  setInterval(refreshTotals, 60000);
  let myDonations = [];
  let goals = []; // fundraising goals, kept in sync via observeQuery

  // Looked up early (before any observeQuery fires) so renderGoalGrid can
  // safely reference them from inside the Donation subscription below.
  const goalsSection = document.getElementById('goals-section');
  const goalGrid      = document.getElementById('goal-grid');

  function formatPeso(n) { return '₱' + (n || 0).toLocaleString('en-US'); }
  function formatShortDate(input) {
    if (!input) return '';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  client.models.Donation.observeQuery().subscribe({
    next: ({ items }) => {
      allDonations = items;
      myDonations = items.filter(d => d.donor === DONOR_NAME);
      renderFundGrid();
      renderGoalGrid();
      renderStats();
      renderHistory();
    },
    error: (err) => {
      console.error('Failed to load donations:', err);
      document.getElementById('history-tbody').innerHTML = `<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">Couldn't load donations.</td></tr>`;
    },
  });

  function fundTotal(fundName) {
    return fundTotals[fundName] || 0;
  }


  /* ------------------------------------------
     FUNDRAISING GOALS
     A goal tracks progress toward a specific,
     one-time need (e.g. "New Church Bell —
     ₱10,000") set up by the parish office on the
     admin side. Progress reuses the same live-sum
     approach as the recurring funds above — a
     donation with purpose === the goal's name
     counts toward it — so giving to a goal is just
     giving with that goal's name as the purpose.
  ------------------------------------------ */
  if (!client.models.DonationGoal) {
    console.error('DonationGoal model is missing from the deployed backend schema (amplify_outputs.json). Fundraising Goals will stay hidden until this model is added to the backend.');
    if (goalsSection) goalsSection.classList.add('hidden');
  } else {
    client.models.DonationGoal.observeQuery().subscribe({
      next: ({ items }) => {
        goals = items.filter(g => g.active !== false);
        renderGoalGrid();
      },
      error: (err) => {
        console.error('Failed to load fundraising goals:', err);
        if (goalsSection) goalsSection.classList.add('hidden');
      },
    });
  }

  function formatShortDeadline(iso) {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderGoalGrid() {
    if (!client.models.DonationGoal || !goalsSection) return;

    if (goals.length === 0) {
      goalsSection.classList.add('hidden');
      return;
    }
    goalsSection.classList.remove('hidden');

    goalGrid.innerHTML = goals.map(g => {
      const raised  = fundTotal(g.name);
      const target  = g.targetAmount || 0;
      const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
      const reached = target > 0 && raised >= target;

      return `
        <div class="donation-goal-card ${reached ? 'reached' : ''}">
          <div class="goal-card-top">
            <p class="goal-name">${escapeHtml(g.name)}</p>
            ${reached ? '<span class="goal-badge-reached">Goal Reached</span>' : ''}
          </div>
          ${g.description ? `<p class="goal-desc">${escapeHtml(g.description)}</p>` : ''}
          ${g.deadline ? `
            <div class="goal-deadline">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              By ${formatShortDeadline(g.deadline)}
            </div>` : ''}
          <div class="goal-progress-wrap">
            <div class="goal-progress-numbers">
              <span class="goal-progress-raised">${formatPeso(raised)}</span>
              <span class="goal-progress-target">of ${formatPeso(target)}</span>
            </div>
            <div class="goal-progress-track">
              <div class="goal-progress-fill" style="width: ${percent}%"></div>
            </div>
            <p class="goal-progress-percent">${percent}% funded</p>
          </div>
          <button type="button" class="btn-lavender goal-give-btn" data-goal-id="${g.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            ${reached ? 'Give More' : 'Give to this Goal'}
          </button>
        </div>`;
    }).join('');

    goalGrid.querySelectorAll('.goal-give-btn').forEach(btn => {
      btn.addEventListener('click', () => openModal('goal-' + btn.dataset.goalId));
    });
  }

  function renderFundGrid() {
    const grid = document.getElementById('fund-grid');
    grid.innerHTML = fundDefs.map(f => `
      <button type="button" class="fund-card" data-fund-id="${f.id}">
        <div class="fund-icon" style="background-color:${f.iconBg};color:${f.iconColor};">${f.icon}</div>
        <p class="fund-name">${f.name}</p>
        <p class="fund-desc">${f.desc}</p>
        <p class="fund-total">${formatPeso(fundTotal(f.name))} raised</p>
      </button>`).join('');

    grid.querySelectorAll('.fund-card').forEach(card => card.addEventListener('click', () => openModal(card.dataset.fundId)));
  }

  function renderStats() {
    const total   = myDonations.reduce((s, d) => s + (d.amount || 0), 0);
    const monthly = myDonations.filter(d => (d.date || '').startsWith(monthPrefix)).reduce((s, d) => s + (d.amount || 0), 0);
    document.getElementById('stat-total').textContent = formatPeso(total);
    document.getElementById('stat-month').textContent = formatPeso(monthly);
    document.getElementById('stat-month-sub').textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('stat-count').textContent = myDonations.length;
  }

  function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    const empty  = document.getElementById('history-empty');
    const count   = document.getElementById('history-count');

    count.textContent = `${myDonations.length} transaction${myDonations.length === 1 ? '' : 's'}`;

    if (myDonations.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const sorted = myDonations.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(d => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(d.purpose)}</td>
        <td class="donation-amount">${formatPeso(d.amount)}</td>
        <td><span class="payment-pill">${escapeHtml(d.method)}</span></td>
        <td class="text-gray-400">${formatShortDate(d.date)}</td>
        <td><button type="button" class="btn-download-receipt" data-id="${d.id}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>Receipt
        </button></td>
      </tr>`).join('');
  }

  document.getElementById('history-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-download-receipt');
    if (btn) downloadReceipt(btn.dataset.id, btn);
  });

  async function downloadReceipt(id, btn) {
    const d = myDonations.find(x => x.id === id);
    if (!d || btn.disabled) return;

    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    try {
      await downloadDonationReceipt({
        ref: `SD-${(d.date || '').replace(/-/g, '')}-${d.id.slice(0, 6).toUpperCase()}`,
        date: d.date,
        donor: d.anonymous ? 'Anonymous Donor' : DONOR_NAME,
        purpose: d.purpose,
        amount: d.amount,
        method: d.method,
        contact,
      });
      window.showToast(`Receipt downloaded for ${formatPeso(d.amount)} to ${d.purpose}.`);
    } catch (err) {
      console.error('Failed to make receipt:', err);
      window.showToast('Couldn\'t make the receipt. Please try again.', true);
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  /* ------------------------------------------
     GIVE AN OFFERING — its own page, 3 steps like Mass Intentions:
     1 Fund → 2 Amount & Payment → 3 Confirm, then a
     "Now send your offering" screen that says exactly what to do
     for the chosen method (GCash / Maya / bank / cash), so nobody
     wonders whether money has already left their account.
  ------------------------------------------ */
  const modal          = document.getElementById('donate-modal');
  const fundSelector    = document.getElementById('donate-fund-selector');
  const amountInput      = document.getElementById('donate-amount');
  const anonymousCheck    = document.getElementById('donate-anonymous');
  const stepBar           = document.getElementById('donate-step-bar');
  const steps              = [...modal.querySelectorAll('.mi-step[data-step]')];
  const dots                = [...stepBar.querySelectorAll('.mstep-dot')];
  const reviewEl             = document.getElementById('donate-review');
  const nextPanel             = document.getElementById('donate-next');
  const backBtn                = document.getElementById('donate-back');
  const nextBtn                 = document.getElementById('donate-next-btn');
  const submitBtn                = document.getElementById('donate-submit');
  const doneBtn                   = document.getElementById('donate-done');

  let selectedFundId = null;
  let selectedMethod  = 'GCash';
  let step = 1;
  let furthest = 1;

  // Office phone / hours / address for the "what to do next" steps (ParishInfo, see ../../shared/js/parish-info.js)
  let contact = null;
  loadParishContact(client).then(c => { contact = c; });
  const officePhone = () => contact?.phone || '(+63) 976-533-7298';

  // Recurring funds plus active fundraising goals, combined into one list
  // so a goal ("New Church Bell") is just another purpose a donor can pick
  // — giving to it works exactly like giving to a fund.
  function givingOptions() {
    return [...fundDefs, ...goals.map(g => ({ id: 'goal-' + g.id, name: g.name }))];
  }

  function populateFundSelector(preSelectId = null) {
    fundSelector.innerHTML = givingOptions().map(f => `<button type="button" class="donate-fund-btn ${f.id === preSelectId ? 'selected' : ''}" data-fund-id="${f.id}" aria-pressed="${f.id === preSelectId}">${escapeHtml(f.name)}</button>`).join('');
    selectedFundId = preSelectId || null;
  }
  fundSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.donate-fund-btn');
    if (!btn) return;
    fundSelector.querySelectorAll('.donate-fund-btn').forEach(b => { b.classList.toggle('selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    fundSelector.classList.remove('has-error');
    selectedFundId = btn.dataset.fundId;
  });

  document.getElementById('quick-amounts').addEventListener('click', e => {
    const btn = e.target.closest('.quick-amount-btn');
    if (!btn) return;
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    amountInput.value = btn.dataset.amount;
    amountInput.classList.remove('border-red-400');
  });

  amountInput.addEventListener('input', () => document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.toggle('selected', b.dataset.amount === amountInput.value)));

  document.getElementById('payment-method-grid').addEventListener('click', e => {
    const btn = e.target.closest('.payment-method-btn');
    if (!btn) return;
    document.querySelectorAll('.payment-method-btn').forEach(b => { b.classList.toggle('selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    selectedMethod = btn.dataset.method;
  });

  const methodLabel = (m) => m === 'Cash' ? 'Cash at the parish office' : m;

  /* --- moving between steps --- */
  function go(n) {
    step = Math.max(1, Math.min(3, n));
    furthest = Math.max(furthest, step);
    steps.forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== step));
    nextPanel.classList.add('hidden');
    stepBar.classList.remove('hidden');
    dots.forEach(d => {
      const k = Number(d.dataset.step);
      d.classList.toggle('is-current', k === step);
      d.classList.toggle('is-done', k < furthest && k !== step);
      d.disabled = k > furthest;
      d.setAttribute('aria-current', k === step ? 'step' : 'false');
    });
    if (step === 3) renderReview();
    backBtn.textContent = step === 1 ? 'Cancel' : '← Back';
    backBtn.classList.remove('hidden');
    nextBtn.classList.toggle('hidden', step === 3);
    nextBtn.textContent = step === 1 ? 'Next: Amount →' : 'Next: Confirm →';
    submitBtn.classList.toggle('hidden', step !== 3);
    doneBtn.classList.add('hidden');
    modal.querySelector('.mi-page-body').scrollTop = 0;
  }

  function finishStep1() {
    if (selectedFundId) return true;
    fundSelector.classList.add('has-error');
    window.showToast('Tap the fund you would like to give to.', true);
    return false;
  }
  function finishStep2() {
    const amount = parseInt(amountInput.value, 10);
    if (amount > 0) return true;
    amountInput.classList.add('border-red-400');
    amountInput.addEventListener('input', () => amountInput.classList.remove('border-red-400'), { once: true });
    window.showToast('Tap an amount, or type how much you would like to give.', true);
    amountInput.focus({ preventScroll: true });
    return false;
  }

  function renderReview() {
    const fund = givingOptions().find(f => f.id === selectedFundId);
    const row = (dt, dd, cls = '') => `<div><dt>${dt}</dt><dd${cls ? ` class="${cls}"` : ''}>${dd}</dd></div>`;
    reviewEl.innerHTML = `
      <div class="mi-review-card">
        <div class="mi-review-head"><span>Your offering</span><button type="button" class="mi-link" data-goto="2">Change</button></div>
        <dl class="mi-review-rows">
          ${row('Fund', `${escapeHtml(fund?.name || '')} <button type="button" class="mi-link donate-inline-change" data-goto="1">Change</button>`)}
          ${row('Paying by', escapeHtml(methodLabel(selectedMethod)))}
          ${row('Name shown', anonymousCheck.checked ? 'Anonymous' : escapeHtml(DONOR_NAME))}
          ${row('Amount', formatPeso(parseInt(amountInput.value, 10) || 0), 'mi-review-total')}
        </dl>
      </div>`;
  }

  nextBtn.addEventListener('click', () => {
    if (step === 1 && finishStep1()) go(2);
    else if (step === 2 && finishStep2()) go(3);
  });
  backBtn.addEventListener('click', () => { if (step === 1) closeModal(); else go(step - 1); });
  modal.addEventListener('click', (e) => {
    const target = Number(e.target.closest('[data-goto]')?.dataset.goto || e.target.closest('.mstep-dot:not(:disabled)')?.dataset.step || 0);
    if (!target || target === step || !nextPanel.classList.contains('hidden')) return;
    if (target < step) { go(target); return; }
    if (step === 1 && !finishStep1()) return;
    if (target === 3 && !finishStep2()) { go(2); return; }
    go(target);
  });

  /* --- "Now send your offering": the exact steps for each method --- */
  const copyBtn = (text) => text
    ? ` <button type="button" class="donate-copy" data-copy="${escapeHtml(text.replace(/\s+/g, ''))}">Copy</button>` : '';

  function nextStepsHtml({ amount, fundName, method, ref }) {
    const peso = `<strong>${formatPeso(amount)}</strong>`;
    const note = `<strong>${escapeHtml(ref)}</strong>`;
    const call = `call the parish office at <a href="tel:${officePhone().replace(/[^\d+]/g, '')}">${escapeHtml(officePhone())}</a>`;
    const acct = PAYMENT_ACCOUNTS[method] || {};
    // GCash / Maya: a QR with this offering's amount already filled in.
    const qr = (method === 'GCash' || method === 'Maya') && acct.qr ? withAmount(acct.qr, amount) : null;
    let items;
    let qrBlock = '';

    if (qr) {
      const payee = acct.accountName || qrPhField(qr, '59');
      qrBlock = `
      <figure class="donate-qr">
        <div class="donate-qr-code" data-qr="${escapeHtml(qr)}" role="img" aria-label="${method} QR code for ${formatPeso(amount)}"></div>
        <figcaption>
          <span class="donate-qr-amount">${formatPeso(amount)}</span>
          <span class="donate-qr-to">to ${escapeHtml(payee)} · ${method}</span>
        </figcaption>
        <button type="button" class="donate-qr-save" data-qr-name="SacraDigit-${method}-${escapeHtml(ref)}.png">Save QR to phone</button>
      </figure>`;
      items = [
        `Open the <strong>${method}</strong> app and tap <strong>${method === 'GCash' ? 'QR' : 'Scan'}</strong>.`,
        `Scan the QR code above. On this same phone? Tap <strong>Save QR to phone</strong>, then choose <strong>Upload QR</strong> in ${method} and pick it from your gallery.`,
        `Check that the amount shows ${peso}, then send.`,
        `In the message box, type ${note} so the office knows it's yours.`,
        `Keep the receipt screen (take a screenshot) until the office confirms.`,
      ];
    } else if (method === 'GCash' || method === 'Maya') {
      const to = acct.number
        ? `<strong>${escapeHtml(acct.number)}</strong>${acct.accountName ? ` (${escapeHtml(acct.accountName)})` : ''}${copyBtn(acct.number)}`
        : `the parish's ${method} number — ${call} to get it`;
      items = [
        `Open the <strong>${method}</strong> app on your phone.`,
        method === 'GCash' ? 'Tap <strong>Send</strong>, then <strong>Express Send</strong>.' : 'Tap <strong>Send money</strong>.',
        `Send ${peso} to ${to}.`,
        `In the message box, type ${note} so the office knows it's yours.`,
        `Keep the receipt screen (take a screenshot) until the office confirms.`,
      ];
    } else if (method === 'Bank Transfer') {
      const to = acct.accountNumber
        ? `<strong>${escapeHtml(acct.bank)}</strong> account <strong>${escapeHtml(acct.accountNumber)}</strong>${acct.accountName ? `, ${escapeHtml(acct.accountName)}` : ''}${copyBtn(acct.accountNumber)}`
        : `the parish's bank account — ${call} for the account number`;
      items = [
        'Open your bank\'s app, or go to your bank.',
        `Transfer ${peso} to ${to}.`,
        `Put ${note} in the notes or reference box.`,
        'Keep your transfer receipt until the office confirms.',
      ];
    } else {
      const hours = contact?.officeHours?.en ? ` (open ${escapeHtml(contact.officeHours.en)})` : '';
      const where = contact?.location ? ` at ${escapeHtml(contact.location)}` : '';
      items = [
        `Bring ${peso} to the parish office${where}${hours}.`,
        `Say it's for the <strong>${escapeHtml(fundName)}</strong>, reference ${note}.`,
        'The office will give you a receipt.',
      ];
    }

    const online = method !== 'Cash';
    return `
      <div class="donate-next-head">
        <span class="sd-motes" aria-hidden="true">${'<i></i>'.repeat(8)}</span>
        <span class="donate-next-icon" aria-hidden="true"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"/></svg></span>
        <div>
          <h4 class="mi-step-title">Thank you! Now ${online ? 'send' : 'bring'} your offering.</h4>
          <p class="donate-next-status">${online
            ? `<strong>No money has left your account yet.</strong> It only leaves when you send it in ${method === 'Bank Transfer' ? 'your bank' : method}.`
            : '<strong>Nothing has been paid yet.</strong> You pay when you visit the office.'}</p>
        </div>
      </div>${qrBlock}
      <ol class="donate-next-steps">${items.map(t => `<li>${t}</li>`).join('')}</ol>
      <div class="mi-review-card">
        <dl class="mi-review-rows">
          <div><dt>Fund</dt><dd>${escapeHtml(fundName)}</dd></div>
          <div><dt>Reference</dt><dd>${escapeHtml(ref)}${copyBtn(ref)}</dd></div>
          <div><dt>Amount</dt><dd class="mi-review-total">${formatPeso(amount)}</dd></div>
        </dl>
      </div>
      <p class="donate-next-after">${online
        ? `The parish office checks for your payment and confirms it ${CONFIRM_WITHIN}. Questions? ${call.charAt(0).toUpperCase() + call.slice(1)}.`
        : `Questions? ${call.charAt(0).toUpperCase() + call.slice(1)}.`}
        Your offering is listed under <strong>My Giving History</strong> on this page.</p>`;
  }

  function showNextSteps(data) {
    steps.forEach(s => s.classList.add('hidden'));
    stepBar.classList.add('hidden');
    nextPanel.innerHTML = nextStepsHtml(data);
    // Black on white with a wide margin: what GCash / Maya scanners read best.
    const qrBox = nextPanel.querySelector('.donate-qr-code');
    if (qrBox) {
      QRCode.toString(qrBox.dataset.qr, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
        .then(svg => { qrBox.innerHTML = svg; })
        .catch(err => {
          console.error('Failed to draw QR:', err);
          nextPanel.querySelector('.donate-qr')?.remove();
        });
    }
    nextPanel.classList.remove('hidden');
    backBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    submitBtn.classList.add('hidden');
    doneBtn.classList.remove('hidden');
    modal.querySelector('.mi-page-body').scrollTop = 0;
    nextPanel.focus({ preventScroll: true });
  }

  nextPanel.addEventListener('click', async (e) => {
    const save = e.target.closest('.donate-qr-save');
    if (save) {
      try {
        const qr = nextPanel.querySelector('.donate-qr-code').dataset.qr;
        const link = document.createElement('a');
        link.href = await QRCode.toDataURL(qr, { width: 720, margin: 4, errorCorrectionLevel: 'M' });
        link.download = save.dataset.qrName;
        link.click();
      } catch {
        window.showToast('Couldn\'t save the QR — please take a screenshot instead.', true);
      }
      return;
    }
    const btn = e.target.closest('.donate-copy');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    } catch {
      window.showToast('Couldn\'t copy — please write it down instead.', true);
    }
  });

  function openModal(preSelectFundId = null) {
    selectedMethod = 'GCash';
    amountInput.value = '';
    amountInput.classList.remove('border-red-400');
    anonymousCheck.checked = false;
    fundSelector.classList.remove('has-error');
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.payment-method-btn').forEach(b => { const on = b.dataset.method === 'GCash'; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
    populateFundSelector(preSelectFundId);
    // Picked a fund card or goal → that's step 1 done; start at the amount.
    furthest = preSelectFundId ? 2 : 1;
    go(preSelectFundId ? 2 : 1);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { modal.classList.add('hidden'); document.body.style.overflow = ''; }

  document.getElementById('btn-donate').addEventListener('click', () => openModal());
  document.getElementById('btn-empty-donate')?.addEventListener('click', () => openModal());
  modal.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  doneBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

  submitBtn.addEventListener('click', async () => {
    if (!finishStep1()) { go(1); return; }
    if (!finishStep2()) { go(2); return; }
    const amount = parseInt(amountInput.value, 10);
    const fund = givingOptions().find(f => f.id === selectedFundId);
    if (!fund) return;

    // Show the tap registered (and stop a second tap from giving twice).
    if (submitBtn.disabled) return;
    const submitLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.textContent = 'Saving your offering…';

    try {
      const date = new Date().toLocaleDateString('en-CA');
      const result = await client.models.Donation.create({
        donor: DONOR_NAME,
        amount,
        method: selectedMethod,
        purpose: fund.name,
        date,
        anonymous: anonymousCheck.checked,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      // Same reference number as the receipt download (downloadReceipt above).
      const id = result.data?.id || '';
      const ref = `SD-${date.replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
      showNextSteps({ amount, fundName: fund.name, method: selectedMethod, ref });
    } catch (err) {
      console.error('Failed to save donation:', err);
      window.showToast(err.message || "Couldn't save your offering. Please try again.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.textContent = submitLabel;
    }
  });

});
