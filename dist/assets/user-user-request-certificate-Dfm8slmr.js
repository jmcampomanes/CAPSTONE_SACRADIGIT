import{n as e,t}from"./modulepreload-polyfill-BlJ-Wce8.js";import{n,t as r}from"./amplify-init-BILvbBLA.js";import{a as i,u as a}from"./auth-gatWNEhY.js";/* empty css                   */import{a as o,i as s,n as c,o as l,r as u,s as d,t as f}from"./name-utils-B7bUvTns.js";import{t as p}from"./user-shell-DQTrXH8F.js";function ee(e=``){return`<option value="">Select region…</option>`+h.map(t=>`<option value="${t.name}" ${t.name===e?`selected`:``}>${t.name}</option>`).join(``)}function m(e,t=``){let n=h.find(t=>t.name===e),r=(n?n.cities:[]).map(e=>`<option value="${e}" ${e===t?`selected`:``}>${e}</option>`).join(``),i=t===`__other__`?`selected`:``;return`<option value="">${n?`Select city/municipality…`:`Select a region first`}</option>`+r+(n?`<option value="${g}" ${i}>Other (not listed)</option>`:``)}var h,g,_=e((()=>{h=[{name:`National Capital Region (NCR)`,cities:[`City of Manila`,`Quezon City`,`Caloocan City`,`Las Piñas City`,`Makati City`,`Malabon City`,`Mandaluyong City`,`Marikina City`,`Muntinlupa City`,`Navotas City`,`Parañaque City`,`Pasay City`,`Pasig City`,`City of San Juan`,`Taguig City`,`Valenzuela City`,`Pateros`]},{name:`Cordillera Administrative Region (CAR)`,cities:[`Baguio City`,`Tabuk City`,`La Trinidad`,`Bontoc`,`Lagawe`,`Bangued`,`Sagada`]},{name:`Region I – Ilocos Region`,cities:[`Laoag City`,`Vigan City`,`San Fernando City (La Union)`,`Dagupan City`,`Alaminos City`,`Candon City`,`Batac City`]},{name:`Region II – Cagayan Valley`,cities:[`Tuguegarao City`,`Ilagan City`,`Cauayan City`,`Santiago City`,`Bayombong`,`Basco`]},{name:`Region III – Central Luzon`,cities:[`San Fernando City (Pampanga)`,`Angeles City`,`Olongapo City`,`Tarlac City`,`Cabanatuan City`,`San Jose City`,`Palayan City`,`Balanga City`,`Malolos City`,`Meycauayan City`,`San Jose del Monte City`]},{name:`Region IV-A – CALABARZON`,cities:[`Calamba City`,`Antipolo City`,`Lucena City`,`Batangas City`,`Lipa City`,`Tanauan City`,`San Pablo City`,`Santa Rosa City`,`Biñan City`,`Cavite City`,`Dasmariñas City`,`Bacoor City`,`Imus City`,`Tagaytay City`,`Trece Martires City`]},{name:`MIMAROPA Region (Region IV-B)`,cities:[`Calapan City`,`Puerto Princesa City`,`Odiongan`,`Boac`,`San Jose (Occidental Mindoro)`,`Mamburao`]},{name:`Region V – Bicol Region`,cities:[`Legazpi City`,`Naga City`,`Iriga City`,`Sorsogon City`,`Masbate City`,`Tabaco City`,`Ligao City`,`Daet`]},{name:`Region VI – Western Visayas`,cities:[`Iloilo City`,`Bacolod City`,`Roxas City`,`Kalibo`,`San Jose de Buenavista`,`Passi City`,`Silay City`,`Talisay City (Negros Occidental)`]},{name:`Region VII – Central Visayas`,cities:[`Cebu City`,`Mandaue City`,`Lapu-Lapu City`,`Tagbilaran City`,`Dumaguete City`,`Talisay City (Cebu)`,`Toledo City`,`Bogo City`]},{name:`Region VIII – Eastern Visayas`,cities:[`Tacloban City`,`Ormoc City`,`Catbalogan City`,`Calbayog City`,`Maasin City`,`Borongan City`,`Baybay City`]},{name:`Region IX – Zamboanga Peninsula`,cities:[`Zamboanga City`,`Pagadian City`,`Dipolog City`,`Dapitan City`,`Isabela City`]},{name:`Region X – Northern Mindanao`,cities:[`Cagayan de Oro City`,`Iligan City`,`Malaybalay City`,`Valencia City`,`Ozamiz City`,`Oroquieta City`,`Tangub City`,`Gingoog City`]},{name:`Region XI – Davao Region`,cities:[`Davao City`,`Tagum City`,`Panabo City`,`Digos City`,`Mati City`,`Island Garden City of Samal`]},{name:`Region XII – SOCCSKSARGEN`,cities:[`General Santos City`,`Koronadal City`,`Kidapawan City`,`Tacurong City`,`Cotabato City`]},{name:`Region XIII – Caraga`,cities:[`Butuan City`,`Surigao City`,`Bislig City`,`Tandag City`,`Bayugan City`,`Cabadbaran City`]},{name:`Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)`,cities:[`Marawi City`,`Lamitan City`,`Jolo`,`Bongao`,`Buluan`]}],g=`__other__`}));function v(e=``){return[`<option value="">Select a confirmation name…</option>`].concat(y.map(t=>`<option value="${t}"${t===e?` selected`:``}>${t}</option>`),[`<option value="${b}"${e===`__other__`?` selected`:``}>Other (not listed)</option>`]).join(``)}var y,b,x=e((()=>{y=`Agatha.Agnes.Aloysius.Ambrose.Andrew.Angela.Anne.Anthony.Augustine.Barbara.Bartholomew.Benedict.Bernadette.Bernard.Blaise.Bonaventure.Bridget.Camillus.Catherine.Cecilia.Charles.Christopher.Clare.Clement.Cornelius.Cyril.Damian.David.Dominic.Dorothy.Edith.Edmund.Edward.Elizabeth.Faustina.Felicity.Francis.Francis Xavier.Gabriel.Genevieve.George.Gerard.Gertrude.Gregory.Helena.Henry.Hilary.Hildegard.Ignatius.Irene.Isaac.Isidore.James.Jerome.Joachim.Joan of Arc.John.John Paul.Joseph.Jude.Julia.Justin.Kateri.Kevin.Lawrence.Leo.Louis.Lucy.Luke.Margaret.Maria Goretti.Mark.Martha.Martin.Mary.Matthew.Maximilian Kolbe.Michael.Monica.Nicholas.Padre Pio.Patrick.Paul.Peter.Philip.Pius.Raphael.Raymond.Rita.Rose of Lima.Sebastian.Simon.Stephen.Teresa of Avila.Therese of Lisieux.Thomas.Thomas Aquinas.Timothy.Ursula.Valentine.Veronica.Vincent de Paul.Zita`.split(`.`),b=`__other__`})),S=t((()=>{n(),a(),c(),_(),x(),document.addEventListener(`DOMContentLoaded`,()=>{let e=i(),t=[`Mother`,`Father`,`Grandfather`,`Grandmother`,`Aunt`,`Uncle`,`Cousin`,`Older Brother`,`Older Sister`,`Godmother`,`Godfather`,`Other`],n=new Date().toISOString().slice(0,10),a=`1900-01-01`;function c(e){if(!e)return!0;if(!/^\d{4}-\d{2}-\d{2}$/.test(e))return!1;let t=Number(e.slice(0,4));return t>=1900&&t<=new Date().getFullYear()}function p(e){e.addEventListener(`blur`,()=>{e.value&&!c(e.value)&&(e.value=``,window.showToast(`Please enter a valid, real date (year between 1900 and this year).`,!0))})}let h=[{id:`baptismal`,name:`Baptismal Certificate`,desc:`Proof of baptism recorded at the parish.`,iconBg:`rgba(139,143,199,0.16)`,iconColor:`#5b5fa8`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,baptismalCustom:!0,fields:[{id:`baptized-name`,label:`Full Name of Baptized Person`,kind:`name`,required:!0},{id:`birth-date`,label:`Date of Birth`,type:`date`,required:!0},{id:`birthplace`,label:`Place of Birth`,required:!0},{id:`baptism-date`,label:`Date of Baptism`,type:`date`,required:!0},{id:`father-name`,label:`Father's Full Name`,kind:`name`,required:!0},{id:`mother-name`,label:`Mother's Maiden Name`,kind:`name`,required:!0},{id:`sponsor-1`,label:`Principal Sponsor (Godparent) 1`,kind:`name`,required:!1},{id:`sponsor-2`,label:`Principal Sponsor (Godparent) 2`,kind:`name`,required:!1}]},{id:`confirmation`,name:`Confirmation Certificate`,desc:`Proof of confirmation sacrament.`,iconBg:`rgba(201,168,76,0.16)`,iconColor:`#b5943e`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,confirmationCustom:!0,fields:[{id:`confirmed-name`,label:`Full Name of Confirmand`,kind:`name`,required:!0},{id:`baptism-date`,label:`Date of Baptism`,type:`date`,required:!1},{id:`confirmation-name`,label:`Confirmation Name (Saint Name)`,required:!0},{id:`confirmation-date`,label:`Approximate Date of Confirmation`,type:`date`,required:!1},{id:`father-name`,label:`Father's Full Name`,kind:`name`,required:!0},{id:`mother-name`,label:`Mother's Full Maiden Name`,kind:`name`,required:!0},{id:`sponsor-name`,label:`Sponsor's Name`,kind:`name`,required:!1}]},{id:`first-communion`,name:`First Communion Certificate`,desc:`Proof of First Holy Communion.`,iconBg:`rgba(180,140,60,0.16)`,iconColor:`#8a6d1f`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 3h12l-1 8.5a5 5 0 01-10 0L6 3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 16.5V21m-3.5 0h7"/></svg>`,fields:[{id:`fc-name`,label:`Full Name of Communicant`,kind:`name`,required:!0},{id:`fc-communion-date`,label:`Approximate Date of First Communion`,type:`date`,required:!1}]},{id:`marriage`,name:`Marriage Certificate`,desc:`Parish record of a Catholic marriage.`,iconBg:`rgba(239,68,68,0.1)`,iconColor:`#dc2626`,icon:`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,marriageCustom:!0,fields:[{id:`groom-name`,label:`Groom's Full Name`,kind:`name`,required:!0},{id:`groom-father`,label:`Groom's Father's Name`,kind:`name`,required:!0},{id:`groom-mother`,label:`Groom's Mother's Maiden Name`,kind:`name`,required:!0},{id:`bride-name`,label:`Bride's Full Name`,kind:`name`,required:!0},{id:`bride-father`,label:`Bride's Father's Name`,kind:`name`,required:!0},{id:`bride-mother`,label:`Bride's Mother's Maiden Name`,kind:`name`,required:!0},{id:`marriage-date`,label:`Date of Marriage`,type:`date`,required:!1},{id:`marriage-place`,label:`Place of Marriage`,placeholder:`e.g. Our Lady of Fatima Parish`,required:!1},{id:`witness-1`,label:`Witness 1`,kind:`name`,required:!0},{id:`witness-2`,label:`Witness 2`,kind:`name`,required:!0}]}],_=null,y=2,x=document.getElementById(`menu-view`),S=document.getElementById(`form-view`),C=document.getElementById(`cert-type-grid`),w=document.getElementById(`request-form-wrap`),T=document.getElementById(`form-type-label`),E=document.getElementById(`dynamic-fields`),D=document.getElementById(`success-banner`),O=document.getElementById(`success-desc`),k=document.getElementById(`confirm-modal`),te=document.getElementById(`confirm-details-grid`),A=null;function j(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML}function M(e){if(!e)return``;let t=new Date(`${e}T00:00:00`);return isNaN(t.getTime())?e:t.toLocaleDateString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`})}function N(e){return!!e&&typeof e==`object`&&!Array.isArray(e)&&(`firstName`in e||`middleName`in e||`lastName`in e||`extension`in e)}function P(e,t){if(N(t))return u(t)?null:f(t);if(e.endsWith(`guardian`)&&t&&typeof t==`object`){let e=f(t.name);if(!e)return null;let n=t.birthdate?M(t.birthdate):``;return`${e} (${t.relationship||`Guardian`})${n?` — b. ${n}`:``}`}if(Array.isArray(t)){let e=t.map(e=>{let t=f(e&&e.name);return t?`${t}${e.role?` (${e.role})`:``}`:null}).filter(Boolean);return e.length?e.join(`, `):null}return t==null||t===``?null:String(t)}let F=[{key:`baptized-name`,label:`Full Name of Baptized Person`},{key:`birth-date`,label:`Date of Birth`,isDate:!0},{key:`birth-region`,label:`Region of Birth`},{key:`birth-city`,label:`City/Municipality of Birth`},{key:`baptism-date`,label:`Date of Baptism`,isDate:!0},{key:`guardian`,label:`Guardian`},{key:`father-name`,label:`Father's Name`},{key:`mother-name`,label:`Mother's Name`},{key:`sponsor-1`,label:`Sponsor 1`},{key:`sponsor-2`,label:`Sponsor 2`},{key:`extraGodparents`,label:`Additional Godparents`}],I=[{key:`confirmed-name`,label:`Full Name of Confirmand`},{key:`baptism-date`,label:`Date of Baptism`,isDate:!0},{key:`confirmation-name`,label:`Confirmation Name (Saint Name)`},{key:`confirmation-date`,label:`Approximate Date of Confirmation`,isDate:!0},{key:`guardian`,label:`Guardian`},{key:`father-name`,label:`Father's Name`},{key:`mother-name`,label:`Mother's Name`},{key:`sponsor-name`,label:`Sponsor's Name`}],L=[{key:`groom-name`,label:`Groom's Full Name`},{key:`groom-guardian`,label:`Groom's Guardian`},{key:`groom-father`,label:`Groom's Father's Name`},{key:`groom-mother`,label:`Groom's Mother's Maiden Name`},{key:`bride-name`,label:`Bride's Full Name`},{key:`bride-guardian`,label:`Bride's Guardian`},{key:`bride-father`,label:`Bride's Father's Name`},{key:`bride-mother`,label:`Bride's Mother's Maiden Name`},{key:`marriage-date`,label:`Date of Marriage`,isDate:!0},{key:`marriage-place`,label:`Place of Marriage`},{key:`witness-1`,label:`Witness 1`},{key:`witness-2`,label:`Witness 2`}];function R(e,t,n){let r=[];return(_.baptismalCustom?F:_.confirmationCustom?I:_.marriageCustom?L:_.fields.map(e=>({key:e.id,label:e.label,isDate:e.type===`date`}))).forEach(({key:t,label:n,isDate:i})=>{let a=e[t],o=i?a?M(a):null:P(t,a);o&&r.push([n,o])}),r.push([`Purpose of Request`,t]),n&&r.push([`Additional Notes`,n]),`<tbody>${r.map(([e,t])=>`
      <tr><th>${j(e)}</th><td>${j(t)}</td></tr>`).join(``)}</tbody>`}function z(){te.innerHTML=R(A.details,A.purpose,A.notes),k.classList.remove(`hidden`)}function B(){k.classList.add(`hidden`)}document.querySelectorAll(`[data-close-confirm-modal]`).forEach(e=>e.addEventListener(`click`,B)),document.getElementById(`btn-back-to-edit`).addEventListener(`click`,B),k.addEventListener(`click`,e=>{e.target===k&&B()}),C.innerHTML=h.map(e=>`
    <button type="button" class="cert-type-card" data-id="${e.id}">
      <div class="cert-icon" style="background-color:${e.iconBg};color:${e.iconColor};">${e.icon}</div>
      <p class="cert-type-name">${e.name}</p>
      <p class="cert-type-desc">${e.desc}</p>
      <span class="cert-type-cta">Start request
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
      </span>
    </button>`).join(``),C.addEventListener(`click`,e=>{let t=e.target.closest(`.cert-type-card`);t&&V(t.dataset.id)});function V(e){_=h.find(t=>t.id===e),_&&(document.querySelectorAll(`.cert-type-card`).forEach(t=>t.classList.toggle(`selected`,t.dataset.id===e)),T.textContent=_.name,_.baptismalCustom?(y=2,E.innerHTML=U(),G()):_.confirmationCustom?(E.innerHTML=q(),J()):_.marriageCustom?(E.innerHTML=re(),ie()):(E.innerHTML=_.fields.map(e=>e.kind===`name`?o(e.id,e.label,{required:e.required,spanFull:!0}):`
        <div>
          <label class="form-label" for="${e.id}">${e.label}${e.required?` <span class="text-red-500">*</span>`:``}</label>
          ${e.type===`date`?`<input type="date" id="${e.id}" class="form-input" min="${a}" max="${n}" />`:`<input type="text" id="${e.id}" class="form-input" placeholder="${e.placeholder||``}" />`}
        </div>`).join(``),_.fields.filter(e=>e.type===`date`).forEach(e=>p(document.getElementById(e.id)))),x.classList.add(`hidden`),S.classList.remove(`hidden`),w.classList.remove(`hidden`),D.classList.add(`hidden`),window.scrollTo({top:0,behavior:`smooth`}))}function H(){_=null,A=null,k.classList.add(`hidden`),S.classList.add(`hidden`),x.classList.remove(`hidden`),D.classList.add(`hidden`),w.classList.remove(`hidden`),document.querySelectorAll(`.cert-type-card`).forEach(e=>e.classList.remove(`selected`)),document.querySelectorAll(`#request-form-wrap input, #request-form-wrap textarea`).forEach(e=>{e.type===`checkbox`?e.checked=!1:e.value=``}),window.scrollTo({top:0,behavior:`smooth`})}function U(){return`
      ${o(`baptized-name`,`Full Name of Baptized Person`,{required:!0,spanFull:!0})}

      <div>
        <label class="form-label" for="birth-date">Date of Birth <span class="text-red-500">*</span></label>
        <input type="date" id="birth-date" class="form-input" min="${a}" max="${n}" />
      </div>

      <div class="sm:col-span-2">
        <label class="form-label">Place of Birth <span class="text-red-500">*</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <select id="birth-region" class="form-input">${ee()}</select>
          <select id="birth-city" class="form-input" disabled>${m(``)}</select>
        </div>
        <input type="text" id="birth-city-other" class="form-input mt-2 hidden" placeholder="Enter city/municipality" />
      </div>

      <div>
        <label class="form-label" for="baptism-date">Date of Baptism <span class="text-red-500">*</span></label>
        <input type="date" id="baptism-date" class="form-input" min="${a}" max="${n}" />
      </div>

      <div class="sm:col-span-2">
        <label class="field-na-label" style="font-size:0.8125rem;color:#374151;">
          <input type="checkbox" id="guardian-toggle" class="checkbox-input" />
          This child is being presented by a guardian (not the parents)
        </label>
      </div>

      <div class="form-subblock hidden" id="guardian-fields">
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-relationship">Guardian's Relationship to the Child <span class="text-red-500">*</span></label>
          <select id="guardian-relationship" class="form-input">
            <option value="">Select relationship…</option>
            ${t.map(e=>`<option value="${e}">${e}</option>`).join(``)}
          </select>
        </div>
        <div class="sm:col-span-2 hidden" id="guardian-relationship-other-wrap">
          <label class="form-label" for="guardian-relationship-other">Specify Relationship <span class="text-red-500">*</span></label>
          <input type="text" id="guardian-relationship-other" class="form-input" placeholder="e.g. Family friend" />
        </div>
        ${o(`guardian-name`,`Guardian's Full Name`,{required:!0,spanFull:!0})}
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-birthdate">Guardian's Birthday <span class="text-red-500">*</span></label>
          <input type="date" id="guardian-birthdate" class="form-input" min="${a}" max="${n}" />
          <p class="text-xs text-gray-400 mt-1">The guardian must be older than the person being baptized.</p>
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Father's Full Name <span class="text-red-500 father-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="father-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="father-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="father-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="father-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="father-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Mother's Full Maiden Name <span class="text-red-500 mother-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="mother-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="mother-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="mother-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="mother-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="mother-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      ${o(`sponsor-1`,`Principal Sponsor (Godparent) 1`,{required:!1,spanFull:!0})}
      ${o(`sponsor-2`,`Principal Sponsor (Godparent) 2`,{required:!1,spanFull:!0})}

      <div class="sm:col-span-2" id="godparents-extra-container"></div>
      <button type="button" id="btn-add-godparent" class="btn-add-row">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add More Godparents
      </button>
    `}function W(e){return`
      <div class="repeatable-row" data-godparent-row data-n="${e}">
        <button type="button" class="repeatable-row-remove" aria-label="Remove this godparent">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        ${o(`godparent-extra-${e}`,`Godparent ${e+1}`,{required:!0,spanFull:!0})}
        <div>
          <label class="form-label" for="godparent-extra-${e}-role">Role <span class="text-red-500">*</span></label>
          <select id="godparent-extra-${e}-role" class="form-input">
            <option value="">Select…</option>
            <option value="Godmother">Godmother</option>
            <option value="Godfather">Godfather</option>
          </select>
        </div>
      </div>`}function G(){[document.getElementById(`birth-date`),document.getElementById(`baptism-date`),document.getElementById(`guardian-birthdate`)].forEach(p);let e=document.getElementById(`birth-region`),t=document.getElementById(`birth-city`),n=document.getElementById(`birth-city-other`);e.addEventListener(`change`,()=>{t.innerHTML=m(e.value),t.disabled=!e.value,n.classList.add(`hidden`),n.value=``}),t.addEventListener(`change`,()=>{n.classList.toggle(`hidden`,t.value!==g),t.value!==`__other__`&&(n.value=``)});let r=document.getElementById(`guardian-toggle`),i=document.getElementById(`guardian-fields`);r.addEventListener(`change`,()=>{i.classList.toggle(`hidden`,!r.checked),r.checked||(document.getElementById(`guardian-relationship`).value=``,document.getElementById(`guardian-relationship-other-wrap`).classList.add(`hidden`),document.getElementById(`guardian-relationship-other`).value=``,d(`guardian-name`,null),document.getElementById(`guardian-birthdate`).value=``),a()});function a(){let e=r.checked;[{prefix:`father-name`,naId:`father-name-na`,markClass:`father-name-required-mark`},{prefix:`mother-name`,naId:`mother-name-na`,markClass:`mother-name-required-mark`}].forEach(({prefix:t,naId:n,markClass:r})=>{let i=document.getElementById(n),a=[`${t}-first`,`${t}-middle`,`${t}-last`,`${t}-ext`].map(e=>document.getElementById(e)),o=document.querySelector(`.${r}`),s=e||i.checked;a.forEach(e=>{e.disabled=s}),i.disabled=e,o&&o.classList.toggle(`hidden`,s)})}let o=document.getElementById(`guardian-relationship`),s=document.getElementById(`guardian-relationship-other-wrap`);o.addEventListener(`change`,()=>{s.classList.toggle(`hidden`,o.value!==`Other`),o.value!==`Other`&&(document.getElementById(`guardian-relationship-other`).value=``)});function c(e,t){let n=document.getElementById(e),r=[`${t}-first`,`${t}-middle`,`${t}-last`,`${t}-ext`].map(e=>document.getElementById(e));n.addEventListener(`change`,()=>{n.checked&&r.forEach(e=>{e.value=``}),a()})}c(`father-name-na`,`father-name`),c(`mother-name-na`,`mother-name`),a();let l=document.getElementById(`godparents-extra-container`);document.getElementById(`btn-add-godparent`).addEventListener(`click`,()=>{y+=1,l.insertAdjacentHTML(`beforeend`,W(y))}),l.addEventListener(`click`,e=>{let t=e.target.closest(`.repeatable-row-remove`);t&&t.closest(`[data-godparent-row]`)?.remove()})}function K(e){let t=!0,n={};n[`baptized-name`]=l(`baptized-name`),s(`baptized-name`)||(t=!1,e(document.getElementById(`baptized-name-first`)),e(document.getElementById(`baptized-name-last`)));let r=document.getElementById(`birth-date`);n[`birth-date`]=r.value,r.value&&c(r.value)||(t=!1,e(r));let i=document.getElementById(`birth-region`),a=document.getElementById(`birth-city`),o=document.getElementById(`birth-city-other`),u=a.value===`__other__`?o.value.trim():a.value;i.value||(t=!1,e(i)),u||(t=!1,e(a.value===`__other__`?o:a)),n[`birth-region`]=i.value,n[`birth-city`]=u,n.birthplace=[u,i.value].filter(Boolean).join(`, `);let d=document.getElementById(`baptism-date`);n[`baptism-date`]=d.value,d.value&&c(d.value)||(t=!1,e(d));let f=document.getElementById(`guardian-toggle`);if(f.checked){let i=document.getElementById(`guardian-relationship`),a=document.getElementById(`guardian-relationship-other`),o=document.getElementById(`guardian-birthdate`),u=i.value;u||(t=!1,e(i)),u===`Other`&&(a.value.trim()||(t=!1,e(a)),u=a.value.trim()||`Other`);let d=l(`guardian-name`);s(`guardian-name`)||(t=!1,e(document.getElementById(`guardian-name-first`)),e(document.getElementById(`guardian-name-last`))),o.value&&c(o.value)?r.value&&o.value>=r.value&&(t=!1,e(o),window.showToast(`The guardian must be older than the person being baptized.`,!0)):(t=!1,e(o)),n.guardian={relationship:u,name:d,birthdate:o.value}}else n.guardian=null;f.checked||document.getElementById(`father-name-na`).checked?n[`father-name`]=null:(n[`father-name`]=l(`father-name`),s(`father-name`)||(t=!1,e(document.getElementById(`father-name-first`)),e(document.getElementById(`father-name-last`)))),f.checked||document.getElementById(`mother-name-na`).checked?n[`mother-name`]=null:(n[`mother-name`]=l(`mother-name`),s(`mother-name`)||(t=!1,e(document.getElementById(`mother-name-first`)),e(document.getElementById(`mother-name-last`)))),n[`sponsor-1`]=l(`sponsor-1`),n[`sponsor-2`]=l(`sponsor-2`);let p=[];return document.querySelectorAll(`#godparents-extra-container [data-godparent-row]`).forEach(n=>{let r=`godparent-extra-${n.dataset.n}`,i=document.getElementById(`${r}-role`),a=l(r);s(r)||(t=!1,e(document.getElementById(`${r}-first`)),e(document.getElementById(`${r}-last`))),i.value||(t=!1,e(i)),p.push({name:a,role:i.value})}),n.extraGodparents=p,{allFilled:t,details:n}}function q(){return`
      ${o(`confirmed-name`,`Full Name of Confirmand`,{required:!0,spanFull:!0})}

      <div>
        <label class="form-label" for="baptism-date">Date of Baptism</label>
        <input type="date" id="baptism-date" class="form-input" min="${a}" max="${n}" />
      </div>

      <div>
        <label class="form-label" for="confirmation-name">Confirmation Name (Saint Name) <span class="text-red-500">*</span></label>
        <select id="confirmation-name" class="form-input">${v()}</select>
        <input type="text" id="confirmation-name-other" class="form-input mt-2 hidden" placeholder="Enter confirmation name" />
      </div>

      <div class="sm:col-span-2">
        <label class="form-label" for="confirmation-date">Approximate Date of Confirmation</label>
        <input type="date" id="confirmation-date" class="form-input" min="${a}" max="${n}" />
      </div>

      <div class="sm:col-span-2">
        <label class="field-na-label" style="font-size:0.8125rem;color:#374151;">
          <input type="checkbox" id="guardian-toggle" class="checkbox-input" />
          This person is being presented by a guardian (not the parents)
        </label>
      </div>

      <div class="form-subblock hidden" id="guardian-fields">
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-relationship">Guardian's Relationship to the Confirmand <span class="text-red-500">*</span></label>
          <select id="guardian-relationship" class="form-input">
            <option value="">Select relationship…</option>
            ${t.map(e=>`<option value="${e}">${e}</option>`).join(``)}
          </select>
        </div>
        <div class="sm:col-span-2 hidden" id="guardian-relationship-other-wrap">
          <label class="form-label" for="guardian-relationship-other">Specify Relationship <span class="text-red-500">*</span></label>
          <input type="text" id="guardian-relationship-other" class="form-input" placeholder="e.g. Family friend" />
        </div>
        ${o(`guardian-name`,`Guardian's Full Name`,{required:!0,spanFull:!0})}
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-birthdate">Guardian's Birthday <span class="text-red-500">*</span></label>
          <input type="date" id="guardian-birthdate" class="form-input" min="${a}" max="${n}" />
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Father's Full Name <span class="text-red-500 father-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="father-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="father-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="father-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="father-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="father-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Mother's Full Maiden Name <span class="text-red-500 mother-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="mother-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="mother-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="mother-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="mother-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="mother-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      ${o(`sponsor-name`,`Sponsor's Name`,{required:!1,spanFull:!0})}
    `}function J(){[document.getElementById(`baptism-date`),document.getElementById(`confirmation-date`),document.getElementById(`guardian-birthdate`)].forEach(p);let e=document.getElementById(`confirmation-name`),t=document.getElementById(`confirmation-name-other`);e.addEventListener(`change`,()=>{t.classList.toggle(`hidden`,e.value!==b),e.value!==`__other__`&&(t.value=``)});let n=document.getElementById(`guardian-toggle`),r=document.getElementById(`guardian-fields`);n.addEventListener(`change`,()=>{r.classList.toggle(`hidden`,!n.checked),n.checked||(document.getElementById(`guardian-relationship`).value=``,document.getElementById(`guardian-relationship-other-wrap`).classList.add(`hidden`),document.getElementById(`guardian-relationship-other`).value=``,d(`guardian-name`,null),document.getElementById(`guardian-birthdate`).value=``),i()});function i(){let e=n.checked;[{prefix:`father-name`,naId:`father-name-na`,markClass:`father-name-required-mark`},{prefix:`mother-name`,naId:`mother-name-na`,markClass:`mother-name-required-mark`}].forEach(({prefix:t,naId:n,markClass:r})=>{let i=document.getElementById(n),a=[`${t}-first`,`${t}-middle`,`${t}-last`,`${t}-ext`].map(e=>document.getElementById(e)),o=document.querySelector(`.${r}`),s=e||i.checked;a.forEach(e=>{e.disabled=s}),i.disabled=e,o&&o.classList.toggle(`hidden`,s)})}let a=document.getElementById(`guardian-relationship`),o=document.getElementById(`guardian-relationship-other-wrap`);a.addEventListener(`change`,()=>{o.classList.toggle(`hidden`,a.value!==`Other`),a.value!==`Other`&&(document.getElementById(`guardian-relationship-other`).value=``)});function s(e,t){let n=document.getElementById(e),r=[`${t}-first`,`${t}-middle`,`${t}-last`,`${t}-ext`].map(e=>document.getElementById(e));n.addEventListener(`change`,()=>{n.checked&&r.forEach(e=>{e.value=``}),i()})}s(`father-name-na`,`father-name`),s(`mother-name-na`,`mother-name`),i()}function ne(e){let t=!0,n={};n[`confirmed-name`]=l(`confirmed-name`),s(`confirmed-name`)||(t=!1,e(document.getElementById(`confirmed-name-first`)),e(document.getElementById(`confirmed-name-last`)));let r=document.getElementById(`baptism-date`);n[`baptism-date`]=r.value,r.value&&!c(r.value)&&(t=!1,e(r)),n[`baptism-church`]=`Our Lady of Fatima Parish`;let i=document.getElementById(`confirmation-name`),a=document.getElementById(`confirmation-name-other`),o=i.value===`__other__`?a.value.trim():i.value;o||(t=!1,e(i.value===`__other__`?a:i)),n[`confirmation-name`]=o;let u=document.getElementById(`confirmation-date`);n[`confirmation-date`]=u.value,u.value&&!c(u.value)&&(t=!1,e(u));let d=document.getElementById(`guardian-toggle`);if(d.checked){let r=document.getElementById(`guardian-relationship`),i=document.getElementById(`guardian-relationship-other`),a=document.getElementById(`guardian-birthdate`),o=r.value;o||(t=!1,e(r)),o===`Other`&&(i.value.trim()||(t=!1,e(i)),o=i.value.trim()||`Other`);let u=l(`guardian-name`);s(`guardian-name`)||(t=!1,e(document.getElementById(`guardian-name-first`)),e(document.getElementById(`guardian-name-last`))),a.value&&c(a.value)||(t=!1,e(a)),n.guardian={relationship:o,name:u,birthdate:a.value}}else n.guardian=null;return d.checked||document.getElementById(`father-name-na`).checked?n[`father-name`]=null:(n[`father-name`]=l(`father-name`),s(`father-name`)||(t=!1,e(document.getElementById(`father-name-first`)),e(document.getElementById(`father-name-last`)))),d.checked||document.getElementById(`mother-name-na`).checked?n[`mother-name`]=null:(n[`mother-name`]=l(`mother-name`),s(`mother-name`)||(t=!1,e(document.getElementById(`mother-name-first`)),e(document.getElementById(`mother-name-last`)))),n[`sponsor-name`]=l(`sponsor-name`),{allFilled:t,details:n}}function Y(e){return`
      <div class="marriage-cell-name-row">
        <input type="text" id="${e}-first" class="form-input" placeholder="First Name" />
        <input type="text" id="${e}-middle" class="form-input" placeholder="Middle Name" />
        <input type="text" id="${e}-last" class="form-input" placeholder="Last Name" />
        <input type="text" id="${e}-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
      </div>`}function X(e,r){return`
      <label class="field-na-label" style="font-size:0.8125rem;color:#374151;">
        <input type="checkbox" id="${e}-guardian-toggle" class="checkbox-input" />
        Add Guardian
      </label>
      <div class="marriage-cell-guardian hidden" id="${e}-guardian-fields">
        <div class="mt-2">
          <label class="form-label" for="${e}-guardian-relationship">Relationship to the ${r} <span class="text-red-500">*</span></label>
          <select id="${e}-guardian-relationship" class="form-input">
            <option value="">Select relationship…</option>
            ${t.map(e=>`<option value="${e}">${e}</option>`).join(``)}
          </select>
        </div>
        <div class="mt-2 hidden" id="${e}-guardian-relationship-other-wrap">
          <label class="form-label" for="${e}-guardian-relationship-other">Specify Relationship <span class="text-red-500">*</span></label>
          <input type="text" id="${e}-guardian-relationship-other" class="form-input" placeholder="e.g. Family friend" />
        </div>
        <div class="mt-2">
          <label class="form-label">Guardian's Full Name <span class="text-red-500">*</span></label>
          ${Y(`${e}-guardian-name`)}
        </div>
        <div class="mt-2">
          <label class="form-label" for="${e}-guardian-birthdate">Guardian's Birthday <span class="text-red-500">*</span></label>
          <input type="date" id="${e}-guardian-birthdate" class="form-input" min="${a}" max="${n}" />
        </div>
      </div>`}function Z(e,t){let n=`${e}-${t}`;return`
      <div class="field-na-row">
        <label class="field-na-label"><input type="checkbox" id="${n}-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
      </div>
      ${Y(n)}`}function re(){return`
      <div class="marriage-table-wrap">
        <table class="marriage-table">
          <colgroup>
            <col class="marriage-table-label-col" />
            <col class="marriage-table-person-col" />
            <col class="marriage-table-person-col" />
          </colgroup>
          <thead>
            <tr><th></th><th>Groom</th><th>Bride</th></tr>
          </thead>
          <tbody>
            <tr>
              <th>Full Name <span class="text-red-500">*</span></th>
              <td>${Y(`groom-name`)}</td>
              <td>${Y(`bride-name`)}</td>
            </tr>
            <tr>
              <th>Guardian</th>
              <td>${X(`groom`,`Groom`)}</td>
              <td>${X(`bride`,`Bride`)}</td>
            </tr>
            <tr>
              <th>Father's Name <span class="text-red-500">*</span></th>
              <td>${Z(`groom`,`father`)}</td>
              <td>${Z(`bride`,`father`)}</td>
            </tr>
            <tr>
              <th>Mother's Maiden Name <span class="text-red-500">*</span></th>
              <td>${Z(`groom`,`mother`)}</td>
              <td>${Z(`bride`,`mother`)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="marriage-table-note">* Required unless checked Not Applicable, or a guardian is added for that person.</p>

      <div>
        <label class="form-label" for="marriage-date">Date of Marriage</label>
        <input type="date" id="marriage-date" class="form-input" min="${a}" max="${n}" />
      </div>

      <div>
        <label class="form-label" for="marriage-place">Place of Marriage</label>
        <input type="text" id="marriage-place" class="form-input" placeholder="e.g. Our Lady of Fatima Parish" />
      </div>

      ${o(`witness-1`,`Witness 1`,{required:!0,spanFull:!0})}
      ${o(`witness-2`,`Witness 2`,{required:!0,spanFull:!0})}
    `}function Q(e){let t=document.getElementById(`${e}-guardian-toggle`),n=document.getElementById(`${e}-guardian-fields`);function r(){let n=t.checked;[{prefix:`${e}-father`,naId:`${e}-father-na`},{prefix:`${e}-mother`,naId:`${e}-mother-na`}].forEach(({prefix:e,naId:t})=>{let r=document.getElementById(t),i=[`${e}-first`,`${e}-middle`,`${e}-last`,`${e}-ext`].map(e=>document.getElementById(e)),a=n||r.checked;i.forEach(e=>{e.disabled=a}),r.disabled=n})}t.addEventListener(`change`,()=>{n.classList.toggle(`hidden`,!t.checked),t.checked||(document.getElementById(`${e}-guardian-relationship`).value=``,document.getElementById(`${e}-guardian-relationship-other-wrap`).classList.add(`hidden`),document.getElementById(`${e}-guardian-relationship-other`).value=``,d(`${e}-guardian-name`,null),document.getElementById(`${e}-guardian-birthdate`).value=``),r()});let i=document.getElementById(`${e}-guardian-relationship`),a=document.getElementById(`${e}-guardian-relationship-other-wrap`);i.addEventListener(`change`,()=>{a.classList.toggle(`hidden`,i.value!==`Other`),i.value!==`Other`&&(document.getElementById(`${e}-guardian-relationship-other`).value=``)});function o(e,t){let n=document.getElementById(e),i=[`${t}-first`,`${t}-middle`,`${t}-last`,`${t}-ext`].map(e=>document.getElementById(e));n.addEventListener(`change`,()=>{n.checked&&i.forEach(e=>{e.value=``}),r()})}o(`${e}-father-na`,`${e}-father`),o(`${e}-mother-na`,`${e}-mother`),r()}function ie(){[document.getElementById(`marriage-date`),document.getElementById(`groom-guardian-birthdate`),document.getElementById(`bride-guardian-birthdate`)].forEach(p),Q(`groom`),Q(`bride`)}function $(e,t,n,r){let i=!0;r[`${e}-name`]=l(`${e}-name`),s(`${e}-name`)||(i=!1,n(document.getElementById(`${e}-name-first`)),n(document.getElementById(`${e}-name-last`)));let a=document.getElementById(`${e}-guardian-toggle`);if(a.checked){let t=document.getElementById(`${e}-guardian-relationship`),a=document.getElementById(`${e}-guardian-relationship-other`),o=document.getElementById(`${e}-guardian-birthdate`),u=t.value;u||(i=!1,n(t)),u===`Other`&&(a.value.trim()||(i=!1,n(a)),u=a.value.trim()||`Other`);let d=l(`${e}-guardian-name`);s(`${e}-guardian-name`)||(i=!1,n(document.getElementById(`${e}-guardian-name-first`)),n(document.getElementById(`${e}-guardian-name-last`))),o.value&&c(o.value)||(i=!1,n(o)),r[`${e}-guardian`]={relationship:u,name:d,birthdate:o.value}}else r[`${e}-guardian`]=null;return a.checked||document.getElementById(`${e}-father-na`).checked?r[`${e}-father`]=null:(r[`${e}-father`]=l(`${e}-father`),s(`${e}-father`)||(i=!1,n(document.getElementById(`${e}-father-first`)),n(document.getElementById(`${e}-father-last`)))),a.checked||document.getElementById(`${e}-mother-na`).checked?r[`${e}-mother`]=null:(r[`${e}-mother`]=l(`${e}-mother`),s(`${e}-mother`)||(i=!1,n(document.getElementById(`${e}-mother-first`)),n(document.getElementById(`${e}-mother-last`)))),i}function ae(e){let t=!0,n={};$(`groom`,`Groom`,e,n)||(t=!1),$(`bride`,`Bride`,e,n)||(t=!1);let r=document.getElementById(`marriage-date`);return n[`marriage-date`]=r.value,r.value&&!c(r.value)&&(t=!1,e(r)),n[`marriage-place`]=document.getElementById(`marriage-place`).value.trim(),n[`witness-1`]=l(`witness-1`),s(`witness-1`)||(t=!1,e(document.getElementById(`witness-1-first`)),e(document.getElementById(`witness-1-last`))),n[`witness-2`]=l(`witness-2`),s(`witness-2`)||(t=!1,e(document.getElementById(`witness-2-first`)),e(document.getElementById(`witness-2-last`))),{allFilled:t,details:n}}document.getElementById(`btn-back-to-menu`).addEventListener(`click`,H),document.addEventListener(`keydown`,e=>{if(e.key===`Escape`){if(!k.classList.contains(`hidden`)){B();return}S.classList.contains(`hidden`)||H()}}),document.getElementById(`btn-submit-request`).addEventListener(`click`,async()=>{if(!_)return;let e=!0,t={};function n(e){e&&(e.classList.add(`border-red-400`),e.addEventListener(`input`,()=>e.classList.remove(`border-red-400`),{once:!0}))}if(_.baptismalCustom){let r=K(n);e=r.allFilled,t=r.details}else if(_.confirmationCustom){let r=ne(n);e=r.allFilled,t=r.details}else if(_.marriageCustom){let r=ae(n);e=r.allFilled,t=r.details}else _.fields.forEach(r=>{if(r.kind===`name`){t[r.id]=l(r.id),r.required&&!s(r.id)&&(e=!1,n(document.getElementById(`${r.id}-first`)),n(document.getElementById(`${r.id}-last`)));return}let i=document.getElementById(r.id);t[r.id]=i?i.value.trim():``,(r.required&&(!i||!i.value.trim())||r.type===`date`&&i&&i.value&&!c(i.value))&&(e=!1,n(i))});let r=document.getElementById(`field-purpose`),i=document.getElementById(`field-notes`);r.value.trim()||(e=!1,r.classList.add(`border-red-400`),r.addEventListener(`input`,()=>r.classList.remove(`border-red-400`),{once:!0}));let a=document.getElementById(`field-parish-confirm`),o=!1;if(a&&!a.checked){e=!1,o=!0;let t=a.closest(`label`);t&&(t.classList.add(`text-red-500`),a.addEventListener(`change`,()=>{a.checked&&t.classList.remove(`text-red-500`)},{once:!0}))}if(!e){window.showToast(o?`Please confirm this event took place at Our Lady of Fatima Parish before submitting.`:`Please fill in all required fields.`,!0);return}A={details:t,purpose:r.value.trim(),notes:i.value.trim()},z()}),document.getElementById(`btn-confirm-submit`).addEventListener(`click`,async()=>{if(!_||!A)return;let t=document.getElementById(`btn-confirm-submit`);t.disabled=!0;try{let t=await r.models.CertificateRequest.create({requesterName:e,certificateType:_.name,purpose:A.purpose,notes:A.notes||void 0,details:JSON.stringify(A.details),status:`pending`});if(t.errors)throw Error(t.errors.map(e=>e.message).join(`; `));B(),w.classList.add(`hidden`),D.classList.remove(`hidden`),O.textContent=`Your request for a ${_.name} has been submitted. You'll be notified when it's ready for pick-up (typically 3–5 working days).`,window.scrollTo({top:0,behavior:`smooth`}),window.showToast(`${_.name} request submitted successfully.`),document.querySelectorAll(`.cert-type-card`).forEach(e=>e.classList.remove(`selected`)),_=null,A=null}catch(e){console.error(`Failed to submit request:`,e),window.showToast(e.message||`Couldn't submit the request.`,!0)}finally{t.disabled=!1}}),document.getElementById(`btn-new-request`).addEventListener(`click`,H)})}));p(),S();