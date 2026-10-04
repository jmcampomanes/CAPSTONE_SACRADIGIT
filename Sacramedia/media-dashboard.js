/* ============================================
   SacraDigit Media — Dashboard Scripts
   Summary of the other Media pages, live from the
   same database models they use: ContentCalendarEntry
   (scheduled posts + upcoming list), EventCoverageRequest
   (pending approvals), CloudFile in folder 'media'
   (media files) and the livestream status.
   ============================================ */

import { client } from '../amplify-init.js';
import { watchLivestream } from '../livestream-status.js';

document.addEventListener('DOMContentLoaded', () => {

  // ---- Content calendar: scheduled count + upcoming list ----
  const scheduledEl = document.getElementById('stat-scheduled');
  const upcomingEl = document.getElementById('upcoming-content-list');
  if (client.models.ContentCalendarEntry) {
    client.models.ContentCalendarEntry.observeQuery().subscribe({
      next: ({ items }) => renderCalendar(items),
      error: (err) => { console.error('Failed to load the content calendar:', err); scheduledEl.textContent = '–'; },
    });
  } else {
    scheduledEl.textContent = '–';
  }

  function renderCalendar(calendar) {
    scheduledEl.textContent = String(calendar.filter(c => c.status === 'scheduled').length);
    const upcoming = calendar
      .filter(c => c.status !== 'published')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5);

    if (upcoming.length === 0) {
      upcomingEl.innerHTML = '<li class="empty-state">Nothing scheduled yet. <a href="content-calendar.html" style="color:#6c6fb0;">Add something →</a></li>';
      return;
    }
    upcomingEl.innerHTML = upcoming.map(c => {
      const status = c.status || 'draft';
      return `
      <li class="list-row flex items-center justify-between text-sm">
        <div class="min-w-0">
          <p class="list-name truncate">${escapeHtml(c.title)}</p>
          <p class="list-time">${formatDate(c.date)} · ${escapeHtml(c.platform || '')}</p>
        </div>
        <span class="badge badge-${status}">${capitalize(status)}</span>
      </li>`;
    }).join('');
  }

  // ---- Event coverage: pending count + approvals list ----
  const pendingStatEl = document.getElementById('stat-pending');
  const pendingEl = document.getElementById('pending-approvals-list');
  if (client.models.EventCoverageRequest) {
    client.models.EventCoverageRequest.observeQuery().subscribe({
      next: ({ items }) => renderCoverage(items),
      error: (err) => { console.error('Failed to load coverage requests:', err); pendingStatEl.textContent = '–'; },
    });
  } else {
    pendingStatEl.textContent = '–';
  }

  function renderCoverage(coverage) {
    const pending = coverage
      .filter(r => (r.status || 'pending') === 'pending')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    pendingStatEl.textContent = String(pending.length);

    if (pending.length === 0) {
      pendingEl.innerHTML = '<li class="empty-state">No pending requests right now.</li>';
      return;
    }
    pendingEl.innerHTML = pending.slice(0, 5).map(r => `
      <li class="list-row flex items-center justify-between text-sm">
        <div class="min-w-0">
          <p class="list-name truncate">${escapeHtml(r.eventName)}</p>
          <p class="list-time">${formatDate(r.date)} · ${escapeHtml(r.location || '')}</p>
        </div>
        <span class="badge badge-pending">Pending</span>
      </li>`).join('');
  }

  const libraryStatEl = document.getElementById('stat-library');
  client.models.CloudFile.observeQuery({ filter: { folder: { eq: 'media' } } }).subscribe({
    next: ({ items }) => { libraryStatEl.textContent = String(items.length); },
    error: (err) => {
      console.error('Failed to count media files:', err);
      libraryStatEl.textContent = '–';
    },
  });

  const liveStatEl = document.getElementById('stat-livestream');
  const liveSubEl = document.getElementById('stat-livestream-sub');
  watchLivestream(client, (livestream) => {
    if (livestream.isLive) {
      liveStatEl.textContent = 'Live';
      liveStatEl.style.color = '#dc2626';
      liveSubEl.textContent = `on ${livestream.platform || 'stream'}`;
    } else {
      liveStatEl.textContent = 'Off';
      liveStatEl.style.color = '';
      liveSubEl.textContent = 'not streaming';
    }
  });

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
