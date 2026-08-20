/* ============================================
   SacraDigit — User Donations Scripts (AWS Amplify)
   Runs after user-shell.js.
   Fund totals are computed live from actual
   Donation records (sum by purpose) instead of
   static numbers. "My Giving History" filters
   client-side by donor === hardcoded demo name.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const DONOR_NAME = 'Maria P. Santos';
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
  let myDonations = [];

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
      renderStats();
      renderHistory();
    },
    error: (err) => {
      console.error('Failed to load donations:', err);
      document.getElementById('history-tbody').innerHTML = `<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">Couldn't load donations.</td></tr>`;
    },
  });

  function fundTotal(fundName) {
    return allDonations.filter(d => d.purpose === fundName).reduce((s, d) => s + (d.amount || 0), 0);
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
    if (btn) downloadReceipt(btn.dataset.id);
  });

  function downloadReceipt(id) {
    const d = myDonations.find(x => x.id === id);
    if (!d) return;

    const refNumber = `SD-${(d.date || '').replace(/-/g, '')}-${d.id.slice(0, 6).toUpperCase()}`;
    const donorName = d.anonymous ? 'Anonymous Donor' : DONOR_NAME;

    const lines = [
      'SacraDigit Parish Portal', 'Official Donation Receipt', '----------------------------------------',
      `Reference No.: ${refNumber}`, `Date: ${formatShortDate(d.date)}`, `Donor: ${donorName}`,
      `Fund / Purpose: ${d.purpose}`, `Amount: ${formatPeso(d.amount)}`, `Payment Method: ${d.method}`,
      '----------------------------------------', 'Thank you for your generous offering.',
      'This receipt is generated electronically and does not require a signature.', '',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${refNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.showToast(`Receipt downloaded for ${formatPeso(d.amount)} to ${d.purpose}.`);
  }

  const modal          = document.getElementById('donate-modal');
  const fundSelector    = document.getElementById('donate-fund-selector');
  const amountInput      = document.getElementById('donate-amount');
  const anonymousCheck    = document.getElementById('donate-anonymous');

  let selectedFundId = null;
  let selectedMethod  = 'GCash';

  function populateFundSelector(preSelectId = null) {
    fundSelector.innerHTML = fundDefs.map(f => `<button type="button" class="donate-fund-btn ${f.id === preSelectId ? 'selected' : ''}" data-fund-id="${f.id}">${f.name}</button>`).join('');
    selectedFundId = preSelectId || null;
    fundSelector.querySelectorAll('.donate-fund-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        fundSelector.querySelectorAll('.donate-fund-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFundId = btn.dataset.fundId;
      });
    });
  }

  document.getElementById('quick-amounts').addEventListener('click', e => {
    const btn = e.target.closest('.quick-amount-btn');
    if (!btn) return;
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    amountInput.value = btn.dataset.amount;
  });

  amountInput.addEventListener('input', () => document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected')));

  document.getElementById('payment-method-grid').addEventListener('click', e => {
    const btn = e.target.closest('.payment-method-btn');
    if (!btn) return;
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMethod = btn.dataset.method;
  });

  function openModal(preSelectFundId = null) {
    selectedMethod = 'GCash';
    amountInput.value = '';
    anonymousCheck.checked = false;
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.toggle('selected', b.dataset.method === 'GCash'));
    populateFundSelector(preSelectFundId);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { modal.classList.add('hidden'); document.body.style.overflow = ''; }

  document.getElementById('btn-donate').addEventListener('click', () => openModal());
  document.getElementById('btn-empty-donate')?.addEventListener('click', () => openModal());
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('donate-submit').addEventListener('click', async () => {
    const amount = parseInt(amountInput.value, 10);

    if (!selectedFundId) { window.showToast('Please select a fund to support.', true); return; }
    if (!amount || amount <= 0) {
      amountInput.classList.add('border-red-400');
      amountInput.addEventListener('input', () => amountInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please enter a valid donation amount.', true);
      return;
    }

    const fund = fundDefs.find(f => f.id === selectedFundId);
    if (!fund) return;

    try {
      const result = await client.models.Donation.create({
        donor: DONOR_NAME,
        amount,
        method: selectedMethod,
        purpose: fund.name,
        date: new Date().toISOString().slice(0, 10),
        anonymous: anonymousCheck.checked,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal();
      window.showToast(`Thank you! ${formatPeso(amount)} given to ${fund.name}.`);
    } catch (err) {
      console.error('Failed to save donation:', err);
      window.showToast(err.message || "Couldn't process the donation.", true);
    }
  });

});
