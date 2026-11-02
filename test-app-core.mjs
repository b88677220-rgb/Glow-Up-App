import assert from 'node:assert/strict';

let core = globalThis.GlowUpCore;
if (!core) {
  try { await import('./app-core.js'); }
  catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  core = globalThis.GlowUpCore;
}
assert.ok(core, 'GlowUpCore must be available for profile and meal persistence');

const KEY = 'glowup2026-v5';
const defaults = {
  sessions: [], meals: [], mealHistory: [], waterDays: {}, checks: [], week: 1,
  challengeVisible: true, savedRecipes: [], shop: [], pantryItems: [], activities: [],
  trainingDaySlots: {}, nutritionGoals: { kcal: 2550, protein: 170 },
  exerciseLibraryPrefs: { favoriteIds: [], recent: [], customExercises: [] }
};
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes++; values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    get writes() { return writes; },
    values
  };
}

const legacy = {
  sessions: [{ id: 'session-1', status: 'completed', ts: 1793400000000, exercises: [{ name: 'Kniebeuge', sets: 3 }] }],
  checks: [{ id: 'check-1', w: 82.4, z: 91, d: '30.10.2026', ts: 1793400000000 }],
  meals: [{ id: 'meal-old', n: 'Haferflocken', c: 420, p: 24, date: '2026-10-30', estimate: true }],
  mealHistory: [{ id: 'meal-old', n: 'Haferflocken', c: 420, p: 24, date: '2026-10-30', estimate: true }],
  trainingDaySlots: { '2026-10-30': { sessionId: 'session-1', reservedAt: 1793400000000 } },
  futureAppField: { retained: true }
};
const legacyStorage = memoryStorage({ [KEY]: JSON.stringify(legacy) });
let loaded = core.readProfile(legacyStorage, KEY, defaults);
assert.equal(loaded.status, 'ready', 'valid v5 profile loads without migration');
assert.deepEqual(loaded.data.sessions, legacy.sessions, 'existing training records survive');
assert.deepEqual(loaded.data.checks, legacy.checks, 'existing check-ins survive');
assert.deepEqual(loaded.data.futureAppField, { retained: true }, 'unknown profile fields survive');
assert.deepEqual(loaded.data.nutritionGoals, { kcal: 2550, protein: 170 }, 'missing defaults merge in memory');
assert.equal(legacyStorage.writes, 0, 'loading alone never writes a migration');
assert.deepEqual(core.writeProfile(legacyStorage, KEY, loaded.data), { ok: true }, 'valid profile saves');
const reloaded = core.readProfile(legacyStorage, KEY, defaults);
assert.deepEqual(reloaded.data.sessions, legacy.sessions, 'legacy sessions round-trip');
assert.deepEqual(reloaded.data.checks, legacy.checks, 'legacy check-ins round-trip');
assert.deepEqual(reloaded.data.futureAppField, { retained: true }, 'unknown top-level data round-trips');

const minimalStorage = memoryStorage({ [KEY]: JSON.stringify({ week: 4 }) });
const minimal = core.readProfile(minimalStorage, KEY, defaults);
assert.equal(minimal.status, 'ready');
assert.deepEqual(minimal.data.sessions, []);
assert.deepEqual(minimal.data.exerciseLibraryPrefs.favoriteIds, []);
assert.equal(minimalStorage.writes, 0, 'default merging is read-only');

for (const raw of ['{broken JSON', JSON.stringify([]), JSON.stringify({ sessions: {} }), JSON.stringify({ nutritionGoals: [] })]) {
  const storage = memoryStorage({ [KEY]: raw });
  const result = core.readProfile(storage, KEY, defaults);
  assert.equal(result.status, 'recovery', 'malformed or wrong-shaped data enters recovery');
  assert.equal(result.raw, raw, 'recovery returns the original bytes for download');
  assert.equal(storage.getItem(KEY), raw, 'recovery leaves the original storage value untouched');
  assert.equal(storage.writes, 0, 'recovery never auto-writes defaults');
}

const unavailableStorage = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
assert.equal(core.readProfile(unavailableStorage, KEY, defaults).status, 'unavailable', 'storage read errors are reported');

const priorRaw = JSON.stringify({ meals: [{ id: 'prior', n: 'Vorhanden', c: 100, p: 5 }] });
const quotaStorage = {
  value: priorRaw,
  getItem() { return this.value; },
  setItem() { throw Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' }); }
};
const writeCandidate = { ...defaults, meals: [{ id: 'new', n: 'Neue Mahlzeit', c: 200, p: 10 }] };
const writeResult = core.writeProfile(quotaStorage, KEY, writeCandidate);
assert.equal(writeResult.ok, false, 'quota errors are returned as failed writes');
assert.equal(quotaStorage.getItem(KEY), priorRaw, 'failed writes preserve the exact prior bytes');
assert.equal(writeCandidate.meals[0].id, 'new', 'write failure does not mutate the in-memory candidate');

const pendingMeal = core.createMeal({ id: 'pending-meal', text: 'Noch nicht gespeicherte Suppe', kcal: null, protein: 12, date: '2026-11-02', source: 'manual' });
const backupWithPending = core.createBackupSnapshot(JSON.parse(priorRaw), {
  storageKey: KEY,
  createdAt: '2026-11-02T10:00:00.000Z',
  pendingMeal
});
assert.equal(backupWithPending.format, 'glowup2026-backup', 'pending meal export remains a normal restorable backup');
assert.equal(backupWithPending.storageKey, KEY, 'pending meal backup keeps the v5 storage key');
assert.deepEqual(backupWithPending.data.meals.map(meal => meal.id), ['prior', 'pending-meal'], 'backup includes the meal missing from persisted profile');
assert.deepEqual(backupWithPending.data.mealHistory.map(meal => meal.id), ['pending-meal'], 'backup includes pending meal history');
assert.deepEqual(JSON.parse(priorRaw), { meals: [{ id: 'prior', n: 'Vorhanden', c: 100, p: 5 }] }, 'creating a pending-meal backup never mutates the loaded profile');

const retryCandidate = core.appendPendingMeal(JSON.parse(priorRaw), pendingMeal);
const retryAgain = core.appendPendingMeal(retryCandidate, pendingMeal);
assert.deepEqual(retryAgain.meals.map(meal => meal.id), ['prior', 'pending-meal'], 'retry candidate contains the pending meal exactly once');
assert.deepEqual(retryAgain.mealHistory.map(meal => meal.id), ['pending-meal'], 'retry candidate adds pending meal history exactly once');
let retryStorageAvailable = false;
const retryStorage = {
  value: priorRaw,
  getItem() { return this.value; },
  setItem(key, value) {
    if (!retryStorageAvailable) throw Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
    this.value = String(value);
  }
};
assert.equal(core.writeProfile(retryStorage, KEY, retryCandidate).ok, false, 'the first local retry can still fail');
assert.equal(retryStorage.getItem(KEY), priorRaw, 'a failed retry still preserves prior profile bytes');
retryStorageAvailable = true;
assert.equal(core.writeProfile(retryStorage, KEY, core.appendPendingMeal(JSON.parse(retryStorage.getItem(KEY)), pendingMeal)).ok, true, 'retry saves the pending meal when storage recovers');
assert.deepEqual(JSON.parse(retryStorage.getItem(KEY)).meals.map(meal => meal.id), ['prior', 'pending-meal'], 'recovered storage has the pending meal once');

const manualUnknown = core.createMeal({ id: 'manual-1', text: 'Suppe', kcal: null, protein: undefined, date: '2026-11-02', source: 'manual' });
assert.deepEqual(
  { n: manualUnknown.n, c: manualUnknown.c, p: manualUnknown.p, date: manualUnknown.date, estimate: manualUnknown.estimate, estimateMethod: manualUnknown.estimateMethod },
  { n: 'Suppe', c: null, p: null, date: '2026-11-02', estimate: false, estimateMethod: 'manual' },
  'manual unknown nutrients remain null in the existing meal shape'
);
const partialManual = core.createMeal({ id: 'manual-2', text: 'Joghurt', kcal: 160, protein: null, date: '2026-11-02', source: 'manual' });
assert.equal(partialManual.c, 160, 'known calories are retained independently');
assert.equal(partialManual.p, null, 'unknown protein stays null');

const originalProfile = { ...defaults, extension: 'keep', meals: [{ id: 'old', n: 'Alt', c: 50, p: 2 }], mealHistory: [] };
const appended = core.appendMeal(originalProfile, manualUnknown);
assert.equal(originalProfile.meals.length, 1, 'append does not mutate original meals');
assert.equal(originalProfile.mealHistory.length, 0, 'append does not mutate original history');
assert.equal(appended.meals.length, 2);
assert.equal(appended.mealHistory.length, 1);
assert.equal(appended.extension, 'keep', 'append retains unknown profile fields');
assert.deepEqual(appended.meals[1], manualUnknown);

assert.deepEqual(core.nutrientTotals([
  { n: 'Bowl', c: 500, p: 32 },
  { n: 'Unbekannt', c: null, p: null },
  { n: 'Nur kcal', c: 250, p: null }
]), { kcal: 750, protein: 32, unknownKcal: 1, unknownProtein: 2 }, 'unknown values are excluded independently from totals');
assert.deepEqual(core.nutrientTotals([{ c: null, p: null }]), { kcal: null, protein: null, unknownKcal: 1, unknownProtein: 1 }, 'unknown-only totals remain null, not zero');

console.log('App core QA passed: v5 preservation, recovery, safe writes, manual meals, immutable append, nullable nutrition totals.');
