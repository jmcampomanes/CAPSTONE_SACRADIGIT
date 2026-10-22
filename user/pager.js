/* ============================================
   SacraDigit — page numbers for long lists
   Used by My Requests and Requested Services so a
   parishioner with many requests pages through them
   instead of scrolling. Styles: user-shell.css
   ("Page numbers").

     const pager = createPager(barEl, { onChange: renderList, scrollTo: listEl });
     function renderList() {
       const items = pager.page(sorted);   // this page's items; draws the bar
       ...
     }
     pager.reset();                        // back to page 1 (e.g. new filter)
   ============================================ */

export function createPager(bar, { pageSize = 5, onChange, scrollTo = null, noun = 'requests' } = {}) {
  let current = 1;
  let pages = 1;

  // 1 … 4 5 6 … 12 — every page when there are few, otherwise the ends and
  // the pages around the current one.
  function numbers() {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set([1, pages, current - 1, current, current + 1].filter(p => p >= 1 && p <= pages));
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
    return out;
  }

  function draw(total, shown) {
    if (pages <= 1) { bar.innerHTML = ''; bar.hidden = true; return; }
    bar.hidden = false;
    const start = (current - 1) * pageSize + 1;
    bar.innerHTML = `
      <p class="pager-info">Showing ${start}–${start + shown - 1} of ${total} ${noun}</p>
      <div class="pager-controls">
        <button type="button" class="pager-btn" data-go="${current - 1}" ${current === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
        ${numbers().map(p => (p === '…'
          ? '<span class="pager-gap" aria-hidden="true">…</span>'
          : `<button type="button" class="pager-btn${p === current ? ' is-current' : ''}" data-go="${p}" aria-label="Page ${p}"${p === current ? ' aria-current="page"' : ''}>${p}</button>`)).join('')}
        <button type="button" class="pager-btn" data-go="${current + 1}" ${current === pages ? 'disabled' : ''} aria-label="Next page">›</button>
      </div>`;
  }

  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Pages');
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn || btn.disabled) return;
    const next = Number(btn.dataset.go);
    if (next < 1 || next > pages || next === current) return;
    current = next;
    onChange?.();
    // Back to the top of the list, and keep keyboard users on the bar.
    (scrollTo || bar).scrollIntoView({ behavior: 'smooth', block: 'start' });
    bar.querySelector(`[data-go="${current}"].is-current`)?.focus({ preventScroll: true });
  });

  return {
    /** This page's slice of `items`; also redraws the bar. */
    page(items) {
      pages = Math.max(1, Math.ceil(items.length / pageSize));
      current = Math.min(current, pages); // a live update may have removed items
      const slice = items.slice((current - 1) * pageSize, current * pageSize);
      draw(items.length, slice.length);
      return slice;
    },
    reset() { current = 1; },
  };
}
