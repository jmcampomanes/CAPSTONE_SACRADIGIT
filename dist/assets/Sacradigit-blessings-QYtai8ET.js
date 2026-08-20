import{n as e,nt as t,t as n}from"./amplify-init-DgBa3hMn.js";/* empty css                  *//* empty css                         */import{t as r}from"./dashboard-C6eKpHew.js";/* empty css               */var i=t((()=>{e(),document.addEventListener(`DOMContentLoaded`,()=>{let e=new Date().toISOString().slice(0,10),t=[],r=[],i=[],a=document.getElementById(`upcoming-list`),o=document.getElementById(`upcoming-empty`),s=document.getElementById(`upcoming-count`),c=document.getElementById(`requests-list`),l=document.getElementById(`requests-empty`),u=document.getElementById(`requests-count`),d=document.getElementById(`completed-list`),f=document.getElementById(`completed-count`),p=document.getElementById(`search-input`),m=document.getElementById(`type-filter`);function h(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML}function g(e){return e?new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`}):`—`}function _(){return`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`}function v(e){let t=p.value.trim().toLowerCase(),n=m.value,r=!t||(e.requesterName||``).toLowerCase().includes(t)||(e.type||``).toLowerCase().includes(t),i=!n||e.type===n;return r&&i}n.models.Blessing.observeQuery().subscribe({next:({items:e})=>{t=[],r=[],i=[],e.forEach(e=>{e.status===`scheduled`?t.push(e):e.status===`pending`?r.push(e):e.status===`completed`&&i.push(e)}),y(),b(),x(),C()},error:e=>{console.error(`Failed to load blessings:`,e),R(`Couldn't load blessings from the database.`,!0)}});function y(){document.getElementById(`stat-scheduled`).textContent=t.length,document.getElementById(`stat-pending`).textContent=r.length}function b(){let e=t.slice().sort((e,t)=>new Date(e.date)-new Date(t.date)).filter(v);if(s.textContent=`${e.length} scheduled`,e.length===0){a.innerHTML=``,o.classList.remove(`hidden`);return}o.classList.add(`hidden`),a.innerHTML=e.map(e=>`
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${_()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${h(e.requesterName)}</p>
            <p class="blessing-meta">${h(e.type)} · ${h(e.location)}</p>
          </div>
          <div>
            <div class="blessing-datetime">
              ${g(e.date)}<br/>${h(e.time)}
            </div>
            <button type="button" class="blessing-details-btn" data-section="upcoming" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}function x(){let e=r.filter(v);if(u.textContent=`${e.length} pending`,e.length===0){c.innerHTML=``,l.classList.remove(`hidden`);return}l.classList.add(`hidden`),c.innerHTML=e.map(e=>`
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${h(e.requesterName)}</p>
            <p class="request-meta">${h(e.type)} · requested for ${g(e.preferredDate)}</p>
          </div>
          <div class="request-actions">
            <div class="request-action-row">
              <button type="button" class="req-approve" data-id="${e.id}">Approve</button>
              <button type="button" class="req-decline" data-id="${e.id}">Decline</button>
            </div>
            <button type="button" class="blessing-details-btn" data-section="requests" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}c.addEventListener(`click`,e=>{let t=e.target.closest(`.req-approve`),n=e.target.closest(`.req-decline`);t&&S(t.dataset.id),n&&A(n.dataset.id)});async function S(e){let t=r.find(t=>t.id===e);if(t)try{let r=await n.models.Blessing.update({id:e,status:`scheduled`,date:t.preferredDate,time:t.time||`09:00 AM`,location:t.location||`To be confirmed`});if(r.errors)throw Error(r.errors.map(e=>e.message).join(`; `));R(`Request approved — ${t.requesterName} added to the schedule.`)}catch(e){console.error(`Failed to approve request:`,e),R(e.message||`Couldn't approve request.`,!0)}}function C(){let e=i.slice().sort((e,t)=>new Date(t.date)-new Date(e.date)).filter(v);f.textContent=`${e.length} completed`,d.innerHTML=e.map(e=>`
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${h(e.requesterName)}</p>
            <p class="completed-meta">${h(e.type)}</p>
          </div>
          <div>
            <div class="completed-date">${g(e.date)}</div>
            <button type="button" class="blessing-details-btn" data-section="completed" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}p.addEventListener(`input`,()=>{b(),x(),C()}),m.addEventListener(`change`,()=>{b(),x(),C()}),document.getElementById(`btn-clear-filters`)?.addEventListener(`click`,()=>{p.value=``,m.value=``,b(),x(),C()}),[a,c,d].forEach(e=>{e.addEventListener(`click`,e=>{let t=e.target.closest(`.blessing-details-btn`);t&&F(t.dataset.section,t.dataset.id)})});let w=document.getElementById(`schedule-modal`);document.getElementById(`btn-schedule-blessing`).addEventListener(`click`,()=>{document.getElementById(`schedule-date`).value=e,N(w)}),document.getElementById(`schedule-submit`).addEventListener(`click`,async()=>{let e=document.getElementById(`schedule-requester`).value.trim(),t=document.getElementById(`schedule-date`).value,r=document.getElementById(`schedule-time`).value,i=document.getElementById(`schedule-type`).value,a=document.getElementById(`schedule-location`).value.trim();if(!e||!t||!r||!i){R(`Please fill in requester, date, time, and blessing type.`,!0);return}let o=document.getElementById(`schedule-submit`);o.disabled=!0;try{let o=await n.models.Blessing.create({requesterName:e,type:i,location:a||`Not specified`,date:t,time:T(r),status:`scheduled`});if(o.errors)throw Error(o.errors.map(e=>e.message).join(`; `));P(w),R(`Blessing scheduled for ${e} on ${g(t)}.`),document.getElementById(`schedule-requester`).value=``,document.getElementById(`schedule-time`).value=``,document.getElementById(`schedule-type`).value=``,document.getElementById(`schedule-location`).value=``}catch(e){console.error(`Failed to schedule blessing:`,e),R(`Couldn't save the blessing.`,!0)}finally{o.disabled=!1}});function T(e){let[t,n]=e.split(`:`).map(Number),r=t>=12?`PM`:`AM`;return t=t%12||12,`${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)} ${r}`}let E=document.getElementById(`decline-modal`),D=document.getElementById(`decline-target-name`),O=document.getElementById(`decline-reason`),k=null;function A(e){let t=r.find(t=>t.id===e);t&&(k=e,D.textContent=t.requesterName,O.value=``,N(E))}document.getElementById(`decline-submit`).addEventListener(`click`,async()=>{if(!k)return;let e=r.find(e=>e.id===k),t=O.value.trim();try{let r=await n.models.Blessing.update({id:k,status:`declined`,declineReason:t||void 0});if(r.errors)throw Error(r.errors.map(e=>e.message).join(`; `));P(E),R(`Request from ${e?e.requesterName:`requester`} declined.`),k=null}catch(e){console.error(`Failed to decline request:`,e),R(`Couldn't decline the request.`,!0)}});let j=document.getElementById(`details-modal`),M=document.getElementById(`details-body`);document.querySelectorAll(`[data-close-modal]`).forEach(e=>{e.addEventListener(`click`,()=>{P(w),P(E),P(j)})}),[w,E,j].forEach(e=>{e.addEventListener(`click`,t=>{t.target===e&&P(e)})}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&(P(w),P(E),P(j))});function N(e){e.classList.remove(`hidden`),document.body.style.overflow=`hidden`}function P(e){e.classList.contains(`hidden`)||(e.classList.add(`hidden`),document.body.style.overflow=``)}function F(e,n){let a,o,s,c,l=``;e===`upcoming`?(a=t.find(e=>e.id===n),o=`Scheduled`,s=`Date & Time`,a&&(c=`${g(a.date)} · ${a.time}`),a&&(l=`<div><p class="so-detail-label">Location</p><p class="so-detail-value">${h(a.location)}</p></div>`)):e===`requests`?(a=r.find(e=>e.id===n),o=`Pending Approval`,s=`Preferred Date`,a&&(c=g(a.preferredDate))):(a=i.find(e=>e.id===n),o=`Completed`,s=`Date Completed`,a&&(c=g(a.date))),a&&(M.innerHTML=`
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Requester</p><p class="so-detail-value">${h(a.requesterName)}</p></div>
        <div><p class="so-detail-label">Blessing Type</p><p class="so-detail-value">${h(a.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${o}</p></div>
        <div><p class="so-detail-label">${s}</p><p class="so-detail-value">${c}</p></div>
        ${l}
      </div>
    `,N(j))}let I=document.getElementById(`toast`),L=null;function R(e,t=!1){clearTimeout(L);let n=I.querySelector(`.toast-message`);n?n.textContent=e:I.textContent=e,I.style.backgroundColor=t?`#b91c1c`:`#1e2a4a`,I.classList.remove(`hidden`),requestAnimationFrame(()=>I.classList.add(`show`)),L=setTimeout(()=>{I.classList.remove(`show`),setTimeout(()=>I.classList.add(`hidden`),200)},3e3)}})}));r(),i();