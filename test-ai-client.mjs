import assert from 'node:assert/strict';

let client = globalThis.GlowUpAIClient;
if (!client) {
  try { await import('./ai-client.js'); }
  catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  client = globalThis.GlowUpAIClient;
}
assert.ok(client, 'GlowUpAIClient.request must be available');

const result = { answer: 'Trainiere regelmäßig und plane Erholung ein.' };
const usage = { input_tokens: 31, output_tokens: 19 };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

let calls = 0;
let sent = null;
let capturedSignal = null;
const usageEvents = [];
const success = await client.request({
  endpoint: 'https://worker.example/',
  action: 'coach',
  payload: { message: 'Wie trainiere ich?' },
  timeoutMs: 5,
  fetchImpl: async (url, options) => {
    calls++;
    sent = { url, options };
    capturedSignal = options.signal;
    return jsonResponse({ result, usage });
  },
  onUsage: value => usageEvents.push(value)
});
assert.deepEqual(success, { result, usageWarning: null }, 'valid results survive usage recording');
assert.equal(calls, 1, 'success makes exactly one request');
assert.equal(sent.url, 'https://worker.example/api/ai', 'API path is joined to the endpoint');
assert.deepEqual(JSON.parse(sent.options.body), { action: 'coach', payload: { message: 'Wie trainiere ich?' } });
assert.deepEqual(usageEvents, [usage], 'provider usage is recorded once');
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(capturedSignal.aborted, false, 'completed requests clear the timeout before it can abort');

const usageOrder = [];
let typedError;
await assert.rejects(client.request({
  endpoint: 'https://worker.example',
  action: 'recipe',
  payload: { recipeCount: 3 },
  fetchImpl: async () => jsonResponse({ error: 'Die Antwort war unvollständig.', code: 'AI_OUTPUT_INCOMPLETE', usage }, 502),
  onUsage: value => { usageOrder.push(['usage', value]); }
}), error => {
  typedError = error;
  usageOrder.push(['error', error.code]);
  return error.code === 'AI_OUTPUT_INCOMPLETE' && error.status === 502 && error.message === 'Die Antwort war unvollständig.';
}, 'Worker error code, status and German message are preserved');
assert.equal(typedError.usageWarning, null);
assert.deepEqual(usageOrder, [['usage', usage], ['error', 'AI_OUTPUT_INCOMPLETE']], 'usage callback runs before surfacing the response error');

const meterFailure = await client.request({
  endpoint: 'https://worker.example',
  action: 'meal',
  payload: { text: 'Suppe' },
  fetchImpl: async () => jsonResponse({ result: { kcal: 250 }, usage }),
  onUsage: () => { throw new Error('local storage full'); }
});
assert.deepEqual(meterFailure.result, { kcal: 250 }, 'usage meter failure does not discard a valid result');
assert.match(meterFailure.usageWarning, /Verbrauch.*nicht aktualisiert/i, 'usage meter failure is reported to the UI');

let usageCalls = 0;
await client.request({
  endpoint: 'https://worker.example',
  action: 'coach',
  payload: {},
  fetchImpl: async () => jsonResponse({ result }),
  onUsage: () => { usageCalls++; }
});
assert.equal(usageCalls, 0, 'missing provider usage never increments local usage');

let malformedCalls = 0;
await assert.rejects(client.request({
  endpoint: 'https://worker.example',
  action: 'meal',
  payload: {},
  fetchImpl: async () => { malformedCalls++; return new Response('not json', { status: 200 }); }
}), error => error.code === 'AI_INVALID_JSON' && error.status === 502, 'non-JSON response has a typed safe error');
assert.equal(malformedCalls, 1, 'invalid response does not trigger a retry');

let networkCalls = 0;
await assert.rejects(client.request({
  endpoint: 'https://worker.example',
  action: 'coach',
  payload: {},
  fetchImpl: async () => { networkCalls++; throw new TypeError('network unavailable'); }
}), error => error.code === 'AI_PROVIDER_UNAVAILABLE' && error.status === 0, 'network failure is normalized');
assert.equal(networkCalls, 1, 'network failure makes no automatic retry');

let timeoutCalls = 0;
await assert.rejects(client.request({
  endpoint: 'https://worker.example',
  action: 'coach',
  payload: {},
  timeoutMs: 5,
  fetchImpl: async (_url, options) => {
    timeoutCalls++;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    });
  }
}), error => error.code === 'AI_TIMEOUT' && error.status === 504, 'timeout abort is reported with a retryable typed error');
assert.equal(timeoutCalls, 1, 'timeout does not retry the paid request');

let failedUsageWarning;
await assert.rejects(client.request({
  endpoint: 'https://worker.example',
  action: 'coach',
  payload: {},
  fetchImpl: async () => jsonResponse({ error: 'KI-Limit erreicht.', code: 'AI_RATE_LIMITED', usage }, 429),
  onUsage: () => { throw new Error('meter error'); }
}), error => {
  failedUsageWarning = error.usageWarning;
  return error.code === 'AI_RATE_LIMITED' && error.status === 429;
}, 'meter failure does not mask the Worker error');
assert.match(failedUsageWarning, /Verbrauch.*nicht aktualisiert/i);

console.log('AI client QA passed: one request, usage ordering, typed errors, malformed/network/timeout handling, non-blocking usage meter.');
