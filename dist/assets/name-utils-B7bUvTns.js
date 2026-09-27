import{n as e}from"./modulepreload-polyfill-BlJ-Wce8.js";function t(e,t,{required:n=!1,spanFull:r=!0}={}){return`
    <div class="name-field-group${r?` sm:col-span-2`:``}">
      <label class="form-label">${t}${n?` <span class="text-red-500">*</span>`:``}</label>
      <div class="name-field-row">
        <input type="text" id="${e}-first" class="form-input" placeholder="First Name" />
        <input type="text" id="${e}-middle" class="form-input" placeholder="Middle Name" />
        <input type="text" id="${e}-last" class="form-input" placeholder="Last Name" />
        <input type="text" id="${e}-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
      </div>
    </div>`}function n(e){let t=t=>(document.getElementById(`${e}-${t}`)?.value||``).trim();return{firstName:t(`first`),middleName:t(`middle`),lastName:t(`last`),extension:t(`ext`)}}function r(e,t){let n=t||{},r=(t,n)=>{let r=document.getElementById(`${e}-${t}`);r&&(r.value=n||``)};r(`first`,n.firstName),r(`middle`,n.middleName),r(`last`,n.lastName),r(`ext`,n.extension)}function i(e){let t=n(e);return!!(t.firstName&&t.lastName)}function a(e){return!e||!((e.firstName||``).trim()||(e.middleName||``).trim()||(e.lastName||``).trim()||(e.extension||``).trim())}function o(e){if(!e)return``;let t=[e.firstName,e.middleName,e.lastName].map(e=>(e||``).trim()).filter(Boolean).join(` `),n=(e.extension||``).trim();return n&&(t+=(t?` `:``)+n),t}var s=e((()=>{}));export{t as a,i,s as n,n as o,a as r,r as s,o as t};