import{n as e}from"./modulepreload-polyfill-BlJ-Wce8.js";function t(){if(document.getElementById(o))return;let e=document.createElement(`style`);e.id=o,e.textContent=`
    .help-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 999px;
      border: 1.5px solid #c7cad6;
      background-color: #ffffff;
      color: #6b7280;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .help-icon-btn:hover {
      background-color: #f3f4f6;
      border-color: #9ca3af;
      color: #1e2a4a;
    }
    .help-icon-btn svg { width: 1rem; height: 1rem; }

    .help-date-wrap {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .help-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background-color: rgba(17, 24, 39, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .help-modal-overlay.hidden { display: none; }
    .help-modal-overlay.show { opacity: 1; }

    .help-modal-card {
      background-color: #ffffff;
      border-radius: 1rem;
      width: 100%;
      max-width: 26rem;
      max-height: calc(100vh - 3rem);
      overflow-y: auto;
      box-shadow: 0 20px 45px rgba(17, 24, 39, 0.25);
      transform: translateY(6px) scale(0.98);
      transition: transform 0.15s ease;
    }
    .help-modal-overlay.show .help-modal-card {
      transform: translateY(0) scale(1);
    }

    .help-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1.125rem 1.25rem;
      border-bottom: 1px solid #eef0f4;
    }
    .help-modal-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #111827;
    }
    .help-modal-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.5rem;
      color: #9ca3af;
      background: none;
      border: none;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .help-modal-close:hover { background-color: #f3f4f6; color: #374151; }
    .help-modal-close svg { width: 1rem; height: 1rem; }

    .help-modal-body { padding: 1.125rem 1.25rem 1.375rem; }

    .help-modal-intro {
      font-size: 0.8125rem;
      color: #4b5563;
      line-height: 1.55;
      margin-bottom: 0.875rem;
    }

    .help-modal-steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .help-modal-steps li {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      font-size: 0.8125rem;
      color: #374151;
      line-height: 1.5;
      counter-increment: help-step;
    }

    .help-modal-steps {
      counter-reset: help-step;
    }

    .help-modal-steps li::before {
      content: counter(help-step);
      flex-shrink: 0;
      width: 1.375rem;
      height: 1.375rem;
      border-radius: 999px;
      background-color: rgba(139, 143, 199, 0.16);
      color: #4b4f8f;
      font-size: 0.6875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.05rem;
    }

    [data-theme="dark"] .help-icon-btn {
      background-color: transparent;
      border-color: #3a3f52;
      color: #9ca3af;
    }
    [data-theme="dark"] .help-icon-btn:hover {
      background-color: #262b3d;
      color: #e5e7eb;
    }
    [data-theme="dark"] .help-modal-card { background-color: #1c2032; }
    [data-theme="dark"] .help-modal-header { border-bottom-color: #2f3448; }
    [data-theme="dark"] .help-modal-title { color: #f3f4f6; }
    [data-theme="dark"] .help-modal-intro { color: #9ca3af; }
    [data-theme="dark"] .help-modal-steps li { color: #d1d5db; }
    [data-theme="dark"] .help-modal-close:hover { background-color: #262b3d; color: #e5e7eb; }
  `,document.head.appendChild(e)}function n(){s||(s=document.createElement(`div`),s.className=`help-modal-overlay hidden`,s.id=`page-help-modal`,s.innerHTML=`
    <div class="help-modal-card" role="dialog" aria-modal="true" aria-labelledby="page-help-title">
      <div class="help-modal-header">
        <h3 class="help-modal-title" id="page-help-title"></h3>
        <button type="button" class="help-modal-close" data-close-help aria-label="Close">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="help-modal-body">
        <p class="help-modal-intro" id="page-help-intro"></p>
        <ol class="help-modal-steps" id="page-help-steps"></ol>
      </div>
    </div>
  `,document.body.appendChild(s),c=s.querySelector(`#page-help-title`),l=s.querySelector(`#page-help-intro`),u=s.querySelector(`#page-help-steps`),s.addEventListener(`click`,e=>{(e.target===s||e.target.closest(`[data-close-help]`))&&i()}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&s.classList.contains(`show`)&&i()}))}function r(e){n(),c.textContent=e.title||`How to use this page`,l.textContent=e.intro||``,u.innerHTML=(e.steps||[]).map(e=>`<li>${e}</li>`).join(``),s.classList.remove(`hidden`),requestAnimationFrame(()=>s.classList.add(`show`))}function i(){s&&(s.classList.remove(`show`),setTimeout(()=>s.classList.add(`hidden`),150))}function a(e){if(!e)return;let n=document.getElementById(`current-date`);if(!n)return;t();let i=document.createElement(`button`);i.type=`button`,i.id=`page-help-btn`,i.className=`help-icon-btn`,i.setAttribute(`aria-label`,`How to use this page`),i.setAttribute(`title`,`How to use this page`),i.innerHTML=`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.09 9a3 3 0 115.83 1c0 2-3 2-3 4m.02 4h.01M12 21a9 9 0 100-18 9 9 0 000 18z"/></svg>`,i.addEventListener(`click`,()=>r(e));let a=n.parentElement;if(a&&a.tagName===`HEADER`){let e=document.createElement(`div`);e.className=`help-date-wrap`,a.insertBefore(e,n),e.appendChild(i),e.appendChild(n)}else n.insertAdjacentElement(`beforebegin`,i)}var o,s,c,l,u,d=e((()=>{o=`help-tutorial-styles`}));export{d as n,a as t};