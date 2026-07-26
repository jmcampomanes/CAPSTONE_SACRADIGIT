/* ============================================
   SacraDigit Admin — Announcements Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  let announcements = [
    {
      title: 'Parish Fiesta Schedule — June 2026',
      body: 'Join us in celebrating Our Lady of Fatima Parish Fiesta this June! Mass schedules, procession routes, and activity highlights are now available. All parishioners and visitors are warmly welcome to take part in the festivities.',
      audience: 'All Parishioners',
      date: '2026-06-17',
      published: true,
    },
    {
      title: 'Lectors & Commentators Meeting',
      body: 'A mandatory meeting for all lectors and commentators will be held this Sunday after the 10:00 AM mass. Please bring your assigned reading schedules for the next quarter.',
      audience: 'Lectors & Commentators',
      date: '2026-06-16',
      published: true,
    },
    {
      title: 'Online Giving Now Available',
      body: 'You can now give your Sunday offering, mass intentions, and other contributions online through SacraDigit. Look for the Donations tab on the parish portal to get started.',
      audience: 'All Parishioners',
      date: '2026-06-14',
      published: true,
    },
    {
      title: 'Youth Ministry Summer Retreat Sign-ups',
      body: 'Registration is now open for the Youth Ministry Summer Retreat happening this July. Slots are limited — please coordinate with your ministry coordinator to reserve a spot.',
      audience: 'Youth Ministry',
      date: '2026-06-10',
      published: true,
    },
    {
      title: 'Choir Rehearsal Schedule Update',
      body: 'Choir rehearsals have moved to Thursdays at 7:00 PM starting this week, to better prepare for the upcoming feast day celebrations.',
      audience: 'Choir',
      date: '2026-06-05',
      published: false,
    },
  ];

  const grid              = document.getElementById('announcements-grid');
  const announcementsEmpty  = document.getElementById('announcements-empty');
  const announcementsCount  = document.getElementById('announcements-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function audienceClass(audience) {
    return audience === 'All Parishioners' ? 'all' : 'ministry';
  }


  /* ------------------------------------------
     1. RENDER — Announcement card grid
  ------------------------------------------ */
  function renderGrid() {
    const sorted = announcements.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const publishedCount = announcements.filter(a => a.published).length;

    announcementsCount.textContent = `${publishedCount} published`;

    if (sorted.length === 0) {
      grid.innerHTML = '';
      announcementsEmpty.classList.remove('hidden');
      return;
    }
    announcementsEmpty.classList.add('hidden');

    grid.innerHTML = sorted.map((a) => {
      const realIndex = announcements.indexOf(a);
      const statusActions = a.published
        ? `<button type="button" class="ann-unpublish" data-index="${realIndex}">Unpublish</button>`
        : `<button type="button" class="ann-republish" data-index="${realIndex}">Republish</button>`;

      return `
        <div class="announcement-card ${a.published ? '' : 'unpublished'}">
          <div class="announcement-top">
            <p class="announcement-title">${escapeHtml(a.title)}</p>
          </div>
          <p class="announcement-excerpt">${escapeHtml(a.body)}</p>
          <div class="announcement-meta">
            <span class="announcement-date">${formatShortDate(a.date)}</span>
            <span class="audience-tag ${audienceClass(a.audience)}">${escapeHtml(a.audience)}</span>
          </div>
          <div class="announcement-actions">
            <button type="button" class="ann-edit" data-index="${realIndex}">Edit</button>
            ${statusActions}
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const editBtn       = e.target.closest('.ann-edit');
    const unpublishBtn   = e.target.closest('.ann-unpublish');
    const republishBtn   = e.target.closest('.ann-republish');

    if (editBtn) {
      const idx = parseInt(editBtn.dataset.index, 10);
      openEditModal(idx);
    }

    if (unpublishBtn) {
      const idx = parseInt(unpublishBtn.dataset.index, 10);
      announcements[idx].published = false;
      renderGrid();
      showToast(`"${announcements[idx].title}" unpublished.`);
    }

    if (republishBtn) {
      const idx = parseInt(republishBtn.dataset.index, 10);
      announcements[idx].published = true;
      renderGrid();
      showToast(`"${announcements[idx].title}" republished.`);
    }
  });

  renderGrid();


  /* ------------------------------------------
     2. NEW / EDIT ANNOUNCEMENT MODAL
     (shared modal — editTargetIndex is null
     when creating a new announcement)
  ------------------------------------------ */
  const modal          = document.getElementById('announcement-modal');
  const modalTitle       = document.getElementById('announcement-modal-title');
  const submitBtn         = document.getElementById('announcement-submit');
  const titleInput          = document.getElementById('ann-title');
  const bodyInput            = document.getElementById('ann-body');
  const audienceSelect        = document.getElementById('ann-audience');

  let editTargetIndex = null;

  document.getElementById('btn-new-announcement').addEventListener('click', () => {
    editTargetIndex = null;
    modalTitle.textContent = 'New Announcement';
    submitBtn.textContent = 'Publish Now';
    titleInput.value = '';
    bodyInput.value = '';
    audienceSelect.value = 'All Parishioners';
    openModal(modal);
  });

  function openEditModal(idx) {
    editTargetIndex = idx;
    const a = announcements[idx];
    modalTitle.textContent = 'Edit Announcement';
    submitBtn.textContent = 'Save Changes';
    titleInput.value = a.title;
    bodyInput.value = a.body;
    audienceSelect.value = a.audience;
    openModal(modal);
  }

  submitBtn.addEventListener('click', () => {
    const title    = titleInput.value.trim();
    const body      = bodyInput.value.trim();
    const audience   = audienceSelect.value;

    if (!title || !body) {
      showToast('Please fill in both title and body.', true);
      return;
    }

    if (editTargetIndex !== null) {
      // Editing an existing announcement
      announcements[editTargetIndex].title = title;
      announcements[editTargetIndex].body = body;
      announcements[editTargetIndex].audience = audience;
      showToast(`"${title}" updated.`);
    } else {
      // Creating + publishing a new one
      announcements.unshift({
        title,
        body,
        audience,
        date: TODAY_ISO,
        published: true,
      });
      showToast(`"${title}" published.`);
    }

    renderGrid();
    closeModal(modal);
  });


  /* ------------------------------------------
     3. MODAL HELPERS (open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(modal));
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(modal);
  });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
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