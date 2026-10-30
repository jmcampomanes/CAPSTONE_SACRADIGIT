/* ============================================
   SacraDigit Admin — Badges (badge maker)
   Runs after dashboard.js. The Head Admin designs
   new Faith Journey badges; the Head Admin or the
   Secretary gives the hand-given ones to
   parishioners. Data and rules: ../../shared/js/custom-badges.js
   and ../../shared/js/badges.js.
   ============================================ */

import { currentUserName, isHeadAdmin } from '../../shared/js/auth.js';
import {
  BADGES, BADGE_GROUPS, RULE_KINDS, ICON_NAMES, ruleKind, describeRule, badgeIconSvg, computeBadges, isoDate, parishionerKey,
} from '../../shared/js/badges.js';
import {
  customBadgesReady, watchCustomBadges, watchAwards, saveBadge, deleteBadge, awardBadge, revokeAward, loadEveryonesRecords,
} from '../../shared/js/custom-badges.js';
import { MINISTRIES } from '../../shared/js/ministry.js';
import { FUNDS } from '../../shared/js/assistant/assistant-knowledge.js';
import { client } from '../../shared/js/amplify-init.js';
import { showToast, confirmDialog } from './admin-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const groupLabel = (id) => BADGE_GROUPS.find(g => g.id === id)?.label || 'Parish Honors';
  const canDesign = isHeadAdmin();

  let badges = [];   // admin-made, fromRecord() shape
  let awards = [];   // BadgeAward records
  let people = null; // Map from loadEveryonesRecords(), loaded on first need
  let peopleLoading = null;
  let awardingId = null; // badge open in “Give Badge”

  /* ---------- tabs ---------- */
  document.querySelectorAll('.bm-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.bm-tab').forEach(t => { const on = t === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
    $('bm-panel-custom').classList.toggle('hidden', tab.dataset.tab !== 'custom');
    $('bm-panel-builtin').classList.toggle('hidden', tab.dataset.tab !== 'builtin');
  }));

  /* ---------- built-in badges (read-only) ---------- */
  $('bm-count-builtin').textContent = BADGES.length;
  $('bm-builtin-grid').innerHTML = BADGE_GROUPS.filter(g => BADGES.some(b => b.group === g.id)).map(g => `
    <p class="bm-group-head">${esc(g.label)}</p>
    ${BADGES.filter(b => b.group === g.id).map(b => `
      <article class="bm-card is-builtin">
        <div class="bm-card-top">
          <div class="bm-medal tier-${b.tier}">${badgeIconSvg(b, 'w-7 h-7')}</div>
          <div class="bm-card-text">
            <h3 class="bm-card-name">${esc(b.name)}</h3>
            <p class="bm-card-desc">${esc(b.desc)}</p>
          </div>
        </div>
      </article>`).join('')}`).join('');

  /* ---------- parish-made badges ---------- */
  if (!customBadgesReady()) {
    $('bm-unavailable').classList.remove('hidden');
    $('bm-create').classList.add('hidden');
    document.querySelector('.bm-tab[data-tab="builtin"]').click();
    $('bm-empty').classList.add('hidden');
    return;
  }

  watchCustomBadges((list) => { badges = list; render(); });
  watchAwards((list) => { awards = list; render(); if (awardingId) renderAwardList(); });

  const awardsOf = (recordId) => awards.filter(a => a.badgeId === recordId)
    .sort((a, b) => String(b.awardedOn || b.createdAt).localeCompare(String(a.awardedOn || a.createdAt)));

  function ruleLine(b) {
    if (b.mode !== 'auto') return 'Given by hand';
    const kind = ruleKind(b.rule.kind);
    return kind ? `Automatic · ${kind.label}` : 'Automatic';
  }

  function render() {
    $('bm-count-custom').textContent = badges.length;
    $('bm-empty').classList.toggle('hidden', badges.length > 0);
    $('bm-grid').innerHTML = badges.map(b => {
      const given = awardsOf(b.recordId).length;
      return `
      <article class="bm-card${b.active ? '' : ' is-hidden'}">
        <div class="bm-card-top">
          <div class="bm-medal tier-${b.tier}">${badgeIconSvg(b, 'w-7 h-7')}</div>
          <div class="bm-card-text">
            <h3 class="bm-card-name">${esc(b.name)}</h3>
            <p class="bm-card-desc">${esc(b.desc)}</p>
          </div>
        </div>
        <div class="bm-chips">
          <span class="bm-chip ${b.mode === 'auto' ? 'is-auto' : 'is-manual'}">${esc(ruleLine(b))}</span>
          <span class="bm-chip">${esc(groupLabel(b.group))}</span>
          ${b.active ? '' : '<span class="bm-chip is-off">Hidden from parishioners</span>'}
          ${given ? `<span class="bm-chip">Given to ${given}</span>` : ''}
        </div>
        <div class="bm-actions">
          <button type="button" class="btn-lavender bm-btn" data-act="award" data-id="${b.recordId}">Give Badge</button>
          <button type="button" class="btn-secondary bm-btn" data-act="holders" data-id="${b.recordId}">Who Has It</button>
          ${canDesign ? `
          <button type="button" class="btn-secondary bm-btn" data-act="edit" data-id="${b.recordId}">Edit</button>
          <button type="button" class="btn-secondary bm-btn" data-act="toggle" data-id="${b.recordId}">${b.active ? 'Hide' : 'Show'}</button>
          <button type="button" class="act-btn act-danger bm-btn" data-act="delete" data-id="${b.recordId}">Delete…</button>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !btn.closest('main')) return;
    const act = btn.dataset.act;
    const b = badges.find(x => x.recordId === btn.dataset.id);
    if (act === 'create') return openEditor();
    if (!b) return;
    if (act === 'edit') return openEditor(b);
    if (act === 'award') return openAward(b);
    if (act === 'holders') return openHolders(b);
    try {
      if (act === 'toggle') {
        await saveBadge({ active: !b.active, rule: b.rule }, b.recordId);
        showToast(b.active ? `${b.name} is hidden from parishioners.` : `${b.name} is showing to parishioners again.`);
      } else if (act === 'delete') {
        const given = awardsOf(b.recordId).length;
        const sure = await confirmDialog({
          title: `Delete “${b.name}”?`,
          message: given
            ? `It disappears from every parishioner’s My Badges, including the ${given} ${given === 1 ? 'person' : 'people'} it was given to. To keep it but stop showing it, use Hide instead.`
            : 'It disappears from every parishioner’s My Badges. To keep it but stop showing it, use Hide instead.',
          confirmLabel: 'Delete',
          tone: 'danger',
        });
        if (!sure) return;
        await deleteBadge(b.recordId, awards);
        showToast('Badge deleted.');
      }
    } catch (err) {
      console.error('Badge update failed:', err);
      showToast(err.message || 'Couldn’t update the badge.', true);
    }
  });

  /* ---------- modals ---------- */
  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; m.querySelector('input:not([type=radio]):not([type=checkbox]), select, button')?.focus(); }
  function closeModal(m) { if (m.classList.contains('hidden')) return; m.classList.add('hidden'); document.body.style.overflow = ''; if (m.id === 'bm-award') awardingId = null; }
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay'))));
  document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(closeModal); });

  /* ---------- create / edit ---------- */
  const kindSel = $('bm-kind');
  kindSel.innerHTML = RULE_KINDS.map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('');
  $('bm-ministry').innerHTML = `<option value="">Any ministry</option>${MINISTRIES.map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join('')}`;
  $('bm-group').innerHTML = BADGE_GROUPS.map(g => `<option value="${g.id}">${esc(g.label)}</option>`).join('');
  $('bm-icons').innerHTML = ICON_NAMES.map(name => `
    <label class="bm-icon" title="${esc(name)}">
      <input type="radio" name="bm-icon" value="${name}" aria-label="${esc(name)}" />
      <span>${badgeIconSvg({ icon: name }, 'w-5 h-5')}</span>
    </label>`).join('');
  const fundNames = new Set(FUNDS.map(f => f.name));
  const paintFunds = () => { $('bm-fund-list').innerHTML = [...fundNames].map(n => `<option value="${esc(n)}"></option>`).join(''); };
  paintFunds();
  if (client.models.DonationGoal) {
    client.models.DonationGoal.list({ limit: 200 })
      .then(({ data }) => { (data || []).forEach(g => g.name && fundNames.add(g.name)); paintFunds(); })
      .catch(() => {});
  }

  let editingId = null;
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
  const setRadio = (name, value) => { const r = document.querySelector(`input[name="${name}"][value="${value}"]`); if (r) r.checked = true; };

  function formRule() {
    const kind = ruleKind(kindSel.value);
    const rule = { kind: kindSel.value, target: Math.max(1, Math.min(999, parseInt($('bm-target').value, 10) || 1)) };
    if (kind?.dates) { rule.from = $('bm-from').value; rule.to = $('bm-to').value; }
    if (kind?.match) rule.match = $('bm-fund').value.trim();
    if (kind?.ministry && $('bm-ministry').value) {
      rule.ministry = $('bm-ministry').value;
      rule.ministryLabel = MINISTRIES.find(m => m.id === rule.ministry)?.label || '';
    }
    return rule;
  }

  function formBadge() {
    const mode = radio('bm-mode');
    const rule = mode === 'auto' ? formRule() : {};
    const auto = mode === 'auto' ? describeRule(rule) : 'Given by the parish.';
    return {
      name: $('bm-name').value.trim(),
      description: $('bm-desc').value.trim(),
      desc: $('bm-desc').value.trim() || auto,
      autoDesc: auto,
      group: $('bm-group').value,
      tier: radio('bm-tier') || 'silver',
      icon: radio('bm-icon') || 'star',
      mode,
      rule,
      active: $('bm-active').checked,
    };
  }

  function syncForm() {
    const auto = radio('bm-mode') === 'auto';
    const kind = ruleKind(kindSel.value);
    $('bm-rule').classList.toggle('hidden', !auto);
    $('bm-target-unit').textContent = kind?.unit || '';
    $('bm-dates-wrap').classList.toggle('hidden', !kind?.dates);
    $('bm-fund-wrap').classList.toggle('hidden', !kind?.match);
    $('bm-ministry-wrap').classList.toggle('hidden', !kind?.ministry);
    $('bm-checkin-note').classList.toggle('hidden', !kind?.needsCheckIn);
    const b = formBadge();
    $('bm-desc').placeholder = b.autoDesc;
    $('bm-desc-hint').textContent = 'Leave it blank to use the text shown in the preview.';
    renderPreview(b);
  }

  function previewCard(b, earned) {
    const target = Number(b.rule?.target) || 1;
    const shown = { ...b, name: b.name || 'Badge name' };
    const status = earned
      ? `<p class="bm-pv-earned">✓ ${b.mode === 'auto' ? 'Earned' : 'Given'} · ${esc(fmtDate(isoDate(new Date())))}</p>`
      : b.mode === 'auto'
        ? `<div class="bm-pv-progress"><span style="width:30%"></span></div><p class="bm-pv-progress-text">${Math.round(target * 0.3)} / ${target} ${esc(ruleKind(b.rule.kind)?.unit || '')}</p>`
        : '<p class="bm-pv-progress-text">Not yet</p>';
    return `
      <div class="bm-pv ${earned ? 'is-earned' : 'is-locked'}">
        <div class="bm-medal tier-${b.tier}">${badgeIconSvg(shown, 'w-7 h-7')}</div>
        <div class="bm-pv-body">
          <p class="bm-pv-name">${esc(shown.name)}</p>
          <p class="bm-pv-desc">${esc(b.desc)}</p>
          ${status}
        </div>
      </div>`;
  }

  function renderPreview(b) {
    $('bm-preview-card').innerHTML = previewCard(b, false);
    $('bm-preview-earned').innerHTML = previewCard(b, true);
  }

  $('bm-editor').addEventListener('input', syncForm);
  $('bm-editor').addEventListener('change', syncForm);

  function openEditor(b = null) {
    if (!canDesign) return;
    editingId = b?.recordId || null;
    $('bm-editor-title').textContent = b ? 'Edit Badge' : 'Create Badge';
    $('bm-save').textContent = b ? 'Save Changes' : 'Create Badge';
    $('bm-name').value = b?.name || '';
    $('bm-desc').value = b && b.desc !== (b.mode === 'auto' ? describeRule(b.rule) : 'Given by the parish.') ? b.desc : '';
    setRadio('bm-mode', b?.mode || 'auto');
    kindSel.value = b?.rule?.kind || 'masses';
    $('bm-target').value = b?.rule?.target || 10;
    $('bm-from').value = b?.rule?.from || '';
    $('bm-to').value = b?.rule?.to || '';
    $('bm-fund').value = b?.rule?.match || '';
    $('bm-ministry').value = b?.rule?.ministry || '';
    setRadio('bm-tier', b?.tier || 'silver');
    setRadio('bm-icon', b?.icon || 'star');
    $('bm-group').value = b?.group || 'honors';
    $('bm-active').checked = b ? b.active : true;
    [$('bm-name'), $('bm-from'), $('bm-to'), $('bm-fund')].forEach(i => i.classList.remove('border-red-400'));
    syncForm();
    openModal($('bm-editor'));
  }
  $('bm-create').addEventListener('click', () => openEditor());

  $('bm-save').addEventListener('click', async () => {
    const b = formBadge();
    const flag = (el, msg) => { el.classList.add('border-red-400'); el.focus(); showToast(msg, true); };
    if (!b.name) return flag($('bm-name'), 'Give the badge a name.');
    if (badges.some(x => x.recordId !== editingId && x.name.toLowerCase() === b.name.toLowerCase())) return flag($('bm-name'), 'There’s already a badge with that name.');
    const kind = b.mode === 'auto' ? ruleKind(b.rule.kind) : null;
    if (kind?.dates) {
      if (!b.rule.from) return flag($('bm-from'), 'Pick the first day.');
      if (!b.rule.to) return flag($('bm-to'), 'Pick the last day.');
      if (b.rule.to < b.rule.from) return flag($('bm-to'), 'The last day must be on or after the first day.');
    }
    if (kind?.match && !b.rule.match) return flag($('bm-fund'), 'Type or pick the fund.');
    const btn = $('bm-save');
    btn.disabled = true;
    try {
      await saveBadge({
        name: b.name, description: b.description, group: b.group, tier: b.tier, icon: b.icon,
        mode: b.mode, rule: b.rule, active: b.active,
      }, editingId, currentUserName());
      showToast(editingId ? 'Badge saved.' : `“${b.name}” created${b.active ? ' — parishioners can see it now.' : '.'}`);
      closeModal($('bm-editor'));
    } catch (err) {
      console.error('Could not save badge:', err);
      showToast(err.message || 'Couldn’t save the badge.', true);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- people (name suggestions + who has it) ---------- */
  function loadPeople() {
    if (people) return Promise.resolve(people);
    if (!peopleLoading) {
      peopleLoading = loadEveryonesRecords().then(map => {
        people = map;
        $('bm-people').innerHTML = [...map.values()].map(p => p.name).sort((a, b) => a.localeCompare(b))
          .map(n => `<option value="${esc(n)}"></option>`).join('');
        return map;
      }).catch(err => { peopleLoading = null; throw err; });
    }
    return peopleLoading;
  }

  const badgeHeader = (b) => `
    <div class="bm-mini">
      <div class="bm-medal tier-${b.tier}">${badgeIconSvg(b, 'w-6 h-6')}</div>
      <div><p class="bm-card-name">${esc(b.name)}</p><p class="bm-card-desc">${esc(b.desc)}</p></div>
    </div>`;

  /* ---------- give a badge ---------- */

  function renderAwardList() {
    const list = awardsOf(awardingId);
    $('bm-award-count').textContent = `${list.length} ${list.length === 1 ? 'person' : 'people'}`;
    $('bm-award-list').innerHTML = list.length ? list.map(a => `
      <li class="bm-person">
        <div>
          <p class="bm-person-name">${esc(a.parishionerName)}</p>
          <p class="bm-person-sub">${esc(fmtDate(a.awardedOn))}${a.awardedByName ? ` · by ${esc(a.awardedByName)}` : ''}${a.note ? ` · “${esc(a.note)}”` : ''}</p>
        </div>
        <button type="button" class="act-btn act-danger" data-revoke="${a.id}">Take back</button>
      </li>`).join('') : '<li class="bm-person-empty">No one yet.</li>';
  }

  function openAward(b) {
    awardingId = b.recordId;
    $('bm-award-title').textContent = 'Give Badge';
    $('bm-award-badge').innerHTML = badgeHeader(b);
    $('bm-award-name').value = '';
    $('bm-award-note').value = '';
    $('bm-award-date').value = isoDate(new Date());
    renderAwardList();
    openModal($('bm-award'));
    loadPeople().catch(err => console.warn('Name suggestions unavailable:', err));
  }

  $('bm-award-save').addEventListener('click', async () => {
    const b = badges.find(x => x.recordId === awardingId);
    const name = $('bm-award-name').value.trim();
    if (!b) return;
    if (!name) { $('bm-award-name').classList.add('border-red-400'); $('bm-award-name').focus(); showToast('Type the parishioner’s name.', true); return; }
    const key = parishionerKey(name);
    if (awardsOf(b.recordId).some(a => a.parishionerKey === key)) { showToast(`${name} already has this badge.`, true); return; }
    const btn = $('bm-award-save');
    btn.disabled = true;
    try {
      await awardBadge({ badgeId: b.recordId, name, note: $('bm-award-note').value.trim(), awardedOn: $('bm-award-date').value || isoDate(new Date()), byName: currentUserName() });
      showToast(`${b.name} given to ${name}.`);
      $('bm-award-name').value = '';
      $('bm-award-note').value = '';
      $('bm-award-name').classList.remove('border-red-400');
      $('bm-award-name').focus();
    } catch (err) {
      console.error('Could not give badge:', err);
      showToast(err.message || 'Couldn’t give the badge.', true);
    } finally {
      btn.disabled = false;
    }
  });

  $('bm-award-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-revoke]');
    if (!btn) return;
    const a = awards.find(x => x.id === btn.dataset.revoke);
    if (!a) return;
    const sure = await confirmDialog({ title: `Take the badge back from ${a.parishionerName}?`, message: 'It disappears from their My Badges page.', confirmLabel: 'Take back', tone: 'danger' });
    if (!sure) return;
    try { await revokeAward(a.id); showToast('Badge taken back.'); }
    catch (err) { console.error('Could not take back badge:', err); showToast(err.message || 'Couldn’t take the badge back.', true); }
  });

  /* ---------- who has it ---------- */
  async function openHolders(b) {
    $('bm-holders-badge').innerHTML = badgeHeader(b);
    $('bm-holders-summary').textContent = b.mode === 'auto' ? 'Working it out from parish records…' : '';
    $('bm-holders-list').innerHTML = '';
    openModal($('bm-holders'));

    const given = awardsOf(b.recordId).map(a => ({ name: a.parishionerName, key: a.parishionerKey, on: a.awardedOn, how: 'Given by hand' }));
    let earned = [];
    if (b.mode === 'auto') {
      try {
        const map = await loadPeople();
        const handKeys = new Set(given.map(g => g.key));
        earned = [...map.entries()].flatMap(([key, p]) => {
          if (handKeys.has(key)) return [];
          const r = computeBadges(p.data, new Date(), { custom: [b] }).find(x => x.recordId === b.recordId);
          return r?.earned ? [{ name: p.name, key, on: r.earnedOn, how: 'Earned' }] : [];
        });
      } catch (err) {
        console.error('Could not work out who has the badge:', err);
        $('bm-holders-summary').textContent = 'Couldn’t load parish records to check who earned it.';
      }
    }
    const all = [...given, ...earned].sort((x, y) => String(y.on || '').localeCompare(String(x.on || '')) || x.name.localeCompare(y.name));
    if (b.mode === 'auto' || all.length) {
      $('bm-holders-summary').textContent = all.length
        ? `${all.length} ${all.length === 1 ? 'parishioner has' : 'parishioners have'} this badge.`
        : 'No one has earned it yet.';
    }
    $('bm-holders-list').innerHTML = all.map(p => `
      <li class="bm-person">
        <div>
          <p class="bm-person-name">${esc(p.name)}</p>
          <p class="bm-person-sub">${esc(p.how)}${p.on ? ` · ${esc(fmtDate(p.on))}` : ''}</p>
        </div>
      </li>`).join('') || (b.mode === 'auto' ? '' : '<li class="bm-person-empty">Not given to anyone yet. Use “Give Badge.”</li>');
  }
});
