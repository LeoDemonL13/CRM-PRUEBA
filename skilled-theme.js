(function(){
'use strict';
const root=document.documentElement;
const BASE_KEY='skilled_ui_preferences_v1';
const COMPANY={mode:'empresa',base:'oscuro',primary:'#00416B',primaryBright:'#0B6EA8',accent:'#EA0029',background:'#060814',surface:'#090D1A',surface2:'#10172A',border:'#1E2B44',text:'#E7EDF6',muted:'#94A3B8'};
const LIGHT={mode:'claro',base:'claro',primary:'#00416B',primaryBright:'#0B6EA8',accent:'#EA0029',background:'#F2F5F9',surface:'#FFFFFF',surface2:'#F6F8FB',border:'#D7E0EB',text:'#0F172A',muted:'#64748B'};
const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toUpperCase():'';
const cleanMode=v=>['empresa','claro','personalizado'].includes(String(v||'').toLowerCase())?String(v).toLowerCase():'empresa';
const cleanBase=v=>String(v||'').toLowerCase()==='claro'?'claro':'oscuro';
function cachedUserId(){try{return String(JSON.parse(localStorage.getItem('skilled_profile_cache')||'{}')?.id||'').trim()}catch(_){return''}}
function storageKey(userId=''){const id=String(userId||cachedUserId()||'local').replace(/[^a-z0-9_-]/gi,'_');return `${BASE_KEY}_${id}`}
function sanitize(input={}){
 const mode=cleanMode(input.mode);if(mode==='empresa')return{...COMPANY};if(mode==='claro')return{...LIGHT};
 const base=cleanBase(input.base);const seed=base==='claro'?LIGHT:COMPANY;
 return{mode:'personalizado',base,primary:color(input.primary)||seed.primary,primaryBright:color(input.primaryBright)||color(input.primary)||seed.primaryBright,accent:color(input.accent)||seed.accent,background:color(input.background)||seed.background,surface:color(input.surface)||seed.surface,surface2:color(input.surface2)||color(input.surface)||seed.surface2,border:color(input.border)||seed.border,text:color(input.text)||seed.text,muted:color(input.muted)||seed.muted};
}
function readLocal(){try{const raw=localStorage.getItem(storageKey());if(raw)return sanitize(JSON.parse(raw));const legacy=Object.keys(localStorage).find(k=>k.startsWith('skilled_tema_')&&localStorage.getItem(k)==='claro');return legacy?{...LIGHT}:{...COMPANY}}catch(_){return{...COMPANY}}}
let current=readLocal();
function setCss(pref){
 const light=pref.mode==='claro'||(pref.mode==='personalizado'&&pref.base==='claro');
 const vars={'--crm-user-primary':pref.primary,'--crm-user-primary-bright':pref.primaryBright,'--crm-user-accent':pref.accent,'--crm-user-bg':pref.background,'--crm-user-surface':pref.surface,'--crm-user-surface-2':pref.surface2,'--crm-user-border':pref.border,'--crm-user-text':pref.text,'--crm-user-muted':pref.muted,'--area-accent':pref.primaryBright,'--area-accent-rgb':hexRgb(pref.primaryBright),'--area-soft':hexAlpha(pref.primaryBright,.11),'--area-border':hexAlpha(pref.primaryBright,.28)};
 Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
 root.dataset.skilledUiMode=pref.mode;root.dataset.crmTheme=light?'claro':'oscuro';root.classList.toggle('tema-claro',light);root.style.colorScheme=light?'light':'dark';root.style.backgroundColor=pref.background;
 if(document.body){document.body.dataset.crmInternal='1';document.body.classList.toggle('tema-claro',light);document.body.style.backgroundColor=pref.background;document.body.style.color=pref.text}
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=pref.background;
 return light;
}
function hexRgb(hex){const h=(color(hex)||'#00416B').slice(1);return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`}
function hexAlpha(hex,a){return `rgba(${hexRgb(hex)},${a})`}
function apply(input,{persist=false,userId=''}={}){current=sanitize(input);setCss(current);if(persist){try{localStorage.setItem(storageKey(userId),JSON.stringify(current))}catch(_){}}window.dispatchEvent(new CustomEvent('skilled:themechange',{detail:{theme:isLight()?'claro':'oscuro',preferences:{...current}}}));return{...current}}
function isLight(){return current.mode==='claro'||(current.mode==='personalizado'&&current.base==='claro')}
async function save(input){const next=apply(input,{persist:true});try{if(window.SkilledDB?.saveUiPreferences){await window.SkilledDB.saveUiPreferences(next);const id=cachedUserId();if(id)localStorage.setItem(storageKey(id),JSON.stringify(next))}}catch(error){console.warn('No se pudieron sincronizar las preferencias visuales.',error)}return next}
function toggleLight(force){const target=typeof force==='boolean'?force:!isLight();if(current.mode==='personalizado')return save({...current,base:target?'claro':'oscuro'});return save(target?{...LIGHT}:{...COMPANY})}
async function syncRemote(){
 try{if(!window.SkilledDB?.getMyProfile)return false;const profile=await window.SkilledDB.getMyProfile();if(profile?.id){try{localStorage.setItem('skilled_profile_cache',JSON.stringify({...JSON.parse(localStorage.getItem('skilled_profile_cache')||'{}'),...profile}))}catch(_){}}
 const remote=profile?.uiPreferences;if(remote&&typeof remote==='object'&&Object.keys(remote).length){apply(remote,{persist:true,userId:profile.id});return true}
 if(profile?.id){try{const key=storageKey(profile.id),raw=localStorage.getItem(key);if(raw){apply(JSON.parse(raw),{persist:true,userId:profile.id});return true}apply({...COMPANY},{persist:true,userId:profile.id})}catch(_){apply({...COMPANY})}}
 return false
 }catch(_){return false}
}
window.SkilledTheme={company:{...COMPANY},light:{...LIGHT},get:()=>({...current}),apply,applyStored:()=>apply(readLocal()),save,toggleLight,isLight,syncRemote,reset:()=>save({...COMPANY})};
window.SkilledThemeKey=storageKey();
setCss(current);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setCss(current);let tries=0;const timer=setInterval(()=>{tries++;if(window.SkilledDB){clearInterval(timer);syncRemote()}else if(tries>30)clearInterval(timer)},150)},{once:true});else{setCss(current);setTimeout(syncRemote,0)}
})();
