/* ============================================
   SacraDigit — phone table cards
   A wide table pushes its Status and Action
   columns off a phone screen. Each cell gets its
   column's name (data-label) so every row shows as
   a card on phones instead (styles below travel with
   this file, so every portal gets the same layout).
   Desktop keeps the table.
   ============================================ */

const STYLE = `
@media (max-width: 640px) {
  table.has-cards thead { display: none; }
  table.has-cards,
  table.has-cards > tbody,
  table.has-cards > tbody > tr { display: block; width: 100%; }
  table.has-cards > tbody > tr { padding: 0.75rem 1rem; border-bottom: 1px solid #eef0f4; }
  table.has-cards > tbody > tr:last-child { border-bottom: none; }
  table.has-cards > tbody > tr > td[data-label],
  table.has-cards > tbody > tr > td.td-actions { display: block; border: 0; padding: 0.125rem 0; white-space: normal; text-align: left; }
  table.has-cards > tbody > tr > td[data-label]:not(.td-primary)::before {
    content: attr(data-label) ": "; font-weight: 600; color: #6b7280;
  }
  table.has-cards > tbody > tr > td.td-primary { font-size: 0.9375rem; font-weight: 600; color: #111827; padding-bottom: 0.25rem; }
  table.has-cards > tbody > tr > td.td-actions { padding-top: 0.5rem; }
  table.has-cards > tbody > tr > td.td-actions .row-actions { justify-content: flex-start; }
  table.has-cards > tbody > tr > td.col-select { display: block; border: 0; padding: 0 0 0.25rem; }
  table.has-cards .purpose-cell { max-width: none; }
  table.has-cards > tbody > tr > td:empty { display: none; }
  table.has-cards .row-reject { margin-left: 0; }
  table.has-cards > tbody > tr > td[data-label] { color: #374151; }
}
:root[data-theme="dark"] table.has-cards > tbody > tr { border-color: #2c3547; }
:root[data-theme="dark"] table.has-cards > tbody > tr > td.td-primary { color: #f1f3f7; }
:root[data-theme="dark"] table.has-cards > tbody > tr > td[data-label] { color: #cbd3e6; }
:root[data-theme="dark"] table.has-cards > tbody > tr > td[data-label]:not(.td-primary)::before { color: #9aa3b5; }
`;

function label(table) {
  const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells = [...tr.children];
    if (cells.length !== heads.length) return; // "Loading…" / "No records" rows span every column
    let primary = false;
    cells.forEach((td, i) => {
      const head = heads[i];
      const isAction = /^(actions?|access|export)$/i.test(head) || td.querySelector('.row-actions');
      td.classList.toggle('td-actions', !!isAction);
      if (!head || isAction) { td.removeAttribute('data-label'); return; }
      td.dataset.label = head;
      if (!primary && !td.classList.contains('col-select')) { td.classList.add('td-primary'); primary = true; }
    });
  });
}

export function initTableCards(selector = 'table.records-table') {
  if (!document.getElementById('table-cards-style')) {
    const st = document.createElement('style');
    st.id = 'table-cards-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  document.querySelectorAll(selector).forEach(table => {
    table.classList.add('has-cards');
    label(table);
    const body = table.querySelector('tbody');
    if (body) new MutationObserver(() => label(table)).observe(body, { childList: true });
  });
}
