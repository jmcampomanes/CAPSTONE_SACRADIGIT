import{n as e,nt as t,t as n}from"./amplify-init-Cg4Klxtw.js";/* empty css                  */t((()=>{e(),document.addEventListener(`DOMContentLoaded`,()=>{let e=new Date().toISOString().slice(0,10);function t(e){return e?new Date(e).toLocaleDateString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`}):`—`}let r={digitized:`badge-green`,processing:`badge-amber`,queued:`badge-gray`},i={digitized:`Digitized`,processing:`Processing`,queued:`Queued`},a=document.getElementById(`todays-schedule-list`);n.models.Mass.observeQuery({filter:{date:{eq:e}}}).subscribe({next:({items:e})=>{let t=e.slice().sort((e,t)=>e.time.localeCompare(t.time)),n=t.filter(e=>e.isSpecial).length,r=t.length-n;document.getElementById(`stat-todays-masses`).textContent=t.length,document.getElementById(`stat-todays-masses-sub`).textContent=`${r} regular · ${n} special`,a.innerHTML=t.length===0?`<li class="list-row text-sm text-gray-400">No masses today.</li>`:t.map(e=>`
            <li class="list-row">
              <span class="list-time">${e.time}</span>
              <span class="list-name">${e.title||e.type}</span>
              <a href="masses.html" class="list-action">Details ›</a>
            </li>`).join(``)},error:e=>{console.error(`Failed to load masses:`,e),a.innerHTML=`<li class="list-row text-sm text-red-500">Couldn't load schedule.</li>`}});let o=document.getElementById(`pending-requests-list`);n.models.CertificateRequest.observeQuery({filter:{status:{eq:`pending`}}}).subscribe({next:({items:e})=>{document.getElementById(`stat-pending-requests`).textContent=e.length,document.getElementById(`stat-pending-requests-sub`).textContent=`Awaiting review`;let t=e.slice(0,4);o.innerHTML=t.length===0?`<li class="list-row text-sm text-gray-400">No pending requests.</li>`:t.map(e=>`
            <li class="list-row">
              <span class="list-name flex-1">${e.requesterName} — ${e.certificateType}</span>
              <a href="record-requests.html" class="list-action">Details ›</a>
            </li>`).join(``)},error:e=>{console.error(`Failed to load requests:`,e),o.innerHTML=`<li class="list-row text-sm text-red-500">Couldn't load requests.</li>`}}),n.models.ParishRecord.observeQuery().subscribe({next:({items:e})=>{let n=e.filter(e=>e.status===`digitized`);document.getElementById(`stat-records-digitized`).textContent=n.length.toLocaleString();let a=new Date;a.setDate(a.getDate()-7);let o=n.filter(e=>e.createdAt&&new Date(e.createdAt)>=a).length;document.getElementById(`stat-records-digitized-sub`).textContent=`+${o} this week`;let s=document.getElementById(`recent-records-tbody`),c=e.slice().sort((e,t)=>new Date(t.createdAt)-new Date(e.createdAt)).slice(0,5);s.innerHTML=c.length===0?`<tr><td colspan="6" class="text-center text-gray-400 text-sm py-8">No records yet.</td></tr>`:c.map(e=>`
            <tr>
              <td class="font-medium text-gray-900">${e.fullName}</td>
              <td>${e.type}</td>
              <td>${t(e.createdAt)}</td>
              <td>${e.addedByName||`—`}</td>
              <td><span class="badge ${r[e.status]||`badge-gray`}">${i[e.status]||e.status}</span></td>
              <td class="text-right"><a href="digital-archives.html" class="list-action">View ›</a></td>
            </tr>`).join(``)},error:e=>console.error(`Failed to load records:`,e)})})}))();