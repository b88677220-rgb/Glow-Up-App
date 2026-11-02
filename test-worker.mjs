import worker from './index.js';
import assert from 'node:assert/strict';

const ORIGIN = 'https://b88677220-rgb.github.io';
const store = new Map();
const kv = {
  async get(key) { return store.get(key) ?? null; },
  async put(key, value) { store.set(key, String(value)); }
};
const env = {
  ALLOWED_ORIGIN: ORIGIN,
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'gpt-6-luna',
  RATE_LIMIT_KV: kv
};
const makeReq = (body, ip = '203.0.113.7', origin = ORIGIN) => new Request('https://worker.example/api/ai', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});
const responseData = ({ status = 'completed', result, rawText, refusal, usage = { input_tokens: 123, output_tokens: 45 } } = {}) => ({
  id: 'resp_test',
  object: 'response',
  status,
  incomplete_details: status === 'incomplete' ? { reason: 'max_output_tokens' } : null,
  output: [{
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: refusal
      ? [{ type: 'refusal', refusal }]
      : [{ type: 'output_text', annotations: [], text: rawText ?? JSON.stringify(result) }]
  }],
  usage
});
const mockResponse = (body, httpStatus = 200) => new Response(JSON.stringify(body), {
  status: httpStatus,
  headers: { 'Content-Type': 'application/json' }
});
const validRecipe = (name = 'Linsen-Bowl') => ({
  name,
  servings: 2,
  kcal: 450,
  protein_g: 25,
  nutrition_note: 'Schätzwert',
  ingredients: [{ name: 'Linsen', amount: '150 g', buy: '150 g' }],
  steps: ['Linsen garen und würzen.']
});
const run = (body, options = {}) => worker.fetch(makeReq(body, options.ip, options.origin), options.env || env);
const reset = () => store.clear();

let r = await worker.fetch(new Request('https://worker.example/api/ai', {
  method: 'OPTIONS', headers: { Origin: ORIGIN }
}), env);
assert.equal(r.status, 204, 'allowed preflight');

r = await run({ action: 'health' }, { ip: '203.0.113.1', origin: 'https://evil.example' });
assert.equal(r.status, 403, 'reject foreign origin');

r = await run({ action: 'health' }, { ip: '203.0.113.2', env: { ...env, RATE_LIMIT_KV: null } });
assert.equal(r.status, 429, 'fail closed without KV');
assert.equal((await r.json()).code, 'REQUEST_LIMIT_REACHED', 'local quota has a stable code');

const brokenKV = { async get() { throw new Error('KV unavailable'); }, async put() {} };
r = await run({ action: 'health' }, { ip: '203.0.113.3', env: { ...env, RATE_LIMIT_KV: brokenKV } });
assert.equal(r.status, 429, 'fail closed on KV error');
assert.equal((await r.json()).code, 'REQUEST_LIMIT_REACHED');

let providerCalls = 0;
globalThis.fetch = async () => { providerCalls++; return mockResponse(responseData({ result: { status: 'ok' } })); };
r = await run({ action: 'health' }, { ip: '203.0.113.4' });
assert.equal(r.status, 200, 'health action succeeds');
assert.deepEqual((await r.json()).result, { status: 'ok' });
assert.equal(providerCalls, 0, 'health action does not call the AI provider');

r = await run({ action: 'unknown' }, { ip: '203.0.113.5' });
assert.equal(r.status, 400, 'reject unknown action');
r = await run('{not-json', { ip: '203.0.113.6' });
assert.equal(r.status, 400, 'reject malformed request JSON');
r = await run('x'.repeat(10001), { ip: '203.0.113.8' });
assert.equal(r.status, 413, 'reject oversized request body');

let captured = null;
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(options.body);
  return mockResponse(responseData({ result: {
    needs_clarification: false, question: '', kcal: 650, protein_g: 35, confidence: 'medium', notes: 'Schätzung'
  } }));
};
r = await run({ action: 'meal', payload: { meal: 'Pasta mit Hähnchen' } }, { ip: '203.0.113.9' });
assert.equal(r.status, 200, 'valid meal response');
let data = await r.json();
assert.equal(data.result.kcal, 650);
assert.deepEqual(data.usage, { input_tokens: 123, output_tokens: 45 });
assert.equal(captured.model, 'gpt-6-luna');
assert.equal(captured.store, false);
assert.equal(captured.text.format.type, 'json_object');
const actualInput = captured.input.flatMap(message => message.content || []).map(item => item.text || '').join('\n');
assert.match(actualInput, /json/i, 'the actual API input contains the required JSON instruction');
assert.equal(captured.max_output_tokens, 400, 'meal output uses its bounded action budget');

reset();
globalThis.fetch = async () => mockResponse(responseData({ result: {
  needs_clarification: false, question: '', kcal: null, protein_g: null, confidence: 'low', notes: 'Mengen nicht bekannt'
} }));
r = await run({ action: 'meal', payload: { meal: 'Ein unbekanntes Gericht' } }, { ip: '203.0.113.24' });
assert.equal(r.status, 200, 'valid unknown meal nutrition stays a completed result');
data = await r.json();
assert.equal(data.result.kcal, null, 'unknown calories remain null');
assert.equal(data.result.protein_g, null, 'unknown protein remains null');

reset();
globalThis.fetch = async () => mockResponse(responseData({ result: {
  needs_clarification: false, question: '', kcal: 999999, protein_g: 2, confidence: 'high', notes: ''
} }));
r = await run({ action: 'meal', payload: { meal: 'Test' } }, { ip: '203.0.113.10' });
assert.equal(r.status, 502, 'invalid model meal is rejected');
assert.equal((await r.json()).code, 'AI_INVALID_RESULT');

reset();
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(options.body);
  return mockResponse(responseData({ result: validRecipe() }));
};
r = await run({ action: 'recipe', payload: { recipeCount: 1, pantry: ['Linsen'] } }, { ip: '203.0.113.11' });
assert.equal(r.status, 200, 'completed single-recipe result is accepted');
assert.equal((await r.json()).result.name, 'Linsen-Bowl');
assert.equal(captured.max_output_tokens, 1400, 'single recipe has enough bounded output tokens');

reset();
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(options.body);
  return mockResponse(responseData({ result: { recipes: [validRecipe('A'), validRecipe('B'), validRecipe('C')] } }));
};
r = await run({ action: 'recipe', payload: { recipeCount: 3, pantry: ['Linsen'] } }, { ip: '203.0.113.12' });
assert.equal(r.status, 200, 'completed three-recipe result is accepted');
assert.equal((await r.json()).result.recipes.length, 3);
assert.equal(captured.max_output_tokens, 3200, 'three recipes have a bounded multi-result output budget');
const recipeInput = captured.input.flatMap(message => message.content || []).map(item => item.text || '').join('\n');
assert.match(recipeInput, /genau drei|genau 3/i, 'the actual API input requests exactly three recipes');

reset();
globalThis.fetch = async () => mockResponse(responseData({ result: { recipes: [validRecipe('A')] } }));
r = await run({ action: 'recipe', payload: { recipeCount: 3 } }, { ip: '203.0.113.13' });
assert.equal(r.status, 502, 'wrong recipe count is rejected');
assert.equal((await r.json()).code, 'AI_INVALID_RESULT');

reset();
globalThis.fetch = async () => mockResponse(responseData({ result: {
  name: '', ingredients: [{ name: 9, amount: '1', buy: '' }], steps: ['']
} }));
r = await run({ action: 'recipe', payload: { recipeCount: 1 } }, { ip: '203.0.113.14' });
assert.equal(r.status, 502, 'malformed recipe entries are rejected');
assert.equal((await r.json()).code, 'AI_INVALID_RESULT');

reset();
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(options.body);
  return mockResponse(responseData({ result: { answer: 'Trainiere regelmäßig.' } }));
};
r = await run({ action: 'coach', payload: { message: 'Tipps' } }, { ip: '203.0.113.15' });
assert.equal(r.status, 200);
assert.equal(captured.max_output_tokens, 1000, 'coach output uses its bounded action budget');

reset();
globalThis.fetch = async () => mockResponse(responseData({ status: 'incomplete', rawText: '{"recipes":[{"name":"abgeschnitten', usage: { input_tokens: 90, output_tokens: 1400 } }));
r = await run({ action: 'recipe', payload: { recipeCount: 1 } }, { ip: '203.0.113.16' });
assert.equal(r.status, 502, 'incomplete provider response is not parsed as JSON');
data = await r.json();
assert.equal(data.code, 'AI_OUTPUT_INCOMPLETE');
assert.deepEqual(data.usage, { input_tokens: 90, output_tokens: 1400 });

reset();
globalThis.fetch = async () => mockResponse(responseData({ refusal: 'I cannot help with that.' }));
r = await run({ action: 'coach', payload: { message: 'Tipps' } }, { ip: '203.0.113.17' });
assert.equal(r.status, 422, 'provider refusal is classified');
assert.equal((await r.json()).code, 'AI_REFUSED');

reset();
globalThis.fetch = async () => mockResponse(responseData({ rawText: '{not valid JSON' }));
r = await run({ action: 'meal', payload: { meal: 'Test' } }, { ip: '203.0.113.18' });
assert.equal(r.status, 502, 'malformed provider JSON is classified');
assert.equal((await r.json()).code, 'AI_INVALID_JSON');

reset();
globalThis.fetch = async () => mockResponse({ error: { message: 'private provider detail test-key' }, usage: { input_tokens: 10, output_tokens: 2 } }, 429);
r = await run({ action: 'coach', payload: { message: 'Tipps' } }, { ip: '203.0.113.19' });
assert.equal(r.status, 429, 'provider rate limit preserves its status');
data = await r.json();
assert.equal(data.code, 'AI_RATE_LIMITED');
assert.deepEqual(data.usage, { input_tokens: 10, output_tokens: 2 });
assert.doesNotMatch(data.error, /private provider detail|test-key/, 'provider internals are not returned');

reset();
globalThis.fetch = async () => mockResponse({ error: { message: 'private provider detail' } }, 503);
r = await run({ action: 'coach', payload: { message: 'Tipps' } }, { ip: '203.0.113.20' });
assert.equal(r.status, 502, 'provider outage is surfaced safely');
data = await r.json();
assert.equal(data.code, 'AI_PROVIDER_UNAVAILABLE');
assert.doesNotMatch(data.error, /private provider detail/);

reset();
globalThis.fetch = async () => { const error = new Error('abort'); error.name = 'AbortError'; throw error; };
r = await run({ action: 'coach', payload: { message: 'Tipps' } }, { ip: '203.0.113.21' });
assert.equal(r.status, 504, 'provider timeout has a gateway timeout status');
assert.equal((await r.json()).code, 'AI_TIMEOUT');

reset();
let rateLimitedProviderCalls = 0;
globalThis.fetch = async () => { rateLimitedProviderCalls++; return mockResponse(responseData({ result: { answer: 'Trainiere progressiv.' } })); };
const oneDailyRequest = { ...env, DAILY_REQUEST_LIMIT: '1' };
r = await run({ action: 'coach', payload: { message: 'Eins' } }, { ip: '203.0.113.22', env: oneDailyRequest });
assert.equal(r.status, 200, 'first daily request is allowed');
r = await run({ action: 'coach', payload: { message: 'Zwei' } }, { ip: '203.0.113.22', env: oneDailyRequest });
assert.equal(r.status, 429, 'local daily request limit blocks the next request');
data = await r.json();
assert.equal(data.code, 'REQUEST_LIMIT_REACHED');
assert.equal(rateLimitedProviderCalls, 1, 'local quota blocks the provider call');

reset();
r = await run({ action: 'meal', payload: { meal: 'x'.repeat(3100) } }, { ip: '203.0.113.23' });
assert.equal(r.status, 413, 'action payload limit enforced');

console.log('Worker QA passed: JSON contract, bounded output budgets, recipe counts/schema, incomplete/refusal/provider errors, usage, CORS/KV/rate limits.');
