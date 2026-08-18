/* ============================================
   SacraDigit Admin — Donations Scripts (AWS Amplify)
   Backed by the Donation model.
   (Requires the `donor` field added to Donation
   in amplify/data/resource.ts — see chat.)
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  let donations = []; // kept in sync via observeQuery

  const tbody          = document.getElementById('donations-tbody');
  const donationsCount  = document.getElementById('donations-count');
  const donationsEmpty   = document.getElementById('donations-empty');
  const paginationBar     = document.getElementById('donations-pagination');

  const searchInput = document.getElementById('search-input');
  const methodFilter  = document.getElementById('method-filter');
  const fundFilter      = document.getElementById('fund-filter');

  const PAGE_SIZE = 6;
  let currentPage = 1;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatPeso(amount) {
    return '₱' + (amount || 0).toLocaleString('en-US');
  }

  function formatShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function methodClass(method) {
    return { 'Cash': 'cash', 'Online': 'online', 'Check': 'check' }[method] || '';
  }

  function matchesFilters(d) {
    const query      = searchInput.value.trim().toLowerCase();
    const methodVal   = methodFilter.value;
    const fundVal       = fundFilter.value;

    const matchesQuery = !query ||
      (d.donor || '').toLowerCase().includes(query) ||
      (d.purpose || '').toLowerCase().includes(query);

    const matchesMethod = !methodVal || d.method === methodVal;
    const matchesFund     = !fundVal || d.purpose === fundVal;

    return matchesQuery && matchesMethod && matchesFund;
  }

  client.models.Donation.observeQuery().subscribe({
    next: ({ items }) => {
      donations = items;
      renderStats();
      renderTable();
    },
    error: (err) => {
      console.error('Failed to load donations:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">Couldn't load donations.</td></tr>`;
    },
  });

  function renderStats() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const thisWeekDonations = donations.filter(d => {
      const dt = new Date(d.date);
      return dt >= weekStart && dt <= today;
    });

    const monthPrefix = today.toISOString().slice(0, 7);
    const thisMonthDonations = donations.filter(d => (d.date || '').startsWith(monthPrefix));

    const weekTotal  = thisWeekDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const monthTotal = thisMonthDonations.reduce((sum, d) => sum + (d.amount || 0), 0);

    const uniqueDonors = new Set(
      thisMonthDonations.filter(d => d.donor && d.donor !== 'Anonymous').map(d => d.donor)
    );

    document.getElementById('stat-week').textContent   = formatPeso(weekTotal);
    document.getElementById('stat-month').textContent  = formatPeso(monthTotal);
    document.getElementById('stat-donors').textContent  = uniqueDonors.size;
  }

  function renderTable() {
    const sorted = donations.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const filtered = sorted.filter(matchesFilters);

    donationsCount.textContent = `${filtered.length} donation${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      donationsEmpty.classList.remove('hidden');
      paginationBar.innerHTML = '';
      return;
    }
    donationsEmpty.classList.add('hidden');

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(d => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(d.donor)}</td>
        <td class="donation-amount">${formatPeso(d.amount)}</td>
        <td><span class="payment-tag ${methodClass(d.method)}">${escapeHtml(d.method)}</span></td>
        <td class="text-gray-500">${escapeHtml(d.purpose)}</td>
        <td class="text-gray-400">${formatShortDate(d.date)}</td>
      </tr>
    `).join('');

    renderPagination(filtered.length, totalPages, startIdx, pageItems.length);
  }

  function renderPagination(totalItems, totalPages, startIdx, pageCount) {
    if (totalPages <= 1) {
      paginationBar.innerHTML = `<span class="pagination-info">Showing ${totalItems} of ${totalItems}</span>`;
      return;
    }
    const rangeStart = startIdx + 1;
    const rangeEnd = startIdx + pageCount;
    let pageBtns = '';
    for (let p = 1; p <= totalPages; p++) {
      pageBtns += `<button type="button" class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    paginationBar.innerHTML = `
      <span class="pagination-info">Showing ${rangeStart}–${rangeEnd} of ${totalItems}</span>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${pageBtns}
        <button type="button" class="pagination-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
      </div>`;
  }

  paginationBar.addEventListener('click', (e) => {
    const prevBtn = e.target.closest('#page-prev');
    const nextBtn = e.target.closest('#page-next');
    const pageBtn  = e.target.closest('.pagination-btn[data-page]');
    if (prevBtn && currentPage > 1) currentPage--;
    if (nextBtn) currentPage++;
    if (pageBtn) currentPage = parseInt(pageBtn.dataset.page, 10);
    if (prevBtn || nextBtn || pageBtn) renderTable();
  });

  [searchInput, methodFilter, fundFilter].forEach(el => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => { currentPage = 1; renderTable(); });
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    methodFilter.value = '';
    fundFilter.value = '';
    currentPage = 1;
    renderTable();
  });


  /* --- Export CSV --- */
  document.getElementById('btn-export').addEventListener('click', () => {
    const headers = ['Donor', 'Amount (PHP)', 'Payment Method', 'Fund / Purpose', 'Date'];
    const rows = donations.slice().sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(d => [csvEscape(d.donor), d.amount, csvEscape(d.method), csvEscape(d.purpose), d.date]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sacradigit-donations-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Report exported — ${donations.length} donations included.`);
  });

  function csvEscape(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }


  /* --- Donation Tracker chart --- */
  const graphModal   = document.getElementById('graph-modal');
  const chartContainer = document.getElementById('donation-chart');

  function renderDonationChart() {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = donations.filter(don => (don.date || '').startsWith(iso)).reduce((sum, don) => sum + (don.amount || 0), 0);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total,
      });
    }

    const maxTotal = Math.max(...days.map(d => d.total), 1);
    const width = 500, height = 220, chartTop = 20, chartBottom = 190;
    const chartHeight = chartBottom - chartTop;
    const barWidth = 36;
    const gap = (width - barWidth * days.length) / (days.length + 1);

    const bars = days.map((d, i) => {
      const x = gap + i * (barWidth + gap);
      const barHeight = d.total === 0 ? 0 : Math.max(4, (d.total / maxTotal) * chartHeight);
      const y = chartBottom - barHeight;
      return `
        <g class="chart-bar-group">
          <title>${d.dateLabel}: ${formatPeso(d.total)}</title>
          <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" />
          ${d.total > 0 ? `<text class="chart-bar-label" x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle">${formatPeso(d.total)}</text>` : ''}
          <text class="chart-axis-label" x="${x + barWidth / 2}" y="${chartBottom + 16}" text-anchor="middle">${d.label}</text>
        </g>`;
    }).join('');

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="#e5e7eb" stroke-width="1" />
        ${bars}
      </svg>`;
  }

  document.getElementById('btn-view-graph').addEventListener('click', () => {
    renderDonationChart();
    openModal(graphModal);
  });


  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { const overlay = btn.closest('.modal-overlay'); if (overlay) closeModal(overlay); });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(closeModal); });
  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }


  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});
