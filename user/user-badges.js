/* ============================================
   SacraDigit — My Badges (Faith Journey)
   Runs after user-shell.js.

   Badges are worked out live from the
   parishioner's own records (badges.js). Mass
   check-in (mass-checkin.js) works once the
   backend check-in models are deployed; until
   then the page says so and the other badges
   still count.

   Opened from a QR code at church as
   user-badges.html?checkin=<session>&code=<CODE>
   it checks the parishioner in straight away.
   ============================================ */

import { client } from '../amplify-init.js';
import { computeBadges, faithfulGivers, badgeIconSvg, BADGES, parishionerKey, monthStreak, streakLabel } from '../badges.js';
import { checkInReady, preferencesReady, submitCheckIn, listCheckInsFor, optedOutKeys, getPreference, setShowOnHonorRoll, formatCode, normalizeCode } from '../mass-checkin.js';

document.addEventListener('DOMContentLoaded', () => {

  const PARISHIONER_NAME = 'Maria P. Santos'; // same hardcoded identity used across the user portal
  const MY_KEY = parishionerKey(PARISHIONER_NAME);

  const data = { checkIns: [], donations: [], intentions: [], blessings: [] };
  let allDonations = [];
  let optedOut = new Set();
  let activeGroup = '';
  let loaded = { donations: false, intentions: false, blessings: false, checkIns: false };

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

  $('checkin-name').textContent = PARISHIONER_NAME;

  /* ------------------------------------------
     Live data
  ------------------------------------------ */
  client.models.Donation.observeQuery().subscribe({
    next: ({ items }) => {
      allDonations = items;
      data.donations = items.filter(d => parishionerKey(d.donor) === MY_KEY);
      loaded.donations = true;
      render();
    },
    error: (err) => console.error('Failed to load donations:', err),
  });

  client.models.MassIntention.observeQuery({ filter: { donor: { eq: PARISHIONER_NAME } } }).subscribe({
    next: ({ items }) => { data.intentions = items; loaded.intentions = true; render(); },
    error: (err) => console.error('Failed to load intentions:', err),
  });

  client.models.Blessing.observeQuery({ filter: { requesterName: { eq: PARISHIONER_NAME } } }).subscribe({
    next: ({ items }) => { data.blessings = items; loaded.blessings = true; render(); },
    error: (err) => console.error('Failed to load blessings:', err),
  });

  async function loadCheckIns() {
    if (!checkInReady()) { loaded.checkIns = true; return; }
    try { data.checkIns = await listCheckInsFor(PARISHIONER_NAME); }
    catch (err) { console.error('Failed to load check-ins:', err); }
    loaded.checkIns = true;
  }

  async function loadPreferences() {
    optedOut = await optedOutKeys().catch(() => new Set());
    if (!preferencesReady()) return;
    const pref = await getPreference(PARISHIONER_NAME).catch(() => null);
    $('honor-toggle').checked = !pref || pref.showOnHonorRoll !== false;
    $('honor-toggle-wrap').classList.remove('hidden');
  }

  if (!checkInReady()) {
    $('checkin-ready').classList.add('hidden');
    $('checkin-not-ready').classList.remove('hidden');
  }

  /* ------------------------------------------
     Rendering
  ------------------------------------------ */
  const allLoaded = () => Object.values(loaded).every(Boolean);

  function render() {
    if (!allLoaded()) return;
    const ready = checkInReady();
    const badges = computeBadges(data);
    const shown = ready ? badges : badges.filter(b => !b.needsCheckIn || b.earned);
    renderStats(badges, ready);
    renderBadges(shown, ready);
    renderGivers();
  }

  function renderStats(badges, ready) {
    const earned = badges.filter(b => b.earned).length;
    $('stat-badges').textContent = `${earned} / ${ready ? BADGES.length : BADGES.filter(b => !b.needsCheckIn).length}`;
    const steadfast = badges.find(b => b.id === 'steadfast-1');
    $('stat-sunday-streak').textContent = ready ? String(steadfast?.progress?.current ?? 0) : '—';
    const year = String(new Date().getFullYear());
    $('stat-masses-year').textContent = ready ? String(data.checkIns.filter(c => (c.massDate || '').startsWith(year)).length) : '—';
    $('stat-giving-streak').textContent = String(monthStreak(data.donations.map(d => d.date)));

    // Nudge toward the closest badge not yet earned
    const next = badges
      .filter(b => !b.earned && b.progress && b.progress.target > 0 && (ready || !b.needsCheckIn))
      .map(b => ({ b, left: b.progress.target - b.progress.current, pct: b.progress.current / b.progress.target }))
      .filter(x => x.left > 0)
      .sort((a, z) => z.pct - a.pct || a.left - z.left)[0];
    $('fj-next').innerHTML = next
      ? `<span class="fj-next-label">Next up:</span> <strong>${escapeHtml(next.b.name)}</strong> — ${next.left} more ${escapeHtml(next.b.progress.label)} to go.`
      : 'You’ve earned every badge within reach right now. Keep it up!';
  }

  function badgeCardHtml(b) {
    const pct = b.progress ? Math.round((b.progress.current / b.progress.target) * 100) : 0;
    const status = b.earned
      ? `<p class="fj-badge-earned">✓ Earned${b.earnedOn ? ` · ${fmtDate(b.earnedOn)}` : ''}</p>`
      : b.progress
        ? `<div class="fj-progress" aria-label="${b.progress.current} of ${b.progress.target}"><span style="width:${pct}%"></span></div>
           <p class="fj-progress-text">${b.progress.current} / ${b.progress.target} ${escapeHtml(b.progress.label)}</p>`
        : '<p class="fj-progress-text">Not yet</p>';
    return `
      <div class="fj-badge ${b.earned ? 'is-earned' : 'is-locked'} tier-${b.tier}">
        <div class="fj-medal">${badgeIconSvg(b, 'w-7 h-7')}</div>
        <div class="fj-badge-body">
          <p class="fj-badge-name">${escapeHtml(b.name)}</p>
          <p class="fj-badge-desc">${escapeHtml(b.desc)}</p>
          ${status}
        </div>
      </div>`;
  }

  function renderBadges(badges, ready) {
    const list = badges.filter(b => !activeGroup || b.group === activeGroup);
    let html = list.map(badgeCardHtml).join('');
    if (!ready && (!activeGroup || activeGroup === 'mass')) {
      html += `<p class="fj-grid-note">Mass badges (First Step, Faithful Month, Simbang Gabi, Holy Week Pilgrim, and more) appear once Mass check-in is turned on.</p>`;
    }
    $('badge-grid').innerHTML = html || '<p class="text-sm text-gray-400 p-5">No badges here yet.</p>';
  }

  function renderGivers() {
    const givers = faithfulGivers(allDonations, { optedOut });
    $('givers-list').innerHTML = givers.slice(0, 30).map(g => `
      <li class="fj-giver${g.key === MY_KEY ? ' is-me' : ''}">
        <span class="fj-giver-name">${escapeHtml(g.name)}${g.key === MY_KEY ? ' <span class="fj-you">You</span>' : ''}</span>
        <span class="fj-giver-streak">${escapeHtml(streakLabel(g.streak))}</span>
      </li>`).join('');
    $('givers-empty').classList.toggle('hidden', givers.length > 0);
  }

  document.querySelector('.fj-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.fj-tab');
    if (!tab) return;
    activeGroup = tab.dataset.group;
    document.querySelectorAll('.fj-tab').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    render();
  });

  $('honor-toggle').addEventListener('change', async (e) => {
    const show = e.target.checked;
    try {
      await setShowOnHonorRoll(PARISHIONER_NAME, show);
      if (show) optedOut.delete(MY_KEY); else optedOut.add(MY_KEY);
      renderGivers();
      window.showToast(show ? 'Your name will show on Faithful Givers.' : 'Your name is hidden from Faithful Givers.');
    } catch (err) {
      console.error('Failed to save preference:', err);
      e.target.checked = !show;
      window.showToast("Couldn't save that setting.", true);
    }
  });

  /* ------------------------------------------
     Check-in
  ------------------------------------------ */
  const codeInput = $('checkin-code');
  codeInput.addEventListener('input', () => {
    const c = normalizeCode(codeInput.value).slice(0, 6);
    codeInput.value = c.length > 3 ? formatCode(c.padEnd(6, ' ')).trim() : c;
  });

  $('checkin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doCheckIn({ code: codeInput.value });
  });

  async function doCheckIn({ sessionId, code }) {
    if (!checkInReady()) return;
    const btn = $('checkin-submit');
    btn.disabled = true;
    btn.textContent = 'Checking in…';
    const before = new Set(computeBadges(data).filter(b => b.earned).map(b => b.id));
    try {
      const res = await submitCheckIn({ sessionId, code, parishionerName: PARISHIONER_NAME });
      showResult(res);
      if (res.ok) {
        codeInput.value = '';
        await loadCheckIns();
        render();
        const newly = computeBadges(data).filter(b => b.earned && !before.has(b.id));
        if (newly.length && !res.already) celebrate(newly);
      }
    } catch (err) {
      console.error('Check-in failed:', err);
      showResult({ ok: false, message: 'Check-in didn’t go through. Please check your connection and try again.' });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check In';
    }
  }

  function showResult(res) {
    const el = $('checkin-result');
    const ci = res.checkIn;
    const detail = ci ? `${ci.title ? `${escapeHtml(ci.title)} · ` : ''}${fmtDate(ci.massDate)}${ci.massTime ? ` · ${escapeHtml(ci.massTime)}` : ''}` : '';
    el.className = `fj-result ${res.ok ? 'is-ok' : 'is-error'}`;
    el.innerHTML = `
      <span class="fj-result-icon" aria-hidden="true">${res.ok ? '✓' : '!'}</span>
      <div><p class="fj-result-title">${escapeHtml(res.message)}</p>${detail ? `<p class="fj-result-sub">${detail}</p>` : ''}</div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------------------
     New-badge celebration
  ------------------------------------------ */
  const modal = $('badge-modal');
  function celebrate(badges) {
    $('badge-modal-medals').innerHTML = badges.slice(0, 3).map(b => `<div class="fj-medal fj-medal-lg tier-${b.tier}">${badgeIconSvg(b, 'w-9 h-9')}</div>`).join('');
    $('badge-modal-title').textContent = badges.length > 1 ? `${badges.length} new badges!` : `New badge: ${badges[0].name}`;
    $('badge-modal-text').textContent = badges.length > 1 ? badges.map(b => b.name).join(' · ') : badges[0].desc;
    modal.classList.remove('hidden');
  }
  const closeModal = () => modal.classList.add('hidden');
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close-badge-modal]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ------------------------------------------
     Start-up: load check-ins + preferences, then
     handle a QR link (?checkin=…&code=…)
  ------------------------------------------ */
  (async () => {
    await Promise.all([loadCheckIns(), loadPreferences()]);
    render();
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('checkin');
    const code = params.get('code');
    if (sessionId && code) {
      // Drop the code from the address bar so a refresh doesn't re-submit it.
      history.replaceState(null, '', window.location.pathname);
      if (checkInReady()) doCheckIn({ sessionId, code });
      else showResult({ ok: false, message: 'Mass check-in isn’t set up yet on this site.' });
    }
  })();

});
