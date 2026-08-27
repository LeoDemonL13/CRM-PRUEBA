'use strict';
const RELEASE='146';
self.addEventListener('install',()=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('skilled-crm-')).map(key=>caches.delete(key)))}catch(_){}try{await self.registration.unregister()}catch(_){}try{await self.clients.claim()}catch(_){}})())});
