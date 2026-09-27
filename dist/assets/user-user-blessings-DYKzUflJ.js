import{t as e}from"./modulepreload-polyfill-BlJ-Wce8.js";import{n as t,t as n}from"./amplify-init-Vxc6pzhO.js";import{a as r,u as i}from"./auth-P9e2XfKm.js";/* empty css                   */import{t as a}from"./user-shell-axWiHYVm.js";var o=e((()=>{t(),i(),document.addEventListener(`DOMContentLoaded`,()=>{let e=r();function t(e=new Date){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}let i=t(),a=[`House Blessing`,`Business Dedication`,`Vehicle Blessing`,`Vehicle / Item Blessing`,`Other`],o=[],s=[],c=[],l=[],u=document.getElementById(`upcoming-list`),d=document.getElementById(`upcoming-empty`),f=document.getElementById(`upcoming-count`),p=document.getElementById(`requests-list`),m=document.getElementById(`requests-empty`),h=document.getElementById(`requests-count`),g=document.getElementById(`completed-list`),_=document.getElementById(`completed-empty`),v=document.getElementById(`completed-count`),y=document.getElementById(`declined-panel`),b=document.getElementById(`declined-list`),x=document.getElementById(`declined-count`);function S(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML}function C(e){return e?new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`}):`—`}function w(){return`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`}n.models.Blessing.observeQuery({filter:{requesterName:{eq:e}}}).subscribe({next:({items:e})=>{let t=e.filter(e=>a.includes(e.type));o=[],s=[],c=[],l=[],t.forEach(e=>{e.status===`scheduled`?o.push(e):e.status===`pending`?s.push(e):e.status===`completed`?c.push(e):e.status===`declined`&&l.push(e)}),T(),E(),D(),O(),k(),J&&H(),j&&!P.classList.contains(`hidden`)&&U(j)},error:e=>{console.error(`Failed to load blessings:`,e),window.showToast?.(`Couldn't load your blessings.`,!0)}});function T(){document.getElementById(`stat-scheduled`).textContent=o.length,document.getElementById(`stat-pending`).textContent=s.length,document.getElementById(`stat-completed`).textContent=c.length}function E(){let e=o.slice().sort((e,t)=>new Date(e.date)-new Date(t.date));if(f.textContent=`${e.length} scheduled`,e.length===0){u.innerHTML=``,d.classList.remove(`hidden`);return}d.classList.add(`hidden`),u.innerHTML=e.map(e=>`
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${w()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${S(e.type)}</p>
            <p class="blessing-meta">${S(e.location||`Location to be confirmed`)}</p>
          </div>
          <div>
            <div class="blessing-datetime">
              ${C(e.date)}<br/>${S(e.time||``)}
            </div>
            <button type="button" class="blessing-details-btn" data-section="upcoming" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}function D(){if(h.textContent=`${s.length} pending`,s.length===0){p.innerHTML=``,m.classList.remove(`hidden`);return}m.classList.add(`hidden`),p.innerHTML=s.map(e=>`
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${S(e.type)}</p>
            <p class="request-meta">Requested for ${C(e.preferredDate)}</p>
          </div>
          <button type="button" class="blessing-details-btn" data-section="requests" data-id="${e.id}">Details ›</button>
        </div>
      </li>
    `).join(``)}function O(){let e=c.slice().sort((e,t)=>new Date(t.date)-new Date(e.date));if(v.textContent=`${e.length} completed`,e.length===0){g.innerHTML=``,_.classList.remove(`hidden`);return}_.classList.add(`hidden`),g.innerHTML=e.map(e=>`
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${S(e.type)}</p>
            <p class="completed-meta">${S(e.location||``)}</p>
          </div>
          <div>
            <div class="completed-date">${C(e.date)}</div>
            <button type="button" class="blessing-details-btn" data-section="completed" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}function k(){if(l.length===0){y.classList.add(`hidden`),b.innerHTML=``;return}y.classList.remove(`hidden`),x.textContent=`${l.length} declined`;let e=l.slice().sort((e,t)=>new Date(t.updatedAt||t.createdAt)-new Date(e.updatedAt||e.createdAt));b.innerHTML=e.map(e=>`
      <li>
        <div class="completed-row">
          <div class="completed-icon declined">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${S(e.type)}</p>
            <p class="completed-meta">${e.declineReason?S(e.declineReason):`No reason given`}</p>
          </div>
          <div>
            <button type="button" class="blessing-details-btn" data-section="declined" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``)}[u,p,g,b].forEach(e=>{e.addEventListener(`click`,e=>{let t=e.target.closest(`.blessing-details-btn`);t&&te(t.dataset.section,t.dataset.id)})});let A=new Date(i+`T00:00:00`),j=null,M=document.getElementById(`cal-month-label`),N=document.getElementById(`calendar-grid`),P=document.getElementById(`day-plan-modal`),F=document.getElementById(`day-plan-title`),I=document.getElementById(`day-plan-list`),L=document.getElementById(`day-plan-empty`),R={scheduled:`badge-lavender`,pending:`badge-amber`,completed:`badge-green`},z={scheduled:`Scheduled`,pending:`Pending`,completed:`Completed`};function B(e,t,n){return`${e}-${String(t+1).padStart(2,`0`)}-${String(n).padStart(2,`0`)}`}function V(){return[...o.map(e=>({id:e.id,type:e.type,location:e.location,time:e.time,status:`scheduled`,calDate:e.date})),...s.map(e=>({id:e.id,type:e.type,location:e.location,time:e.time,status:`pending`,calDate:e.preferredDate})),...c.map(e=>({id:e.id,type:e.type,location:e.location,time:e.time,status:`completed`,calDate:e.date}))].filter(e=>e.calDate)}function H(){let e=A.getFullYear(),t=A.getMonth();M.textContent=A.toLocaleDateString(`en-US`,{month:`long`,year:`numeric`});let n=new Date(e,t,1).getDay(),r=new Date(e,t+1,0).getDate(),a=V(),o=``;for(let e=0;e<n;e++)o+=`<div class="calendar-cell empty"></div>`;for(let n=1;n<=r;n++){let r=B(e,t,n),s=a.filter(e=>e.calDate===r).sort((e,t)=>(e.time||``).localeCompare(t.time||``)),c=r===i,l=r===j,u=s.slice(0,2),d=s.length-u.length,f=u.map(e=>`
        <div class="calendar-cell-booking ${e.status}">
          <span class="calendar-cell-booking-time">${S(e.time||`—`)}</span>
          <span class="calendar-cell-booking-facility">${S(e.type)}</span>
        </div>
      `).join(``)+(d>0?`<div class="calendar-cell-more">+${d} more</div>`:``);o+=`
        <div class="calendar-cell ${c?`today`:``} ${l?`selected`:``}" data-date="${r}">
          <span class="calendar-date-num">${n}</span>
          <div class="calendar-cell-bookings">${f}</div>
        </div>
      `}N.innerHTML=o,N.querySelectorAll(`.calendar-cell:not(.empty)`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.date;j=t,H(),U(t)})})}function U(e){let t=V().filter(t=>t.calDate===e).sort((e,t)=>(e.time||``).localeCompare(t.time||``)),n=new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`});F.textContent=n,t.length===0?(I.innerHTML=``,I.classList.add(`hidden`),L.classList.remove(`hidden`)):(I.innerHTML=t.map(e=>`
        <div class="day-plan-item">
          <span class="day-plan-item-time">${S(e.time||`—`)}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${S(e.type)}</p>
            <p class="day-plan-item-purpose">${S(e.location||``)}</p>
          </div>
          <span class="badge ${R[e.status]||`badge-gray`}">${z[e.status]||e.status}</span>
        </div>
      `).join(``),I.classList.remove(`hidden`),L.classList.add(`hidden`)),Q(P)}document.getElementById(`cal-prev`).addEventListener(`click`,()=>{A.setMonth(A.getMonth()-1),H()}),document.getElementById(`cal-next`).addEventListener(`click`,()=>{A.setMonth(A.getMonth()+1),H()});let W=document.getElementById(`list-view-panel`),G=document.getElementById(`calendar-view-panel`),K=document.getElementById(`btn-calendar-view`),q=document.getElementById(`calendar-toggle-label`),J=!1;K.addEventListener(`click`,()=>{J=!J,K.setAttribute(`aria-pressed`,String(J)),q.textContent=J?`List View`:`Calendar View`,W.classList.toggle(`hidden`,J),G.classList.toggle(`hidden`,!J),J&&H()});let Y=document.getElementById(`details-modal`),X=document.getElementById(`details-body`),Z=document.getElementById(`details-manage-link`),ee={upcoming:{statusLabel:`Scheduled`,dateLabel:`Date & Time`,list:()=>o},requests:{statusLabel:`Pending Approval`,dateLabel:`Preferred Date`,list:()=>s},completed:{statusLabel:`Completed`,dateLabel:`Date Completed`,list:()=>c},declined:{statusLabel:`Cancelled by the parish`,dateLabel:`Date`,list:()=>l}};function te(e,t){let n=ee[e];if(!n)return;let r=n.list().find(e=>e.id===t);if(!r)return;let i;i=e===`upcoming`?`${C(r.date)}${r.time?` · ${r.time}`:``}`:C(e===`completed`?r.date:r.date||r.preferredDate);let a=r.location?`<div><p class="so-detail-label">Location</p><p class="so-detail-value">${S(r.location)}</p></div>`:``,o=e===`declined`?`<div class="col-span-2"><p class="so-detail-label">Reason</p><p class="so-detail-value">${S(r.declineReason||`No reason given`)}</p></div>`:``;X.innerHTML=`
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Blessing Type</p><p class="so-detail-value">${S(r.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${n.statusLabel}</p></div>
        <div><p class="so-detail-label">${n.dateLabel}</p><p class="so-detail-value">${i}</p></div>
        ${a}
        ${o}
      </div>
    `,Z.classList.toggle(`hidden`,e!==`requests`&&e!==`upcoming`),Q(Y)}document.querySelectorAll(`[data-close-modal]`).forEach(e=>{e.addEventListener(`click`,()=>{$(Y),$(P)})}),[Y,P].forEach(e=>{e.addEventListener(`click`,t=>{t.target===e&&$(e)})}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&($(Y),$(P))});function Q(e){e.classList.remove(`hidden`),document.body.style.overflow=`hidden`}function $(e){e.classList.contains(`hidden`)||(e.classList.add(`hidden`),document.body.style.overflow=``)}})}));a(),o();