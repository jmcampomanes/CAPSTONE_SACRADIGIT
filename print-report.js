/* ============================================
   SacraDigit — printouts
   One letterhead for every Print button: the Our
   Lady of Fatima Parish emblem and name, the
   document title, a summary line, the content,
   optional signature lines, and a footer with
   who printed it, when, and "Page X of Y".

   printReport() builds the document in a hidden
   frame and opens the browser's print dialog, so
   nothing on the page itself changes and no
   pop-up window is needed. In Filipino mode the
   printout is translated too.
   ============================================ */

import { currentUserName } from './auth.js';
import { translateElement } from './ui-prefs.js';

const EMBLEM = new URL('./sacradigit-images/fatima-emblem.png', import.meta.url).href;

export const PARISH = {
  name: 'Our Lady of Fatima Parish',
  diocese: 'Diocese of Cubao',
  address: '57 L. Castillo St., Don Manuel, Quezon City, Metro Manila',
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STYLES = (orientation, footerLeft) => `
  @page {
    size: A4 ${orientation};
    margin: 14mm 14mm 16mm;
    @bottom-left { content: "${footerLeft.replace(/"/g, '\\"')}"; font: 8pt Inter, Arial, sans-serif; color: #6b7280; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Inter, Arial, sans-serif; color: #6b7280; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #111827; font-size: 10pt; line-height: 1.45; }

  /* ---- Letterhead ---- */
  .lh { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; }
  .lh img { width: 62px; height: auto; flex-shrink: 0; }
  .lh-text { flex: 1; min-width: 0; }
  .lh-name { margin: 0; font-family: 'Cinzel', 'Trajan Pro', Georgia, serif; font-size: 17pt; font-weight: 700; letter-spacing: 0.02em; color: #1d3a8a; }
  .lh-diocese { margin: 1px 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 9.5pt; font-weight: 600; letter-spacing: 0.08em; color: #1d3a8a; }
  .lh-address { margin: 3px 0 0; font-size: 8pt; color: #6b7280; }
  .lh-brand { text-align: right; font-size: 7.5pt; color: #9ca3af; line-height: 1.4; white-space: nowrap; }
  .lh-brand b { display: block; font-size: 9pt; color: #1e2a4a; letter-spacing: 0.04em; }
  .rule { height: 3px; background: #1e2a4a; margin: 0; }
  .rule-gold { height: 1.5px; background: #c9a84c; margin: 2px 0 0; }

  /* ---- Title ---- */
  .doc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 16px 0 10px; }
  .doc-title { margin: 0; font-size: 15pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #1e2a4a; }
  .doc-sub { margin: 3px 0 0; font-size: 10pt; color: #4b5563; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .chip { border: 1px solid #d9dbee; border-radius: 999px; padding: 2px 9px; font-size: 8pt; color: #374151; background: #f7f8fc; white-space: nowrap; }
  .chip b { color: #1e2a4a; }

  /* ---- Content ---- */
  h2 { margin: 18px 0 6px; font-size: 10.5pt; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #1e2a4a; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; break-after: avoid; }
  p.note { margin: 4px 0; color: #6b7280; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; font-size: 9pt; }
  thead { display: table-header-group; }
  th { background: #1e2a4a; color: #ffffff; text-align: left; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8f9fc; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.nowrap { white-space: nowrap; }
  td.check { width: 34px; }
  td.check span { display: inline-block; width: 13px; height: 13px; border: 1.3px solid #6b7280; border-radius: 3px; }
  tfoot td { font-weight: 800; border-top: 2px solid #1e2a4a; border-bottom: 0; background: #ffffff !important; }
  .muted { color: #6b7280; }
  .small { font-size: 8pt; color: #6b7280; }
  .tag { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 999px; font-size: 7pt; font-weight: 700; background: #fef3c7; color: #92400e; }
  .empty { padding: 18px; text-align: center; color: #6b7280; border: 1px dashed #d1d5db; border-radius: 8px; }
  .pill { display: inline-block; margin: 0 4px 3px 0; padding: 1px 7px; border: 1px solid #d9dbee; border-radius: 999px; font-size: 8.5pt; }

  /* ---- Reader's sheet (larger, easy to read aloud) ---- */
  .reader h2 { font-size: 11.5pt; }
  .reader .flow { font-size: 12.5pt; line-height: 1.75; margin: 4px 0 10px; }
  .reader .closing { margin-top: 14px; font-size: 11.5pt; font-weight: 600; }

  /* ---- Signatures ---- */
  .sigs { display: flex; gap: 40px; margin-top: 36px; break-inside: avoid; }
  .sig { flex: 1; text-align: center; font-size: 8.5pt; color: #4b5563; }
  .sig-line { border-top: 1px solid #111827; margin-bottom: 4px; height: 0; }
`;

function waitForImages(doc) {
  return Promise.all([...doc.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
}

/**
 * Opens the print dialog for a document with the parish letterhead.
 *   title       "Service Schedule"
 *   subtitle    "Saturday, September 27, 2026"
 *   chips       [['Bookings', 4], ['Status', 'All']]  (small summary tags)
 *   body        HTML (escape any user text with esc())
 *   orientation 'portrait' | 'landscape'
 *   signatures  ['Prepared by', 'Noted by']  (optional signature lines)
 *   className   extra class on the content (e.g. 'reader')
 */
export async function printReport({ title, subtitle = '', chips = [], body = '', orientation = 'portrait', signatures = [], className = '' }) {
  const printedBy = currentUserName();
  const printedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const footerLeft = `SacraDigit · Printed ${printedAt}${printedBy ? ` by ${printedBy}` : ''}`;

  // Build the content in this page first so it can be translated like everything else.
  const holder = document.createElement('div');
  holder.innerHTML = `
    <header class="lh">
      <img src="${EMBLEM}" alt="" />
      <div class="lh-text">
        <p class="lh-name">${esc(PARISH.name)}</p>
        <p class="lh-diocese">${esc(PARISH.diocese)}</p>
        <p class="lh-address">${esc(PARISH.address)}</p>
      </div>
      <div class="lh-brand"><b>SacraDigit</b>Parish Management System</div>
    </header>
    <div class="rule"></div><div class="rule-gold"></div>
    <section class="doc-head">
      <div>
        <h1 class="doc-title">${esc(title)}</h1>
        ${subtitle ? `<p class="doc-sub">${esc(subtitle)}</p>` : ''}
      </div>
      ${chips.length ? `<div class="chips">${chips.map(([k, v]) => `<span class="chip">${esc(k)}: <b>${esc(v)}</b></span>`).join('')}</div>` : ''}
    </section>
    <main class="${esc(className)}">${body}</main>
    ${signatures.length ? `<section class="sigs">${signatures.map(s => `<div class="sig"><div class="sig-line"></div>${esc(s)}</div>`).join('')}</section>` : ''}`;
  try { await translateElement(holder); } catch { /* print in English */ }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="${document.documentElement.lang || 'en'}"><head><meta charset="utf-8">
    <title>${esc(title)}${subtitle ? ` — ${esc(subtitle)}` : ''}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>${STYLES(orientation, footerLeft)}</style></head><body>${holder.innerHTML}</body></html>`);
  doc.close();

  // Wait for the emblem and fonts (briefly — never hang the print on a slow network).
  await Promise.race([
    Promise.all([waitForImages(doc), doc.fonts ? doc.fonts.ready : null]),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => frame.isConnected && frame.remove(), 5 * 60 * 1000);
  win.focus();
  win.print();
}

/** A simple table. rows: arrays of cell HTML; cols: [{ label, cls }]. */
export function tableHtml(cols, rows, { empty = 'Nothing to show.', foot = null } = {}) {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<table>
    <thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((cell, i) => `<td class="${cols[i].cls || ''}">${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    ${foot ? `<tfoot><tr>${foot.map((cell, i) => `<td class="${cols[i].cls || ''}">${cell ?? ''}</td>`).join('')}</tr></tfoot>` : ''}
  </table>`;
}

/** Prints the Mass intentions reader's sheet from what's on screen (admin + parishioner pages). */
export function printReadersSheet() {
  const flow = (id) => (document.getElementById(id)?.textContent || '').trim();
  const range = (document.getElementById('sheet-mass-range')?.textContent || '').trim();
  const groups = [
    ['Thanksgiving & (Birthdays):', flow('sheet-list-thanksgiving')],
    ['Special Intentions:', flow('sheet-list-special')],
    ['Souls:', flow('sheet-list-souls')],
  ];
  const count = groups.reduce((n, [, t]) => n + (t ? t.split(' / ').length : 0), 0);
  const body = `
    ${groups.map(([h, t], i) => `
      <h2>${esc(h)}</h2>
      <p class="flow">${t ? esc(t) : '<span class="muted">No intentions in this category.</span>'}</p>
      ${i === 0 ? `<p class="flow"><b>${esc('All Donors of Fatima Builders')}</b></p>` : ''}`).join('')}
    <p class="closing">*** ${esc('All Mass Card Intentions')}<br>*** ${esc('All Souls in Purgatory')}</p>`;
  return printReport({ title: 'Mass Intentions', subtitle: range, chips: [['Intentions', count]], body, className: 'reader' });
}
