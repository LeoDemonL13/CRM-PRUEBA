(function(){
'use strict';
const root=document.documentElement;
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const saveData=Boolean(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType));
root.dataset.crmSaveData=saveData?'1':'0';
if(!document.getElementById('skilled-performance-style')){
 const style=document.createElement('style');style.id='skilled-performance-style';style.textContent=`
 html{overflow-x:hidden} body{max-width:100vw} img,video,canvas,svg{max-width:100%}
 @media(max-width:1023px){.profile-shell{padding-left:16px!important;padding-right:16px!important}.profile-hero-content{gap:14px!important}.profile-actions{flex-wrap:wrap!important}.profile-actions>*{max-width:100%}.profile-metrics{gap:10px!important}.crm-modal,.profile-modal{max-height:94dvh!important}.field{min-height:42px}.crm-primary,.crm-secondary{min-height:40px}}
 @media(max-width:640px){.profile-shell{padding-left:12px!important;padding-right:12px!important}.profile-title{font-size:1.35rem!important}.profile-subtitle{font-size:.75rem!important}.profile-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.profile-metric{padding:12px!important;min-height:88px!important}.profile-metric strong{font-size:1.25rem!important}.crm-primary,.crm-secondary{font-size:11px!important}.modal-panel{width:calc(100vw - 16px)!important;max-width:none!important}}
 html[data-crm-save-data="1"] *,html[data-crm-save-data="1"] *::before,html[data-crm-save-data="1"] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
 `;document.head.appendChild(style)
}
function optimize(){document.querySelectorAll('img').forEach((img,i)=>{if(!img.hasAttribute('decoding'))img.decoding='async';if(i>1&&!img.hasAttribute('loading'))img.loading='lazy'});if(saveData){document.querySelectorAll('video[autoplay]').forEach(v=>{v.autoplay=false;v.pause?.()})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',optimize,{once:true});else optimize();
window.addEventListener('skilled:contentchanged',optimize);
})();
