(function(){
'use strict';
const key='skilled_sky_demo_tools_v82',legacyKey='skilled_sky_demo_tools_v81';
const defaults=[
{name:'Java',category:'Lenguaje',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',description:'Lógica estructurada y crecimiento de servicios cuando se requieran procesos adicionales.'},
{name:'JavaScript',category:'Lenguaje',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',description:'Interfaz, validaciones, buscadores, Skill y conexión del frontend con Supabase.'},
{name:'TypeScript',category:'Lenguaje',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',description:'Funciones de servidor y procesos controlados en Supabase Edge Functions.'},
{name:'SQL / PostgreSQL',category:'Base de datos',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',description:'Consultas, vistas, funciones RPC, permisos y reglas de trazabilidad del CRM.'},
{name:'HTML5',category:'Estructura',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg',description:'Pantallas, formularios, tarjetas y navegación por perfil.'},
{name:'CSS3',category:'Diseño',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg',description:'Diseño corporativo, temas, responsividad y experiencia visual.'},
{name:'PowerShell .ps1',category:'Automatización',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/powershell/powershell-original.svg',description:'Configuración y tareas de Windows para publicación, impresión y preparación del entorno.'},
{name:'Python',category:'Checador',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',description:'Aplicación local del checador, almacenamiento, huella y sincronización en Raspberry Pi.'},
{name:'C++ / PlatformIO',category:'Checador',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',description:'Firmware de apoyo para ESP32 y periféricos del checador físico.'},
{name:'OpenSCAD',category:'Diseño 3D',image:'',description:'Diseño paramétrico de la carcasa del checador.'},
{name:'Supabase',category:'Nube y datos',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg',description:'Autenticación, PostgreSQL, funciones, permisos y sincronización centralizada.'},
{name:'Visual Studio',category:'Desarrollo',image:'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/visualstudio/visualstudio-plain.svg',description:'Entorno de trabajo para organizar, revisar y mejorar el código del CRM.'}
];
function read(){try{const raw=localStorage.getItem(key)||localStorage.getItem(legacyKey)||'null',rows=JSON.parse(raw);if(Array.isArray(rows)&&rows.length){if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(rows));return rows}return defaults.slice()}catch(_){return defaults.slice()}}
function save(rows){try{localStorage.setItem(key,JSON.stringify(rows));window.dispatchEvent(new CustomEvent('skilled:skytools',{detail:{rows}}))}catch(_){}}
function html(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function render(){const grid=document.getElementById('sky-tools-grid'),empty=document.getElementById('sky-tools-empty');if(!grid)return;const rows=read();grid.innerHTML=rows.map((item,index)=>`<article class="sky-tool-card"><button type="button" data-remove-tool="${index}">Borrar</button>${item.image?`<img src="${html(item.image)}" alt="${html(item.name)}" loading="lazy" onerror="this.style.display='none'">`:''}<span>${html(item.category||'Herramienta')}</span><strong>${html(item.name||'Sin nombre')}</strong><p>${html(item.description||'Sin descripción')}</p></article>`).join('');if(empty)empty.style.display=rows.length?'none':'block';grid.querySelectorAll('[data-remove-tool]').forEach(button=>button.addEventListener('click',()=>{const next=read();next.splice(Number(button.dataset.removeTool),1);save(next);render()}));}
function add(){const name=document.getElementById('tool-name'),category=document.getElementById('tool-category'),image=document.getElementById('tool-image'),description=document.getElementById('tool-description');const item={name:name?.value.trim()||'',category:category?.value.trim()||'Herramienta',image:image?.value.trim()||'',description:description?.value.trim()||''};if(!item.name)return;const rows=read();rows.push(item);save(rows);[name,category,image,description].forEach(node=>{if(node)node.value=''});render();}
function expose(){window.SkyDemoTools={list:read,save,reset:()=>{save(defaults.slice());render()},storageKey:key};}
function openSky(question=''){if(window.SkilledSky){window.SkilledSky.open();if(question)setTimeout(()=>window.SkilledSky.query(question),130);return}if(typeof window.SkilledOpenSky==='function'){window.SkilledOpenSky(question)}}
let ready=false;window.addEventListener('skilled:skyready',()=>{ready=true},{once:true});
window.addEventListener('DOMContentLoaded',()=>{expose();render();document.getElementById('tool-add')?.addEventListener('click',add);document.getElementById('sky-demo-open')?.addEventListener('click',()=>openSky());document.querySelectorAll('[data-sky-question]').forEach(button=>button.addEventListener('click',()=>openSky(button.dataset.skyQuestion||'')));document.querySelectorAll('#tool-name,#tool-category,#tool-image,#tool-description').forEach(node=>node.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();add()}}));});
let demoLoadPromise=null;
function timeout(value,ms=7000){return Promise.race([Promise.resolve(value),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tiempo de espera agotado.')),ms))])}
async function loadDemo(){
 if(demoLoadPromise)return demoLoadPromise;
 const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=Number.isFinite(value)?String(value):'—'};
 const jobs=[
  ['demo-materiales',()=>SkilledDB.listExecutiveSkyMaterials?.(),value=>Array.isArray(value)?value.length:NaN],
  ['demo-proyectos',()=>SkilledDB.getExecutiveProjectSummary?.(),value=>Array.isArray(value)?value.length:NaN],
  ['demo-personal',()=>SkilledDB.listExecutiveSkyPeople?.(),value=>Array.isArray(value)?value.length:NaN],
  ['demo-compras',()=>SkilledDB.getExecutiveSkyPurchasing?.(),value=>value&&typeof value==='object'?((value.solicitudes||[]).length+(value.cotizaciones||[]).length):NaN],
  ['demo-vehiculos',()=>SkilledDB.listExecutiveVehicles?.(),value=>Array.isArray(value)?value.length:NaN]
 ];
 demoLoadPromise=(async()=>{for(const [id,run,count] of jobs){try{const value=await timeout(run(),7000);set(id,count(value))}catch(_){set(id,NaN)}await new Promise(resolve=>setTimeout(resolve,80))}})().finally(()=>{demoLoadPromise=null});
 return demoLoadPromise;
}
function scheduleDemoLoad(){const run=()=>loadDemo();if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:4500});else setTimeout(run,1800)}
window.addEventListener('skilled:sessionready',scheduleDemoLoad,{once:true});if(window.SkilledSession)scheduleDemoLoad();
})();
