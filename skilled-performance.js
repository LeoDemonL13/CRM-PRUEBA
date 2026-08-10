(function(){
'use strict';
const root=document.documentElement;
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const viewport=()=>window.innerWidth||document.documentElement.clientWidth||1024;
const updateMode=()=>{
 const width=viewport();
 const saveData=Boolean(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType));
 root.dataset.crmSaveData=saveData?'1':'0';
 root.dataset.crmDevice=width<700?'mobile':width<1180?'tablet':'desktop';
 root.dataset.crmCompact=width<1024?'1':'0';
};
updateMode();
if(!document.getElementById('skilled-performance-style')){
 const style=document.createElement('style');
 style.id='skilled-performance-style';
 style.textContent=`
 html{overflow-x:hidden}body{max-width:100vw}img,video,canvas,svg{max-width:100%}img{height:auto}table{max-width:100%}
 .crm-workspace-overlay{box-sizing:border-box!important;min-width:0!important}
 .crm-workspace-dialog{box-sizing:border-box!important;min-width:0!important;container-type:inline-size}
 @media(min-width:1024px){
  body.skilled-has-sidebar .crm-workspace-overlay{left:var(--crm-sidebar-live,260px)!important;right:0!important;width:auto!important;padding:18px!important}
  body:not(.skilled-has-sidebar) .crm-workspace-overlay{left:0!important;right:0!important;width:auto!important}
  .crm-workspace-dialog.crm-workspace-fluid{width:calc(100% - 4px)!important;max-width:none!important}
  .crm-workspace-dialog.crm-workspace-medium{width:min(100%,1080px)!important;max-width:1080px!important}
 }
 @media(max-width:1180px){.profile-shell{padding-left:18px!important;padding-right:18px!important}.profile-hero-content{gap:14px!important}.profile-actions{flex-wrap:wrap!important}.profile-actions>*{max-width:100%}.profile-metrics{gap:10px!important}.crm-modal,.profile-modal{max-height:94dvh!important}.field{min-height:42px}.crm-primary,.crm-secondary{min-height:40px}}
 @media(max-width:1023px){.crm-workspace-overlay{left:0!important;right:0!important;width:auto!important;padding:10px!important}.crm-workspace-dialog,.crm-workspace-dialog.crm-workspace-fluid,.crm-workspace-dialog.crm-workspace-medium{width:100%!important;max-width:none!important}}
 @media(max-width:760px){.profile-shell{padding-left:12px!important;padding-right:12px!important}.profile-title{font-size:1.35rem!important}.profile-subtitle{font-size:.75rem!important}.profile-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}.profile-metric{padding:12px!important;min-height:88px!important}.profile-metric strong{font-size:1.25rem!important}.crm-primary,.crm-secondary{font-size:11px!important}.modal-panel{width:calc(100vw - 16px)!important;max-width:none!important}.profile-hero-content{align-items:flex-start!important}.profile-hero-main{min-width:0}.profile-actions{width:100%;justify-content:flex-start!important}}
 @media(max-width:640px){.crm-workspace-overlay{padding:0!important;align-items:stretch!important}.crm-workspace-dialog{height:100dvh!important;max-height:100dvh!important;border-radius:0!important;border-left:0!important;border-right:0!important}.profile-modal-footer,.crm-modal-footer{flex-wrap:wrap}.profile-modal-footer>*,.crm-modal-footer>*{min-width:0}.profile-modal-footer .crm-primary,.crm-modal-footer .crm-primary{flex:1 1 160px}}
 @media(max-width:520px){.profile-metrics{grid-template-columns:1fr 1fr!important}.profile-hero{padding:16px!important}.profile-title{overflow-wrap:anywhere}.profile-actions>*{flex:1 1 auto}}
 @container (max-width:1100px){.crm-workspace-dialog .xl\\:grid-cols-12{grid-template-columns:repeat(6,minmax(0,1fr))!important}.crm-workspace-dialog .xl\\:grid-cols-12>.xl\\:col-span-3{grid-column:span 3/span 3!important}.crm-workspace-dialog .xl\\:grid-cols-12>.xl\\:col-span-2{grid-column:span 2/span 2!important}.crm-workspace-dialog .xl\\:grid-cols-12>.xl\\:col-span-1{grid-column:span 1/span 1!important}.crm-workspace-dialog .xl\\:grid-cols-4{grid-template-columns:repeat(2,minmax(0,1fr))!important}.crm-workspace-dialog .xl\\:grid-cols-4>.xl\\:col-span-3{grid-column:1/-1!important}}
 @container (max-width:760px){.crm-workspace-dialog .md\\:grid-cols-2,.crm-workspace-dialog .sm\\:grid-cols-2,.crm-workspace-dialog .xl\\:grid-cols-4,.crm-workspace-dialog .xl\\:grid-cols-12{grid-template-columns:1fr!important}.crm-workspace-dialog [class*="col-span-"]{grid-column:1/-1!important}}
 html[data-crm-save-data="1"] *,html[data-crm-save-data="1"] *::before,html[data-crm-save-data="1"] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
 html[data-crm-save-data="1"] video[autoplay]{visibility:hidden}
 `;
 document.head.appendChild(style);
}
const loadedScripts=new Map();
function loadScript(src,options={}){
 const url=String(src||'').trim();
 if(!url)return Promise.reject(new Error('Falta la dirección del recurso.'));
 if(loadedScripts.has(url))return loadedScripts.get(url);
 const existing=[...document.scripts].find(node=>node.src===new URL(url,location.href).href);
 if(existing&&existing.dataset.loaded==='1')return Promise.resolve(existing);
 const promise=new Promise((resolve,reject)=>{
  const script=existing||document.createElement('script');
  const done=()=>{script.dataset.loaded='1';resolve(script)};
  const fail=()=>reject(new Error('No se pudo cargar un recurso necesario.'));
  script.addEventListener('load',done,{once:true});
  script.addEventListener('error',fail,{once:true});
  if(!existing){script.src=url;script.async=options.async!==false;if(options.defer)script.defer=true;document.head.appendChild(script)}
  else if(script.readyState==='complete')done();
 });
 loadedScripts.set(url,promise);
 return promise;
}
window.SkilledAssets=Object.freeze({loadScript});
function dialogSizeClass(dialog){
 const classes=[...dialog.classList];
 if(classes.some(value=>/^max-w-(?:5xl|6xl|7xl|full|screen)/.test(value))||classes.includes('import-bulk-modal')||/pdf|report|import/i.test(dialog.parentElement?.id||''))return'crm-workspace-fluid';
 if(classes.some(value=>/^max-w-4xl/.test(value)))return'crm-workspace-medium';
 return'';
}
function adaptDialogs(scope=document){
 if(document.body)document.body.classList.toggle('skilled-has-sidebar',Boolean(document.getElementById('skilled-sidebar')));
 const overlays=scope.querySelectorAll?scope.querySelectorAll('.fixed.inset-0'):[];
 overlays.forEach(overlay=>{
  const dialog=[...overlay.children].find(node=>node.nodeType===1);
  if(!dialog)return;
  overlay.classList.add('crm-workspace-overlay');
  dialog.classList.add('crm-workspace-dialog');
  dialog.classList.remove('crm-workspace-fluid','crm-workspace-medium');
  const size=dialogSizeClass(dialog);
  if(size)dialog.classList.add(size);
 });
}
function optimizeImages(scope=document){
 adaptDialogs(scope);
 const images=scope.querySelectorAll?scope.querySelectorAll('img'):[];
 images.forEach((img,index)=>{
  if(!img.hasAttribute('decoding'))img.decoding='async';
  const important=img.closest('header,#skilled-sidebar,.skilled-sidebar-brand,.profile-avatar,.skilled-profile-avatar')||index<1;
  if(!important&&!img.hasAttribute('loading'))img.loading='lazy';
  if(!important&&!img.hasAttribute('fetchpriority'))img.fetchPriority='low';
 });
 const videos=scope.querySelectorAll?scope.querySelectorAll('video'):[];
 videos.forEach(video=>{
  if(!video.hasAttribute('preload'))video.preload=root.dataset.crmSaveData==='1'?'none':'metadata';
  if(root.dataset.crmSaveData==='1'&&video.autoplay){video.autoplay=false;video.pause?.()}
 });
}
function scheduleOptimize(scope=document){
 if('requestIdleCallback'in window)requestIdleCallback(()=>optimizeImages(scope),{timeout:650});
 else setTimeout(()=>optimizeImages(scope),0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scheduleOptimize(),{once:true});else scheduleOptimize();
window.addEventListener('skilled:contentchanged',event=>scheduleOptimize(event.target||document));
window.addEventListener('skilled:sidebarstate',()=>requestAnimationFrame(()=>adaptDialogs(document)));
let resizeTimer=0;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{updateMode();adaptDialogs(document)},120)},{passive:true});
connection?.addEventListener?.('change',updateMode);
if('MutationObserver'in window){
 const observer=new MutationObserver(records=>{
  const roots=[];
  records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)roots.push(node)}));
  if(roots.length)requestAnimationFrame(()=>roots.slice(0,12).forEach(node=>optimizeImages(node)));
 });
 const start=()=>observer.observe(document.body,{childList:true,subtree:true});
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}
})();
