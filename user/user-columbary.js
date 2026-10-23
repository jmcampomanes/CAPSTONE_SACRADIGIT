/* ============================================
   SacraDigit — Columbary (parishioner)
   Runs after user-shell.js. Shows which niches are
   available (never who owns the others), lets the
   parishioner ask the office to reserve one, and lists
   their requests with the office's answer. Payments
   happen at the parish office. Data: ../columbary.js.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUser, currentUserName } from '../auth.js';
import { parishionerKey } from '../badges.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../mobile-number.js';
import {
  columbaryReady, listSections, readReservation, availableCount, nicheCode, cellKey, watch, create,
  ACTIVE, peso, fmtDate,
} from '../columbary.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg, isError) => window.showToast?.(msg, isError);

  if (!columbaryReady(client)) {
    $('col-unavailable').classList.remove('hidden');
    $('col-main').classList.add('hidden');
    return;
  }

  let sections = [];
  let mine = [];
  let activeSectionId = null;
  let picked = null; // { section, row, col }

  const STATUS = {
    requested: ['Waiting for the parish office', 'is-wait'],
    reserved: ['Reserved — pay at the parish office', 'is-ok'],
    paid: ['Fully paid', 'is-ok'],
    declined: ['Not approved', 'is-no'],
    cancelled: ['Cancelled', 'is-no'],
  };

  function loadSections() {
    return listSections(client)
      .then(list => { sections = list; render(); })
      .catch(err => { console.error('Could not load the columbary:', err); toast('Couldn’t load the columbary. Please try again.', true); });
  }
  loadSections();
  // Parishioners can only read their own requests anyway (owner rule); staff
  // opening the portal can read all of them, so keep just the ones they made.
  const mySub = currentUser()?.sub || '';
  watch(client, 'NicheReservation', (items) => {
    mine = items.filter(r => !mySub || String(r.owner || '').startsWith(mySub)).map(readReservation);
    render();
  });

  const myActiveAt = (s, r, c) => mine.find(x => x.sectionId === s.id && x.row === r && x.col === c && ACTIVE.has(x.status));

  function render() {
    if (!activeSectionId || !sections.some(s => s.id === activeSectionId)) activeSectionId = sections[0]?.id || null;
    renderMine();
    const free = sections.reduce((n, s) => n + availableCount(s), 0);
    $('ucol-free').textContent = sections.length ? `${free} niche${free === 1 ? '' : 's'} available` : '';
    $('col-sections').innerHTML = sections.map(s => `
      <button type="button" class="col-chip${s.id === activeSectionId ? ' active' : ''}" data-section="${s.id}">
        ${esc(s.name)} <span class="col-chip-sub">${availableCount(s)} available</span>
      </button>`).join('');
    const s = sections.find(x => x.id === activeSectionId);
    $('col-map-empty').classList.toggle('hidden', !!s);
    $('col-section-note').textContent = s?.note || '';
    if (!s) { $('col-map').innerHTML = ''; return; }

    let html = `<div class="col-grid" style="--cols:${s.columns}"><span class="col-corner"></span>`;
    for (let c = 1; c <= s.columns; c++) html += `<span class="col-colnum">${c}</span>`;
    for (let r = 1; r <= s.rows; r++) {
      html += `<span class="col-rownum">Row ${r}<small>${esc(peso(s.rowPrices[r - 1]))}</small></span>`;
      for (let c = 1; c <= s.columns; c++) {
        const k = cellKey(r, c);
        const code = nicheCode(s, r, c);
        const myReq = myActiveAt(s, r, c);
        const free = !s.blocked.has(k) && !s.taken.has(k);
        const state = myReq ? 'requested' : free ? 'available' : 'blocked';
        html += state === 'available'
          ? `<button type="button" class="col-cell s-available" data-r="${r}" data-c="${c}" aria-label="${esc(`Niche ${code}, available, ${peso(s.rowPrices[r - 1])}`)}" title="${esc(`${code} · ${peso(s.rowPrices[r - 1])}`)}">${c}</button>`
          : `<span class="col-cell s-${state}" role="img" aria-label="${esc(`Niche ${code}, ${myReq ? 'your request' : 'not available'}`)}" title="${esc(`${code} · ${myReq ? 'Your request' : 'Not available'}`)}">${c}</span>`;
      }
    }
    $('col-map').innerHTML = `${html}</div>`;
  }

  function renderMine() {
    const list = mine.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    $('ucol-mine-wrap').classList.toggle('hidden', !list.length);
    $('ucol-mine').innerHTML = list.map(r => {
      const [label, tone] = STATUS[r.status] || [r.status, ''];
      return `
        <li class="ucol-req">
          <span class="ucol-req-code">${esc(r.nicheCode)}</span>
          <span class="ucol-req-main">
            <strong class="ucol-status ${tone}">${esc(label)}</strong>
            <small>${esc(peso(r.price))} · ${r.paymentPlan === 'cash' ? 'Cash' : 'Installment'} · requested ${esc(fmtDate(String(r.createdAt || '').slice(0, 10)))}</small>
            ${r.declineReason && (r.status === 'declined' || r.status === 'cancelled') ? `<small class="ucol-reason">${esc(r.declineReason)}</small>` : ''}
          </span>
        </li>`;
    }).join('');
  }

  $('col-sections').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-section]');
    if (!chip) return;
    activeSectionId = chip.dataset.section;
    render();
  });

  /* ---------- request a niche ---------- */
  $('col-map').addEventListener('click', (e) => {
    const cell = e.target.closest('button.col-cell');
    if (!cell) return;
    const section = sections.find(s => s.id === activeSectionId);
    picked = { section, row: Number(cell.dataset.r), col: Number(cell.dataset.c) };
    const price = section.rowPrices[picked.row - 1];
    $('ucol-pick').innerHTML = `
      <div class="ucol-pick-medal">${esc(nicheCode(section, picked.row, picked.col))}</div>
      <div>
        <p class="ucol-pick-where">${esc(section.name)} · Row ${picked.row}, niche ${picked.col}</p>
        <p class="ucol-pick-price">${esc(peso(price))}</p>
      </div>`;
    const user = currentUser() || {};
    if (!$('uq-name').value) $('uq-name').value = currentUserName();
    if (!$('uq-email').value) $('uq-email').value = user.email || '';
    openModal($('ucol-request'));
    $('uq-contact').focus();
  });

  $('uq-submit').addEventListener('click', async () => {
    if (!picked) return;
    const name = $('uq-name').value.trim();
    const contact = mobileDigits($('uq-contact').value);
    const bad = (el, msg) => { el.classList.add('border-red-400'); el.focus(); toast(msg, true); };
    [$('uq-name'), $('uq-contact')].forEach(el => el.classList.remove('border-red-400'));
    if (!name) return bad($('uq-name'), 'Type the name of the buyer.');
    if (!isMobile(contact)) return bad($('uq-contact'), MOBILE_HINT);
    const { section, row, col } = picked;
    if (myActiveAt(section, row, col)) { toast('You already asked for this niche.', true); return; }

    const btn = $('uq-submit');
    btn.disabled = true;
    try {
      // Check again in case someone reserved it a moment ago.
      await loadSections();
      const fresh = sections.find(s => s.id === section.id);
      if (!fresh || fresh.taken.has(cellKey(row, col)) || fresh.blocked.has(cellKey(row, col))) {
        toast('Sorry — that niche was just taken. Please choose another.', true);
        closeModal($('ucol-request'));
        return;
      }
      await create(client, 'NicheReservation', {
        sectionId: section.id, row, col, nicheCode: nicheCode(section, row, col),
        ownerName: name, ownerKey: parishionerKey(name), contact, email: $('uq-email').value.trim(),
        price: fresh.rowPrices[row - 1], paymentPlan: $('uq-plan').value, status: 'requested',
        notes: $('uq-notes').value.trim(), occupants: '[]', requestedOnline: true,
      });
      toast(`Request sent for niche ${nicheCode(section, row, col)}. The parish office will contact you.`);
      $('uq-notes').value = '';
      closeModal($('ucol-request'));
    } catch (err) {
      console.error('Could not send the niche request:', err);
      toast(err.message || 'Couldn’t send your request. Please try again.', true);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- modal ---------- */
  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) { if (m.classList.contains('hidden')) return; m.classList.add('hidden'); document.body.style.overflow = ''; }
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal-overlay'))));
  $('ucol-request').addEventListener('click', (e) => { if (e.target === $('ucol-request')) closeModal($('ucol-request')); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal($('ucol-request')); });
});
