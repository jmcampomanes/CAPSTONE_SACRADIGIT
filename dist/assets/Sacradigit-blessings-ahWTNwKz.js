import{t as e}from"./modulepreload-polyfill-BlJ-Wce8.js";/* empty css                    */import{n as t,t as n}from"./amplify-init-BILvbBLA.js";/* empty css                         *//* empty css                   */import{t as r}from"./dashboard-s6XzQn55.js";/* empty css               *//* empty css                         */import{a as i,d as a,f as o,h as s,i as c,l,m as u,n as d,p as f,s as ee,t as te,u as p}from"./service-schedule-D_2dIfmW.js";import{n as m,t as ne}from"./walk-in-service-Dm2-kaCU.js";var h=e((()=>{t(),p(),m(),document.addEventListener(`DOMContentLoaded`,()=>{let e=new Date().toISOString().slice(0,10),t=[],r=[],p=[],m=[],h=null,g=[];s(n,e=>{g=e,h&&h.refresh()});let re=document.getElementById(`upcoming-list`),ie=document.getElementById(`upcoming-empty`),ae=document.getElementById(`upcoming-count`),_=document.getElementById(`upcoming-pagination`),v=document.getElementById(`requests-list`),oe=document.getElementById(`requests-empty`),se=document.getElementById(`requests-count`),y=document.getElementById(`requests-pagination`),b=document.getElementById(`completed-list`),ce=document.getElementById(`completed-count`),x=document.getElementById(`completed-pagination`),S=document.getElementById(`search-input`),C=document.getElementById(`type-filter`),w=1,T=1,E=1;function D(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML}function O(e){return e?new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`}):`—`}function le(){return`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`}function ue(e){let t=S.value.trim().toLowerCase(),n=C.value,r=!t||(e.requesterName||``).toLowerCase().includes(t)||(e.type||``).toLowerCase().includes(t),i=!n||e.type===n;return r&&i}n.models.Blessing.observeQuery().subscribe({next:({items:e})=>{m=e,h&&h.refresh(),Y&&Y.refresh(m),t=[],r=[],p=[],e.forEach(e=>{e.status===`scheduled`?t.push(e):e.status===`pending`?r.push(e):e.status===`completed`&&p.push(e)}),de(),k(),A(),j(),B&&L(),P&&!F.classList.contains(`hidden`)&&xe(P)},error:e=>{console.error(`Failed to load blessings:`,e),$(`Couldn't load blessings from the database.`,!0)}});function de(){document.getElementById(`stat-scheduled`).textContent=t.length,document.getElementById(`stat-pending`).textContent=r.length}[{card:document.getElementById(`stat-scheduled`).closest(`.stat-card`),panelId:`upcoming-panel`},{card:document.getElementById(`stat-pending`).closest(`.stat-card`),panelId:`requests-panel`}].forEach(({card:e,panelId:t})=>{e.classList.add(`stat-card-clickable`),e.setAttribute(`role`,`button`),e.setAttribute(`tabindex`,`0`),e.addEventListener(`click`,()=>fe(t)),e.addEventListener(`keydown`,e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),fe(t))})});function fe(e){let t=document.getElementById(e);t&&(t.scrollIntoView({behavior:`smooth`,block:`start`}),t.classList.remove(`panel-flash`),t.offsetWidth,t.classList.add(`panel-flash`),setTimeout(()=>t.classList.remove(`panel-flash`),1200))}function k(){let e=t.slice().sort((e,t)=>new Date(e.date)-new Date(t.date)).filter(ue);if(ae.textContent=`${e.length} scheduled`,e.length===0){re.innerHTML=``,ie.classList.remove(`hidden`),_.innerHTML=``;return}ie.classList.add(`hidden`);let n=Math.max(1,Math.ceil(e.length/6));w>n&&(w=n);let r=(w-1)*6,i=e.slice(r,r+6);re.innerHTML=i.map(e=>`
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${le()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${D(e.requesterName)}</p>
            <p class="blessing-meta">${D(e.type)} · ${D(e.location)}</p>
          </div>
          <div>
            <div class="blessing-datetime">
              ${O(e.date)}<br/>${D(e.time)}
            </div>
            <button type="button" class="blessing-details-btn" data-section="upcoming" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``),M(_,e.length,w,n,r,i.length)}function A(){let e=r.filter(ue);if(se.textContent=`${e.length} pending`,e.length===0){v.innerHTML=``,oe.classList.remove(`hidden`),y.innerHTML=``;return}oe.classList.add(`hidden`);let t=Math.max(1,Math.ceil(e.length/6));T>t&&(T=t);let n=(T-1)*6,i=e.slice(n,n+6);v.innerHTML=i.map(e=>`
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${D(e.requesterName)}</p>
            <p class="request-meta">${D(e.type)} · requested for ${O(e.preferredDate)}${e.time?` at ${D(e.time)}`:``}</p>
          </div>
          <div class="request-actions">
            <div class="request-action-row">
              <button type="button" class="req-reschedule" data-id="${e.id}">Reschedule</button>
            </div>
            <button type="button" class="blessing-details-btn" data-section="requests" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``),M(y,e.length,T,t,n,i.length)}v.addEventListener(`click`,e=>{let t=e.target.closest(`.req-reschedule`);t&&Ve(t.dataset.id)});function j(){let e=p.slice().sort((e,t)=>new Date(t.date)-new Date(e.date)).filter(ue);if(ce.textContent=`${e.length} completed`,e.length===0){b.innerHTML=``,x.innerHTML=``;return}let t=Math.max(1,Math.ceil(e.length/6));E>t&&(E=t);let n=(E-1)*6,r=e.slice(n,n+6);b.innerHTML=r.map(e=>`
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${D(e.requesterName)}</p>
            <p class="completed-meta">${D(e.type)}</p>
          </div>
          <div>
            <div class="completed-date">${O(e.date)}</div>
            <button type="button" class="blessing-details-btn" data-section="completed" data-id="${e.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join(``),M(x,e.length,E,t,n,r.length)}function M(e,t,n,r,i,a){if(r<=1){e.innerHTML=`<span class="pagination-info">Showing ${t} of ${t}</span>`;return}let o=i+1,s=i+a,c=``;for(let e=1;e<=r;e++)c+=`<button type="button" class="pagination-btn ${e===n?`active`:``}" data-page="${e}">${e}</button>`;e.innerHTML=`
      <span class="pagination-info">Showing ${o}–${s} of ${t}</span>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn" data-action="prev" ${n===1?`disabled`:``}>‹</button>
        ${c}
        <button type="button" class="pagination-btn" data-action="next" ${n===r?`disabled`:``}>›</button>
      </div>`}_.addEventListener(`click`,e=>{let t=e.target.closest(`.pagination-btn`);t&&(t.dataset.action===`prev`?w>1&&w--:t.dataset.action===`next`?w++:t.dataset.page&&(w=parseInt(t.dataset.page,10)),k())}),y.addEventListener(`click`,e=>{let t=e.target.closest(`.pagination-btn`);t&&(t.dataset.action===`prev`?T>1&&T--:t.dataset.action===`next`?T++:t.dataset.page&&(T=parseInt(t.dataset.page,10)),A())}),x.addEventListener(`click`,e=>{let t=e.target.closest(`.pagination-btn`);t&&(t.dataset.action===`prev`?E>1&&E--:t.dataset.action===`next`?E++:t.dataset.page&&(E=parseInt(t.dataset.page,10)),j())});let N=new Date(e+`T00:00:00`),P=null,pe=document.getElementById(`cal-month-label`),me=document.getElementById(`calendar-grid`),F=document.getElementById(`day-plan-modal`),he=document.getElementById(`day-plan-title`),I=document.getElementById(`day-plan-list`),ge=document.getElementById(`day-plan-empty`),_e={scheduled:`badge-lavender`,pending:`badge-amber`,completed:`badge-green`},ve={scheduled:`Scheduled`,pending:`Pending`,completed:`Completed`};function ye(e,t,n){return`${e}-${String(t+1).padStart(2,`0`)}-${String(n).padStart(2,`0`)}`}function be(){return[...t.map(e=>({id:e.id,requesterName:e.requesterName,type:e.type,location:e.location,time:e.time,status:`scheduled`,calDate:e.date})),...r.map(e=>({id:e.id,requesterName:e.requesterName,type:e.type,location:e.location,time:e.time,status:`pending`,calDate:e.preferredDate})),...p.map(e=>({id:e.id,requesterName:e.requesterName,type:e.type,location:e.location,time:e.time,status:`completed`,calDate:e.date}))].filter(e=>e.calDate)}function L(){let t=N.getFullYear(),n=N.getMonth();pe.textContent=N.toLocaleDateString(`en-US`,{month:`long`,year:`numeric`});let r=new Date(t,n,1).getDay(),i=new Date(t,n+1,0).getDate(),a=be(),o=``;for(let e=0;e<r;e++)o+=`<div class="calendar-cell empty"></div>`;for(let r=1;r<=i;r++){let i=ye(t,n,r),s=a.filter(e=>e.calDate===i).sort((e,t)=>(e.time||``).localeCompare(t.time||``)),c=i===e,l=i===P,u=s.slice(0,2),d=s.length-u.length,f=u.map(e=>`
        <div class="calendar-cell-booking ${e.status}">
          <span class="calendar-cell-booking-time">${D(e.time||`—`)}</span>
          <span class="calendar-cell-booking-facility">${D(e.requesterName)}</span>
        </div>
      `).join(``)+(d>0?`<div class="calendar-cell-more">+${d} more</div>`:``);o+=`
        <div class="calendar-cell ${c?`today`:``} ${l?`selected`:``}" data-date="${i}">
          <span class="calendar-date-num">${r}</span>
          <div class="calendar-cell-bookings">${f}</div>
        </div>
      `}me.innerHTML=o,me.querySelectorAll(`.calendar-cell:not(.empty)`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.date;P=t,L(),xe(t)})})}function xe(e){let t=be().filter(t=>t.calDate===e).sort((e,t)=>u(e.time)-u(t.time)),n=new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`});he.textContent=n,t.length===0?(I.innerHTML=``,I.classList.add(`hidden`),ge.classList.remove(`hidden`)):(I.innerHTML=t.map(e=>`
        <div class="day-plan-item">
          <span class="day-plan-item-time">${D(e.time||`—`)}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${D(e.requesterName)}</p>
            <p class="day-plan-item-purpose">${D(e.type)}${e.location?` · ${D(e.location)}`:``}</p>
          </div>
          <span class="badge ${_e[e.status]||`badge-gray`}">${ve[e.status]||e.status}</span>
        </div>
      `).join(``),I.classList.remove(`hidden`),ge.classList.add(`hidden`)),R=e,He(F)}let R=null;function z(e){if(!e.details)return{};try{let t=typeof e.details==`string`?JSON.parse(e.details):e.details;return t&&typeof t==`object`?t:{}}catch{return{}}}function Se(e){return e&&typeof e==`object`?[e.firstName,e.middleName,e.lastName,e.extension].filter(Boolean).join(` `):String(e??``)}function Ce(e){let t=m.filter(t=>t.status===`scheduled`||t.status===`completed`?t.date===e:t.status===`pending`&&t.preferredDate===e).sort((e,t)=>u(e.time)-u(t.time)),n=new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`,year:`numeric`}),r=t.length===0?`<p class="empty">No services booked for this day.</p>`:`<table>
          <thead><tr><th>Time</th><th>Service</th><th>Requester</th><th>Location</th><th>Contact</th><th>Details</th><th>Done</th></tr></thead>
          <tbody>${t.map(e=>{let t=Object.entries(z(e)).map(([e,t])=>[e,Se(t)]).filter(([,e])=>e).map(([e,t])=>`<div><b>${D(e)}:</b> ${D(t)}</div>`).join(``);return`<tr>
              <td class="nowrap">${D(e.time||`—`)}</td>
              <td>${D(e.type)}${e.status===`pending`?` <span class="tag">Pending review</span>`:``}</td>
              <td>${D(e.requesterName)}</td>
              <td>${D(e.location||`—`)}</td>
              <td class="nowrap">${D(e.contact||`—`)}</td>
              <td class="details">${t}${e.notes?`<div><b>Notes:</b> ${D(e.notes)}</div>`:``}</td>
              <td class="check"></td>
            </tr>`}).join(``)}</tbody>
        </table>`,i=window.open(``,`_blank`);if(!i){$(`Allow pop-ups for this site to print the schedule.`,!0);return}i.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Service Schedule — ${n}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 28px; }
        h1 { font-size: 20px; margin: 0; }
        .sub { color: #6b7280; font-size: 12px; margin: 4px 0 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
        .nowrap { white-space: nowrap; }
        .details div { margin-bottom: 2px; }
        .check { width: 38px; }
        .tag { display: inline-block; font-size: 10px; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 9px; }
        .empty { color: #6b7280; }
        .foot { margin-top: 18px; font-size: 11px; color: #9ca3af; }
        @page { size: A4 landscape; margin: 14mm; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h1>Our Lady of Fatima Parish — Service Schedule</h1>
      <p class="sub">${n} · ${t.length} booking${t.length===1?``:`s`}</p>
      ${r}
      <p class="foot">Printed ${new Date().toLocaleString(`en-US`)} from SacraDigit.</p>
      <script>window.onload = () => { window.print(); };<\/script>
      </body></html>`),i.document.close()}document.getElementById(`day-plan-print`).addEventListener(`click`,()=>{R&&Ce(R)}),document.getElementById(`btn-print-today`).addEventListener(`click`,()=>{let e=new Date;Ce(`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`)}),document.getElementById(`cal-prev`).addEventListener(`click`,()=>{N.setMonth(N.getMonth()-1),L()}),document.getElementById(`cal-next`).addEventListener(`click`,()=>{N.setMonth(N.getMonth()+1),L()});let we=document.getElementById(`list-view-panel`),Te=document.getElementById(`calendar-view-panel`),Ee=document.getElementById(`btn-calendar-view`),De=document.getElementById(`calendar-toggle-label`),B=!1;Ee.addEventListener(`click`,()=>{B=!B,Ee.setAttribute(`aria-pressed`,String(B)),De.textContent=B?`List View`:`Calendar View`,we.classList.toggle(`hidden`,B),Te.classList.toggle(`hidden`,!B),B&&L()}),S.addEventListener(`input`,()=>{w=1,T=1,E=1,k(),A(),j()}),C.addEventListener(`change`,()=>{w=1,T=1,E=1,k(),A(),j()}),document.getElementById(`btn-clear-filters`)?.addEventListener(`click`,()=>{S.value=``,C.value=``,w=1,T=1,E=1,k(),A(),j()}),[re,v,b].forEach(e=>{e.addEventListener(`click`,e=>{let t=e.target.closest(`.blessing-details-btn`);t&&Ue(t.dataset.section,t.dataset.id)})}),h=ne({showToast:$,getRecords:()=>m,getClosures:()=>g,backLabel:`Back to Blessings`}),document.getElementById(`btn-add-service`).addEventListener(`click`,()=>h.open());let V=document.getElementById(`decline-modal`),Oe=document.getElementById(`decline-target-name`),ke=document.getElementById(`decline-reason`),Ae=document.getElementById(`decline-modal-title`),je=document.getElementById(`decline-verb`),Me=document.getElementById(`decline-submit`),H=null,U=!1;function Ne(e,{cancelBooking:n=!1}={}){let i=(n?t:r).find(t=>t.id===e);i&&(H=e,U=n,Ae.textContent=n?`Cancel Booking`:`Decline Blessing Request`,je.textContent=n?`Cancelling the ${i.type} booking on ${O(i.date)} at ${i.time} for`:`Declining request from`,Me.textContent=n?`Cancel Booking`:`Decline Request`,Oe.textContent=i.requesterName,ke.value=``,He(V))}Me.addEventListener(`click`,async()=>{if(!H)return;let e=[...r,...t].find(e=>e.id===H),i=ke.value.trim();try{let t=await n.models.Blessing.update({id:H,status:`declined`,declineReason:i||void 0});if(t.errors)throw Error(t.errors.map(e=>e.message).join(`; `));Z(V),o(n,{action:U?`Cancel`:`Decline`,record:e,reason:i}),$(U?`Booking for ${e?e.requesterName:`requester`} cancelled — the slot is open again.`:`Request from ${e?e.requesterName:`requester`} declined.`),H=null}catch(e){console.error(`Failed to decline request:`,e),$(`Couldn't decline the request.`,!0)}});let W=document.getElementById(`details-modal`),Pe=document.getElementById(`details-body`),Fe=document.getElementById(`details-cancel-booking`),G=null;Fe.addEventListener(`click`,()=>{G&&(Z(W),Ne(G,{cancelBooking:!0}))});let K=document.getElementById(`reschedule-screen`),q=document.getElementById(`reschedule-slot-picker`),J=document.getElementById(`reschedule-summary`),Ie=document.getElementById(`reschedule-submit`),Le=document.getElementById(`details-reschedule`),Re=null,Y=null,ze=c(document.getElementById(`reschedule-reason-wrap`));function Be(e){let t=(e,t)=>`<div><p class="svc-screen-fact-label">${e}</p><p class="svc-screen-fact-value">${t}</p></div>`,n=z(e),r=n[te],i=Object.entries(n).filter(([e])=>e!==te).map(([e,t])=>[e,Se(t)]).filter(([,e])=>e).map(([e,n])=>t(D(e===`Reschedule Reason`?`Last Rescheduled`:e),D(n)));return[t(`Requester`,D(e.requesterName)),t(`Location`,D(e.location||a(e.type))),...e.contact?[t(`Contact`,D(e.contact))]:[],...i,...r?[t(`Pinned Location`,`<a href="${D(l(r))}" target="_blank" rel="noopener" class="map-pin-link">Open in Google Maps ↗</a>`)]:[]].join(``)}function Ve(e){let t=m.find(t=>t.id===e);if(!t)return;Re=e,document.getElementById(`reschedule-title`).textContent=`Reschedule — ${t.type}`,document.getElementById(`reschedule-sub`).textContent=`For ${t.requesterName}`;let n=t.status===`scheduled`;document.getElementById(`reschedule-current-label`).textContent=n?`Currently booked`:`Requested (not yet booked)`,document.getElementById(`reschedule-current`).textContent=n?`${O(t.date)} at ${t.time}`:`${O(t.preferredDate)}${t.time?` at ${t.time}`:``}`,document.getElementById(`reschedule-facts`).innerHTML=Be(t),ze.reset(),J.classList.add(`hidden`),q.classList.remove(`has-error`),Y=i(q,{type:t.type,records:m,closures:g,excludeId:e,ignoreLead:!0,layout:`calendar`,onChange:e=>{q.classList.remove(`has-error`),J.classList.toggle(`hidden`,!e),e&&(J.textContent=`New schedule: ${O(e.date)} at ${e.time}`)}}),K.classList.remove(`hidden`,`is-closing`),document.body.classList.add(`svc-screen-open`),document.getElementById(`reschedule-body`).scrollTop=0}function X(){if(K.classList.contains(`hidden`))return;Re=null,Y=null,document.body.classList.remove(`svc-screen-open`);let e=()=>K.classList.add(`hidden`);if(window.matchMedia(`(prefers-reduced-motion: reduce)`).matches){e();return}K.classList.add(`is-closing`),K.addEventListener(`animationend`,()=>{K.classList.remove(`is-closing`),document.body.classList.contains(`svc-screen-open`)||e()},{once:!0})}document.getElementById(`reschedule-back`).addEventListener(`click`,X),document.getElementById(`reschedule-cancel`).addEventListener(`click`,X),Le.addEventListener(`click`,()=>{G&&(Z(W),Ve(G))}),Ie.addEventListener(`click`,async()=>{let e=m.find(e=>e.id===Re),t=Y&&Y.getValue(),r=ze.value();if(e){if(!r){ze.showError(),$(`Please give a reason for rescheduling.`,!0);return}if(!t){q.classList.add(`has-error`),$(`Please pick a new date and time.`,!0);return}if(e.status===`scheduled`&&t.date===e.date&&t.time===e.time){$(`That is the current schedule — pick a different slot.`,!0);return}if(!f(e.type,m,t.date,t.time,{excludeId:e.id,closures:g})){$(`That slot was just taken. Please pick another.`,!0),Y.refresh(m);return}Ie.disabled=!0;try{let i=await n.models.Blessing.update({id:e.id,status:`scheduled`,date:t.date,time:t.time,location:e.location||a(e.type),details:ee(e.details,r,`Parish Office`)});if(i.errors)throw Error(i.errors.map(e=>e.message).join(`; `));let s=e.status===`scheduled`?`${O(e.date)} ${e.time}`:`pending request`;o(n,{action:`Reschedule`,record:{...e,date:t.date,time:t.time},reason:`${r} (from ${s})`}),X(),$(`${e.type} for ${e.requesterName} moved to ${O(t.date)} at ${t.time}.`)}catch(e){console.error(`Failed to reschedule blessing:`,e),$(e.message||`Couldn't reschedule the blessing.`,!0)}finally{Ie.disabled=!1}}}),document.querySelectorAll(`[data-close-modal]`).forEach(e=>{e.addEventListener(`click`,()=>{Z(V),Z(W),Z(F)})}),[V,W,F].forEach(e=>{e.addEventListener(`click`,t=>{t.target===e&&Z(e)})}),document.addEventListener(`keydown`,e=>{if(e.key!==`Escape`)return;let t=[V,W,F].filter(e=>!e.classList.contains(`hidden`));t.length?t.forEach(Z):X()});function He(e){e.classList.remove(`hidden`),document.body.style.overflow=`hidden`}function Z(e){e.classList.contains(`hidden`)||(e.classList.add(`hidden`),document.body.style.overflow=``)}function Ue(n,i){let a,o,s,c,u=``;if(n===`upcoming`?(a=t.find(e=>e.id===i),o=`Scheduled`,s=`Date & Time`,a&&(c=`${O(a.date)} · ${a.time}`),a&&(u=`<div><p class="so-detail-label">Location</p><p class="so-detail-value">${D(a.location)}</p></div>`)):n===`requests`?(a=r.find(e=>e.id===i),o=`Pending Approval`,s=`Preferred Date & Time`,a&&(c=`${O(a.preferredDate)}${a.time?` · ${a.time}`:` · No preferred time given`}`)):(a=p.find(e=>e.id===i),o=`Completed`,s=`Date Completed`,a&&(c=O(a.date))),!a)return;let f=z(a)[te];f&&(u+=`<div><p class="so-detail-label">Pinned Location</p><p class="so-detail-value"><a href="${D(l(f))}" target="_blank" rel="noopener" class="map-pin-link">Open in Google Maps ↗</a></p></div>`);let ee=z(a)[d];ee&&(u+=`<div style="grid-column: 1 / -1;"><p class="so-detail-label">Rescheduled</p><p class="so-detail-value">${D(ee)}</p></div>`),G=i,Fe.classList.toggle(`hidden`,!(n===`upcoming`&&(a.date||``)>=e)),Le.classList.toggle(`hidden`,!(n===`requests`||n===`upcoming`&&(a.date||``)>=e)),Pe.innerHTML=`
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Requester</p><p class="so-detail-value">${D(a.requesterName)}</p></div>
        <div><p class="so-detail-label">Blessing Type</p><p class="so-detail-value">${D(a.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${o}</p></div>
        <div><p class="so-detail-label">${s}</p><p class="so-detail-value">${c}</p></div>
        ${u}
      </div>
    `,He(W)}let Q=document.getElementById(`toast`),We=null;function $(e,t=!1){clearTimeout(We);let n=Q.querySelector(`.toast-message`);n?n.textContent=e:Q.textContent=e,Q.style.backgroundColor=t?`#b91c1c`:`#1e2a4a`,Q.classList.remove(`hidden`),requestAnimationFrame(()=>Q.classList.add(`show`)),We=setTimeout(()=>{Q.classList.remove(`show`),setTimeout(()=>Q.classList.add(`hidden`),200)},3e3)}})}));r(),h();