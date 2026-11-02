const CACHE='glowup-2026-v30';
const APP_ROOT=new URL('./',self.registration.scope).href;
const APP_SHELL=new URL('index.html',APP_ROOT).href;
const FILES=['','index.html','manifest.json','icon.svg','exercise-library.json','app-core.js','ai-client.js'].map(path=>new URL(path,APP_ROOT).href);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('glowup-2026-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.mode==='navigate'||u.pathname.endsWith('/index.html')){
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(APP_SHELL,copy));}return r}).catch(()=>caches.open(CACHE).then(c=>c.match(APP_SHELL))));
 }else{
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));
 }
});
