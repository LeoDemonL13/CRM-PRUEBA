(function(){
'use strict';
const roles=[
 ['administrador','Administración'],['jefe_almacen','Jefe de Almacén'],['almacen','Almacén'],['compras','Compras'],
 ['proyectos','Proyectos'],['planeacion','Planeación'],['coordinacion','Coordinación'],['logistica','Logística'],
 ['recepcion','Recepción'],['rh','Recursos Humanos'],['finanzas','Finanzas'],['gerente_general','Gerencia General'],
 ['subgerente','Subgerencia'],['tsi','TSI'],['sky_demo','Skill · Presentación'],['consulta','Consulta']
];
const homes={administrador:'AL.inicio.html',jefe_almacen:'AL.inicio.html',almacen:'AL.inicio.html',compras:'CO.inicio.html',proyectos:'AL.proyectos.html',planeacion:'PL.inicio.html',coordinacion:'CR.inicio.html',logistica:'LG.inicio.html',recepcion:'RE.inicio.html',rh:'RH.inicio.html',finanzas:'FI.inicio.html',gerente_general:'GG.inicio.html',subgerente:'SG.inicio.html',tsi:'TSI.inicio.html',sky_demo:'SKY.inicio.html',consulta:'AL.inicio.html'};
let changing=false;
let currentSession=null;
function isTestProfile(session){
 const profile=session?.profile||{};
 const type=String(profile.tipo_cuenta||profile.tipoCuenta||session?.user?.user_metadata?.tipo_cuenta||session?.user?.app_metadata?.tipo_cuenta||'').trim().toLowerCase();
 const email=String(session?.user?.email||profile.email||'').trim().toLowerCase();
 return ['pruebas','prueba','demo','demostracion','demostración'].includes(type)||email==='prueba@no.mx';
}
function currentRole(session){return String(session?.role||session?.profile?.rol||'administrador').toLowerCase();}
function labelFor(role){return roles.find(x=>x[0]===role)?.[1]||role;}
function isProfilePage(){return /(^|\/)perfil\.html$/i.test(location.pathname);}
function optionMarkup(role){return roles.map(([value,label])=>`<option value="${value}" ${value===role?'selected':''}>${label}</option>`).join('');}
async function switchRole(target,ui){
 if(changing)return;
 const role=currentRole(currentSession);
 if(!target||target===role)return;
 changing=true;
 if(ui?.button){ui.button.disabled=true;ui.button.textContent='Cambiando...';}
 if(ui?.select)ui.select.disabled=true;
 ui?.host?.classList.add('is-changing');
 try{
  const client=window.SkilledDB?.client;if(!client)throw new Error('Supabase todavía no está listo.');
  const {error}=await client.rpc('nexus_pruebas_cambiar_perfil_v152',{p_rol:target});if(error)throw error;
  try{localStorage.removeItem('skilled_profile_cache');sessionStorage.removeItem('skilled_profile_validated_at');}catch(_){ }
  location.replace(homes[target]||'AL.inicio.html');
 }catch(err){
  console.error('No se pudo cambiar el perfil de prueba:',err);
  alert(err?.message||'No se pudo cambiar el perfil de prueba.');
  if(ui?.select){ui.select.value=role;ui.select.disabled=false;}
  if(ui?.button){ui.button.disabled=true;ui.button.textContent='Cambiar perfil';}
  ui?.host?.classList.remove('is-changing');
  changing=false;
 }
}
function mountProfileCard(session){
 if(!isTestProfile(session)||!isProfilePage()||document.getElementById('nexus-demo-profile-card'))return false;
 const summary=document.querySelector('.profile-summary');
 if(!summary)return false;
 const role=currentRole(session);
 const card=document.createElement('section');
 card.id='nexus-demo-profile-card';
 card.className='nexus-demo-profile-card';
 card.innerHTML=`
  <div class="nexus-demo-profile-head">
   <span class="nexus-demo-dot" aria-hidden="true"></span>
   <div><strong>Modo pruebas</strong><span>Cambio de perfil de demostración</span></div>
  </div>
  <div class="nexus-demo-profile-body">
   <div class="nexus-demo-active-row"><span>Perfil activo</span><strong data-demo-active-role>${labelFor(role)}</strong></div>
   <label for="nexus-demo-role">Cambiar a</label>
   <select id="nexus-demo-role" aria-label="Cambiar perfil de prueba">${optionMarkup(role)}</select>
   <button type="button" class="nexus-demo-change-button" disabled>Cambiar perfil</button>
   <p>Esta opción solo cambia el rol visible de la cuenta de demostración. Se mantiene fuera de la barra superior para no estorbar ni moverse con el tamaño de pantalla.</p>
  </div>`;
 summary.appendChild(card);
 const select=card.querySelector('select');
 const button=card.querySelector('button');
 select.addEventListener('change',()=>{button.disabled=select.value===role;});
 button.addEventListener('click',()=>switchRole(select.value,{host:card,select,button}));
 if(new URLSearchParams(location.search).get('cambiar_perfil')==='1')setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),160);
 return true;
}
function mountSidebarShortcut(session){
 if(!isTestProfile(session))return false;
 const sidebar=document.getElementById('skilled-sidebar');
 if(!sidebar||sidebar.querySelector('[data-nexus-demo-profile-link]'))return false;
 const profileLink=[...sidebar.querySelectorAll('a[data-sidebar-link]')].find(a=>/^perfil\.html(?:\?|$)/i.test((a.getAttribute('href')||'').split('#')[0]));
 if(!profileLink)return false;
 const li=profileLink.closest('li');
 if(!li)return false;
 const role=currentRole(session);
 const shortcut=document.createElement('li');
 shortcut.innerHTML=`<a href="perfil.html?cambiar_perfil=1" data-nexus-demo-profile-link title="Cambiar perfil de prueba" class="nexus-demo-sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition">
  <span class="nexus-demo-sidebar-icon" aria-hidden="true"><span></span></span>
  <span class="skilled-sidebar-label nexus-demo-sidebar-copy"><strong>Cambiar perfil</strong><small>${labelFor(role)}</small></span>
 </a>`;
 li.insertAdjacentElement('afterend',shortcut);
 return true;
}
function mount(session){
 if(!isTestProfile(session))return;
 currentSession=session;
 mountSidebarShortcut(session);
 mountProfileCard(session);
}
function retryMount(session,attempt=0){
 mount(session);
 if(attempt>=24)return;
 const sidebarReady=Boolean(document.getElementById('skilled-sidebar'));
 const profileReady=!isProfilePage()||Boolean(document.querySelector('.profile-summary'));
 if(sidebarReady&&profileReady)return;
 setTimeout(()=>retryMount(session,attempt+1),120);
}
function sessionReady(session){
 if(!isTestProfile(session))return;
 currentSession=session;
 retryMount(session);
}
window.addEventListener('skilled:sessionready',e=>sessionReady(e.detail||window.SkilledSession));
window.addEventListener('skilled:profileloaded',()=>sessionReady(window.SkilledSession));
window.addEventListener('skilled:sidebarstate',()=>{if(currentSession)mountSidebarShortcut(currentSession);});
window.addEventListener('skilled:profileupdated',()=>{if(currentSession)mountProfileCard(currentSession);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>sessionReady(window.SkilledSession),80),{once:true});else setTimeout(()=>sessionReady(window.SkilledSession),80);
})();
