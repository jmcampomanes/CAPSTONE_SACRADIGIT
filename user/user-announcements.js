/* ============================================
   SacraDigit — User Announcements Scripts
   (user-announcements.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. DATA
  ------------------------------------------ */
  const announcements = [
    {
      title: 'Parish Fiesta Schedule — June 2026',
      body: 'Join us in celebrating Our Lady of Fatima Parish Fiesta this June! Mass schedules, procession routes, and activity highlights are now available. All parishioners and visitors are warmly welcome to take part in the festivities. The solemn procession will be held on June 21 at 4:00 PM.',
      audience: 'All Parishioners',
      date: '2026-06-17',
    },
    {
      title: 'Online Giving Now Available',
      body: 'You can now give your Sunday offering, mass intentions, and other contributions online through SacraDigit. Look for the Donations tab on the parish portal to get started. Online giving is available 24/7 and all contributions are recorded and acknowledged by the parish office.',
      audience: 'All Parishioners',
      date: '2026-06-14',
    },
    {
      title: 'Youth Ministry Summer Retreat Sign-ups',
      body: 'Registration is now open for the Youth Ministry Summer Retreat happening this July. Slots are limited — please coordinate with your ministry coordinator to reserve a spot. The retreat will be held at the Salesian Retreat House in Canlubang, Laguna.',
      audience: 'Youth Ministry',
      date: '2026-06-10',
    },
    {
      title: 'Lectors & Commentators Meeting',
      body: 'A mandatory meeting for all lectors and commentators will be held this Sunday after the 10:00 AM mass in the Catechetical Room A. Please bring your assigned reading schedules for the next quarter. New volunteers are also welcome to attend and learn about the ministry.',
      audience: 'Lectors & Commentators',
      date: '2026-06-16',
    },
    {
      title: 'Choir Rehearsal Schedule Update',
      body: 'Choir rehearsals have moved to Thursdays at 7:00 PM starting this week, to better prepare for the upcoming feast day celebrations. Please inform fellow choir members who may not have received this update. Attendance is required for all feast day assignments.',
      audience: 'Choir',
      date: '2026-06-05',
    },
    {
      title: 'Catechists Formation Session — July',
      body: 'All catechists are invited to attend the diocesan formation session on July 12, 2026 at the Diocese of Cubao Pastoral Center. Registration forms are available at the parish office. Transportation assistance may be arranged — please inquire with the parish secretary.',
      audience: 'Catechists',
      date: '2026-06-08',
    },
    {
      title: 'SacraDigit Parish Portal Now Live',
      body: 'We are excited to announce that the SacraDigit Parish Portal is now live for all registered parishioners. You can now view mass schedules, submit certificate requests, log mass intentions, book parish facilities, and make donations — all in one place. For login assistance, contact the parish office.',
      audience: 'All Parishioners',
      date: '2026-06-01',
    },
  ];

  const grid          = document.getElementById('ann-grid');
  const annEmpty       = document.getElementById('ann-empty');
  const resultsLabel    = document.getElementById('results-label');
  const searchInput      = document.getElementById('search-input');
  const audienceFilter    = document.getElementById('audience-filter');
  const clearBtn           = document.getElementById('btn-clear');

  const detailModal = document.getElementById('detail-modal');
  const detailTitle  = document.getElementById('detail-title');
  const detailBody    = document.getElementById('detail-body');
  const detailAudience = document.getElementById('detail-audience');
  const detailDate      = document.getElementById('detail-date');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatShort(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function audienceClass(audience) {
    return audience === 'All Parishioners' ? 'all' : 'ministry';
  }


  /* ------------------------------------------
     1. RENDER — filtered card grid
  ------------------------------------------ */
  function renderGrid() {
    const query    = searchInput.value.trim().toLowerCase();
    const audience  = audienceFilter.value;

    const filtered = announcements.filter(a => {
      const matchQuery    = !query || a.title.toLowerCase().includes(query) || a.body.toLowerCase().includes(query);
      const matchAudience  = !audience || a.audience === audience;
      return matchQuery && matchAudience;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    resultsLabel.textContent = `${filtered.length} announcement${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      annEmpty.classList.remove('hidden');
      return;
    }
    annEmpty.classList.add('hidden');

    grid.innerHTML = filtered.map((a, idx) => `
      <div class="ann-card" data-index="${announcements.indexOf(a)}" role="button" tabindex="0" aria-label="Read announcement: ${escapeHtml(a.title)}">
        <p class="ann-card-title">${escapeHtml(a.title)}</p>
        <p class="ann-card-excerpt">${escapeHtml(a.body)}</p>
        <div class="ann-card-footer">
          <span class="ann-card-date">${formatShort(a.date)}</span>
          <span class="ann-audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          <button type="button" class="ann-read-more" data-index="${announcements.indexOf(a)}">Read more ›</button>
        </div>
      </div>
    `).join('');
  }

  // Delegate card + read-more clicks
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.ann-card');
    if (!card) return;
    const idx = parseInt(card.dataset.index, 10);
    openDetail(idx);
  });

  // Keyboard support on cards
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.ann-card');
      if (card) {
        e.preventDefault();
        openDetail(parseInt(card.dataset.index, 10));
      }
    }
  });

  searchInput.addEventListener('input', renderGrid);
  audienceFilter.addEventListener('change', renderGrid);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    audienceFilter.value = '';
    renderGrid();
  });

  renderGrid();


  /* ------------------------------------------
     2. DETAIL MODAL — full announcement text
  ------------------------------------------ */
  function openDetail(idx) {
    const a = announcements[idx];
    detailTitle.textContent    = a.title;
    detailBody.textContent     = a.body;
    detailDate.textContent     = formatDate(a.date);
    detailAudience.textContent = a.audience;
    detailAudience.className   = `ann-audience-tag ${audienceClass(a.audience)}`;

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeDetail);
  });

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

});