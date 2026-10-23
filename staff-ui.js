/* ============================================
   SacraDigit — shared toast and dialogs for the
   Media and ITech portals: errors stay at the top
   until closed (success fades after 3s), and
   in-page replacements for the browser's
   confirm() / prompt() boxes. Brings its own
   styles, so it doesn't depend on any portal's
   stylesheet.
   ============================================ */

import { showToast as sharedToast } from './toast.js';

const STYLE = `
/* ---------- Errors stay at the top until closed (staff-ui.js) ---------- */
.toast.toast-error {
  top: calc(0.75rem + env(safe-area-inset-top));
  bottom: auto;
  background-color: #fef2f2 !important;
  color: #991b1b;
  border: 1.5px solid #fca5a5;
  font-size: 0.9rem;
  transform: translateX(-50%) translateY(-10px);
}
.toast.toast-error.show { transform: translateX(-50%) translateY(0); }
.toast.toast-error .toast-message::before { content: "\\26A0  "; }
.toast .toast-dismiss { width: 2rem; height: 2rem; font-size: 1.25rem; }
.toast.toast-error .toast-dismiss { background: transparent; color: #991b1b; }
.toast.toast-error .toast-dismiss:hover { background: #fee2e2; }
:root[data-theme="dark"] .toast.toast-error { background-color: #3b1219 !important; color: #fecaca; border-color: #7f1d1d; }
:root[data-theme="dark"] .toast.toast-error .toast-dismiss { color: #fecaca; }

/* ---------- In-page confirm / reason dialog (staff-ui.js) ---------- */
.adm-dialog-overlay {
  position: fixed; inset: 0; z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; background: rgba(15, 23, 42, 0.5);
}
.adm-dialog {
  width: 100%; max-width: 30rem; max-height: calc(100vh - 2rem); overflow-y: auto;
  background: #ffffff; border-radius: 1rem; padding: 1.25rem 1.375rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
}
.adm-dialog-title { font-size: 1.0625rem; font-weight: 700; color: #111827; margin: 0 0 0.4rem; line-height: 1.35; }
.adm-dialog-msg { font-size: 0.875rem; color: #374151; margin: 0 0 0.75rem; line-height: 1.5; }
.adm-dialog-detail {
  margin: 0 0 0.85rem; padding: 0.6rem 0.8rem; border-left: 3px solid #c7cad6; border-radius: 0.4rem;
  background: #f7f8fa; font-size: 0.8125rem; color: #374151; line-height: 1.5;
}
.adm-dialog-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.3rem; }
.adm-dialog-input { width: 100%; }
.adm-dialog-err { font-size: 0.8125rem; font-weight: 600; color: #b91c1c; margin: 0.35rem 0 0; }
.adm-dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 0.625rem; margin-top: 1.1rem; }
.adm-dialog-ok {
  display: inline-flex; align-items: center; justify-content: center; min-height: 2.5rem;
  padding: 0.55rem 1.1rem; border: none; border-radius: 0.6rem;
  font-size: 0.875rem; font-weight: 600; color: #ffffff; cursor: pointer;
}
.adm-dialog-ok-primary { background-color: #1e2a4a; }
.adm-dialog-ok-primary:hover { background-color: #2a3963; }
.adm-dialog-ok-danger { background-color: #b91c1c; }
.adm-dialog-ok-danger:hover { background-color: #991b1b; }
.adm-dialog-ok-approve { background-color: #15803d; }
.adm-dialog-ok-approve:hover { background-color: #166534; }
.adm-dialog-actions .btn-secondary { min-height: 2.5rem; }
:root[data-theme="dark"] .adm-dialog { background: #1a2131; }
:root[data-theme="dark"] .adm-dialog-title { color: #f1f3f7; }
:root[data-theme="dark"] .adm-dialog-msg, :root[data-theme="dark"] .adm-dialog-label { color: #cbd3e6; }
:root[data-theme="dark"] .adm-dialog-detail { background: #121826; border-color: #3a4459; color: #cbd3e6; }
:root[data-theme="dark"] .adm-dialog-err { color: #fca5a5; }
.adm-dialog-preview { margin: 0 0 0.85rem; }
.adm-dialog-choices { border: 0; padding: 0; margin: 0 0 0.25rem; display: grid; gap: 0.4rem; }
.adm-dialog-choice { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.55rem 0.7rem; border: 1.5px solid #e5e7eb; border-radius: 0.6rem; cursor: pointer; font-size: 0.875rem; color: #111827; }
.adm-dialog-choice:has(input:checked) { border-color: #1e2a4a; background: #f5f6fb; }
.adm-dialog-choice input { margin-top: 0.2rem; accent-color: #1e2a4a; }
.adm-dialog-choice small { display: block; font-size: 0.8125rem; color: #4b5563; font-weight: 400; margin-top: 0.1rem; }
:root[data-theme="dark"] .adm-dialog-choice { border-color: #3a4459; color: #f1f3f7; }
:root[data-theme="dark"] .adm-dialog-choice:has(input:checked) { border-color: #8b8fc7; background: #242c3e; }
:root[data-theme="dark"] .adm-dialog-choice small { color: #b6bdca; }
/* ---------- Row actions: real buttons, not 11px capital words ---------- */
:is(.records-table, .acct-table) .row-actions { gap: 0.5rem; flex-wrap: wrap; }
:is(.records-table, .acct-table) :is(.row-approve, .row-reject, .row-view, .row-cert, .row-btn) {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.25rem; padding: 0.35rem 0.8rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 600; letter-spacing: 0; text-transform: none;
  white-space: nowrap; cursor: pointer;
  background: #ffffff; color: #1e2a4a; border: 1.5px solid #c7cad6;
}
:is(.records-table, .acct-table) :is(.row-view, .row-cert):hover { background: #f3f4f6; color: #1e2a4a; }
:is(.records-table, .acct-table) .row-approve { background: #15803d; color: #ffffff; border-color: #15803d; }
:is(.records-table, .acct-table) .row-approve:hover { background: #166534; color: #ffffff; }
:is(.records-table, .acct-table) .row-release { background: #1e2a4a; border-color: #1e2a4a; }
:is(.records-table, .acct-table) .row-release:hover { background: #2a3963; }
/* Opposite decisions get extra room between them. */
:is(.records-table, .acct-table) .row-reject { color: #b91c1c; border-color: #fca5a5; margin-left: 0.5rem; }
:is(.records-table, .acct-table) .row-reject:hover { background: #fef2f2; color: #991b1b; }
:root[data-theme="dark"] :is(.records-table, .acct-table) :is(.row-view, .row-cert, .row-reject) { background: transparent; color: #e5e8ef; border-color: #3a4459; }
:root[data-theme="dark"] :is(.records-table, .acct-table) .row-reject { color: #fca5a5; border-color: #7f1d1d; }
`;

function injectStyles() {
  if (document.getElementById('staff-ui-styles')) return;
  const st = document.createElement('style');
  st.id = 'staff-ui-styles';
  st.textContent = STYLE;
  document.head.appendChild(st);
}


// Timer bar + pause on hover come from the shared toast (toast.js).
export function showToast(message, isError = false) {
  injectStyles();
  sharedToast(message, isError);
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
 * @param {string} [o.previewHtml]  trusted HTML (caller escapes) shown under the message, e.g. what parishioners will see
 * @param {string} [o.typeToConfirm]  exact text the person must type before OK is enabled (permanent deletes)
 * @param {{label:string, options:{value:string,label:string,hint?:string}[], value?:string}} [o.select]  resolves to the picked value (or null)
 */
export function openDialog({ title, message = '', detail = '', confirmLabel = 'OK', cancelLabel = 'Cancel', tone = 'primary', input = null, previewHtml = '', typeToConfirm = '', select = null }) {
  if (typeToConfirm) {
    input = { label: `Type ${typeToConfirm} to confirm`, placeholder: typeToConfirm, required: true, maxLength: typeToConfirm.length + 20, single: true };
  }
  injectStyles();
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'adm-dialog-overlay';
    overlay.innerHTML = `
      <div class="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-dialog-title">
        <h2 id="adm-dialog-title" class="adm-dialog-title">${esc(title)}</h2>
        ${message ? `<p class="adm-dialog-msg">${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
        ${detail ? `<blockquote class="adm-dialog-detail">${esc(detail).replace(/\n/g, '<br>')}</blockquote>` : ''}
        ${previewHtml ? `<div class="adm-dialog-preview">${previewHtml}</div>` : ''}
        ${select ? `
          <fieldset class="adm-dialog-choices"><legend class="adm-dialog-label">${esc(select.label)}</legend>
            ${select.options.map(o => `
            <label class="adm-dialog-choice"><input type="radio" name="adm-dialog-choice" value="${esc(o.value)}" ${o.value === select.value ? 'checked' : ''} />
              <span><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></label>`).join('')}
          </fieldset>` : ''}
        ${input ? `
          <label class="adm-dialog-label" for="adm-dialog-input">${esc(input.label)}</label>
          ${input.single
            ? `<input type="text" id="adm-dialog-input" class="form-input adm-dialog-input" autocomplete="off" spellcheck="false" maxlength="${input.maxLength || 200}" placeholder="${esc(input.placeholder || '')}" />`
            : `<textarea id="adm-dialog-input" class="form-input adm-dialog-input" rows="3" maxlength="${input.maxLength || 500}" placeholder="${esc(input.placeholder || '')}"></textarea>`}
          <p class="adm-dialog-err" id="adm-dialog-err" hidden>${typeToConfirm ? 'That doesn’t match. Type it exactly as shown.' : 'Please write a short reason.'}</p>` : ''}
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
      if (select) { finish(overlay.querySelector('input[name="adm-dialog-choice"]:checked')?.value ?? null); return; }
      if (!input) { finish(true); return; }
      const text = field.value.trim();
      if (typeToConfirm ? text !== typeToConfirm : (input.required !== false && !text)) {
        err.hidden = false;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', 'adm-dialog-err');
        field.focus();
        return;
      }
      finish(typeToConfirm ? true : text);
    };
    const cancel = () => finish(select || (input && !typeToConfirm) ? null : false);
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      else if (e.key === 'Tab') {
        const items = [...overlay.querySelectorAll('button, textarea, input, a[href]')];
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
    if (input?.single) field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    (field || overlay.querySelector('input[name="adm-dialog-choice"]:checked') || overlay.querySelector('[data-act="ok"]')).focus();
  });
}

export const confirmDialog = (opts) => openDialog(opts);
export const reasonDialog = (opts) => openDialog({ tone: 'danger', ...opts, input: { required: true, ...opts.input } });

// Row buttons (ITech accounts, Media tables) need these styles before any dialog opens.
injectStyles();
