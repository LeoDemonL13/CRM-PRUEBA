const STATIC_CACHE='skilled-crm-static-v37';
const PAGE_CACHE='skilled-crm-pages-v37';
const CORE=[
 './interfaz.css?v=37',
 './navegacion-suave.js?v=37',
 './skilled-performance.js?v=37',
 './skilled-sidebar.js?v=37',
 './skilled-search.js?v=37',
 './skilled-supabase.js?v=37',
 './skilled-sky.js?v=37',
 './auth-guard.js?v=37',
 './favicon-32x32.png?v=29',
 './favicon-192x192.png?v=29'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(STATIC_CACHE);
  await Promise.all(CORE.map(async url=>{try{const response=await fetch(url,{cache:'reload'});if(response.ok)await cache.put(url,response)}catch(_){}}));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('skilled-crm-')&&!['skilled-crm-static-v37','skilled-crm-pages-v37'].includes(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
function cacheable(response){return response&&(response.ok||response.type==='opaque')}
async function networkFirst(request){
 const cache=await caches.open(PAGE_CACHE);
 try{
  const response=await fetch(request);
  if(cacheable(response))cache.put(request,response.clone()).catch(()=>{});
  return response;
 }catch(error){
  const cached=await cache.match(request,{ignoreSearch:false});
  if(cached)return cached;
  throw error;
 }
}
async function staleWhileRevalidate(request,cacheName=STATIC_CACHE){
 const cache=await caches.open(cacheName);
 const cached=await cache.match(request,{ignoreSearch:false});
 const fresh=fetch(request).then(response=>{if(cacheable(response))cache.put(request,response.clone()).catch(()=>{});return response}).catch(()=>null);
 return cached||await fresh||Response.error();
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(/\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\/|\/realtime\/v1\//.test(url.pathname))return;
 if(request.mode==='navigate'&&url.origin===self.location.origin){event.respondWith(networkFirst(request));return}
 const sameOrigin=url.origin===self.location.origin;
 const staticFile=/\.(?:js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?|xlsx)(?:$|\?)/i.test(url.pathname+url.search);
 const trustedCdn=/^(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/i.test(url.hostname);
 if((sameOrigin&&staticFile)||trustedCdn)event.respondWith(staleWhileRevalidate(request));
});
