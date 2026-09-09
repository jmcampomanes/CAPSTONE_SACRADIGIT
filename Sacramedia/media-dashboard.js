/* ============================================
   SacraDigit Media — Dashboard Scripts
   Reads the same localStorage keys the other
   media pages write to, purely for the summary
   view. Each individual page (content-calendar.js,
   event-coverage.js, etc.) owns its own seeding —
   this file only seeds if a key is completely
   missing, so the dashboard never looks empty on
   a first-ever visit before any other page has
   been opened.
   ============================================ */

const KEYS = {
  calendar: 'sacradigit_media_calendar',
  library: 'sacradigit_media_library',
  livestream: 'sacradigit_media_livestream',
  coverage: 'sacradigit_media_coverage',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function seedIfMissing(key, value) {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

document.addEventListener('DOMContentLoaded', () => {

  // Minimal seed so the dashboard has something to show even before
  // the person has visited the calendar/coverage/library pages.
  seedIfMissing(KEYS.calendar, [
    { id: 'c1', date: '2026-09-13', title: 'Sunday Mass Schedule Graphic', type: 'scheduled', platform: 'Facebook' },
    { id: 'c2', date: '2026-09-14', title: 'Feast of the Exaltation of the Cross — greeting', type: 'draft', platform: 'Facebook' },
    { id: 'c3', date: '2026-09-19', title: 'Recollection reminder', type: 'scheduled', platform: 'Facebook' },
  ]);
  seedIfMissing(KEYS.library, [
    { id: 'm1', title: 'Parish Fiesta 2026 — Album 1', tag: 'Event', type: 'photo', dateAdded: '2026-08-20', uploadedBy: 'Media Team' },
    { id: 'm2', title: 'Sunday Homily — Sept 7', tag: 'Homily', type: 'video', dateAdded: '2026-09-07', uploadedBy: 'Media Team' },
  ]);
  seedIfMissing(KEYS.livestream, { isLive: false, platform: 'Facebook', url: '', updatedAt: '' });
  seedIfMissing(KEYS.coverage, [
    { id: 'r1', eventName: 'Youth Ministry Recollection', date: '2026-09-20', location: 'Parish Hall', contact: 'Youth Ministry', notes: 'Need photos + short recap video', status: 'pending' },
    { id: 'r2', eventName: 'First Communion Batch 2', date: '2026-09-27', location: 'Main Church', contact: 'Catechism Office', notes: '', status: 'approved' },
  ]);

  const calendar = readJSON(KEYS.calendar, []);
  const library = readJSON(KEYS.library, []);
  const livestream = readJSON(KEYS.livestream, { isLive: false });
  const coverage = readJSON(KEYS.coverage, []);

  // ---- Stat cards ----
  const scheduledCount = calendar.filter(c => c.type === 'scheduled').length;
  document.getElementById('stat-scheduled').textContent = String(scheduledCount);

  const pendingCount = coverage.filter(r => r.status === 'pending').length;
  document.getElementById('stat-pending').textContent = String(pendingCount);

  document.getElementById('stat-library').textContent = String(library.length);

  const liveStatEl = document.getElementById('stat-livestream');
  const liveSubEl = document.getElementById('stat-livestream-sub');
  if (livestream.isLive) {
    liveStatEl.textContent = 'Live';
    liveStatEl.style.color = '#dc2626';
    liveSubEl.textContent = `on ${livestream.platform || 'stream'}`;
  } else {
    liveStatEl.textContent = 'Off';
    liveSubEl.textContent = 'not streaming';
  }

  // ---- Upcoming content list ----
  const upcomingEl = document.getElementById('upcoming-content-list');
  const upcoming = [...calendar]
    .filter(c => c.type !== 'published')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (upcoming.length === 0) {
    upcomingEl.innerHTML = '<li class="empty-state">Nothing scheduled yet. <a href="content-calendar.html" style="color:#6c6fb0;">Add something →</a></li>';
  } else {
    upcomingEl.innerHTML = upcoming.map(c => `
      <li class="list-row flex items-center justify-between text-sm">
        <div class="min-w-0">
          <p class="list-name truncate">${escapeHtml(c.title)}</p>
          <p class="list-time">${formatDate(c.date)} · ${escapeHtml(c.platform || '')}</p>
        </div>
        <span class="badge badge-${c.type}">${capitalize(c.type)}</span>
      </li>
    `).join('');
  }

  // ---- Pending approvals list ----
  const pendingEl = document.getElementById('pending-approvals-list');
  const pending = coverage.filter(r => r.status === 'pending').slice(0, 5);

  if (pending.length === 0) {
    pendingEl.innerHTML = '<li class="empty-state">No pending requests right now.</li>';
  } else {
    pendingEl.innerHTML = pending.map(r => `
      <li class="list-row flex items-center justify-between text-sm">
        <div class="min-w-0">
          <p class="list-name truncate">${escapeHtml(r.eventName)}</p>
          <p class="list-time">${formatDate(r.date)} · ${escapeHtml(r.location || '')}</p>
        </div>
        <span class="badge badge-pending">Pending</span>
      </li>
    `).join('');
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
