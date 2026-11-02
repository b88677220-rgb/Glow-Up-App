import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
const handlers = new Map();
const openedCaches = [];
const precached = [];
const shell = new Response('<!doctype html><title>GLOW UP</title>', {
  headers: { 'content-type': 'text/html' }
});
const cache = {
  addAll: async files => { precached.push(...files); },
  put: async () => {},
  match: async request => request === 'https://example.test/Glow-up/index.html' ? shell : undefined
};
const sandbox = {
  URL,
  Response,
  self: {
    addEventListener: (type, callback) => handlers.set(type, callback),
    registration: { scope: 'https://example.test/Glow-up/' },
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  },
  caches: {
    open: async name => { openedCaches.push(name); return cache; },
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined
  },
  fetch: async () => { throw new TypeError('offline'); }
};
vm.runInNewContext(source, sandbox, { filename: 'sw.js' });

let installPromise;
handlers.get('install')({ waitUntil: promise => { installPromise = promise; } });
await installPromise;
assert.deepEqual(openedCaches, ['glowup-2026-v30'], 'the new service-worker cache version is activated');
assert.ok(precached.includes('https://example.test/Glow-up/app-core.js'), 'the app core helper is precached below the repository subpath');
assert.ok(precached.includes('https://example.test/Glow-up/ai-client.js'), 'the AI client helper is precached below the repository subpath');

let navigationResponse;
handlers.get('fetch')({
  request: { mode: 'navigate', url: 'https://example.test/Glow-up/' },
  respondWith: promise => { navigationResponse = promise; }
});
const response = await navigationResponse;
assert.equal(await response.text(), '<!doctype html><title>GLOW UP</title>', 'offline navigation falls back to the cached app shell');

console.log('Service worker QA passed: cache version, helper precache, offline app-shell fallback.');
