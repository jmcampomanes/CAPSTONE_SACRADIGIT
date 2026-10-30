/* ============================================
   SacraDigit Admin — shared toast and dialogs
   One toast for every admin page (errors stay at
   the top until closed; success fades after 3s),
   and in-page replacements for the browser's
   confirm() / prompt() boxes, which can't show
   which record is affected and look like system
   errors. Styles: Sacradigit/css/admin-shell.css.
   ============================================ */

// The toast itself (timer bar, pause on hover) is shared with the staff portals.
import { showToast } from '../../shared/js/toast.js';
export { showToast };

/**
 * Shows `message` for a saved change, then — once the parishioner email
 * (a notify* promise from ../../shared/js/email-notify.js) settles — says so if it
 * didn't go out, so the office knows to reach them another way.
 */
export async function reportEmail(pending, who, message) {
  if (message) showToast(message);
  const outcome = await pending;
  const name = who || 'the parishioner';
  if (outcome === 'failed') {
    showToast(`${message ? `${message} ` : ''}But the email to ${name} couldn’t be sent — please let them know another way.`, true);
  } else if (outcome === 'no-email') {
    showToast(`${message ? `${message} ` : ''}${name} has no email on file, so they weren’t emailed.`);
  }
  return outcome;
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
