'use strict';
const RELEASE='68';
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('skilled-crm-')).map(key=>caches.delete(key)))}catch(_){}await self.clients.claim()})())});
