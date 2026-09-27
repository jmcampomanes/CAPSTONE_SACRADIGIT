import{n as e}from"./modulepreload-polyfill-BlJ-Wce8.js";import{n as t,t as n}from"./amplify-init-Vxc6pzhO.js";import{a as r,u as i}from"./auth-P9e2XfKm.js";import{T as a,o,s,t as c,u as l,v as u,w as d,x as f,y as p}from"./mass-checkin-D1GTcawN.js";import{a as m,n as h}from"./public-data-D9JMNzHj.js";function g(e){if(!e)return;let t={checkIns:[],donations:[],intentions:[],blessings:[]},r={donations:!1,intentions:!1,blessings:!1,checkIns:!1},i=()=>{if(!Object.values(r).every(Boolean))return;let n=c(),i=p(t).filter(e=>n||!e.needsCheckIn||e.earned),a=i.filter(e=>e.earned),o=i.filter(e=>!e.earned&&e.progress&&e.progress.target>e.progress.current).sort((e,t)=>t.progress.current/t.progress.target-e.progress.current/e.progress.target)[0];e.innerHTML=`
      <div class="fjw-strip">
        ${a.length?a.slice(0,6).map(e=>`
            <div class="fjw-medal tier-${e.tier}" title="${b(e.name)} — ${b(e.desc)}">${u(e,`w-5 h-5`)}</div>`).join(``):`<p class="fjw-empty">No badges yet — your first one is close!</p>`}
        ${a.length>6?`<span class="fjw-more">+${a.length-6}</span>`:``}
      </div>
      <p class="fjw-caption">
        <strong>${a.length}</strong> badge${a.length===1?``:`s`} earned${o?` · Next: <strong>${b(o.name)}</strong> (${o.progress.current}/${o.progress.target} ${b(o.progress.label)})`:``}
      </p>`};n.models.Donation.observeQuery().subscribe({next:({items:e})=>{t.donations=e.filter(e=>d(e.donor)===y),r.donations=!0,i()},error:e=>console.error(`Failed to load donations:`,e)}),n.models.MassIntention.observeQuery({filter:{donor:{eq:v}}}).subscribe({next:({items:e})=>{t.intentions=e,r.intentions=!0,i()},error:e=>console.error(`Failed to load intentions:`,e)}),n.models.Blessing.observeQuery({filter:{requesterName:{eq:v}}}).subscribe({next:({items:e})=>{t.blessings=e,r.blessings=!0,i()},error:e=>console.error(`Failed to load blessings:`,e)}),(c()?s(v):Promise.resolve([])).then(e=>{t.checkIns=e}).catch(e=>console.error(`Failed to load check-ins:`,e)).finally(()=>{r.checkIns=!0,i()})}function _(e,{limit:t=12}={}){if(!e)return;let n=new Set,r=!1,i=()=>{if(!r)return;let i=o.filter(e=>!n.has(e.key)),s=i.find(e=>e.key===y);e.innerHTML=i.length?`
      <ol class="fjw-givers">
        ${i.slice(0,t).map(e=>`
          <li class="fjw-giver${e.key===y?` is-me`:``}">
            <span class="fjw-giver-name">${b(e.name)}${e.key===y?` <span class="fjw-you">You</span>`:``}</span>
            <span class="fjw-giver-streak">${b(a(e.streak))}</span>
          </li>`).join(``)}
      </ol>
      ${i.length>t?`<p class="fjw-caption">and ${i.length-t} more faithful givers — thank you!</p>`:``}
      ${s?``:`<p class="fjw-caption">Give any amount 3 months in a row to join this list.</p>`}`:`<p class="fjw-caption">No one has given 3 months in a row yet — be the first!</p>`},o=[];Promise.all([m(),l().catch(()=>new Set)]).then(([e,t])=>{o=e,n=t,r=!0,i()}).catch(e=>console.error(`Failed to load Faithful Givers:`,e))}var v,y,b,x=e((()=>{t(),h(),i(),f(),o(),v=r(),y=d(v),b=e=>{let t=document.createElement(`div`);return t.textContent=e??``,t.innerHTML}}));export{g as n,_ as r,x as t};