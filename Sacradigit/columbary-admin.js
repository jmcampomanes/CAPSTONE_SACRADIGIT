/* ============================================
   SacraDigit Admin — Columbary
   Runs after dashboard.js. Data and rules: ../columbary.js.

   Niche Map      every wall as a grid; click a niche to reserve
                  it (walk-in), or open its reservation
   Reservations   parishioners' online requests (approve /
                  decline), families paying, fully paid,
                  maintenance due
   Walls & Prices (Head Admin) the walls, their size and the
                  price of each row; niches can be marked
                  "not for sale" from the map

   A reservation: requested → reserved (paying) → paid
   (vault usable) → in use (first inurnment starts the
   ₱100/month maintenance). The Secretary handles
   reservations and payments; walls and prices are the
   Head Admin's.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUserName, isHeadAdmin } from '../auth.js';
import { parishionerKey } from '../badges.js';
import {
  columbaryReady, readSection, sortSections, readReservation, nicheState, nicheCode, cellKey, accountOf,
  availableCount, totalNiches, sectionPayload, syncTaken, watch, create, update, remove,
  ACTIVE, OWNED, STATUS_LABEL, MAINTENANCE_PER_MONTH, peso, fmtDate, todayIso,
} from '../columbary.js';
import { notifyServiceUpdate } from '../email-notify.js';
import { printReport, esc } from '../print-report.js';
import { logActivity } from '../activity-log.js';
import { showToast, confirmDialog, reasonDialog, reportEmail } from './admin-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const headAdmin = isHeadAdmin();
  const me = () => currentUserName() || 'Parish Office';

  if (!columbaryReady(client)) {
    $('col-unavailable').classList.remove('hidden');
    $('col-main').classList.add('hidden');
    return;
  }

  let sections = [];
  let reservations = [];
  let payments = [];
  let activeSectionId = null;
  let activeTab = 'map';
  let filter = 'requested';
  let query = '';
  let openNiche = null; // { sectionId, row, col } or { reservationId }
  let busy = false;

  watch(client, 'ColumbarySection', (items) => { sections = sortSections(items.map(readSection)); renderAll(); });
  watch(client, 'NicheReservation', (items) => { reservations = items.map(readReservation); renderAll(); });
  watch(client, 'NichePayment', (items) => { payments = items; renderAll(); });

  const sectionById = (id) => sections.find(s => s.id === id);
  const activeOf = (sectionId, row, col) => {
    const here = reservations.filter(r => r.sectionId === sectionId && r.row === row && r.col === col && ACTIVE.has(r.status));
    return here.find(r => OWNED.has(r.status)) || here[0] || null;
  };
  const requestsFor = (r) => reservations.filter(x => x.id !== r.id && x.sectionId === r.sectionId && x.row === r.row && x.col === r.col && x.status === 'requested');

  /* ---------- tabs ---------- */
  document.querySelectorAll('.col-tab').forEach(tab => tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.col-tab').forEach(t => { const on = t === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
    ['map', 'list', 'setup'].forEach(k => $(`col-panel-${k}`).classList.toggle('hidden', k !== activeTab));
  }));

  function renderAll() {
    if (!activeSectionId || !sectionById(activeSectionId)) activeSectionId = sections[0]?.id || null;
    renderStats();
    renderMap();
    renderList();
    renderSetup();
    if (openNiche && !$('col-niche').classList.contains('hidden')) renderNiche();
  }

  /* ---------- stats ---------- */
  function renderStats() {
    const total = sections.reduce((n, s) => n + totalNiches(s), 0);
    const free = sections.reduce((n, s) => n + availableCount(s), 0);
    const owned = reservations.filter(r => OWNED.has(r.status));
    const waiting = reservations.filter(r => r.status === 'requested').length;
    const balance = owned.reduce((n, r) => n + accountOf(r, payments).balance, 0);
    const arrears = owned.reduce((n, r) => n + accountOf(r, payments).maintArrears, 0);
    const tile = (label, value, tone = '') => `<div class="col-stat ${tone}"><p class="col-stat-value">${value}</p><p class="col-stat-label">${label}</p></div>`;
    $('col-stats').innerHTML =
      tile('Available niches', `${free}<small> / ${total}</small>`) +
      tile('Requests waiting', waiting, waiting ? 'is-alert' : '') +
      tile('In use', owned.filter(r => r.occupants.length).length) +
      tile('Balances to collect', peso(balance)) +
      tile('Maintenance due', peso(arrears), arrears ? 'is-alert' : '');
    const badge = $('col-count-requests');
    badge.hidden = !waiting;
    badge.textContent = waiting;
  }

  /* ---------- map ---------- */
  function renderMap() {
    $('col-sections').innerHTML = sections.map(s => `
      <button type="button" class="col-chip${s.id === activeSectionId ? ' active' : ''}" data-section="${s.id}">
        ${esc(s.name)} <span class="col-chip-sub">${availableCount(s)} free</span>
      </button>`).join('');
    const s = sectionById(activeSectionId);
    $('col-map-empty').classList.toggle('hidden', !!s);
    $('col-section-note').textContent = s?.note || '';
    if (!s) { $('col-map').innerHTML = ''; return; }

    let html = `<div class="col-grid" style="--cols:${s.columns}">`;
    html += '<span class="col-corner"></span>';
    for (let c = 1; c <= s.columns; c++) html += `<span class="col-colnum">${c}</span>`;
    for (let r = 1; r <= s.rows; r++) {
      html += `<span class="col-rownum" title="${esc(peso(s.rowPrices[r - 1]))}">Row ${r}<small>${esc(peso(s.rowPrices[r - 1]))}</small></span>`;
      for (let c = 1; c <= s.columns; c++) {
        const res = activeOf(s.id, r, c);
        const state = nicheState(s, r, c, res);
        const code = nicheCode(s, r, c);
        const who = res ? ` — ${res.ownerName}` : '';
        html += `<button type="button" class="col-cell s-${state}" data-r="${r}" data-c="${c}" title="${esc(`${code}${who} · ${STATUS_LABEL[state] || (state === 'occupied' ? 'In use' : state === 'blocked' ? 'Not for sale' : 'Available')}`)}" aria-label="${esc(`${code}, ${state}`)}">${c}</button>`;
      }
    }
    $('col-map').innerHTML = html + '</div>';
  }

  $('col-sections').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-section]');
    if (!chip) return;
    activeSectionId = chip.dataset.section;
    renderMap();
  });
  $('col-map').addEventListener('click', (e) => {
    const cell = e.target.closest('.col-cell');
    if (!cell) return;
    openNiche = { sectionId: activeSectionId, row: Number(cell.dataset.r), col: Number(cell.dataset.c) };
    renderNiche();
    openModal($('col-niche'));
  });

  /* ---------- reservations list ---------- */
  const inFilter = (r) => {
    if (filter === 'requested') return r.status === 'requested';
    if (filter === 'reserved') return r.status === 'reserved';
    if (filter === 'paid') return r.status === 'paid';
    if (filter === 'dues') return OWNED.has(r.status) && accountOf(r, payments).maintArrears > 0;
    return r.status === 'declined' || r.status === 'cancelled';
  };

  function renderList() {
    const q = query.trim().toLowerCase();
    const shown = reservations
      .filter(inFilter)
      .filter(r => !q || `${r.ownerName} ${r.nicheCode}`.toLowerCase().includes(q))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    $('col-list-empty').classList.toggle('hidden', shown.length > 0);
    $('col-list-empty').textContent = q ? 'No reservations match your search.' : 'Nothing here right now.';
    $('col-list').innerHTML = shown.map(r => {
      const acc = accountOf(r, payments);
      const money = OWNED.has(r.status)
        ? `<span>${acc.balance ? `Balance <strong>${peso(acc.balance)}</strong>` : '<strong class="col-ok">Fully paid</strong>'}</span>${acc.maintArrears ? `<span class="col-due">Maintenance due ${peso(acc.maintArrears)}</span>` : ''}`
        : `<span>${peso(r.price)}${r.paymentPlan ? ` · ${r.paymentPlan === 'installment' ? 'Installment' : 'Cash'}` : ''}</span>`;
      return `
        <button type="button" class="col-row" data-res="${r.id}">
          <span class="col-row-code">${esc(r.nicheCode)}</span>
          <span class="col-row-main">
            <strong>${esc(r.ownerName)}</strong>
            <small>${esc(STATUS_LABEL[r.status] || r.status)}${r.occupants.length ? ` · ${r.occupants.length} inurned` : ''}${r.requestedOnline && r.status === 'requested' ? ' · requested online' : ''} · ${esc(fmtDate(String(r.createdAt || '').slice(0, 10)))}</small>
          </span>
          <span class="col-row-money">${money}</span>
        </button>`;
    }).join('');
  }

  $('col-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    filter = chip.dataset.filter;
    $('col-filters').querySelectorAll('.col-chip').forEach(c => c.classList.toggle('active', c === chip));
    renderList();
  });
  $('col-search').addEventListener('input', (e) => { query = e.target.value; renderList(); });
  $('col-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-res]');
    if (!row) return;
    openNiche = { reservationId: row.dataset.res };
    renderNiche();
    openModal($('col-niche'));
  });

  /* ---------- niche / reservation modal ---------- */
  function currentNiche() {
    if (openNiche?.reservationId) {
      const r = reservations.find(x => x.id === openNiche.reservationId);
      return r ? { section: sectionById(r.sectionId), row: r.row, col: r.col, res: r } : null;
    }
    const section = sectionById(openNiche?.sectionId);
    if (!section) return null;
    return { section, row: openNiche.row, col: openNiche.col, res: activeOf(section.id, openNiche.row, openNiche.col) };
  }

  function renderNiche() {
    const n = currentNiche();
    if (!n || !n.section) { closeModal($('col-niche')); return; }
    const { section, row, col, res } = n;
    const code = res?.nicheCode || nicheCode(section, row, col);
    const rowPrice = section.rowPrices[row - 1];
    $('col-niche-title').textContent = `Niche ${code}`;
    const where = `<p class="col-where">${esc(section.name)} · Row ${row}, niche ${col} · Row price ${esc(peso(rowPrice))}</p>`;
    const foot = $('col-niche-foot');

    if (!res && section.blocked.has(cellKey(row, col))) {
      $('col-niche-body').innerHTML = `${where}<p class="col-state s-blocked">Not for sale</p><p class="col-hint">Kept off the map for parishioners (e.g. reserved for clergy, or under repair).</p>`;
      foot.innerHTML = `<button type="button" class="btn-secondary" data-close-modal>Close</button>${headAdmin ? '<button type="button" class="btn-lavender" data-act="unblock">Make Available</button>' : ''}`;
      return;
    }

    if (!res) {
      $('col-niche-body').innerHTML = `${where}
        <p class="col-state s-available">Available</p>
        <h4 class="col-h">Reserve for a family (walk-in)</h4>
        <div class="col-form-grid">
          <div class="col-span2"><label class="form-label" for="rv-owner">Name of the buyer <span class="text-red-500">*</span></label><input id="rv-owner" class="form-input" maxlength="80" /></div>
          <div><label class="form-label" for="rv-contact">Contact number</label><input id="rv-contact" class="form-input" maxlength="30" /></div>
          <div><label class="form-label" for="rv-email">Email</label><input id="rv-email" type="email" class="form-input" maxlength="80" /></div>
          <div><label class="form-label" for="rv-plan">Payment</label><select id="rv-plan" class="form-input"><option value="installment">Installment</option><option value="cash">Cash (full)</option></select></div>
          <div><label class="form-label" for="rv-price">Price</label><input id="rv-price" type="number" class="form-input" min="0" step="0.01" value="${rowPrice}" /></div>
          <div class="col-span2"><label class="form-label" for="rv-notes">Notes <span class="col-optional">(optional)</span></label><input id="rv-notes" class="form-input" maxlength="200" /></div>
        </div>`;
      foot.innerHTML = `${headAdmin ? '<button type="button" class="btn-secondary col-left" data-act="block">Mark Not for Sale</button>' : ''}<button type="button" class="btn-secondary" data-close-modal>Cancel</button><button type="button" class="btn-lavender" data-act="reserve">Reserve Niche</button>`;
      return;
    }

    const acc = accountOf(res, payments);
    const others = requestsFor(res);
    const pct = res.price ? Math.min(100, Math.round((acc.paidNiche / res.price) * 100)) : 100;
    const owned = OWNED.has(res.status);
    const occupants = res.occupants.map(o => `<li><strong>${esc(o.name)}</strong><small>${o.dateOfDeath ? `Died ${esc(fmtDate(o.dateOfDeath))} · ` : ''}Inurned ${esc(fmtDate(o.inurnedOn))}</small></li>`).join('');

    $('col-niche-body').innerHTML = `${where}
      <p class="col-state s-${res.occupants.length ? 'occupied' : res.status}">${esc(res.occupants.length && owned ? 'In use' : STATUS_LABEL[res.status] || res.status)}</p>
      ${res.status === 'declined' || res.status === 'cancelled' ? `<p class="col-warn">${esc(res.declineReason || 'No reason given.')}</p>` : ''}
      ${others.length ? `<p class="col-warn">${others.length} other ${others.length === 1 ? 'family has' : 'families have'} also asked for this niche: ${others.map(o => esc(o.ownerName)).join(', ')}. Approving this one declines the others.</p>` : ''}
      <dl class="col-facts">
        <div><dt>Buyer</dt><dd>${esc(res.ownerName)}</dd></div>
        <div><dt>Contact</dt><dd>${esc([res.contact, res.email].filter(Boolean).join(' · ') || '—')}</dd></div>
        <div><dt>Price</dt><dd>${esc(peso(res.price))} · ${res.paymentPlan === 'cash' ? 'Cash' : 'Installment'}</dd></div>
        <div><dt>${res.requestedOnline ? 'Requested online' : 'Reserved'}</dt><dd>${esc(fmtDate(String(res.createdAt || '').slice(0, 10)))}</dd></div>
        ${res.notes ? `<div class="col-span2"><dt>Notes</dt><dd>${esc(res.notes)}</dd></div>` : ''}
      </dl>
      ${owned ? `
        <div class="col-account">
          <div class="col-meter"><span style="width:${pct}%"></span></div>
          <p><strong>${esc(peso(acc.paidNiche))}</strong> paid of ${esc(peso(res.price))}${acc.balance ? ` · <strong>${esc(peso(acc.balance))}</strong> left` : ' · <strong class="col-ok">Fully paid — vault can be used</strong>'}</p>
          ${res.firstUseDate ? `<p>Maintenance since ${esc(fmtDate(res.firstUseDate))}: ${acc.months} month${acc.months === 1 ? '' : 's'} × ${esc(peso(MAINTENANCE_PER_MONTH))} = ${esc(peso(acc.maintDue))}, paid ${esc(peso(acc.paidMaint))}${acc.maintArrears ? ` · <strong class="col-due">${esc(peso(acc.maintArrears))} due</strong>` : ' · up to date'}</p>` : '<p class="col-hint">Maintenance (₱100/month) starts with the first inurnment.</p>'}
        </div>
        <div id="col-form" class="col-inline-form hidden"></div>
        ${acc.payments.length ? `
          <h4 class="col-h">Payments</h4>
          <table class="col-table"><thead><tr><th>Date</th><th>For</th><th>OR #</th><th class="num">Amount</th><th></th></tr></thead><tbody>
          ${acc.payments.map(p => `<tr><td>${esc(fmtDate(p.paidOn))}</td><td>${p.kind === 'maintenance' ? 'Maintenance' : 'Niche'}${p.method ? ` · ${esc(p.method)}` : ''}</td><td>${esc(p.orNumber || '—')}</td><td class="num">${esc(peso(p.amount))}</td><td>${headAdmin ? `<button type="button" class="col-x" data-act="del-payment" data-id="${p.id}" aria-label="Delete payment">×</button>` : ''}</td></tr>`).join('')}
          </tbody></table>` : ''}
        <h4 class="col-h">Resting here</h4>
        ${occupants ? `<ul class="col-occupants">${occupants}</ul>` : '<p class="col-hint">No one yet.</p>'}` : ''}`;

    const btn = (act, label, cls = 'btn-secondary') => `<button type="button" class="${cls}" data-act="${act}">${label}</button>`;
    let actions = '';
    if (res.status === 'requested') actions = btn('decline', 'Decline', 'btn-danger-outline col-left') + btn('approve', 'Approve Reservation', 'btn-lavender');
    else if (owned) {
      actions = (headAdmin && !res.occupants.length ? btn('cancel', 'Cancel Reservation…', 'btn-danger-outline col-left') : '')
        + btn('print', 'Print Statement')
        + btn('inurn', 'Record Inurnment')
        + btn('pay', 'Record Payment', 'btn-lavender');
    }
    foot.innerHTML = `<button type="button" class="btn-secondary" data-close-modal>Close</button>${actions}`;
  }

  function showForm(kind) {
    const n = currentNiche();
    const form = $('col-form');
    if (!form || !n?.res) return;
    const acc = accountOf(n.res, payments);
    if (kind === 'pay') {
      const suggestNiche = acc.balance > 0;
      form.innerHTML = `
        <h4 class="col-h">Record a payment</h4>
        <div class="col-form-grid">
          <div><label class="form-label" for="pay-kind">For</label><select id="pay-kind" class="form-input"><option value="niche" ${suggestNiche ? 'selected' : ''}>Niche price</option><option value="maintenance" ${suggestNiche ? '' : 'selected'}>Maintenance</option></select></div>
          <div><label class="form-label" for="pay-amount">Amount <span class="text-red-500">*</span></label><input id="pay-amount" type="number" class="form-input" min="1" step="0.01" value="${suggestNiche ? '' : (acc.maintArrears || MAINTENANCE_PER_MONTH)}" placeholder="${suggestNiche ? `Balance ${acc.balance}` : ''}" /></div>
          <div><label class="form-label" for="pay-date">Date paid</label><input id="pay-date" type="date" class="form-input" value="${todayIso()}" /></div>
          <div><label class="form-label" for="pay-or">OR number</label><input id="pay-or" class="form-input" maxlength="30" /></div>
          <div><label class="form-label" for="pay-method">Method</label><select id="pay-method" class="form-input"><option>Cash</option><option>GCash</option><option>Bank</option><option>Check</option></select></div>
          <div class="col-form-actions"><button type="button" class="btn-lavender" data-act="save-payment">Save Payment</button></div>
        </div>`;
    } else {
      if (n.res.status !== 'paid') {
        form.innerHTML = '<p class="col-warn">The vault can be used only when the niche is fully paid (parish rule). Record the remaining payments first.</p>';
      } else {
        form.innerHTML = `
          <h4 class="col-h">Record an inurnment</h4>
          <div class="col-form-grid">
            <div class="col-span2"><label class="form-label" for="inu-name">Name of the deceased <span class="text-red-500">*</span></label><input id="inu-name" class="form-input" maxlength="80" /></div>
            <div><label class="form-label" for="inu-death">Date of death</label><input id="inu-death" type="date" class="form-input" /></div>
            <div><label class="form-label" for="inu-date">Date inurned</label><input id="inu-date" type="date" class="form-input" value="${todayIso()}" /></div>
            <p class="col-hint col-span2">${n.res.firstUseDate ? '' : 'This is the first inurnment here, so the ₱100/month maintenance starts this month. '}Check the death and cremation certificates first.</p>
            <div class="col-form-actions"><button type="button" class="btn-lavender" data-act="save-inurn">Save Inurnment</button></div>
          </div>`;
      }
    }
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.querySelector('input, select')?.focus();
  }

  const val = (id) => ($(id)?.value || '').trim();
  const flag = (id, msg) => { $(id).classList.add('border-red-400'); $(id).focus(); throw new Error(msg); };

  function emailOwner(r, status, extra = {}) {
    return notifyServiceUpdate({
      to: r.email, name: r.ownerName, serviceType: `Columbary niche ${r.nicheCode}`, status,
      location: 'Parish Columbary', contact: r.contact,
      detailsLines: [`Niche: ${r.nicheCode}`, `Price: ${peso(r.price)}`, `Payment: ${r.paymentPlan === 'cash' ? 'Cash' : 'Installment'}`],
      ...extra,
    });
  }

  async function act(name) {
    const n = currentNiche();
    if (!n) return;
    const { section, row, col, res } = n;
    switch (name) {
      case 'reserve': {
        const owner = val('rv-owner');
        if (!owner) flag('rv-owner', 'Type the buyer’s name.');
        if (activeOf(section.id, row, col)) throw new Error('Someone just reserved this niche.');
        const price = Number(val('rv-price')) || section.rowPrices[row - 1];
        const r = await create(client, 'NicheReservation', {
          sectionId: section.id, row, col, nicheCode: nicheCode(section, row, col),
          ownerName: owner, ownerKey: parishionerKey(owner), contact: val('rv-contact'), email: val('rv-email'),
          price, paymentPlan: val('rv-plan'), status: 'reserved', notes: val('rv-notes'),
          occupants: '[]', requestedOnline: false,
        });
        await syncTaken(client, section, [...reservations, readReservation(r)]);
        logActivity('Create', `Columbary — reserved ${r.nicheCode} for ${owner} (${peso(price)})`);
        openNiche = { reservationId: r.id };
        showToast(`Niche ${r.nicheCode} reserved for ${owner}. Record their first payment.`);
        return;
      }
      case 'block': case 'unblock': {
        const blocked = new Set(section.blocked);
        name === 'block' ? blocked.add(cellKey(row, col)) : blocked.delete(cellKey(row, col));
        await update(client, 'ColumbarySection', { id: section.id, blocked: JSON.stringify([...blocked]) });
        showToast(name === 'block' ? 'Marked not for sale.' : 'Niche is available again.');
        return;
      }
      case 'approve': {
        if (reservations.some(x => x.id !== res.id && x.sectionId === res.sectionId && x.row === res.row && x.col === res.col && OWNED.has(x.status))) {
          throw new Error('This niche is already reserved by another family. Decline this request instead.');
        }
        await update(client, 'NicheReservation', { id: res.id, status: 'reserved' });
        for (const o of requestsFor(res)) {
          await update(client, 'NicheReservation', { id: o.id, status: 'declined', declineReason: 'This niche was reserved by another family. Please choose another niche.' });
          emailOwner(o, 'declined', { declineReason: 'This niche was reserved by another family. Please choose another niche.' });
        }
        await syncTaken(client, section, reservations.map(x => (x.id === res.id ? { ...x, status: 'reserved' } : x)));
        logActivity('Approve', `Columbary — approved ${res.nicheCode} for ${res.ownerName}`);
        reportEmail(emailOwner(res, 'approved'), res.ownerName, `Reservation approved — ${res.nicheCode} is ${res.ownerName}’s.`);
        return;
      }
      case 'decline': case 'cancel': {
        const reason = await reasonDialog({
          title: name === 'decline' ? `Decline ${res.ownerName}’s request?` : `Cancel the reservation of ${res.nicheCode}?`,
          message: name === 'cancel' ? 'The niche becomes available again. Payments already recorded stay on file.' : '',
          confirmLabel: name === 'decline' ? 'Decline' : 'Cancel Reservation',
          input: { label: `Reason (${res.ownerName} will see this)`, placeholder: 'e.g. The family asked for a different row.' },
        });
        if (reason === null) return;
        await update(client, 'NicheReservation', { id: res.id, status: name === 'decline' ? 'declined' : 'cancelled', declineReason: reason });
        await syncTaken(client, section, reservations.map(x => (x.id === res.id ? { ...x, status: 'cancelled' } : x)));
        logActivity(name === 'decline' ? 'Reject' : 'Delete', `Columbary — ${name === 'decline' ? 'declined' : 'cancelled'} ${res.nicheCode} (${res.ownerName}): ${reason}`);
        reportEmail(emailOwner(res, name === 'decline' ? 'declined' : 'cancelled', { declineReason: reason }), res.ownerName, name === 'decline' ? 'Request declined.' : 'Reservation cancelled.');
        return;
      }
      case 'pay': case 'inurn': showForm(name); return;
      case 'save-payment': {
        const amount = Number(val('pay-amount'));
        if (!(amount > 0)) flag('pay-amount', 'Enter the amount paid.');
        const kind = val('pay-kind');
        await create(client, 'NichePayment', {
          reservationId: res.id, kind, amount, paidOn: val('pay-date') || todayIso(),
          orNumber: val('pay-or'), method: val('pay-method'), recordedByName: me(),
        });
        const paidNiche = accountOf(res, payments).paidNiche + (kind === 'niche' ? amount : 0);
        let msg = `${peso(amount)} recorded.`;
        if (kind === 'niche' && res.status === 'reserved' && paidNiche >= res.price) {
          await update(client, 'NicheReservation', { id: res.id, status: 'paid' });
          msg = `${peso(amount)} recorded — ${res.nicheCode} is fully paid. The vault can now be used.`;
        }
        logActivity('Create', `Columbary — ${kind} payment ${peso(amount)} for ${res.nicheCode} (${res.ownerName})${val('pay-or') ? `, OR ${val('pay-or')}` : ''}`);
        showToast(msg);
        return;
      }
      case 'save-inurn': {
        const nameOf = val('inu-name');
        if (!nameOf) flag('inu-name', 'Type the name of the deceased.');
        const inurnedOn = val('inu-date') || todayIso();
        const occupants = [...res.occupants, { name: nameOf, dateOfDeath: val('inu-death'), inurnedOn }];
        await update(client, 'NicheReservation', {
          id: res.id, occupants: JSON.stringify(occupants),
          ...(res.firstUseDate ? {} : { firstUseDate: inurnedOn }),
        });
        logActivity('Create', `Columbary — inurned ${nameOf} in ${res.nicheCode}`);
        showToast(`${nameOf} recorded in ${res.nicheCode}.`);
        return;
      }
      case 'del-payment': return; // handled with its id below
      case 'print': return printStatement(res);
      default:
    }
  }

  $('col-niche').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    if (b.dataset.act === 'del-payment') {
      const p = payments.find(x => x.id === b.dataset.id);
      if (!p) return;
      const sure = await confirmDialog({ title: `Delete the ${peso(p.amount)} payment?`, message: 'Only for a payment entered by mistake. It can’t be brought back.', confirmLabel: 'Delete', tone: 'danger' });
      if (!sure) return;
      try { await remove(client, 'NichePayment', p.id); showToast('Payment deleted.'); }
      catch (err) { showToast(err.message || 'Couldn’t delete the payment.', true); }
      return;
    }
    busy = true;
    b.disabled = true;
    try { await act(b.dataset.act); }
    catch (err) { console.error('Columbary action failed:', err); showToast(err.message || 'Something went wrong.', true); }
    finally { busy = false; b.disabled = false; }
  });

  function printStatement(r) {
    const acc = accountOf(r, payments);
    const rows = acc.payments.slice().reverse().map(p => `<tr><td class="nowrap">${esc(fmtDate(p.paidOn))}</td><td>${p.kind === 'maintenance' ? 'Maintenance' : 'Niche'}</td><td>${esc(p.method || '')}</td><td>${esc(p.orNumber || '')}</td><td class="num">${esc(peso(p.amount))}</td></tr>`).join('');
    printReport({
      title: 'Statement of Account',
      subtitle: `Niche ${r.nicheCode} · ${r.ownerName}`,
      chips: [['Status', STATUS_LABEL[r.status] || r.status], ['As of', fmtDate(todayIso())]],
      body: `
        <h2>Niche</h2>
        <table><tbody>
          <tr><td>Niche</td><td>${esc(r.nicheCode)} — ${esc(sectionById(r.sectionId)?.name || '')}</td></tr>
          <tr><td>Price</td><td>${esc(peso(r.price))} (${r.paymentPlan === 'cash' ? 'cash' : 'installment'})</td></tr>
          <tr><td>Paid toward the niche</td><td>${esc(peso(acc.paidNiche))}</td></tr>
          <tr><td><b>Balance</b></td><td><b>${esc(peso(acc.balance))}</b></td></tr>
          ${r.firstUseDate ? `<tr><td>Maintenance</td><td>${acc.months} month(s) since ${esc(fmtDate(r.firstUseDate))} × ${esc(peso(MAINTENANCE_PER_MONTH))} = ${esc(peso(acc.maintDue))}; paid ${esc(peso(acc.paidMaint))}; <b>due ${esc(peso(acc.maintArrears))}</b></td></tr>` : ''}
        </tbody></table>
        <h2>Payments</h2>
        ${rows ? `<table><thead><tr><th>Date</th><th>For</th><th>Method</th><th>OR #</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="note">No payments yet.</p>'}
        ${r.occupants.length ? `<h2>Resting here</h2><table><tbody>${r.occupants.map(o => `<tr><td>${esc(o.name)}</td><td>Inurned ${esc(fmtDate(o.inurnedOn))}</td></tr>`).join('')}</tbody></table>` : ''}
        <p class="note">Perpetual use. The vault can be used when fully paid. Maintenance fee: ${esc(peso(MAINTENANCE_PER_MONTH))} per month upon use.</p>`,
      signatures: ['Prepared by', 'Received by'],
    });
  }

  /* ---------- walls & prices ---------- */
  function renderSetup() {
    $('col-setup-list').innerHTML = sections.map(s => {
      const inUse = reservations.filter(r => r.sectionId === s.id && ACTIVE.has(r.status)).length;
      return `
        <article class="col-setup-card">
          <div>
            <h4>${esc(s.name)} <span class="col-code">${esc(s.code)}</span></h4>
            <p>${s.rows} rows × ${s.columns} niches · ${totalNiches(s)} for sale · ${inUse} reserved or requested</p>
            <p class="col-hint">${s.rowPrices.map((p, i) => `Row ${i + 1}: ${esc(peso(p))}`).join(' · ')}</p>
          </div>
          <button type="button" class="btn-secondary" data-edit-section="${s.id}">Edit</button>
        </article>`;
    }).join('') || '<p class="col-empty">No walls yet. Click “Add Wall” to set up the first one.</p>';
  }

  let editingSectionId = null;
  function paintPrices(rows, prices = []) {
    const current = [...$('sec-prices').querySelectorAll('input')].map(i => i.value);
    $('sec-prices').innerHTML = Array.from({ length: rows }, (_, i) => `
      <label class="col-price"><span>Row ${i + 1}</span><input type="number" class="form-input" min="0" step="0.01" value="${esc(prices[i] ?? current[i] ?? current[current.length - 1] ?? '')}" data-row="${i}" /></label>`).join('');
  }

  function openSection(s = null) {
    editingSectionId = s?.id || null;
    $('col-section-title').textContent = s ? `Edit ${s.name}` : 'Add Wall';
    $('sec-name').value = s?.name || '';
    $('sec-code').value = s?.code || String.fromCharCode(65 + sections.length);
    $('sec-order').value = s?.sortOrder ?? sections.length + 1;
    $('sec-rows').value = s?.rows || 6;
    $('sec-cols').value = s?.columns || 10;
    $('sec-note').value = s?.note || '';
    $('sec-prices').innerHTML = '';
    paintPrices(s?.rows || 6, s?.rowPrices || []);
    $('sec-delete').classList.toggle('hidden', !s);
    $('sec-warn').classList.add('hidden');
    openModal($('col-section-modal'));
  }

  $('col-add-section').addEventListener('click', () => openSection());
  $('col-setup-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-section]');
    if (b) openSection(sectionById(b.dataset.editSection));
  });
  $('sec-rows').addEventListener('input', () => {
    const rows = Math.max(1, Math.min(30, parseInt($('sec-rows').value, 10) || 1));
    paintPrices(rows);
  });

  $('sec-save').addEventListener('click', async () => {
    const name = val('sec-name');
    const code = val('sec-code').toUpperCase();
    const rows = Math.max(1, Math.min(30, parseInt($('sec-rows').value, 10) || 0));
    const columns = Math.max(1, Math.min(60, parseInt($('sec-cols').value, 10) || 0));
    const warn = (msg) => { $('sec-warn').textContent = msg; $('sec-warn').classList.remove('hidden'); };
    if (!name) return warn('Give the wall a name.');
    if (!/^[A-Z0-9]{1,3}$/.test(code)) return warn('The code is 1–3 letters or numbers, e.g. A.');
    if (sections.some(s => s.id !== editingSectionId && s.code === code)) return warn(`Another wall already uses the code ${code}.`);
    const outside = reservations.filter(r => r.sectionId === editingSectionId && ACTIVE.has(r.status) && (r.row > rows || r.col > columns));
    if (outside.length) return warn(`Can’t shrink the wall: ${outside.map(r => r.nicheCode).join(', ')} would fall outside it.`);
    const rowPrices = [...$('sec-prices').querySelectorAll('input')].map(i => Number(i.value) || 0);
    if (rowPrices.some(p => p <= 0)) return warn('Enter a price for every row.');
    const old = sectionById(editingSectionId);
    const data = sectionPayload({
      name, code, rows, columns, rowPrices, sortOrder: Number($('sec-order').value) || 0, note: val('sec-note'),
      blocked: old ? [...old.blocked].filter(k => { const [r, c] = k.split('-').map(Number); return r <= rows && c <= columns; }) : [],
      taken: old ? [...old.taken] : [],
    });
    $('sec-save').disabled = true;
    try {
      if (old) await update(client, 'ColumbarySection', { id: old.id, ...data });
      else { const s = await create(client, 'ColumbarySection', data); activeSectionId = s.id; }
      logActivity(old ? 'Edit' : 'Create', `Columbary — ${old ? 'updated' : 'added'} wall ${name} (${rows}×${columns})`);
      showToast(old ? 'Wall saved.' : `${name} added — ${rows * columns} niches.`);
      closeModal($('col-section-modal'));
    } catch (err) {
      console.error('Could not save wall:', err);
      warn(err.message || 'Couldn’t save the wall.');
    } finally {
      $('sec-save').disabled = false;
    }
  });

  $('sec-delete').addEventListener('click', async () => {
    const s = sectionById(editingSectionId);
    if (!s) return;
    if (reservations.some(r => r.sectionId === s.id && ACTIVE.has(r.status))) {
      $('sec-warn').textContent = 'This wall has reservations or requests. Cancel or decline them first.';
      $('sec-warn').classList.remove('hidden');
      return;
    }
    const sure = await confirmDialog({ title: `Delete ${s.name}?`, message: 'Its niches disappear from the map.', confirmLabel: 'Delete', tone: 'danger' });
    if (!sure) return;
    try {
      await remove(client, 'ColumbarySection', s.id);
      logActivity('Delete', `Columbary — deleted wall ${s.name}`);
      showToast('Wall deleted.');
      closeModal($('col-section-modal'));
    } catch (err) { showToast(err.message || 'Couldn’t delete the wall.', true); }
  });

  /* ---------- modal helpers ---------- */
  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
    if (m.id === 'col-niche') openNiche = null;
  }
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close-modal]');
    if (close) closeModal(close.closest('.modal-overlay'));
  });
  document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(closeModal); });
});
