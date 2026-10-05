/* ============================================
   SacraDigit — Shared time picker
   Hour + minute selects and an AM/PM switch, used
   instead of the browser's time box (where AM/PM
   had to be typed). Styles live in admin-shell.css.

   Import as:  import { createTimePicker } from '../time-picker.js';

   value() gives "07:00 AM" (the format times are
   saved in), or '' until an hour is picked.
   ============================================ */

export function createTimePicker(container, { onChange = () => {}, minuteStep = 5 } = {}) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  container.innerHTML = `
    <div class="time-picker">
      <select class="form-input tp-hour" aria-label="Hour">
        <option value="">Hour</option>
        ${hours.map(h => `<option value="${h}">${h}</option>`).join('')}
      </select>
      <span class="tp-colon">:</span>
      <select class="form-input tp-minute" aria-label="Minutes">
        ${minutes.map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
      <div class="tp-meridiem" role="group" aria-label="AM or PM">
        <button type="button" class="tp-mer active" data-mer="AM" aria-pressed="true">AM</button>
        <button type="button" class="tp-mer" data-mer="PM" aria-pressed="false">PM</button>
      </div>
    </div>`;
  const hourEl = container.querySelector('.tp-hour');
  const minuteEl = container.querySelector('.tp-minute');
  const merBtns = container.querySelectorAll('.tp-mer');
  let meridiem = 'AM';

  const setMeridiem = (mer) => {
    meridiem = mer;
    merBtns.forEach(b => { const on = b.dataset.mer === mer; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  };
  merBtns.forEach(b => b.addEventListener('click', () => { setMeridiem(b.dataset.mer); onChange(); }));
  hourEl.addEventListener('change', onChange);
  minuteEl.addEventListener('change', onChange);

  return {
    value() {
      if (!hourEl.value) return '';
      return `${hourEl.value.padStart(2, '0')}:${minuteEl.value} ${meridiem}`;
    },
    /** Fill from a saved "7:00 AM" / "07:00 AM" string ('' clears it). */
    set(time12) {
      const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
      if (!match) { this.reset(); return; }
      hourEl.value = String(parseInt(match[1], 10));
      // A saved minute that isn't on the step (e.g. :07) still shows
      if (![...minuteEl.options].some(o => o.value === match[2])) minuteEl.add(new Option(match[2], match[2]));
      minuteEl.value = match[2];
      setMeridiem(match[3].toUpperCase());
    },
    reset() { hourEl.value = ''; minuteEl.value = '00'; setMeridiem('AM'); },
  };
}

/** "07:00 AM" → "7:00 AM" for display. */
export function displayTime(time12) {
  return (time12 || '').replace(/^0(\d)/, '$1');
}
