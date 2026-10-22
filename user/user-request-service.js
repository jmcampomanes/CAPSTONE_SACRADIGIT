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
  // "Mon–Sat · 09:00 AM, 10:30 AM" → days on one line, times as plain text
  // underneath (they used to be little chips that looked tappable but weren't).
  const CLOCK_ICON = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  function schedHtml(name) {
    const [days, times = ''] = describeSchedule(name).split(' · ');
    const list = times.split(', ').filter(Boolean).map(t => t.replace(/^0(\d)/, '$1')).join(', ');
    return `<span class="svc-sched-days">${CLOCK_ICON}${escapeHtml(days)}</span>${list ? `<span class="svc-sched-times">${escapeHtml(list)}</span>` : ''}`;
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
        ${needsApproval(s.name) ? '<span class="svc-type-approval" title="The parish office approves this request first">Needs approval</span>' : ''}
        <span class="svc-type-cta">Start request
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
    </a>`;
  }

  svcTypeGrid.innerHTML = SERVICE_CATEGORIES.map(cat => {
    const items = SERVICE_TYPES.filter(s => s.category === cat.key && SERVICE_PAGES[s.id]);
    if (!items.length) return '';
    return `
    <div class="svc-category-block hidden" data-cat="${cat.key}">
      <div class="svc-category-header">
        <p class="svc-category-desc">${escapeHtml(cat.desc)}</p>
      </div>
      <div class="svc-type-row">${items.map(svcCardHtml).join('')}</div>
    </div>`;
  }).join('');

  /* --- "What do you need?" — one big button per group. Choosing one
     shows only that group's services. The choice is kept in the URL
     (?need=blessing), so Back from a service page returns to the same list. --- */
  const NEEDS = [
    { key: 'blessing', label: 'Blessing', title: 'Blessings', hint: 'House, vehicle, business, or pet',
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>' },
    { key: 'sacrament', label: 'Sacrament', title: 'Sacraments', hint: 'Baptism, confirmation, wedding, and more',
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/>' },
    { key: 'special-mass', label: 'Mass for an occasion', title: 'Masses for an occasion', hint: 'Funeral, anniversary, or graduation',
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' },
  ];
  const needOptions = document.getElementById('svc-need-options');
  const listPanel   = document.getElementById('svc-list-panel');
  const listTitle   = document.getElementById('svc-list-title');

  needOptions.innerHTML = NEEDS.map(n => `
    <button type="button" class="svc-need-btn" data-need="${n.key}" aria-pressed="false" aria-controls="svc-list-panel">
      <svg class="svc-need-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg>
      <span class="svc-need-text">
        <span class="svc-need-label">${escapeHtml(n.label)}</span>
        <span class="svc-need-hint">${escapeHtml(n.hint)}</span>
      </span>
    </button>`).join('');

  function showNeed(key, { scroll = false } = {}) {
    const need = NEEDS.find(n => n.key === key);
    needOptions.querySelectorAll('.svc-need-btn').forEach(b => {
      const on = b.dataset.need === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    svcTypeGrid.querySelectorAll('.svc-category-block').forEach(block => {
      block.classList.toggle('hidden', block.dataset.cat !== key);
    });
    listPanel.classList.toggle('hidden', !need);
    if (!need) return;
    listTitle.textContent = need.title;
    const url = new URL(location.href);
    url.searchParams.set('need', key);
    history.replaceState(null, '', url);
    if (scroll) listPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  needOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.svc-need-btn');
    if (btn) showNeed(btn.dataset.need, { scroll: true });
  });

  const startNeed = new URLSearchParams(location.search).get('need');
  if (NEEDS.some(n => n.key === startNeed)) showNeed(startNeed);

  // Refresh the day/time line once any schedule edits saved by ITech have loaded.
  serviceSchedulesReady.then(() => {
    svcTypeGrid.querySelectorAll('.svc-type-card').forEach(card => {
      const svc = SERVICE_TYPES.find(s => s.id === card.dataset.id);
      const line = card.querySelector('.svc-type-sched');
      if (svc && line) line.innerHTML = schedHtml(svc.name);
    });
  });

});
