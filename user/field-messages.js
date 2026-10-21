/* ============================================
   SacraDigit — a plain message under the box that's wrong
   (used by user-shell.js on every parishioner page).
   Every form already outlines a missing box in red (border-red-400 /
   has-error / mi-invalid) and clears it when the box is edited. This
   writes "Please enter the last name." under that box while it's red,
   links it for screen readers, and removes it once it's fixed.
   ============================================ */

const FIELD_ERROR_CLASSES = ['border-red-400', 'has-error', 'mi-invalid'];
export const FIELD_ERROR_SELECTOR = FIELD_ERROR_CLASSES.map(c => `.${c}`).join(', ');

// Areas that aren't a single box: what's missing, in plain words.
const AREA_MESSAGES = [
  ['.mi-cat-grid', 'Tap one of the intentions above first.'],
  ['.bkcal', 'Please pick a date on the calendar.'],
  ['.bktime-slots', 'Please pick a start time.'],
  ['.slot-picker', 'Please pick a date and time.'],
];

const hasFieldError = (el) => FIELD_ERROR_CLASSES.some(c => el.classList.contains(c));

function fieldLabel(el) {
  let text = '';
  if (el.id) text = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent || '';
  if (!text) text = el.closest('div')?.querySelector('label, .form-label')?.textContent || '';
  if (!text) text = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  return text.replace(/\(.*?\)/g, '').replace(/[*:]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function fieldMessage(el) {
  const area = AREA_MESSAGES.find(([sel]) => el.matches(sel));
  if (area) return area[1];
  const label = fieldLabel(el);
  if (el.type === 'date') {
    if (el.value) return label ? `Please check the ${label} — that date doesn't look right.` : 'Please check this date.';
    return label ? `Please enter the ${label}.` : 'Please pick a date.';
  }
  if (el.tagName === 'SELECT') return label ? `Please choose the ${label}.` : 'Please choose one.';
  return label ? `Please enter the ${label}.` : 'Please fill in this box.';
}

// First / middle / last name boxes share one row — one message under the row.
function nameRowMessage(row) {
  const parts = [...row.querySelectorAll(FIELD_ERROR_SELECTOR)]
    .map(el => (el.id.match(/-(first|middle|last)$/) || [])[1])
    .filter(Boolean);
  if (!parts.length) return '';
  return `Please enter the ${parts.join(' and ')} name.`;
}

let fieldMsgSeq = 0;

function anchorFor(el) {
  const row = el.closest('.name-field-row');
  if (row) return row;
  const parent = el.parentElement;
  if (parent && parent !== document.body) {
    const s = getComputedStyle(parent);
    if (s.display.includes('flex') && !s.flexDirection.startsWith('column')) return parent;
  }
  return el;
}

function paintFieldError(el) {
  // Pages that already write their own message under the box (Request a Service, My Profile).
  if (el.parentElement?.querySelector(':scope > .form-error-msg')) return;
  const anchor = anchorFor(el);
  const isRow = anchor.classList.contains('name-field-row');
  const text = isRow ? nameRowMessage(anchor) : (hasFieldError(el) ? fieldMessage(el) : '');
  let msg = anchor.nextElementSibling?.classList.contains('field-msg') ? anchor.nextElementSibling : null;

  if (!text) {
    msg?.remove();
    el.removeAttribute('aria-invalid');
    if (el.dataset.fieldMsgId) {
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== el.dataset.fieldMsgId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
      delete el.dataset.fieldMsgId;
    }
    return;
  }
  if (!msg) {
    msg = document.createElement('p');
    msg.className = 'field-msg';
    msg.id = `field-msg-${++fieldMsgSeq}`;
    anchor.insertAdjacentElement('afterend', msg);
  }
  msg.textContent = text;
  if (hasFieldError(el) && !['DIV', 'UL', 'SECTION'].includes(el.tagName)) {
    el.setAttribute('aria-invalid', 'true');
    if (el.dataset.fieldMsgId !== msg.id) {
      el.dataset.fieldMsgId = msg.id;
      el.setAttribute('aria-describedby', `${el.getAttribute('aria-describedby') || ''} ${msg.id}`.trim());
    }
  }
}

export function watchFieldErrors(onAllFixed) {
  new MutationObserver((mutations) => {
    let cleared = false;
    for (const m of mutations) {
      const el = m.target;
      if (!(el instanceof HTMLElement)) continue;
      const was = FIELD_ERROR_CLASSES.some(c => (m.oldValue || '').split(/\s+/).includes(c));
      const now = hasFieldError(el);
      if (was === now) continue;
      paintFieldError(el);
      if (was && !now) cleared = true;
    }
    if (cleared && !document.querySelector(FIELD_ERROR_SELECTOR)) onAllFixed();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
}

