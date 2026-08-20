import{n as e,nt as t,t as n}from"./amplify-init-DgBa3hMn.js";import{t as r}from"./user-shell-DOUxjjUy.js";var i=t((()=>{e(),document.addEventListener(`DOMContentLoaded`,()=>{let e=new Date().toISOString().slice(0,10),t=document.getElementById(`greeting-name`);t&&(t.textContent=`Maria`);let r=[{label:`Request Certificate`,sub:`Baptismal, Marriage, etc.`,href:`user-request-certificate.html`,iconBg:`rgba(139,143,199,0.16)`,iconColor:`#5b5fa8`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`},{label:`Submit Intention`,sub:`Mass offering & prayer`,href:`user-mass-intentions.html`,iconBg:`rgba(201,168,76,0.16)`,iconColor:`#b5943e`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`},{label:`Book a Facility`,sub:`Hall, chapel, or room`,href:`user-facility-booking.html`,iconBg:`rgba(30,42,74,0.08)`,iconColor:`#1e2a4a`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`},{label:`Make a Donation`,sub:`Support the parish`,href:`user-donations.html`,iconBg:`rgba(21,128,61,0.12)`,iconColor:`#15803d`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`}],i=document.getElementById(`quick-actions-grid`);i&&(i.innerHTML=r.map(e=>`
      <a href="${e.href}" class="quick-action-card">
        <div class="quick-action-icon" style="background-color:${e.iconBg};color:${e.iconColor};">${e.icon}</div>
        <div><p class="quick-action-label">${e.label}</p><p class="quick-action-sub">${e.sub}</p></div>
      </a>`).join(``));function a(e){return new Date(e+`T00:00:00`).toLocaleDateString(`en-US`,{weekday:`long`,month:`long`,day:`numeric`})}function o(e){return e?(e.length===10?new Date(e+`T00:00:00`):new Date(e)).toLocaleDateString(`en-US`,{month:`short`,day:`numeric`}):``}let s=document.getElementById(`todays-masses`);s&&n.models.Mass.observeQuery({filter:{date:{eq:e}}}).subscribe({next:({items:e})=>{let t=e.slice().sort((e,t)=>e.time.localeCompare(t.time));s.innerHTML=t.length===0?`<li class="text-sm text-gray-400 py-4">No masses scheduled today.</li>`:t.map(e=>`
              <li><div class="mass-row">
                <span class="mass-time">${e.time}</span>
                <div class="flex-1 min-w-0">
                  <p class="mass-type">${e.title||e.type}</p>
                  ${e.note?`<p class="mass-note">${e.note}</p>`:``}
                </div>
              </div></li>`).join(``)},error:e=>{console.error(e),s.innerHTML=`<li class="text-sm text-red-500 py-4">Couldn't load schedule.</li>`}});let c=document.getElementById(`special-masses`);c&&n.models.Mass.observeQuery({filter:{isSpecial:{eq:!0},date:{ge:e}}}).subscribe({next:({items:e})=>{let t=e.slice().sort((e,t)=>new Date(e.date)-new Date(t.date)).slice(0,4);c.innerHTML=t.length===0?`<li class="text-sm text-gray-400 py-4">No upcoming special masses.</li>`:t.map(e=>`
              <li><div class="special-mass-row">
                <div class="special-mass-icon"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></div>
                <div class="special-mass-info">
                  <p class="special-mass-name">${e.title||e.note}</p>
                  <p class="special-mass-date">${a(e.date)}</p>
                </div>
              </div></li>`).join(``)},error:e=>console.error(e)});let l=document.getElementById(`announcements-grid`);l&&n.models.Announcement.observeQuery({filter:{published:{eq:!0}}}).subscribe({next:({items:e})=>{let t=e.slice().sort((e,t)=>new Date(t.createdAt)-new Date(e.createdAt)).slice(0,3);l.innerHTML=t.map(e=>`
          <div class="user-ann-card">
            <p class="user-ann-title">${e.title}</p>
            <p class="user-ann-excerpt">${e.body}</p>
            <div class="user-ann-meta">
              <span class="user-ann-date">${o(e.createdAt)}</span>
              <span class="user-ann-audience">${e.audience||`All Parishioners`}</span>
            </div>
          </div>`).join(``)},error:e=>console.error(e)});let u={approved:`badge-green`,released:`badge-green`,pending:`badge-amber`,rejected:`badge-red`},d=document.getElementById(`my-requests-tbody`);d&&n.models.CertificateRequest.observeQuery().subscribe({next:({items:e})=>{let t=e.slice().sort((e,t)=>new Date(t.createdAt)-new Date(e.createdAt)).slice(0,5);d.innerHTML=t.length===0?`<tr><td colspan="3" class="text-center text-gray-400 text-sm py-8">No requests yet.</td></tr>`:t.map(e=>{let t=(e.status||``).toLowerCase(),n=e.status?e.status[0].toUpperCase()+e.status.slice(1):`Pending`;return`<tr>
                <td class="font-medium text-gray-900">${e.certificateType}</td>
                <td>${o(e.createdAt)}</td>
                <td><span class="badge ${u[t]||`badge-gray`}">${n}</span></td>
              </tr>`}).join(``)},error:e=>{console.error(e),d.innerHTML=`<tr><td colspan="3" class="text-center text-red-500 text-sm py-8">Couldn't load requests.</td></tr>`}})})}));r(),i();