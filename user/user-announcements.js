/* ============================================
   SacraDigit — User Announcements Scripts (AWS Amplify)
   Runs after user-shell.js.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  let announcements = [];

  const grid         = document.getElementById('ann-grid');
  const annEmpty      = document.getElementById('ann-empty');
  const resultsLabel   = document.getElementById('results-label');
  const searchInput     = document.getElementById('search-input');
  const audienceFilter   = document.getElementById('audience-filter');
  const clearBtn          = document.getElementById('btn-clear');

  const detailModal = document.getElementById('detail-modal');
  const detailTitle  = document.getElementById('detail-title');
  const detailBody    = document.getElementById('detail-body');
  const detailAudience = document.getElementById('detail-audience');
  const detailDate      = document.getElementById('detail-date');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatDate(input) {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function formatShort(input) {
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function audienceClass(audience) {
    return audience === 'All Parishioners' ? 'all' : 'ministry';
  }

  client.models.Announcement.observeQuery({ filter: { published: { eq: true } } }).subscribe({
    next: ({ items }) => {
      announcements = items;
      renderGrid();
    },
    error: (err) => {
      console.error('Failed to load announcements:', err);
      window.showToast?.("Couldn't load announcements.", true);
    },
  });

  function renderGrid() {
    const query   = searchInput.value.trim().toLowerCase();
    const audience = audienceFilter.value;

    const filtered = announcements.filter(a => {
      const matchQuery   = !query || a.title.toLowerCase().includes(query) || a.body.toLowerCase().includes(query);
      const matchAudience = !audience || a.audience === audience;
      return matchQuery && matchAudience;
    });

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    resultsLabel.textContent = `${filtered.length} announcement${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      annEmpty.classList.remove('hidden');
      return;
    }
    annEmpty.classList.add('hidden');

    grid.innerHTML = filtered.map((a) => `
      <div class="ann-card" data-id="${a.id}" role="button" tabindex="0" aria-label="Read announcement: ${escapeHtml(a.title)}">
        <p class="ann-card-title">${escapeHtml(a.title)}</p>
        <p class="ann-card-excerpt">${escapeHtml(a.body)}</p>
        <div class="ann-card-footer">
          <span class="ann-card-date">${formatShort(a.createdAt)}</span>
          <span class="ann-audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          <button type="button" class="ann-read-more" data-id="${a.id}">Read more ›</button>
        </div>
      </div>`).join('');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.ann-card');
    if (!card) return;
    openDetail(card.dataset.id);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.ann-card');
      if (card) { e.preventDefault(); openDetail(card.dataset.id); }
    }
  });

  searchInput.addEventListener('input', renderGrid);
  audienceFilter.addEventListener('change', renderGrid);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    audienceFilter.value = '';
    renderGrid();
  });

  function openDetail(id) {
    const a = announcements.find(x => x.id === id);
    if (!a) return;
    detailTitle.textContent    = a.title;
    detailBody.textContent     = a.body;
    detailDate.textContent     = formatDate(a.createdAt);
    detailAudience.textContent = a.audience;
    detailAudience.className   = `ann-audience-tag ${audienceClass(a.audience)}`;
    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeDetail));
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

});
