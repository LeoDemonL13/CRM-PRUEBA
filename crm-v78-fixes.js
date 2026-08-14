
(function(){
'use strict';
const $=id=>document.getElementById(id);
function show(id){const m=$(id); if(!m) return false; m.classList.remove('hidden'); m.classList.add('flex'); return true;}
function hide(id){const m=$(id); if(!m) return false; m.classList.add('hidden'); m.classList.remove('flex'); return true;}
function bind(id,fn){const el=$(id); if(el&&!el.dataset.v78Bound){el.dataset.v78Bound='1'; el.addEventListener('click',e=>{try{fn(e)}catch(err){console.warn('[V78]',err)}})}}
function bindModalFallbacks(){
  bind('open-config',()=>show('config-modal'));
  bind('close-config',()=>hide('config-modal')); bind('cancel-config',()=>hide('config-modal'));
  bind('open-wa-config',()=>show('wa-config-modal'));
  bind('close-wa-config',()=>hide('wa-config-modal')); bind('cancel-wa-config',()=>hide('wa-config-modal'));
  ['config-modal','wa-config-modal','whatsapp-guide-modal','device-modal','device-token-modal'].forEach(id=>{const m=$(id); if(m&&!m.dataset.v78Backdrop){m.dataset.v78Backdrop='1'; m.addEventListener('click',e=>{if(e.target===m)hide(id)})}});
}
function hardenScrollableModals(){document.querySelectorAll('.profile-modal').forEach(m=>m.classList.add('crm-v78-compact-modal'));}
window.addEventListener('DOMContentLoaded',()=>{bindModalFallbacks();hardenScrollableModals();setTimeout(bindModalFallbacks,600);setTimeout(hardenScrollableModals,600)});
})();
