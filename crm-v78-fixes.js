(function(){
'use strict';
const $=id=>document.getElementById(id);
function show(id){const m=$(id);if(!m)return false;m.classList.remove('hidden');m.classList.add('flex');return true}
function hide(id){const m=$(id);if(!m)return false;m.classList.add('hidden');m.classList.remove('flex');return true}
function bind(id,fn){const el=$(id);if(el&&!el.dataset.v82Bound){el.dataset.v82Bound='1';el.addEventListener('click',e=>{try{fn(e)}catch(err){console.warn('[CRM]',err)}})}}
function bindModalFallbacks(){
  bind('open-config',()=>show('config-modal'));
  bind('close-config',()=>hide('config-modal'));bind('cancel-config',()=>hide('config-modal'));
  bind('open-wa-config',()=>show('wa-config-modal'));
  bind('close-wa-config',()=>hide('wa-config-modal'));bind('cancel-wa-config',()=>hide('wa-config-modal'));
  ['config-modal','wa-config-modal','whatsapp-guide-modal','device-modal','device-token-modal'].forEach(id=>{const m=$(id);if(m&&!m.dataset.v82Backdrop){m.dataset.v82Backdrop='1';m.addEventListener('click',e=>{if(e.target===m)hide(id)})}});
}
function hardenScrollableModals(){document.querySelectorAll('.profile-modal').forEach(m=>{m.classList.add('crm-v78-compact-modal');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true')})}
function editableTarget(target){return target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)}
function focusSearch(){const input=$('global-search')||document.querySelector('[data-skilled-global-search]');if(!input)return false;input.focus();if(typeof input.select==='function')input.select();return true}
function bindKeyboard(){if(document.documentElement.dataset.crmKeyboard==='1')return;document.documentElement.dataset.crmKeyboard='1';document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){if(focusSearch())event.preventDefault();return}if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!editableTarget(event.target)){if(focusSearch())event.preventDefault()}})}
function networkState(event){
  let banner=$('crm-network-state');
  if(!banner){banner=document.createElement('div');banner.id='crm-network-state';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.appendChild(banner)}
  const online=navigator.onLine!==false;
  banner.className=`crm-network-state ${online?'is-online':'is-offline'}`;
  banner.innerHTML=online?'<span></span>Conexión restablecida':'<span></span>Sin conexión · los datos en nube pueden no actualizarse';
  if(online){if(event&&event.type==='online')banner.classList.add('is-visible');clearTimeout(networkState.timer);networkState.timer=setTimeout(()=>banner.classList.remove('is-visible'),2200)}else banner.classList.add('is-visible');
}
function boot(){bindModalFallbacks();hardenScrollableModals();bindKeyboard();networkState();window.addEventListener('online',networkState);window.addEventListener('offline',networkState);setTimeout(bindModalFallbacks,600);setTimeout(hardenScrollableModals,600)}
window.addEventListener('DOMContentLoaded',boot,{once:true});
})();
