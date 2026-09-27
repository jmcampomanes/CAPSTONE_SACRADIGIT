import{n as e}from"./modulepreload-polyfill-BlJ-Wce8.js";import{n as t,t as n}from"./amplify-init-BILvbBLA.js";import{a as r,i,n as a,o,r as s,s as c,t as l}from"./name-utils-B7bUvTns.js";import{a as u,d,f,o as p,p as m,u as h}from"./service-schedule-D_2dIfmW.js";import{a as g,i as _,n as v,o as y,r as b,t as x}from"./pin-map-CIA1NT7Z.js";function S({showToast:e,getRecords:t,getClosures:a,backLabel:h=`Back`}){document.body.insertAdjacentHTML(`beforeend`,`
  <section id="walkin-screen" class="svc-screen hidden" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
    <header class="svc-screen-bar">
      <button type="button" id="walkin-back" class="svc-screen-back">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        ${w(h)}
      </button>
      <div class="svc-screen-heading">
        <h2 class="svc-screen-title" id="walkin-title">New Service — Walk-in</h2>
        <p class="svc-screen-sub">For parishioners who asked at the parish office. The office can book any open slot, including same-day.</p>
      </div>
    </header>

    <div class="svc-screen-body" id="walkin-body">
      <div class="svc-screen-cols">
        <!-- Left: who and what -->
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Service &amp; Requester</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="form-label" for="walkin-service">Service <span class="text-red-500">*</span></label>
              <select id="walkin-service" class="form-input">
                <option value="">Select a service</option>
                ${_.map(e=>`
                  <optgroup label="${w(e.label)}">
                    ${g.filter(t=>t.category===e.key).map(e=>`<option value="${e.id}">${w(e.name)}</option>`).join(``)}
                  </optgroup>`).join(``)}
              </select>
              <p class="text-xs text-gray-400 mt-1 hidden" id="walkin-service-sched"></p>
            </div>
            ${r(`walkin-requester`,`Requester (person who asked)`,{required:!0,spanFull:!0})}
            <div>
              <label class="form-label" for="walkin-contact">Contact Number <span class="text-red-500">*</span></label>
              <input type="tel" id="walkin-contact" class="form-input" placeholder="e.g. 0917 123 4567" />
            </div>
            <div>
              <label class="form-label" for="walkin-email">Email <span class="text-gray-400 font-normal">(optional)</span></label>
              <input type="email" id="walkin-email" class="form-input" placeholder="for reminders" />
            </div>
          </div>

          <div id="walkin-fields-wrap" class="hidden mt-4">
            <h3 class="svc-screen-col-title" id="walkin-fields-title">Service Details</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="walkin-fields"></div>
          </div>

          <div class="mt-4">
            <label class="form-label" for="walkin-notes">Notes <span class="text-gray-400 font-normal">(optional)</span></label>
            <textarea id="walkin-notes" class="form-input" rows="2" placeholder="e.g. Paid the stipend at the office; bring baptismal candle."></textarea>
          </div>
        </div>

        <!-- Right: the slot -->
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Pick a Schedule <span class="text-red-500">*</span></h3>
          <div id="walkin-slot-picker" class="slot-picker"><p class="slot-empty">Choose a service first.</p></div>
          <p id="walkin-slot-summary" class="slot-summary hidden"></p>
        </div>
      </div>
    </div>

    <footer class="svc-screen-footer">
      <button type="button" id="walkin-cancel" class="btn-secondary">Cancel</button>
      <button type="button" id="walkin-submit" class="btn-lavender">Book Service</button>
    </footer>
  </section>`);let y=e=>document.getElementById(e),b=y(`walkin-screen`),S=y(`walkin-service`),E=y(`walkin-fields-wrap`),D=y(`walkin-fields`),O=y(`walkin-slot-picker`),k=y(`walkin-slot-summary`),A=y(`walkin-submit`),j=null,M=null,N=()=>g.find(e=>e.id===S.value)||null;function P(e,t){e.classList.add(`has-error`);let n=e.parentElement.querySelector(`.form-error-msg`);n||(n=document.createElement(`p`),n.className=`form-error-msg`,e.insertAdjacentElement(`afterend`,n)),n.textContent=t}function F(e){e&&(e.classList.remove(`has-error`),e.parentElement.querySelector(`.form-error-msg`)?.remove())}b.addEventListener(`input`,e=>{e.target.matches(`.form-input`)&&F(e.target)});function I(){R(),b.classList.remove(`hidden`,`is-closing`),document.body.classList.add(`svc-screen-open`),y(`walkin-body`).scrollTop=0,S.focus({preventScroll:!0})}function L(){if(b.classList.contains(`hidden`))return;document.body.classList.remove(`svc-screen-open`);let e=()=>{b.classList.add(`hidden`),H()};if(window.matchMedia(`(prefers-reduced-motion: reduce)`).matches){e();return}b.classList.add(`is-closing`),b.addEventListener(`animationend`,()=>{b.classList.remove(`is-closing`),document.body.classList.contains(`svc-screen-open`)||e()},{once:!0})}function R(){S.value=``,c(`walkin-requester`,null),[`walkin-contact`,`walkin-email`,`walkin-notes`].forEach(e=>{y(e).value=``}),b.querySelectorAll(`.form-input.has-error`).forEach(F),z()}y(`walkin-back`).addEventListener(`click`,L),y(`walkin-cancel`).addEventListener(`click`,L),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&!b.classList.contains(`hidden`)&&L()});function z(){H();let e=N();if(k.classList.add(`hidden`),O.classList.remove(`has-error`),y(`walkin-service-sched`).classList.toggle(`hidden`,!e),!e){j=null,O.innerHTML=`<p class="slot-empty">Choose a service first.</p>`,E.classList.add(`hidden`),D.innerHTML=``;return}y(`walkin-service-sched`).textContent=`Regular schedule: ${p(e.name)}`,y(`walkin-fields-title`).textContent=`${e.name} Details`,D.innerHTML=e.fields.map(e=>e.kind===`name`?r(`walkin-f-${e.id}`,w(e.label),{required:e.required,spanFull:!0}):e.kind===`map`?B(e):`
        <div class="${e.span2?`sm:col-span-2`:``}">
          <label class="form-label" for="walkin-f-${e.id}">${w(e.label)}${e.required?` <span class="text-red-500">*</span>`:``}</label>
          <input type="text" id="walkin-f-${e.id}" class="form-input" placeholder="${w(e.placeholder||``)}" />
        </div>`).join(``),E.classList.toggle(`hidden`,!e.fields.length);let n=e.fields.find(e=>e.kind===`map`);n&&V(n),j=u(O,{type:e.name,records:t(),closures:a(),ignoreLead:!0,layout:`calendar`,onChange:e=>{O.classList.remove(`has-error`),k.classList.toggle(`hidden`,!e),e&&(k.textContent=`Selected: ${T(e.date)} at ${e.time}`)}})}S.addEventListener(`change`,()=>{F(S),z()});function B(e){return`
      <div class="sm:col-span-2" id="walkin-q-${e.id}">
        <p class="form-label">Pin the Exact Location <span class="pin-map-optional">(recommended)</span></p>
        <div class="pin-map-wrap">
          <div id="walkin-f-${e.id}" class="pin-map" role="application" aria-label="Map — click to place a pin on the house"></div>
          <div class="pin-map-actions">
            <button type="button" class="pin-map-btn" data-pin-action="find">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
              Find the address
            </button>
            <span id="walkin-f-${e.id}-status" class="pin-map-status">Type the address below, then “Find the address”, or click the map.</span>
          </div>
        </div>
      </div>`}function V(e){let t=y(`walkin-f-${e.id}-status`),n=(e,n=``)=>{t.textContent=e,t.dataset.state=n};M=x(y(`walkin-f-${e.id}`),{onChange:e=>{e&&n(`Pinned: ${v(e)} — drag the pin to adjust.`,`ok`)}}),setTimeout(()=>M?.resize(),300),y(`walkin-q-${e.id}`).addEventListener(`click`,async t=>{let r=t.target.closest(`[data-pin-action]`);if(!r||!M)return;let i=y(`walkin-f-${e.addressField}`)?.value.trim();if(!i){n(`Type the address below first, then click “Find the address”.`,`error`);return}r.disabled=!0;try{n(`Looking up the address…`),await M.findAddress(i)}catch(e){n(e.message,`error`)}finally{r.disabled=!1}})}function H(){M&&=(M.destroy(),null)}return A.addEventListener(`click`,async()=>{let r=N(),c=!1;if(!r){P(S,`Please choose a service.`),e(`Please choose a service.`,!0);return}let u=y(`walkin-requester-last`);[y(`walkin-requester-first`),u].forEach(F),i(`walkin-requester`)||(P(u,`Requester’s first and last name are required.`),c=!0);let p=y(`walkin-contact`);F(p),p.value.trim()||(P(p,`Contact number is required.`),c=!0),r.fields.filter(e=>e.required&&e.kind!==`map`).forEach(e=>{if(e.kind===`name`){let t=y(`walkin-f-${e.id}-last`);F(t),i(`walkin-f-${e.id}`)||(P(t,`${e.label} is required.`),c=!0);return}let t=y(`walkin-f-${e.id}`);F(t),t.value.trim()||(P(t,`${e.label} is required.`),c=!0)});let h=j&&j.getValue();if(h||(O.classList.add(`has-error`),c=!0),c){e(h?`Please fill in the highlighted fields.`:`Please fill in the highlighted fields and pick a schedule.`,!0);return}let g={};r.fields.forEach(e=>{if(e.kind===`map`){let t=M?.getValue();t&&(g[e.label]=v(t));return}if(e.kind===`name`){let t=o(`walkin-f-${e.id}`);s(t)||(g[e.label]=t);return}let t=y(`walkin-f-${e.id}`).value.trim();t&&(g[e.label]=t)}),g[C]=`Parish Office (walk-in)`;let _=l(o(`walkin-requester`));A.disabled=!0;try{let{data:i}=await n.models.Blessing.list({limit:1e3});if(!m(r.name,i||t(),h.date,h.time,{closures:a()}))throw j.refresh(i||t()),Error(`That slot was just taken. Please pick another time.`);let o=y(`walkin-email`).value.trim(),s=await n.models.Blessing.create({requesterName:_,type:r.name,contact:y(`walkin-contact`).value.trim(),...o?{email:o}:{},notes:y(`walkin-notes`).value.trim()||void 0,details:JSON.stringify(g),location:d(r.name,g),preferredDate:h.date,date:h.date,time:h.time,status:`scheduled`});if(s.errors)throw Error(s.errors.map(e=>e.message).join(`; `));f(n,{action:`Walk-in`,record:s.data}),e(`${r.name} booked for ${_} — ${T(h.date)} at ${h.time}.`),L()}catch(t){console.error(`Failed to book walk-in service:`,t),e(t.message||`Couldn't book the service.`,!0)}finally{A.disabled=!1}}),{open:I,refresh(){j&&(j.refresh(t()),j.setClosures(a()))}}}var C,w,T,E=e((()=>{t(),y(),h(),a(),b(),C=`Booked By`,w=e=>{let t=document.createElement(`div`);return t.textContent=e??``,t.innerHTML},T=e=>new Date(`${e}T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`,year:`numeric`})}));export{E as n,S as t};