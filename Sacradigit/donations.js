/* ============================================
   SacraDigit Admin — Donations Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  const donations = [
    { donor: 'Santos Family',      amount: 5000,  method: 'Online',  fund: 'Sunday Collection',       date: '2026-06-18' },
    { donor: 'Cruz, Jose R.',       amount: 1000,  method: 'Cash',     fund: 'Mass Intention Offering', date: '2026-06-18' },
    { donor: 'Reyes Family',        amount: 2500,  method: 'Online',  fund: 'Building Fund',            date: '2026-06-17' },
    { donor: 'Garcia, Pedro M.',    amount: 500,   method: 'Cash',     fund: 'Poor Box',                  date: '2026-06-17' },
    { donor: 'Anonymous',           amount: 10000, method: 'Check',   fund: 'Building Fund',            date: '2026-06-16' },
    { donor: 'Villanueva Family',   amount: 1500,  method: 'Online',  fund: 'Sunday Collection',         date: '2026-06-15' },
    { donor: 'Bautista, Carlo M.',  amount: 800,   method: 'Cash',     fund: 'Mass Intention Offering',  date: '2026-06-14' },
    { donor: 'Mendoza, Carmen P.',  amount: 3000,  method: 'Online',  fund: 'Youth Ministry',            date: '2026-06-10' },
    { donor: 'Fernandez, Luis G.',  amount: 1200,  method: 'Cash',     fund: 'Sunday Collection',         date: '2026-06-08' },
    { donor: 'Torres Family',        amount: 2000,  method: 'Check',   fund: 'Building Fund',            date: '2026-06-03' },
    { donor: 'Aquino Bakeshop',      amount: 5000,  method: 'Online',  fund: 'Building Fund',            date: '2026-06-02' },
    { donor: 'Ramos, Teresa A.',     amount: 700,   method: 'Cash',     fund: 'Poor Box',                  date: '2026-05-29' },
  ];

  const tbody          = document.getElementById('donations-tbody');
  const donationsCount  = document.getElementById('donations-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatPeso(amount) {
    return '₱' + amount.toLocaleString('en-US');
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function methodClass(method) {
    return {
      'Cash': 'cash',
      'Online': 'online',
      'Check': 'check',
    }[method] || '';
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const today = new Date(TODAY_ISO + 'T00:00:00');

    // This week = last 7 days up to and including today
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const thisWeekDonations = donations.filter(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt >= weekStart && dt <= today;
    });

    // This month = same calendar month as TODAY_ISO
    const monthPrefix = TODAY_ISO.slice(0, 7); // "2026-06"
    const thisMonthDonations = donations.filter(d => d.date.startsWith(monthPrefix));

    const weekTotal  = thisWeekDonations.reduce((sum, d) => sum + d.amount, 0);
    const monthTotal = thisMonthDonations.reduce((sum, d) => sum + d.amount, 0);

    const uniqueDonors = new Set(
      thisMonthDonations
        .filter(d => d.donor !== 'Anonymous')
        .map(d => d.donor)
    );

    document.getElementById('stat-week').textContent   = formatPeso(weekTotal);
    document.getElementById('stat-month').textContent  = formatPeso(monthTotal);
    document.getElementById('stat-donors').textContent  = uniqueDonors.size;
  }


  /* ------------------------------------------
     2. RENDER — Recent Donations table
  ------------------------------------------ */
  function renderTable() {
    const sorted = donations.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    donationsCount.textContent = `${sorted.length} donation${sorted.length === 1 ? '' : 's'}`;

    tbody.innerHTML = sorted.map(d => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(d.donor)}</td>
        <td class="donation-amount">${formatPeso(d.amount)}</td>
        <td><span class="payment-tag ${methodClass(d.method)}">${escapeHtml(d.method)}</span></td>
        <td class="text-gray-500">${escapeHtml(d.fund)}</td>
        <td class="text-gray-400">${formatShortDate(d.date)}</td>
      </tr>
    `).join('');
  }

  renderStats();
  renderTable();


  /* ------------------------------------------
     3. EXPORT REPORT — generate & download CSV
  ------------------------------------------ */
  document.getElementById('btn-export').addEventListener('click', () => {
    const headers = ['Donor', 'Amount (PHP)', 'Payment Method', 'Fund / Purpose', 'Date'];

    const rows = donations
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(d => [
        csvEscape(d.donor),
        d.amount,
        csvEscape(d.method),
        csvEscape(d.fund),
        d.date,
      ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `sacradigit-donations-report-${TODAY_ISO}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Report exported — ${donations.length} donations included.`);
  });

  function csvEscape(value) {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }


  /* ------------------------------------------
     4. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});