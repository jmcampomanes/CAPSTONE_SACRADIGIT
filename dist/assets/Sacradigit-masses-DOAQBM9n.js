import{t as e}from"./modulepreload-polyfill-DhfyEEff.js";/* empty css                  *//* empty css                         */import{n as t,t as n}from"./amplify-init-B18ZgTx7.js";/* empty css               */e((()=>{t(),document.addEventListener(`DOMContentLoaded`,()=>{let e=new Date().toISOString().slice(0,10),t=[],r=[],i=[{day:`Monday`,times:[`6:00 AM`,`7:00 AM`],type:`Daily Mass`},{day:`Tuesday`,times:[`6:00 AM`,`7:00 AM`],type:`Daily Mass`},{day:`Wednesday`,times:[`6:00 AM`,`7:00 AM`],type:`Daily Mass`},{day:`Thursday`,times:[`6:00 AM`,`7:00 AM`],type:`Daily Mass`},{day:`Friday`,times:[`6:00 AM`,`7:00 AM`],type:`Daily Mass`},{day:`Saturday`,times:[`7:00 AM`,`5:30 PM`],type:`Anticipated Mass`},{day:`Sunday`,times:[`6:00 AM`,`8:00 AM`,`10:00 AM`,`5:00 PM`],type:`Sunday Mass`}],a=document.getElementById(`date-picker`),o=document.getElementById(`schedule-date-label`),s=document.getElementById(`date-schedule-list`),c=document.getElementById(`date-schedule-empty`),l=document.getElementById(`special-masses-list`),u=document.getElementById(`weekly-tbody`);a.value=e;function d(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML}function f(e){let[t,n]=e.split(` `),[r,i]=t.split(`:`).map(Number);return n===`PM`&&r!==12&&(r+=12),n===`AM`&&r===12&&(r=0),r*60+i}function p(e){return new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`,year:`numeric`})}function m(e){return new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{month:`short`,day:`numeric`})}n.models.Mass.observeQuery().subscribe({next:({items:e})=>{t=e,h(),g()},error:e=>{console.error(`Failed to load masses:`,e),s.innerHTML=`<li class="text-sm text-red-500 py-4">Couldn't load masses.</li>`}});function h(){let e=a.value,n=t.filter(t=>t.date===e);if(o.textContent=p(e),s.innerHTML=``,n.length===0){r=[],c.classList.remove(`hidden`);return}c.classList.add(`hidden`),r=n.slice().sort((e,t)=>f(e.time)-f(t.time)),r.forEach((e,t)=>{let n=document.createElement(`li`);n.innerHTML=`
        <div class="schedule-row">
          <span class="schedule-time">${d(e.time)}</span>
          <div class="schedule-info">
            <p class="schedule-type">${d(e.title||e.type)}</p>
            ${e.note?`<p class="schedule-note">${d(e.note)}</p>`:``}
          </div>
          ${e.isSpecial?`<span class="schedule-special-tag">Special</span>`:``}
          <button type="button" class="schedule-details-btn" data-index="${t}">See Full Details ›</button>
        </div>
      `,s.appendChild(n)})}a.addEventListener(`change`,h),s.addEventListener(`click`,e=>{let t=e.target.closest(`.schedule-details-btn`);t&&w(parseInt(t.dataset.index,10))});function g(){let n=new Date(e+`T00:00:00`),r=t.filter(e=>e.isSpecial&&new Date(e.date+`T00:00:00`)>=n).sort((e,t)=>new Date(e.date)-new Date(t.date));l.innerHTML=r.map(e=>`
      <li>
        <div class="special-row">
          <div class="special-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          </div>
          <div class="special-info">
            <p class="special-name">${d(e.title||e.note)}</p>
            <p class="special-date">${p(e.date)}</p>
          </div>
        </div>
      </li>
    `).join(``)}function _(){u.innerHTML=i.map((e,t)=>`
      <tr>
        <td class="day-cell">${d(e.day)}</td>
        <td>${e.times.map(e=>`<span class="time-pill">${d(e)}</span>`).join(``)}</td>
        <td>${d(e.type)}</td>
        <td class="text-right"><button type="button" class="row-action" data-day-index="${t}">Edit ›</button></td>
      </tr>
    `).join(``)}u.addEventListener(`click`,e=>{let t=e.target.closest(`.row-action`);if(t){let e=parseInt(t.dataset.dayIndex,10);D(`Editing ${i[e].day}'s schedule… (not yet wired to a form)`)}}),_(),document.getElementById(`btn-print`).addEventListener(`click`,()=>window.print());let v=document.getElementById(`schedule-modal`);document.getElementById(`btn-schedule-mass`).addEventListener(`click`,()=>{document.getElementById(`schedule-date`).value=a.value,y(v)}),document.querySelectorAll(`[data-close-modal]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.closest(`.modal-overlay`);t&&b(t)})}),document.querySelectorAll(`.modal-overlay`).forEach(e=>{e.addEventListener(`click`,t=>{t.target===e&&b(e)})}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&document.querySelectorAll(`.modal-overlay`).forEach(b)});function y(e){e.classList.remove(`hidden`),document.body.style.overflow=`hidden`}function b(e){e.classList.contains(`hidden`)||(e.classList.add(`hidden`),document.body.style.overflow=``)}document.getElementById(`schedule-submit`).addEventListener(`click`,async()=>{let e=document.getElementById(`schedule-date`).value,t=document.getElementById(`schedule-time`).value,r=document.getElementById(`schedule-type`).value,i=document.getElementById(`schedule-note`).value.trim(),o=document.getElementById(`schedule-special`).checked;if(!e||!t||!r){D(`Please fill in date, time, and mass type.`,!0);return}let s=x(t);try{let t=await n.models.Mass.create({date:e,time:s,type:r,title:o&&i||r,note:i||void 0,isSpecial:o});if(t.errors)throw Error(t.errors.map(e=>e.message).join(`; `));a.value=e,h(),b(v),D(`Mass scheduled for ${m(e)} at ${s}.`),document.getElementById(`schedule-time`).value=``,document.getElementById(`schedule-type`).value=``,document.getElementById(`schedule-note`).value=``,document.getElementById(`schedule-special`).checked=!1}catch(e){console.error(`Failed to schedule mass:`,e),D(e.message||`Couldn't schedule the mass.`,!0)}});function x(e){let[t,n]=e.split(`:`).map(Number),r=t>=12?`PM`:`AM`;return t=t%12||12,`${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)} ${r}`}let S=document.getElementById(`mass-details-modal`),C=document.getElementById(`mass-details-body`);function w(e){let t=r[e];t&&(C.innerHTML=`
      <div class="so-detail-grid">
        <div>
          <p class="so-detail-label">Date</p>
          <p class="so-detail-value">${d(p(a.value))}</p>
        </div>
        <div>
          <p class="so-detail-label">Time</p>
          <p class="so-detail-value">${d(t.time)}</p>
        </div>
        <div>
          <p class="so-detail-label">Mass Type</p>
          <p class="so-detail-value">${d(t.type)}</p>
        </div>
        <div>
          <p class="so-detail-label">Special Mass</p>
          <p class="so-detail-value">${t.isSpecial?`Yes`:`No`}</p>
        </div>
      </div>
      <div class="mt-3">
        <p class="so-detail-label">Intention / Note</p>
        <p class="so-detail-value">${t.note?d(t.note):`—`}</p>
      </div>
    `,y(S))}let T=document.getElementById(`toast`),E=null;function D(e,t=!1){clearTimeout(E);let n=T.querySelector(`.toast-message`);n?n.textContent=e:T.textContent=e,T.style.backgroundColor=t?`#b91c1c`:`#1e2a4a`,T.classList.remove(`hidden`),requestAnimationFrame(()=>T.classList.add(`show`)),E=setTimeout(()=>{T.classList.remove(`show`),setTimeout(()=>T.classList.add(`hidden`),200)},3e3)}})}))();