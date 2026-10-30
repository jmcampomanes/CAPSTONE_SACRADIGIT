/* ============================================
   SacraDigit — User Request a Service Scripts
   Runs after user-shell.js.
   Browsing only — each card opens that service's
   own request page (see service-request-page.js),
   and the tracking log lives on
   user-requested-services.html/.js.
   ============================================ */

import { serviceSchedulesReady } from '../../shared/js/service-schedule.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES, SERVICE_NEEDS, serviceCardHtml, scheduleHtml, needButtonsHtml } from '../../shared/js/service-catalog.js';
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
  svcTypeGrid.innerHTML = SERVICE_CATEGORIES.map(cat => {
    const items = SERVICE_TYPES.filter(s => s.category === cat.key && SERVICE_PAGES[s.id]);
    if (!items.length) return '';
    return `
    <div class="svc-category-block hidden" data-cat="${cat.key}">
      <div class="svc-category-header">
        <p class="svc-category-desc">${escapeHtml(cat.desc)}</p>
      </div>
      <div class="svc-type-row">${items.map(s => serviceCardHtml(s, { href: SERVICE_PAGES[s.id] })).join('')}</div>
    </div>`;
  }).join('');

  /* --- "What do you need?" — one big button per group. Choosing one
     shows only that group's services. The choice is kept in the URL
     (?need=blessing), so Back from a service page returns to the same list. --- */
  const NEEDS = SERVICE_NEEDS; // ../../shared/js/service-catalog.js
  const needOptions = document.getElementById('svc-need-options');
  const listPanel   = document.getElementById('svc-list-panel');
  const listTitle   = document.getElementById('svc-list-title');

  needOptions.innerHTML = needButtonsHtml();
  needOptions.querySelectorAll('.svc-need-btn').forEach(b => b.setAttribute('aria-controls', 'svc-list-panel'));

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
      if (svc && line) line.innerHTML = scheduleHtml(svc.name);
    });
  });

});
