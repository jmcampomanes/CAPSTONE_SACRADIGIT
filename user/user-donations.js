/* ============================================
   SacraDigit — User Donations Scripts
   (user-donations.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const TODAY_ISO = '2026-06-19';
  const MONTH_PREFIX = '2026-06';

  /* ------------------------------------------
     0. FUNDS DATA
  ------------------------------------------ */
  const funds = [
    {
      id: 'sunday',
      name: 'Sunday Collection',
      desc: 'General parish fund for operations, utilities, and ministry.',
      iconBg: 'rgba(139,143,199,0.16)',
      iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      totalRaised: 48500,
    },
    {
      id: 'building',
      name: 'Building Fund',
      desc: 'Supports construction, maintenance, and improvements to parish structures.',
      iconBg: 'rgba(201,168,76,0.16)',
      iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1"/></svg>`,
      totalRaised: 182000,
    },
    {
      id: 'poor-box',
      name: 'Poor Box',
      desc: 'Directly supports parishioners in need and charitable outreach programs.',
      iconBg: 'rgba(21,128,61,0.1)',
      iconColor: '#15803d',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      totalRaised: 26300,
    },
    {
      id: 'youth',
      name: 'Youth Ministry',
      desc: 'Funds retreats, formations, and youth activities throughout the year.',
      iconBg: 'rgba(239,68,68,0.1)',
      iconColor: '#dc2626',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3.5-5.93"/></svg>`,
      totalRaised: 14750,
    },
  ];

  /* ------------------------------------------
     1. MY DONATION HISTORY
  ------------------------------------------ */
  let myDonations = [
    { fund: 'Sunday Collection',  amount: 500,  method: 'GCash',         date: '2026-06-15', anonymous: false },
    { fund: 'Building Fund',       amount: 1000, method: 'Bank Transfer',  date: '2026-06-01', anonymous: false },
    { fund: 'Poor Box',             amount: 200,  method: 'Cash',           date: '2026-05-25', anonymous: false },
    { fund: 'Youth Ministry',       amount: 300,  method: 'Maya',           date: '2026-05-10', anonymous: true  },
  ];

  function formatPeso(n) {
    return '₱' + n.toLocaleString('en-US');
  }

  function formatShortDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ------------------------------------------
     2. RENDER — fund cards
  ------------------------------------------ */
  function renderFundGrid() {
    const grid = document.getElementById('fund-grid');
    grid.innerHTML = funds.map(f => `
      <button type="button" class="fund-card" data-fund-id="${f.id}">
        <div class="fund-icon" style="background-color:${f.iconBg};color:${f.iconColor};">${f.icon}</div>
        <p class="fund-name">${f.name}</p>
        <p class="fund-desc">${f.desc}</p>
        <p class="fund-total">${formatPeso(f.totalRaised)} raised</p>
      </button>
    `).join('');

    grid.querySelectorAll('.fund-card').forEach(card => {
      card.addEventListener('click', () => {
        openModal(card.dataset.fundId);
      });
    });
  }

  /* ------------------------------------------
     3. RENDER — stats
  ------------------------------------------ */
  function renderStats() {
    const total    = myDonations.reduce((s, d) => s + d.amount, 0);
    const monthly   = myDonations
      .filter(d => d.date.startsWith(MONTH_PREFIX))
      .reduce((s, d) => s + d.amount, 0);

    document.getElementById('stat-total').textContent = formatPeso(total);
    document.getElementById('stat-month').textContent = formatPeso(monthly);
    document.getElementById('stat-count').textContent = myDonations.length;
  }

  /* ------------------------------------------
     4. RENDER — donation history table
  ------------------------------------------ */
  function renderHistory() {
    const tbody  = document.getElementById('history-tbody');
    const empty   = document.getElementById('history-empty');
    const count    = document.getElementById('history-count');

    count.textContent = `${myDonations.length} transaction${myDonations.length === 1 ? '' : 's'}`;

    if (myDonations.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const sorted = myDonations.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(d => {
      const realIndex = myDonations.indexOf(d);
      return `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(d.fund)}</td>
        <td class="donation-amount">${formatPeso(d.amount)}</td>
        <td>
          <span class="payment-pill">${escapeHtml(d.method)}</span>
        </td>
        <td class="text-gray-400">${formatShortDate(d.date)}</td>
        <td>
          <button type="button" class="btn-download-receipt" data-index="${realIndex}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            Receipt
          </button>
        </td>
      </tr>
    `;
    }).join('');
  }

  // Delegate "Download Receipt" row action
  document.getElementById('history-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-download-receipt');
    if (!btn) return;
    downloadReceipt(parseInt(btn.dataset.index, 10));
  });

  /* ------------------------------------------
     4b. DOWNLOAD RECEIPT (client-side .txt)
  ------------------------------------------ */
  function referenceNumberFor(d, idx) {
    return `SD-${d.date.replace(/-/g, '')}-${String(idx).padStart(3, '0')}`;
  }

  function downloadReceipt(idx) {
    const d = myDonations[idx];
    if (!d) return;

    const refNumber = referenceNumberFor(d, idx);
    const donorName = d.anonymous ? 'Anonymous Donor' : 'Maria P. Santos';

    const lines = [
      'SacraDigit Parish Portal',
      'Official Donation Receipt',
      '----------------------------------------',
      `Reference No.: ${refNumber}`,
      `Date: ${formatShortDate(d.date)}`,
      `Donor: ${donorName}`,
      `Fund / Purpose: ${d.fund}`,
      `Amount: ${formatPeso(d.amount)}`,
      `Payment Method: ${d.method}`,
      '----------------------------------------',
      'Thank you for your generous offering.',
      'This receipt is generated electronically and does not require a signature.',
      '',
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

    window.showToast(`Receipt downloaded for ${formatPeso(d.amount)} to ${d.fund}.`);
  }

  renderFundGrid();
  renderStats();
  renderHistory();

  /* ------------------------------------------
     5. DONATE MODAL
  ------------------------------------------ */
  const modal          = document.getElementById('donate-modal');
  const fundSelector    = document.getElementById('donate-fund-selector');
  const amountInput      = document.getElementById('donate-amount');
  const anonymousCheck    = document.getElementById('donate-anonymous');

  let selectedFundId = null;
  let selectedMethod  = 'GCash';
  let selectedAmount   = null;

  // Populate fund selector in modal
  function populateFundSelector(preSelectId = null) {
    fundSelector.innerHTML = funds.map(f => `
      <button type="button"
        class="donate-fund-btn ${f.id === preSelectId ? 'selected' : ''}"
        data-fund-id="${f.id}">
        ${f.name}
      </button>
    `).join('');

    selectedFundId = preSelectId || null;

    fundSelector.querySelectorAll('.donate-fund-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        fundSelector.querySelectorAll('.donate-fund-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFundId = btn.dataset.fundId;
      });
    });
  }

  // Quick amount buttons
  document.getElementById('quick-amounts').addEventListener('click', e => {
    const btn = e.target.closest('.quick-amount-btn');
    if (!btn) return;
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedAmount = parseInt(btn.dataset.amount, 10);
    amountInput.value = selectedAmount;
  });

  amountInput.addEventListener('input', () => {
    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    selectedAmount = null;
  });

  // Payment method buttons
  document.getElementById('payment-method-grid').addEventListener('click', e => {
    const btn = e.target.closest('.payment-method-btn');
    if (!btn) return;
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMethod = btn.dataset.method;
  });

  function openModal(preSelectFundId = null) {
    selectedMethod  = 'GCash';
    selectedAmount  = null;
    amountInput.value = '';
    anonymousCheck.checked = false;

    document.querySelectorAll('.quick-amount-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.payment-method-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.method === 'GCash');
    });

    populateFundSelector(preSelectFundId);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.getElementById('btn-donate').addEventListener('click', () => openModal());
  document.getElementById('btn-empty-donate')?.addEventListener('click', () => openModal());

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* Submit donation */
  document.getElementById('donate-submit').addEventListener('click', () => {
    const amount = parseInt(amountInput.value, 10);

    if (!selectedFundId) {
      window.showToast('Please select a fund to support.', true);
      return;
    }
    if (!amount || amount <= 0) {
      amountInput.classList.add('border-red-400');
      amountInput.addEventListener('input', () => amountInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please enter a valid donation amount.', true);
      return;
    }

    const fund = funds.find(f => f.id === selectedFundId);
    if (!fund) return;

    // Add to history
    myDonations.unshift({
      fund: fund.name,
      amount,
      method: selectedMethod,
      date: TODAY_ISO,
      anonymous: anonymousCheck.checked,
    });

    // Update fund total
    fund.totalRaised += amount;

    renderFundGrid();
    renderStats();
    renderHistory();
    closeModal();

    window.showToast(`Thank you! ${formatPeso(amount)} given to ${fund.name}.`);
  });

});