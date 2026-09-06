/* ============================================
   SacraDigit Admin — Donations Scripts (AWS Amplify)
   Backed by the Donation model.
   (Requires the `donor` field added to Donation
   in amplify/data/resource.ts — see chat.)
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  let donations = []; // kept in sync via observeQuery
  let goals     = []; // kept in sync via observeQuery, each has .id

  const goalsGrid   = document.getElementById('goals-grid');
  const goalsEmpty  = document.getElementById('goals-empty');
  const goalsCount  = document.getElementById('goals-count');

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

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
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
      renderGoals();
    },
    error: (err) => {
      console.error('Failed to load donations:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load donations.</td></tr>`;
    },
  });


  /* ------------------------------------------
     FUNDRAISING GOALS
     A goal tracks progress toward a specific,
     one-time need (e.g. "New Church Bell —
     ₱10,000") rather than a recurring fund.
     Progress is computed live by summing existing
     Donation records whose purpose matches the
     goal's name — no separate link field needed,
     the same approach already used for fund totals
     on the user donations page.
  ------------------------------------------ */
  const addGoalBtn = document.getElementById('btn-add-goal');

  if (!client.models.DonationGoal) {
    console.error('DonationGoal model is missing from the deployed backend schema (amplify_outputs.json). Fundraising Goals cannot load, save, or delete until this model is added to the backend.');

    goalsCount.textContent = '';
    goalsGrid.innerHTML = '';
    goalsEmpty.innerHTML = `
      <svg class="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-sm font-medium text-gray-600">Fundraising Goals isn't connected to a database table yet</p>
      <p class="text-xs text-gray-400 mt-1">The DonationGoal model is missing from the backend schema — check with the developer before this feature can be used.</p>
    `;
    goalsEmpty.classList.remove('hidden');

    if (addGoalBtn) {
      addGoalBtn.disabled = true;
      addGoalBtn.classList.add('opacity-50', 'cursor-not-allowed');
      addGoalBtn.title = "Fundraising Goals isn't connected to a database table yet.";
    }
  } else {
    client.models.DonationGoal.observeQuery().subscribe({
      next: ({ items }) => {
        goals = items;
        renderGoals();
      },
      error: (err) => {
        console.error('Failed to load fundraising goals:', err);
        goalsGrid.innerHTML = '';
        goalsEmpty.classList.remove('hidden');
      },
    });
  }

  function goalRaised(goalName) {
    return donations.filter(d => d.purpose === goalName).reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  function formatShortDeadline(iso) {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderGoals() {
    if (!client.models.DonationGoal) return;

    goalsCount.textContent = `${goals.length} goal${goals.length === 1 ? '' : 's'}`;

    if (goals.length === 0) {
      goalsGrid.innerHTML = '';
      goalsEmpty.classList.remove('hidden');
      return;
    }
    goalsEmpty.classList.add('hidden');

    const sorted = goals.slice().sort((a, b) => (a.active === b.active) ? 0 : (a.active ? -1 : 1));

    goalsGrid.innerHTML = sorted.map(g => {
      const raised  = goalRaised(g.name);
      const target  = g.targetAmount || 0;
      const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
      const reached = target > 0 && raised >= target;

      return `
        <div class="goal-card ${reached ? 'reached' : ''}">
          <div class="goal-card-body">
            <div class="goal-card-top">
              <p class="goal-name">${escapeHtml(g.name)}</p>
              ${reached ? '<span class="goal-badge-reached">Goal Reached</span>' : (g.active === false ? '<span class="goal-badge-inactive">Inactive</span>' : '')}
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
          </div>
          <div class="goal-card-footer">
            <button type="button" class="goal-edit" data-id="${g.id}">Edit</button>
            <button type="button" class="goal-delete" data-id="${g.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  goalsGrid.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.goal-edit');
    const deleteBtn = e.target.closest('.goal-delete');
    if (editBtn) openGoalEditModal(editBtn.dataset.id);
    if (deleteBtn) openGoalDeleteModal(deleteBtn.dataset.id);
  });

  /* --- Add/Edit Goal Modal --- */
  const goalModal        = document.getElementById('goal-modal');
  const goalModalTitle    = document.getElementById('goal-modal-title');
  const goalSubmitBtn      = document.getElementById('goal-submit');
  const goalNameInput        = document.getElementById('goal-name');
  const goalTargetInput        = document.getElementById('goal-target');
  const goalDeadlineInput        = document.getElementById('goal-deadline');
  const goalDescriptionInput       = document.getElementById('goal-description');
  const goalActiveInput              = document.getElementById('goal-active');

  let goalEditTargetId = null;

  if (addGoalBtn) {
    addGoalBtn.addEventListener('click', () => {
      goalEditTargetId = null;
      goalModalTitle.textContent = 'New Fundraising Goal';
      goalSubmitBtn.textContent = 'Save Goal';
      goalNameInput.value = '';
      goalTargetInput.value = '';
      goalDeadlineInput.value = '';
      goalDescriptionInput.value = '';
      goalActiveInput.checked = true;
      [goalNameInput, goalTargetInput].forEach(clearFieldError);
      openModal(goalModal);
    });
  }

  function openGoalEditModal(id) {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    goalEditTargetId = id;
    goalModalTitle.textContent = 'Edit Fundraising Goal';
    goalSubmitBtn.textContent = 'Save Changes';
    goalNameInput.value = g.name || '';
    goalTargetInput.value = g.targetAmount || '';
    goalDeadlineInput.value = g.deadline || '';
    goalDescriptionInput.value = g.description || '';
    goalActiveInput.checked = g.active !== false;
    [goalNameInput, goalTargetInput].forEach(clearFieldError);
    openModal(goalModal);
  }

  [goalNameInput, goalTargetInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  goalSubmitBtn.addEventListener('click', async () => {
    const name        = goalNameInput.value.trim();
    const targetAmount = parseFloat(goalTargetInput.value);
    const deadline      = goalDeadlineInput.value || null;
    const description     = goalDescriptionInput.value.trim() || null;
    const active            = goalActiveInput.checked;

    [goalNameInput, goalTargetInput].forEach(clearFieldError);

    let hasError = false;
    if (!name) { setFieldError(goalNameInput, 'Goal name is required.'); hasError = true; }
    if (!targetAmount || targetAmount <= 0) { setFieldError(goalTargetInput, 'Enter a target amount greater than 0.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    try {
      if (goalEditTargetId !== null) {
        const result = await client.models.DonationGoal.update({
          id: goalEditTargetId, name, targetAmount, deadline, description, active,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" updated.`);
      } else {
        const result = await client.models.DonationGoal.create({
          name, targetAmount, deadline, description, active,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" added.`);
      }
      closeModal(goalModal);
    } catch (err) {
      console.error('Failed to save fundraising goal:', err);
      showToast(err.message || "Couldn't save the goal.", true);
    }
  });

  /* --- Delete Goal Confirmation Modal --- */
  const goalDeleteModal      = document.getElementById('goal-delete-modal');
  const goalDeleteTargetName  = document.getElementById('goal-delete-target-name');
  let goalDeleteTargetId = null;

  function openGoalDeleteModal(id) {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    goalDeleteTargetId = id;
    goalDeleteTargetName.textContent = g.name;
    openModal(goalDeleteModal);
  }

  document.getElementById('goal-delete-confirm-submit').addEventListener('click', async () => {
    if (goalDeleteTargetId === null) return;
    const g = goals.find(x => x.id === goalDeleteTargetId);

    try {
      const result = await client.models.DonationGoal.delete({ id: goalDeleteTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(goalDeleteModal);
      showToast(`"${g ? g.name : 'Goal'}" removed.`);
      goalDeleteTargetId = null;
    } catch (err) {
      console.error('Failed to delete fundraising goal:', err);
      showToast(err.message || "Couldn't delete the goal.", true);
    }
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
        <td class="text-right"><button type="button" class="row-action" data-id="${d.id}">View ›</button></td>
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


  /* --- Donation detail modal --- */
  const donationDetailModal = document.getElementById('donation-detail-modal');
  const donationDetailBody  = document.getElementById('donation-detail-body');

  function openDonationDetailModal(id) {
    const d = donations.find(x => x.id === id);
    if (!d) return;

    donationDetailBody.innerHTML = `
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Donor</p><p class="so-detail-value">${escapeHtml(d.donor)}</p></div>
        <div><p class="so-detail-label">Amount</p><p class="so-detail-value">${formatPeso(d.amount)}</p></div>
        <div><p class="so-detail-label">Payment Method</p><p class="so-detail-value">${escapeHtml(d.method)}</p></div>
        <div><p class="so-detail-label">Fund / Purpose</p><p class="so-detail-value">${escapeHtml(d.purpose)}</p></div>
        <div><p class="so-detail-label">Date</p><p class="so-detail-value">${formatShortDate(d.date)}</p></div>
        <div><p class="so-detail-label">Recorded</p><p class="so-detail-value">${d.createdAt ? formatShortDate(d.createdAt) : '—'}</p></div>
      </div>
    `;

    openModal(donationDetailModal);
  }

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (!btn) return;
    openDonationDetailModal(btn.dataset.id);
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