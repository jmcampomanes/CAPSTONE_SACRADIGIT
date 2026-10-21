/* ============================================
   SacraDigit — Month / Day / Year dropdowns for birth dates
   (started by user/user-shell.js on every parishioner page).

   The browser's mm/dd/yyyy calendar is hard work for someone
   born 70 years ago — it starts at today and pages back one
   month at a time. Any <input type="date"> whose id mentions
   "birth" gets three plain dropdowns instead:
     [ Month ▾ ] [ Day ▾ ] [ Year ▾ ]   e.g. March · 14 · 1956

   The original date box stays in the page (hidden) and still
   holds the YYYY-MM-DD value, so every form's existing
   reading, checking and clearing code keeps working untouched:
   - picking all three fills it (and fires input/change);
   - code that sets or clears `.value` updates the dropdowns;
   - when a form outlines it red, the dropdowns turn red too,
     and the "Please enter the date of birth." message from
     field-messages.js shows under them.
   ============================================ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_YEAR = 1900;
const ERROR_CLASSES = ['border-red-400', 'has-error', 'mi-invalid'];
const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

const isBirthDateInput = (el) =>
  el instanceof HTMLInputElement && el.type === 'date' && /birth/i.test(el.id) && !el.dataset.dateDropdowns;

const daysIn = (year, month) => new Date(year || 2000, month, 0).getDate(); // year unknown: allow Feb 29

const pad = (n) => String(n).padStart(2, '0');

function makeSelect(id, label, placeholder) {
  const s = document.createElement('select');
  s.className = 'form-input date-dd-select';
  s.id = id;
  s.setAttribute('aria-label', label);
  s.innerHTML = `<option value="">${placeholder}</option>`;
  return s;
}

function enhance(input) {
  input.dataset.dateDropdowns = '1';
  const base = input.id;
  const thisYear = new Date().getFullYear();
  const maxYear = Math.min(thisYear, Number((input.max || '').slice(0, 4)) || thisYear);
  const minYear = Math.max(MIN_YEAR, Number((input.min || '').slice(0, 4)) || MIN_YEAR);

  const group = document.createElement('div');
  group.className = 'date-dd';
  group.setAttribute('role', 'group');

  const month = makeSelect(`${base}-month`, 'Month', 'Month');
  month.innerHTML += MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

  const day = makeSelect(`${base}-day`, 'Day', 'Day');

  // Newest year first: most people pick by typing the year or scrolling a short way.
  const year = makeSelect(`${base}-year`, 'Year', 'Year');
  let years = '';
  for (let y = maxYear; y >= minYear; y--) years += `<option value="${y}">${y}</option>`;
  year.innerHTML += years;

  group.append(month, day, year);
  input.before(group);
  input.classList.add('date-dd-source');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  // The visible label now points at the first dropdown, and names the group.
  const label = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
  if (label) {
    if (!label.id) label.id = `${base}-label`;
    label.htmlFor = month.id;
    group.setAttribute('aria-labelledby', label.id);
  }

  function fillDays() {
    const keep = day.value;
    const n = daysIn(Number(year.value), Number(month.value) || 1);
    day.innerHTML = '<option value="">Day</option>' +
      Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    if (keep && Number(keep) <= n) day.value = keep;
  }

  // Dropdowns -> hidden date box
  function pushValue() {
    const v = month.value && day.value && year.value
      ? `${year.value}-${pad(month.value)}-${pad(day.value)}` : '';
    if (nativeValue.get.call(input) !== v) {
      nativeValue.set.call(input, v);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Any pick counts as editing the box (clears its red outline, like typing would).
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Hidden date box -> dropdowns (prefill, "clear" buttons, drafts)
  function pullValue() {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nativeValue.get.call(input) || '');
    year.value = m ? String(Number(m[1])) : '';
    month.value = m ? String(Number(m[2])) : '';
    fillDays();
    day.value = m ? String(Number(m[3])) : '';
  }

  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return nativeValue.get.call(input); },
    set(v) { nativeValue.set.call(input, v); pullValue(); },
  });

  month.addEventListener('change', () => { fillDays(); pushValue(); });
  year.addEventListener('change', () => { fillDays(); pushValue(); });
  day.addEventListener('change', pushValue);

  // Mirror the form's red outline onto the dropdowns.
  const paintError = () => group.classList.toggle('date-dd-invalid', ERROR_CLASSES.some(c => input.classList.contains(c)));
  new MutationObserver(paintError).observe(input, { attributes: true, attributeFilter: ['class'] });

  // Keep disabled/hidden state in step (e.g. a guardian section switched off).
  new MutationObserver(() => { [month, day, year].forEach(s => { s.disabled = input.disabled; }); })
    .observe(input, { attributes: true, attributeFilter: ['disabled'] });

  pullValue();
  paintError();
}

/** Converts birth-date boxes already on the page, and any that forms add later. */
export function initBirthDateDropdowns(root = document.body) {
  root.querySelectorAll('input[type="date"]').forEach(el => { if (isBirthDateInput(el)) enhance(el); });
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (isBirthDateInput(node)) enhance(node);
        node.querySelectorAll?.('input[type="date"]').forEach(el => { if (isBirthDateInput(el)) enhance(el); });
      });
    }
  }).observe(root, { childList: true, subtree: true });
}
