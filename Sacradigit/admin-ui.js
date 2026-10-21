/* ============================================
   SacraDigit Admin — shared toast and dialogs
   One toast for every admin page (errors stay at
   the top until closed; success fades after 3s),
   and in-page replacements for the browser's
   confirm() / prompt() boxes, which can't show
   which record is affected and look like system
   errors. Styles: sacradigit-css/admin-shell.css.
   ============================================ */

const SUCCESS_MS = 3000;
let toastTimer = null;

export function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  const msgEl = toast.querySelector('.toast-message');
  if (msgEl) msgEl.textContent = message; else toast.textContent = message;
  toast.style.backgroundColor = '';
  toast.classList.toggle('toast-error', isError);
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  if (isError) return;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 200);
  }, SUCCESS_MS);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * In-page dialog. Resolves to true/false (confirm) or the typed text / null (with `input`).
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.message]  plain text
 * @param {string} [o.detail]   plain text shown in a quote box (e.g. the record affected)
 * @param {string} [o.confirmLabel='OK']
 * @param {'primary'|'danger'|'approve'} [o.tone='primary']
 * @param {{label:string, placeholder?:string, required?:boolean, maxLength?:number}} [o.input]
 */
export function openDialog({ title, message = '', detail = '', confirmLabel = 'OK', cancelLabel = 'Cancel', tone = 'primary', input = null }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'adm-dialog-overlay';
    overlay.innerHTML = `
      <div class="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-dialog-title">
        <h2 id="adm-dialog-title" class="adm-dialog-title">${esc(title)}</h2>
        ${message ? `<p class="adm-dialog-msg">${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
        ${detail ? `<blockquote class="adm-dialog-detail">${esc(detail).replace(/\n/g, '<br>')}</blockquote>` : ''}
        ${input ? `
          <label class="adm-dialog-label" for="adm-dialog-input">${esc(input.label)}</label>
          <textarea id="adm-dialog-input" class="form-input adm-dialog-input" rows="3" maxlength="${input.maxLength || 500}" placeholder="${esc(input.placeholder || '')}"></textarea>
          <p class="adm-dialog-err" id="adm-dialog-err" hidden>Please write a short reason.</p>` : ''}
        <div class="adm-dialog-actions">
          <button type="button" class="btn-secondary" data-act="cancel">${esc(cancelLabel)}</button>
          <button type="button" class="adm-dialog-ok adm-dialog-ok-${tone}" data-act="ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;

    const field = overlay.querySelector('#adm-dialog-input');
    const err = overlay.querySelector('#adm-dialog-err');
    const finish = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
      resolve(value);
    };
    const ok = () => {
      if (!input) { finish(true); return; }
      const text = field.value.trim();
      if (input.required !== false && !text) {
        err.hidden = false;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', 'adm-dialog-err');
        field.focus();
        return;
      }
      finish(text);
    };
    const cancel = () => finish(input ? null : false);
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      else if (e.key === 'Tab') {
        const items = [...overlay.querySelectorAll('button, textarea')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { cancel(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok') ok(); else if (act === 'cancel') cancel();
    });
    field?.addEventListener('input', () => { err.hidden = true; field.removeAttribute('aria-invalid'); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    (field || overlay.querySelector('[data-act="ok"]')).focus();
  });
}

export const confirmDialog = (opts) => openDialog(opts);
export const reasonDialog = (opts) => openDialog({ tone: 'danger', ...opts, input: { required: true, ...opts.input } });
