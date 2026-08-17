(function(){
'use strict';
const file=(location.pathname.split('/').pop()||'').toLowerCase();
const body=document.body;
if(!body)return;
const publicPage=/^(login|index|limpiar-cache|recuperar-crm)(?:\.html)?$/.test(file);
if(publicPage){
body.classList.add('crm-v83-no-sidebar');
body.classList.remove('crm-v83-page','skilled-has-sidebar','skilled-sidebar-collapsed','skilled-mobile-sidebar-open');
document.documentElement.style.setProperty('--crm-sidebar-live','0px');
document.getElementById('skilled-sidebar')?.remove();
document.getElementById('skilled-sidebar-overlay')?.remove();
return
}
body.classList.add('crm-v83-page');
const profileMap={al:'almacen',co:'compras',rh:'rh',fi:'finanzas',gg:'gerente_general',sg:'subgerente',tsi:'tsi',sky:'sky_demo',pl:'planeacion',cr:'coordinacion',lg:'logistica',re:'recepcion',proy:'proyectos',adm:'administrador'};
const prefix=(file.match(/^([a-z]+)\./)||[])[1]||'';
const profile=body.dataset.profile||profileMap[prefix]||new URLSearchParams(location.search).get('perfil')||'';
if(profile)body.dataset.crmProfile=profile;
const main=document.querySelector('main');
if(main)main.classList.add('crm-v83-main');
const header=document.querySelector('header.skilled-app-header,header[data-skilled-header]');
if(header){header.setAttribute('role','banner');header.dataset.crmV83='header'}
const sidebar=()=>document.getElementById('skilled-sidebar')||document.querySelector('.skilled-sidebar');
if(!sidebar())body.classList.add('crm-v83-sidebar-pending');
const observer=new MutationObserver(()=>{if(sidebar()){body.classList.remove('crm-v83-sidebar-pending','crm-v83-no-sidebar');observer.disconnect()}});
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>{if(!sidebar())body.classList.add('crm-v83-no-sidebar');observer.disconnect()},5000);
if(!document.getElementById('crm-v83-skip')){const skip=document.createElement('a');skip.id='crm-v83-skip';skip.href='#crm-v83-content';skip.textContent='Saltar al contenido';skip.style.cssText='position:fixed;left:12px;top:-60px;z-index:2147483647;padding:8px 11px;border-radius:8px;background:#0878b6;color:#fff;font:700 11px system-ui;text-decoration:none;transition:top .15s';skip.addEventListener('focus',()=>skip.style.top='12px');skip.addEventListener('blur',()=>skip.style.top='-60px');document.body.prepend(skip);if(main)main.id=main.id||'crm-v83-content'}
})();
