(function (root) {
  'use strict';

  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => {
    if (Array.isArray(value)) return value.map(clone);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  };
  const ARRAY_FIELDS = ['sessions', 'meals', 'mealHistory', 'checks', 'savedRecipes', 'shop', 'pantryItems', 'activities'];
  const OBJECT_FIELDS = ['waterDays', 'trainingDaySlots', 'nutritionGoals', 'exerciseLibraryPrefs'];

  function shapeError(profile) {
    if (!isRecord(profile)) return 'Das gespeicherte Profil ist kein JSON-Objekt.';
    for (const key of ARRAY_FIELDS) {
      if (Object.hasOwn(profile, key) && !Array.isArray(profile[key])) return `Das gespeicherte Feld ${key} hat ein ungültiges Format.`;
    }
    for (const key of OBJECT_FIELDS) {
      if (Object.hasOwn(profile, key) && !isRecord(profile[key])) return `Das gespeicherte Feld ${key} hat ein ungültiges Format.`;
    }
    return null;
  }

  function mergeDefaults(defaults, profile) {
    const base = isRecord(defaults) ? defaults : {};
    const result = { ...clone(base), ...profile };
    for (const [key, defaultValue] of Object.entries(base)) {
      if (isRecord(defaultValue) && isRecord(result[key])) result[key] = { ...clone(defaultValue), ...result[key] };
    }
    return result;
  }

  function readProfile(storage, key, defaults) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      return { status: 'unavailable', data: clone(defaults), raw: null, error };
    }
    if (raw === null || raw === undefined) return { status: 'empty', data: clone(defaults), raw: null };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { status: 'recovery', data: clone(defaults), raw, error };
    }
    const invalidShape = shapeError(parsed);
    if (invalidShape) return { status: 'recovery', data: clone(defaults), raw, error: new TypeError(invalidShape) };
    return { status: 'ready', data: mergeDefaults(defaults, parsed), raw };
  }

  function writeProfile(storage, key, data) {
    const invalidShape = shapeError(data);
    if (invalidShape) return { ok: false, error: new TypeError(invalidShape) };
    let serialized;
    try {
      serialized = JSON.stringify(data);
      if (typeof serialized !== 'string') throw new TypeError('Profil konnte nicht als JSON gespeichert werden.');
    } catch (error) {
      return { ok: false, error };
    }
    try {
      storage.setItem(key, serialized);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function nullableAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
  }

  function createMeal({ id, text, kcal, protein, date, source, confidence, notes } = {}) {
    const isAI = source === 'ai';
    return {
      id: String(id || `meal_${Date.now()}`),
      n: String(text ?? '').trim(),
      c: nullableAmount(kcal),
      p: nullableAmount(protein),
      date: String(date || localDate()),
      estimate: isAI,
      estimateMethod: isAI ? 'ai' : 'manual',
      confidence: isAI ? String(confidence || 'unknown') : 'manual',
      nutritionNotes: String(notes || '')
    };
  }

  function appendMeal(profile, meal) {
    const current = isRecord(profile) ? profile : {};
    return {
      ...current,
      meals: [...(Array.isArray(current.meals) ? current.meals : []), clone(meal)],
      mealHistory: [...(Array.isArray(current.mealHistory) ? current.mealHistory : []), clone(meal)]
    };
  }

  function appendPendingMeal(profile, pendingMeal) {
    const current = isRecord(profile) ? profile : {};
    if (!pendingMeal) return clone(current);
    const id = String(pendingMeal.id || '');
    const meals = Array.isArray(current.meals) ? current.meals : [];
    const history = Array.isArray(current.mealHistory) ? current.mealHistory : [];
    const alreadyInMeals = !!id && meals.some(meal => meal?.id === id);
    const alreadyInHistory = !!id && history.some(meal => meal?.id === id);
    const copy = clone(pendingMeal);
    return {
      ...current,
      meals: alreadyInMeals ? clone(meals) : [...clone(meals), clone(copy)],
      mealHistory: alreadyInHistory ? clone(history) : [...clone(history), copy]
    };
  }

  function createBackupSnapshot(profile, { storageKey = 'glowup2026-v5', createdAt = new Date().toISOString(), pendingMeal = null } = {}) {
    return {
      format: 'glowup2026-backup',
      schemaVersion: 1,
      createdAt: String(createdAt),
      storageKey: String(storageKey),
      data: appendPendingMeal(profile, pendingMeal)
    };
  }

  function knownAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  function nutrientTotals(meals) {
    let kcal = 0;
    let protein = 0;
    let knownKcal = 0;
    let knownProtein = 0;
    let unknownKcal = 0;
    let unknownProtein = 0;
    for (const meal of Array.isArray(meals) ? meals : []) {
      const calories = knownAmount(meal?.c);
      const grams = knownAmount(meal?.p);
      if (calories === null) unknownKcal++;
      else { kcal += calories; knownKcal++; }
      if (grams === null) unknownProtein++;
      else { protein += grams; knownProtein++; }
    }
    return {
      kcal: knownKcal ? kcal : null,
      protein: knownProtein ? protein : null,
      unknownKcal,
      unknownProtein
    };
  }

  root.GlowUpCore = Object.freeze({ readProfile, writeProfile, createMeal, appendMeal, appendPendingMeal, createBackupSnapshot, nutrientTotals });
})(globalThis);
