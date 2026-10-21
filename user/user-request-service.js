/* ============================================
   SacraDigit — User Request a Service Scripts
   Runs after user-shell.js.
   Browsing only — each card opens that service's
   own request page (see service-request-page.js),
   and the tracking log lives on
   user-requested-services.html/.js.
   ============================================ */

import { describeSchedule, serviceSchedulesReady } from '../service-schedule.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES, needsApproval } from '../service-catalog.js';
import { SERVICE_PAGES } from './service-request-page.js';

document.addEventListener('DOMContentLoaded', () => {

  const svcTypeGrid = document.getElementById('svc-type-grid');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* --- Services We Offer — on-page catalog, grouped into a labeled row
     per category (Blessings, Sacraments, Special Masses) instead of one
     undifferentiated grid, so it's clear at a glance what kind of
     request each card is. --- */
  // "Mon–Sat · 09:00 AM, 10:30 AM" → days on one line, each time as a small chip
  const CLOCK_ICON = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  function schedHtml(name) {
    const [days, times = ''] = describeSchedule(name).split(' · ');
    const chips = times.split(', ').filter(Boolean)
      .map(t => `<span class="svc-time-chip">${escapeHtml(t.replace(/^0(\d)/, '$1'))}</span>`).join('');
    return `<span class="svc-sched-days">${CLOCK_ICON}${escapeHtml(days)}</span>${chips ? `<span class="svc-sched-times">${chips}</span>` : ''}`;
  }

  function svcCardHtml(s) {
    return `
    <a href="${SERVICE_PAGES[s.id]}" class="svc-type-card" data-id="${s.id}">
      <div class="svc-type-head">
        <div class="svc-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
        <p class="svc-type-name">${escapeHtml(s.name)}</p>
      </div>
      <p class="svc-type-desc">${escapeHtml(s.desc)}</p>
      <div class="svc-type-sched">${schedHtml(s.name)}</div>
      <div class="svc-type-foot">
        ${needsApproval(s.name) ? '<span class="svc-type-approval" title="The parish office approves blessing requests first">Needs approval</span>' : '<span></span>'}
        <span class="svc-type-cta">Start request
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </span>
      </div>
    </a>`;
  }

  svcTypeGrid.innerHTML = SERVICE_CATEGORIES.map(cat => {
    const items = SERVICE_TYPES.filter(s => s.category === cat.key && SERVICE_PAGES[s.id]);
    if (!items.length) return '';
    return `
    <div class="svc-category-block">
      <div class="svc-category-header">
        <h3 class="svc-category-title">${escapeHtml(cat.label)}</h3>
        <p class="svc-category-desc">${escapeHtml(cat.desc)}</p>
      </div>
      <div class="svc-type-row">${items.map(svcCardHtml).join('')}</div>
    </div>`;
  }).join('');

  // Refresh the day/time line once any schedule edits saved by ITech have loaded.
  serviceSchedulesReady.then(() => {
    svcTypeGrid.querySelectorAll('.svc-type-card').forEach(card => {
      const svc = SERVICE_TYPES.find(s => s.id === card.dataset.id);
      const line = card.querySelector('.svc-type-sched');
      if (svc && line) line.innerHTML = schedHtml(svc.name);
    });
  });

});
