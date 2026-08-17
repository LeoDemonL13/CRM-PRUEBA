(function(){
'use strict';
const root=document.documentElement;
const BASE_KEY='skilled_ui_preferences_v2';
const COMPANY={mode:'empresa',base:'oscuro',primary:'#00416B',primaryBright:'#0B6EA8',accent:'#EA0029',background:'#060814',surface:'#090D1A',surface2:'#10172A',border:'#1E2B44',text:'#E7EDF6',muted:'#94A3B8',sidebarBackground:'#080D19',sidebarSurface:'#10192A',sidebarText:'#A8B4C6',sidebarMuted:'#667892',sidebarActive:'#12304D',sidebarActiveText:'#FFFFFF',sidebarBrandBackground:'#080D19',sidebarDivider:'#1E2B44',topbarBackground:'#090D1A',topbarBorder:'#161F38',buttonPrimary:'#0878B6',buttonPrimaryText:'#FFFFFF',buttonSecondary:'#10182A',buttonSecondaryText:'#D8E3F2',success:'#34D399',warning:'#FBBF24',danger:'#FB7185',heroBackground:'#08111F',heroBorder:'#1B2642',heroTitle:'#E8EEF8',heroSubtitle:'#9EB0C8',heroKicker:'#7DB9EE',heroIconBackground:'#0B1A30',heroIconBorder:'#24466E',heroIconText:'#6DB7FF'};
const LIGHT={mode:'claro',base:'claro',primary:'#00416B',primaryBright:'#0B6EA8',accent:'#EA0029',background:'#F2F5F9',surface:'#FFFFFF',surface2:'#F6F8FB',border:'#D7E0EB',text:'#0F172A',muted:'#64748B',sidebarBackground:'#FFFFFF',sidebarSurface:'#F1F5F9',sidebarText:'#334155',sidebarMuted:'#64748B',sidebarActive:'#E6F2FA',sidebarActiveText:'#0B4F78',sidebarBrandBackground:'#FFFFFF',sidebarDivider:'#D7E0EB',topbarBackground:'#FFFFFF',topbarBorder:'#DCE4EE',buttonPrimary:'#0878B6',buttonPrimaryText:'#FFFFFF',buttonSecondary:'#F1F5F9',buttonSecondaryText:'#1E293B',success:'#059669',warning:'#D97706',danger:'#E11D48',heroBackground:'#FFFFFF',heroBorder:'#D7E1EE',heroTitle:'#0F172A',heroSubtitle:'#64748B',heroKicker:'#0B6EA8',heroIconBackground:'#F1F5F9',heroIconBorder:'#BFDBFE',heroIconText:'#0B4F78'};
const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toUpperCase():'';
const cleanMode=v=>['empresa','claro','personalizado'].includes(String(v||'').toLowerCase())?String(v).toLowerCase():'empresa';
const cleanBase=v=>String(v||'').toLowerCase()==='claro'?'claro':'oscuro';
const keys=['primary','primaryBright','accent','background','surface','surface2','border','text','muted','sidebarBackground','sidebarSurface','sidebarText','sidebarMuted','sidebarActive','sidebarActiveText','sidebarBrandBackground','sidebarDivider','topbarBackground','topbarBorder','buttonPrimary','buttonPrimaryText','buttonSecondary','buttonSecondaryText','success','warning','danger','heroBackground','heroBorder','heroTitle','heroSubtitle','heroKicker','heroIconBackground','heroIconBorder','heroIconText'];
function cachedUserId(){try{return String(JSON.parse(localStorage.getItem('skilled_profile_cache')||'{}')?.id||'').trim()}catch(_){return''}}
function storageKey(userId=''){const id=String(userId||cachedUserId()||'local').replace(/[^a-z0-9_-]/gi,'_');return `${BASE_KEY}_${id}`}
function legacyStorageKey(userId=''){const id=String(userId||cachedUserId()||'local').replace(/[^a-z0-9_-]/gi,'_');return `skilled_ui_preferences_v1_${id}`}
function sanitize(input={}){
 const mode=cleanMode(input.mode);if(mode==='empresa')return{...COMPANY};if(mode==='claro')return{...LIGHT};
 const base=cleanBase(input.base),seed=base==='claro'?LIGHT:COMPANY,result={mode:'personalizado',base};
 keys.forEach(key=>result[key]=color(input[key])||seed[key]);
 return result;
}
function readLocal(){try{const raw=localStorage.getItem(storageKey())||localStorage.getItem(legacyStorageKey());if(raw)return sanitize(JSON.parse(raw));const legacy=Object.keys(localStorage).find(k=>k.startsWith('skilled_tema_')&&localStorage.getItem(k)==='claro');return legacy?{...LIGHT}:{...COMPANY}}catch(_){return{...COMPANY}}}
let current=readLocal();
function hexRgb(hex){const h=(color(hex)||'#00416B').slice(1);return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`}
function hexAlpha(hex,a){return `rgba(${hexRgb(hex)},${a})`}
function setCss(pref){
 const light=pref.mode==='claro'||(pref.mode==='personalizado'&&pref.base==='claro');
 const vars={
 '--crm-user-primary':pref.primary,'--crm-user-primary-bright':pref.primaryBright,'--crm-user-accent':pref.accent,'--crm-user-bg':pref.background,'--crm-user-surface':pref.surface,'--crm-user-surface-2':pref.surface2,'--crm-user-border':pref.border,'--crm-user-text':pref.text,'--crm-user-muted':pref.muted,
 '--crm-user-sidebar-bg':pref.sidebarBackground,'--crm-user-sidebar-surface':pref.sidebarSurface,'--crm-user-sidebar-text':pref.sidebarText,'--crm-user-sidebar-muted':pref.sidebarMuted,'--crm-user-sidebar-active':pref.sidebarActive,'--crm-user-sidebar-active-text':pref.sidebarActiveText,'--crm-user-sidebar-brand-bg':pref.sidebarBrandBackground,'--crm-user-sidebar-divider':pref.sidebarDivider,
 '--crm-user-topbar-bg':pref.topbarBackground,'--crm-user-topbar-border':pref.topbarBorder,
 '--crm-user-button-primary':pref.buttonPrimary,'--crm-user-button-primary-text':pref.buttonPrimaryText,'--crm-user-button-secondary':pref.buttonSecondary,'--crm-user-button-secondary-text':pref.buttonSecondaryText,
 '--crm-user-success':pref.success,'--crm-user-warning':pref.warning,'--crm-user-danger':pref.danger,
 '--crm-user-hero-bg':pref.heroBackground,'--crm-user-hero-border':pref.heroBorder,'--crm-user-hero-title':pref.heroTitle,'--crm-user-hero-subtitle':pref.heroSubtitle,'--crm-user-hero-kicker':pref.heroKicker,'--crm-user-hero-icon-bg':pref.heroIconBackground,'--crm-user-hero-icon-border':pref.heroIconBorder,'--crm-user-hero-icon-text':pref.heroIconText,
 '--area-accent':pref.primaryBright,'--area-accent-rgb':hexRgb(pref.primaryBright),'--area-soft':hexAlpha(pref.primaryBright,.11),'--area-border':hexAlpha(pref.primaryBright,.28)
 };
 Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
 root.dataset.skilledUiMode=pref.mode;root.dataset.crmTheme=light?'claro':'oscuro';root.classList.toggle('tema-claro',light);root.style.colorScheme=light?'light':'dark';root.style.backgroundColor=pref.background;
 if(document.body){document.body.dataset.crmInternal='1';document.body.classList.toggle('tema-claro',light);document.body.style.backgroundColor=pref.background;document.body.style.color=pref.text}
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=pref.topbarBackground||pref.background;
 return light;
}
function apply(input,{persist=false,userId=''}={}){current=sanitize(input);setCss(current);if(persist){try{localStorage.setItem(storageKey(userId),JSON.stringify(current))}catch(_){}}window.dispatchEvent(new CustomEvent('skilled:themechange',{detail:{theme:isLight()?'claro':'oscuro',preferences:{...current}}}));return{...current}}
function isLight(){return current.mode==='claro'||(current.mode==='personalizado'&&current.base==='claro')}
async function save(input){const next=apply(input,{persist:true});try{if(window.SkilledDB?.saveUiPreferences){await window.SkilledDB.saveUiPreferences(next);const id=cachedUserId();if(id)localStorage.setItem(storageKey(id),JSON.stringify(next))}}catch(error){console.warn('No se pudieron sincronizar las preferencias visuales.',error)}return next}
function toggleLight(force){const target=typeof force==='boolean'?force:!isLight();if(current.mode==='personalizado')return save({...current,base:target?'claro':'oscuro'});return save(target?{...LIGHT}:{...COMPANY})}
async function syncRemote(){try{if(!window.SkilledDB?.getMyProfile)return false;const profile=await window.SkilledDB.getMyProfile();if(profile?.id){try{localStorage.setItem('skilled_profile_cache',JSON.stringify({...JSON.parse(localStorage.getItem('skilled_profile_cache')||'{}'),...profile}))}catch(_){}}const remote=profile?.uiPreferences;if(remote&&typeof remote==='object'&&Object.keys(remote).length){apply(remote,{persist:true,userId:profile.id});return true}if(profile?.id){try{const key=storageKey(profile.id),raw=localStorage.getItem(key)||localStorage.getItem(legacyStorageKey(profile.id));if(raw){apply(JSON.parse(raw),{persist:true,userId:profile.id});return true}apply({...COMPANY},{persist:true,userId:profile.id})}catch(_){apply({...COMPANY})}}return false}catch(_){return false}}
window.SkilledTheme={company:{...COMPANY},light:{...LIGHT},keys:[...keys],get:()=>({...current}),apply,applyStored:()=>apply(readLocal()),save,toggleLight,isLight,syncRemote,reset:()=>save({...COMPANY})};
window.SkilledThemeKey=storageKey();
setCss(current);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setCss(current);let tries=0;const timer=setInterval(()=>{tries++;if(window.SkilledDB){clearInterval(timer);syncRemote()}else if(tries>30)clearInterval(timer)},150)},{once:true});else{setCss(current);setTimeout(syncRemote,0)}
})();
