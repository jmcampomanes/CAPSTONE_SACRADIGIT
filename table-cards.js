/* ============================================
   SacraDigit — phone table cards
   A wide table pushes its Status and Action
   columns off a phone screen. Each cell gets its
   column's name (data-label) so the shared admin
   stylesheet (Sacradigit/sacradigit-css/admin-shell.css,
   loaded by the admin, Media and ITech portals) can
   show every row as a card on phones instead.
   Desktop keeps the table.
   ============================================ */

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
  document.querySelectorAll(selector).forEach(table => {
    table.classList.add('has-cards');
    label(table);
    const body = table.querySelector('tbody');
    if (body) new MutationObserver(() => label(table)).observe(body, { childList: true });
  });
}
