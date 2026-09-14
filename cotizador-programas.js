(function(){
'use strict';
const catalog=window.SkilledProgramQuoteCatalog;
if(!catalog)return;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const form=$('#quote-form');
const panels=$$('.quote-step-panel');
const stepButtons=$$('.quote-step-button');
const moduleGroups=$('#module-groups');
const advancedGroups=$('#advanced-groups');
const profileContainer=$('#quote-profiles');
const draftKey='skilled_program_quote_draft_v150';
const advancedIds=new Set(['ia','web','integraciones']);
const startedAt=Date.now();
let currentStep=1;
let profileSequence=0;
let draftTimer=0;
let submitting=false;
const icons={
shield:'<svg viewBox="0 0 24 24"><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z"></path><path d="m9 12 2 2 4-5"></path></svg>',
box:'<svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Z"></path><path d="M4 7v10l8 4 8-4V7M12 11v10"></path></svg>',
cart:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2.5 11h10L20 8H7"></path><path d="M9 20h.01M17 20h.01"></path></svg>',
users:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 11a3 3 0 1 0 0-6M22 21v-2a4 4 0 0 0-3-3.7"></path></svg>',
folder:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9H3V7Z"></path></svg>',
tool:'<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 1-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z"></path></svg>',
vehicle:'<svg viewBox="0 0 24 24"><path d="m4 14 2-6h12l2 6v5h-2v-2H6v2H4v-5Z"></path><path d="M6 14h12M8 11h8M8 17h.01M16 17h.01"></path></svg>',
chart:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path></svg>',
store:'<svg viewBox="0 0 24 24"><path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Z"></path><path d="M8 20v-6h8v6"></path></svg>',
flow:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="6" rx="1"></rect><rect x="14" y="15" width="7" height="6" rx="1"></rect><path d="M6.5 9v5a3 3 0 0 0 3 3H14M17.5 15v-5a3 3 0 0 0-3-3H10"></path></svg>',
spark:'<svg viewBox="0 0 24 24"><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z"></path><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"></path></svg>',
web:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"></path></svg>',
plug:'<svg viewBox="0 0 24 24"><path d="m8 12 8-8M14 4l6 6M4 14l6 6M12 12l-2 2M7 17l-4 4"></path></svg>'
};
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g,' ').trim();}
function groupMarkup(group,index){return `<section class="quote-group ${index===0?'is-open':''}" data-group-id="${group.id}"><button type="button" class="quote-group-head" aria-expanded="${index===0?'true':'false'}"><span class="quote-group-icon">${icons[group.icon]||icons.folder}</span><span><strong>${esc(group.label)}</strong><span>${esc(group.description)}</span></span><span class="quote-group-meta"><b data-group-count>0 seleccionadas</b><svg class="quote-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"></path></svg></span></button><div class="quote-feature-list">${group.features.map(feature=>`<label class="quote-feature" data-feature-search="${esc(normalize(`${feature.label} ${feature.help} ${group.label}`))}"><input type="checkbox" name="features" value="${feature.id}" data-group="${group.id}"><span class="quote-check"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg></span><span><strong>${esc(feature.label)}</strong><small>${esc(feature.help)}</small></span></label>`).join('')}</div></section>`;}
function renderCatalog(){
const standard=catalog.groups.filter(group=>!advancedIds.has(group.id));
const advanced=catalog.groups.filter(group=>advancedIds.has(group.id));
moduleGroups.innerHTML=standard.map(groupMarkup).join('');
advancedGroups.innerHTML=advanced.map(groupMarkup).join('');
$$('.quote-group-head').forEach(button=>button.addEventListener('click',()=>{const group=button.closest('.quote-group');group.classList.toggle('is-open');button.setAttribute('aria-expanded',group.classList.contains('is-open')?'true':'false');}));
$$('input[name="features"]').forEach(input=>input.addEventListener('change',()=>{updateSelectionCounts();scheduleDraft();}));
updateSelectionCounts();
}
function updateSelectionCounts(){
$$('.quote-group').forEach(group=>{const count=group.querySelectorAll('input[name="features"]:checked').length;const badge=group.querySelector('[data-group-count]');if(badge)badge.textContent=`${count} seleccionada${count===1?'':'s'}`;});
const moduleCount=moduleGroups.querySelectorAll('input[name="features"]:checked').length;
$('#module-selection-count').textContent=`${moduleCount} ${moduleCount===1?'función seleccionada':'funciones seleccionadas'}`;
}
function filterFunctions(){
const query=normalize($('#function-search').value);
let visibleGroups=0;
moduleGroups.querySelectorAll('.quote-group').forEach(group=>{
let visible=0;
group.querySelectorAll('.quote-feature').forEach(feature=>{const show=!query||feature.dataset.featureSearch.includes(query);feature.hidden=!show;if(show)visible+=1;});
group.hidden=visible===0;
if(visible){visibleGroups+=1;if(query)group.classList.add('is-open');}
});
$('#module-empty').classList.toggle('is-visible',visibleGroups===0);
}
function profileMarkup(profile={}){
profileSequence+=1;
const id=`profile-${profileSequence}`;
return `<article class="quote-profile-card" data-profile-id="${id}"><div class="quote-profile-card-head"><strong><span class="quote-profile-number"></span><span>Perfil del programa</span></strong><button type="button" class="quote-btn danger" data-remove-profile>Quitar</button></div><div class="quote-profile-grid"><div class="quote-field"><label>Nombre del perfil o puesto <span>*</span></label><input data-profile-name maxlength="100" required placeholder="Ej. Administrador, Ventas, Almacén" value="${esc(profile.name||'')}"></div><div class="quote-field"><label>Usuarios</label><input data-profile-users type="number" min="1" max="10000" step="1" value="${Number(profile.users)||1}"></div><div class="quote-field"><label>Nivel de acceso</label><select data-profile-access><option value="operativo" ${profile.access==='operativo'?'selected':''}>Operativo</option><option value="consulta" ${profile.access==='consulta'?'selected':''}>Solo consulta</option><option value="supervisor" ${profile.access==='supervisor'?'selected':''}>Supervisor</option><option value="administrador" ${profile.access==='administrador'?'selected':''}>Administrador</option><option value="cliente" ${profile.access==='cliente'?'selected':''}>Cliente o externo</option></select></div><div class="quote-field"><label>Cantidad de herramientas</label><input data-profile-tools type="number" min="0" max="300" step="1" value="${Math.max(0,Number(profile.tools)||0)}"></div><div class="quote-field wide"><label>¿Qué debería poder hacer este perfil?</label><textarea data-profile-description maxlength="1000" placeholder="Ej. registrar ventas, consultar inventario, aprobar solicitudes y descargar reportes.">${esc(profile.description||'')}</textarea></div></div></article>`;
}
function addProfile(profile={}){profileContainer.insertAdjacentHTML('beforeend',profileMarkup(profile));bindProfiles();renumberProfiles();scheduleDraft();}
function bindProfiles(){
profileContainer.querySelectorAll('[data-remove-profile]').forEach(button=>{if(button.dataset.bound)return;button.dataset.bound='1';button.addEventListener('click',()=>{button.closest('.quote-profile-card')?.remove();if(!profileContainer.children.length)addProfile();renumberProfiles();scheduleDraft();});});
profileContainer.querySelectorAll('input,select,textarea').forEach(input=>{if(input.dataset.bound)return;input.dataset.bound='1';input.addEventListener('input',scheduleDraft);input.addEventListener('change',scheduleDraft);});
}
function renumberProfiles(){profileContainer.querySelectorAll('.quote-profile-card').forEach((card,index)=>{card.querySelector('.quote-profile-number').textContent=index+1;});}
function getProfiles(){return [...profileContainer.querySelectorAll('.quote-profile-card')].map(card=>({name:card.querySelector('[data-profile-name]').value.trim(),users:Math.min(10000,Math.max(1,Number(card.querySelector('[data-profile-users]').value)||1)),access:card.querySelector('[data-profile-access]').value,tools:Math.min(300,Math.max(0,Number(card.querySelector('[data-profile-tools]').value)||0)),description:card.querySelector('[data-profile-description]').value.trim()}));}
function selectedFeatureIds(){return $$('input[name="features"]:checked').map(input=>input.value);}
function textValue(name){const element=form.elements[name];return element?String(element.value||'').trim():'';}
function radioValue(name){return form.querySelector(`input[name="${name}"]:checked`)?.value||'';}
function payload(){
return {catalogVersion:catalog.version,contact:{name:textValue('contactName'),company:textValue('company'),position:textValue('position'),industry:textValue('industry'),email:textValue('email'),phone:textValue('phone'),city:textValue('city'),preferredContact:textValue('preferredContact')},project:{objective:textValue('objective'),currentSystem:textValue('currentSystem'),estimatedUsers:textValue('estimatedUsers'),deployment:radioValue('deployment'),priority:radioValue('priority'),desiredDate:textValue('desiredDate'),existingData:textValue('existingData'),budgetRange:textValue('budgetRange'),additionalFunctions:textValue('additionalFunctions'),additionalContext:textValue('additionalContext')},profiles:getProfiles(),features:selectedFeatureIds(),submittedFrom:'public_program_quote',language:'es-MX'};
}
function fieldError(element,message){element?.classList.add('quote-input-error');element?.focus({preventScroll:true});element?.scrollIntoView({behavior:'smooth',block:'center'});showStepError(currentStep,message);return false;}
function clearErrors(step=currentStep){const panel=form.querySelector(`[data-step="${step}"]`);panel?.querySelectorAll('.quote-input-error').forEach(element=>element.classList.remove('quote-input-error'));const box=form.querySelector(`[data-step-error="${step}"]`);if(box){box.textContent='';box.classList.remove('is-visible');}}
function showStepError(step,message){const box=form.querySelector(`[data-step-error="${step}"]`);if(box){box.textContent=message;box.classList.add('is-visible');}}
function validateStep(step){
clearErrors(step);
if(step===1){
const name=$('#contact-name'),company=$('#contact-company'),email=$('#contact-email'),phone=$('#contact-phone'),objective=$('#project-objective');
if(!name.value.trim())return fieldError(name,'Captura tu nombre completo.');
if(!company.value.trim())return fieldError(company,'Captura el nombre de tu empresa o negocio.');
if(!email.value.trim()&&!phone.value.trim())return fieldError(email,'Captura al menos un correo electrónico o un teléfono.');
if(email.value.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))return fieldError(email,'Revisa el formato del correo electrónico.');
if(!objective.value.trim()||objective.value.trim().length<15)return fieldError(objective,'Describe con un poco más de detalle el problema o proceso que quieres mejorar.');
}
if(step===2){const profiles=getProfiles();if(!profiles.length){showStepError(step,'Agrega al menos un perfil para el programa.');return false;}const emptyIndex=profiles.findIndex(profile=>!profile.name);if(emptyIndex>=0)return fieldError(profileContainer.querySelectorAll('[data-profile-name]')[emptyIndex],'Escribe el nombre de cada perfil o puesto.');}
if(step===6&&!$('#quote-consent').checked)return fieldError($('#quote-consent'),'Confirma la autorización de contacto para enviar la solicitud.');
return true;
}
function goToStep(step,validateCurrent=false){
const target=Math.min(6,Math.max(1,Number(step)||1));
if(validateCurrent&&target>currentStep&&!validateStep(currentStep))return;
currentStep=target;
panels.forEach(panel=>panel.classList.toggle('is-active',Number(panel.dataset.step)===currentStep));
stepButtons.forEach(button=>{const number=Number(button.dataset.stepTarget);button.classList.toggle('is-active',number===currentStep);button.classList.toggle('is-complete',number<currentStep);});
$('#quote-progress-label').textContent=`${currentStep} de 6`;
$('#quote-progress-bar').style.width=`${currentStep/6*100}%`;
$('#previous-step').hidden=currentStep===1;
$('#next-step').hidden=currentStep===6;
$('#submit-request').hidden=currentStep!==6;
if(currentStep===6)renderReview();
clearErrors(currentStep);
$('#quote-shell').scrollIntoView({behavior:'smooth',block:'start'});
scheduleDraft();
}
function reviewItem(label,value){return `<div class="quote-review-item"><span>${esc(label)}</span><strong>${esc(value||'No especificado')}</strong></div>`;}
function renderReview(){
const data=payload();
const byGroup=new Map();
data.features.forEach(id=>{const item=catalog.byId[id];if(!item)return;if(!byGroup.has(item.groupLabel))byGroup.set(item.groupLabel,[]);byGroup.get(item.groupLabel).push(item.label);});
const featureSections=[...byGroup.entries()].map(([group,items])=>`<div style="margin-top:10px"><strong style="display:block;margin-bottom:7px;color:#8cb8d4;font-size:9px">${esc(group)}</strong><div class="quote-review-tags">${items.map(item=>`<span class="quote-review-tag">${esc(item)}</span>`).join('')}</div></div>`).join('');
const profiles=data.profiles.map(profile=>`<div class="quote-review-item"><span>${esc(profile.name)}</span><strong>${profile.users} usuario${profile.users===1?'':'s'} · ${profile.tools} herramienta${profile.tools===1?'':'s'} · ${esc(profile.access)}</strong></div>`).join('');
$('#quote-review').innerHTML=`<section class="quote-review-section"><div class="quote-review-head"><strong>Contacto y negocio</strong><button type="button" data-edit-step="1">Editar</button></div><div class="quote-review-grid">${reviewItem('Nombre',data.contact.name)}${reviewItem('Empresa',data.contact.company)}${reviewItem('Correo',data.contact.email)}${reviewItem('Teléfono',data.contact.phone)}${reviewItem('Giro',data.contact.industry)}${reviewItem('Usuarios estimados',data.project.estimatedUsers)}</div><div class="quote-review-item" style="margin-top:10px"><span>Objetivo principal</span><strong>${esc(data.project.objective)}</strong></div></section><section class="quote-review-section"><div class="quote-review-head"><strong>Perfiles del programa</strong><button type="button" data-edit-step="2">Editar</button></div><div class="quote-review-grid">${profiles||'<span class="quote-review-empty">No se agregaron perfiles.</span>'}</div></section><section class="quote-review-section"><div class="quote-review-head"><strong>Funciones seleccionadas</strong><button type="button" data-edit-step="3">Editar</button></div>${featureSections||'<span class="quote-review-empty">No se seleccionaron funciones de la lista.</span>'}</section><section class="quote-review-section"><div class="quote-review-head"><strong>Implementación</strong><button type="button" data-edit-step="5">Editar</button></div><div class="quote-review-grid">${reviewItem('Modalidad',data.project.deployment)}${reviewItem('Prioridad',data.project.priority)}${reviewItem('Fecha deseada',data.project.desiredDate)}${reviewItem('Datos existentes',data.project.existingData)}${reviewItem('Presupuesto considerado',data.project.budgetRange)}${reviewItem('Funciones adicionales',data.project.additionalFunctions)}</div></section>`;
$('#quote-review').querySelectorAll('[data-edit-step]').forEach(button=>button.addEventListener('click',()=>goToStep(button.dataset.editStep)));
}
function draftData(){const values={};form.querySelectorAll('input:not([name="features"]):not([data-profile-name]):not([data-profile-users]):not([data-profile-tools]),select:not([data-profile-access]),textarea:not([data-profile-description])').forEach(element=>{if(!element.name&&element.id!=='quote-consent')return;const key=element.name||element.id;if(element.type==='radio'){if(element.checked)values[key]=element.value;}else if(element.type==='checkbox')values[key]=element.checked;else values[key]=element.value;});return {at:Date.now(),step:currentStep,values,profiles:getProfiles(),features:selectedFeatureIds()};}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,350);}
function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(draftData()));$('#draft-state').textContent='Borrador guardado en este dispositivo';}catch(_){$('#draft-state').textContent='El borrador no pudo guardarse';}}
function restoreDraft(){
let draft=null;try{draft=JSON.parse(localStorage.getItem(draftKey)||'null');}catch(_){}
if(!draft||!draft.values||Date.now()-Number(draft.at||0)>14*86400000){addProfile({name:'Administrador',users:1,access:'administrador',tools:5});return;}
Object.entries(draft.values).forEach(([key,value])=>{const elements=form.querySelectorAll(`[name="${CSS.escape(key)}"],#${CSS.escape(key)}`);elements.forEach(element=>{if(element.type==='radio')element.checked=element.value===value;else if(element.type==='checkbox')element.checked=Boolean(value);else element.value=value??'';});});
if(Array.isArray(draft.profiles)&&draft.profiles.length)draft.profiles.slice(0,50).forEach(addProfile);else addProfile({name:'Administrador',users:1,access:'administrador',tools:5});
if(Array.isArray(draft.features))draft.features.forEach(id=>{const input=form.querySelector(`input[name="features"][value="${CSS.escape(id)}"]`);if(input)input.checked=true;});
updateSelectionCounts();
currentStep=Math.min(6,Math.max(1,Number(draft.step)||1));
goToStep(currentStep);
}
function setSubmitting(value){submitting=value;$('#submit-request').disabled=value;$('#previous-step').disabled=value;$('#submit-status').classList.toggle('is-visible',value);}
function friendlySubmitError(error){const message=String(error?.message||'');if(/crm_crear_solicitud_cotizador_v150|schema cache|function/i.test(message))return 'El formulario todavía no ha sido activado en el servidor. Por favor comunícate directamente con Skilled.';if(/fetch|network|Failed to fetch|timeout/i.test(message))return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.';return message||'No se pudo enviar la solicitud. Inténtalo nuevamente.';}
async function submitRequest(event){
event.preventDefault();
if(submitting)return;
if(!validateStep(6))return;
if($('#company-website-confirm').value||Date.now()-startedAt<4000){showStepError(6,'No pudimos validar el formulario. Actualiza la página e inténtalo nuevamente.');return;}
setSubmitting(true);clearErrors(6);
try{
if(!window.supabase?.createClient)throw new Error('No se pudo cargar la conexión segura.');
const config=window.SKILLED_CONFIG||{};
const client=window.supabase.createClient(String(config.supabaseUrl||''),String(config.supabasePublishableKey||''),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {data,error}=await client.rpc('crm_crear_solicitud_cotizador_v150',{p_solicitud:payload()});
if(error)throw error;
const result=Array.isArray(data)?data[0]:data;
if(!result?.ok||!result?.folio)throw new Error(result?.mensaje||'El servidor no confirmó la solicitud.');
try{localStorage.removeItem(draftKey);}catch(_){}
$('#quote-form-content').hidden=true;$('#quote-actions').hidden=true;$('#quote-success').classList.add('is-visible');$('#success-folio').textContent=`Folio ${result.folio}`;$('#quote-success').scrollIntoView({behavior:'smooth',block:'center'});
}catch(error){showStepError(6,friendlySubmitError(error));}finally{setSubmitting(false);}
}
function resetForm(){form.reset();profileContainer.innerHTML='';profileSequence=0;addProfile({name:'Administrador',users:1,access:'administrador',tools:5});$$('input[name="features"]').forEach(input=>input.checked=false);updateSelectionCounts();try{localStorage.removeItem(draftKey);}catch(_){}$('#quote-form-content').hidden=false;$('#quote-actions').hidden=false;$('#quote-success').classList.remove('is-visible');goToStep(1);}
function init(){
renderCatalog();restoreDraft();
$('#add-profile').addEventListener('click',()=>addProfile());
$('#function-search').addEventListener('input',filterFunctions);
$('#previous-step').addEventListener('click',()=>goToStep(currentStep-1));
$('#next-step').addEventListener('click',()=>goToStep(currentStep+1,true));
stepButtons.forEach(button=>button.addEventListener('click',()=>{const target=Number(button.dataset.stepTarget);if(target<=currentStep)goToStep(target);else if(validateStep(currentStep))goToStep(Math.min(target,currentStep+1));}));
form.addEventListener('submit',submitRequest);
form.addEventListener('input',event=>{event.target.classList.remove('quote-input-error');scheduleDraft();});
form.addEventListener('change',scheduleDraft);
$('#new-request').addEventListener('click',resetForm);
$('#print-confirmation').addEventListener('click',()=>window.print());
$('#quote-year').textContent=new Date().getFullYear();
const date=$('#desired-date');if(date)date.min=new Date().toISOString().slice(0,10);
}
init();
})();
