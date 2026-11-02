# GLOW UP 2026 Stability Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the reported AI failures, make meal and local-data persistence recoverable, and deliver a tested iPhone-ready GLOW UP package without changing existing user data or external deployments.

**Architecture:** Keep GitHub Pages, the Cloudflare Worker, and the `glowup2026-v5` local profile. Add small dependency-free browser helpers for storage/meal data and AI requests so both can be tested in Node; retain the current single-page UI and update the service worker to cache the helpers.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Cloudflare Workers module, Node.js built-in test/assert APIs; no runtime dependencies or real API calls in tests.

**Spec:** `docs/superpowers/specs/2026-11-02-glowup-stability-design.md`

## Global Constraints

- Keep the storage key exactly `glowup2026-v5`; never clear, rename, or destructively migrate saved data.
- Add no database, account system, framework, or runtime package dependency.
- Preserve CORS allowlisting, `store: false`, server-side API-key use, and fail-closed KV limits.
- Never call the real OpenAI API in tests; never automatically retry a paid request.
- Do not edit Cloudflare secrets/settings, push commits, or deploy GitHub Pages or the Worker.
- Keep the GitHub Pages repository subpath and iPhone PWA installation behavior working.
- Every production behavior change gets a failing test or a recorded failing local browser check before implementation.

## Review Focus

1. A request using `json_object` must put the literal JSON instruction in the actual API input; the test captures the transmitted request body.
2. An incomplete/truncated response must return a typed safe error and usage data, and must not be parsed or saved as a meal.
3. Invalid JSON or a wrong known field type under `glowup2026-v5` must leave the original stored text untouched and enter recovery mode.
4. A quota/security write failure must leave prior persisted bytes intact, mark current state unsaved, and keep meal text available for retry/export.
5. Unknown nutrition values on manual meals must remain unknown through rendering, totals, backup, and restore; they must not become zero.

---

## File Map

- Modify `index.js` — Worker request construction, output budgets, response parsing, validation, and stable errors.
- Modify `test-worker.mjs` — dependency-free Worker regression tests.
- Create `app-core.js` — storage loading/writing, meal creation/append, pending-meal recovery snapshots, and known-nutrient totals.
- Create `test-app-core.mjs` — storage and meal behavior tests using in-memory storage.
- Create `ai-client.js` — bounded browser fetch, typed errors, and usage callback handling.
- Create `test-ai-client.mjs` — mocked-fetch success, error, usage, and timeout tests.
- Modify `index.html` — load helpers, handle storage/AI states, add manual meal fields, show unknown values, and fix accessible navigation/privacy copy.
- Modify `sw.js` — version the cache and include the new same-origin helper files.
- Modify `README_DEPLOYMENT_DE.txt` — align cost/rate/output-limit documentation with the Worker.
- Create `README_IPHONE_DEPLOYMENT_DE.txt` — short backup-first GitHub Pages and optional manual Worker update instructions.
- Modify `package.json` — add a dependency-free `npm test` script after the test files exist.
- Create `docs/superpowers/plans/2026-11-02-glowup-stability.md` — this plan.

## Task 1: Fix and test the Worker JSON contract

**Files:** Modify `test-worker.mjs`, `index.js`.

**Interfaces:**

- Requests stay `{action, payload}`; pantry recipe requests add `payload.recipeCount` with value `1` or `3`.
- Success stays `{result, usage}`. Errors retain the string `error` field and add `code` plus optional `usage`.
- Required codes: `AI_OUTPUT_INCOMPLETE` (502), `AI_REFUSED` (422), `AI_INVALID_JSON` (502), `AI_INVALID_RESULT` (502), `AI_PROVIDER_UNAVAILABLE` (502), `AI_TIMEOUT` (504), `AI_RATE_LIMITED` (429), and `REQUEST_LIMIT_REACHED` (429).

- [x] **Step 1: Add failing Worker tests** for the actual input's JSON keyword, JSON output mode, 1/3 recipe limits (1,400/3,200), completed recipe results, wrong result count, incomplete output with usage, refusal, malformed output, invalid schema, provider rate limit, and local quota code.
- [x] **Step 2: Run `node test-worker.mjs` and verify RED.** Expected failures include the missing JSON keyword and current 650-token recipe cap; existing CORS, KV, health, payload, and IP-limit tests should still pass.
- [x] **Step 3: Implement the Worker contract in `index.js`.** Add the JSON requirement to the actual user message, select the action budget (health remains local with no provider call), inspect response status/refusal before parsing, strengthen recipe count validation, and return safe codes/messages with available usage.
- [x] **Step 4: Run `node test-worker.mjs` and verify GREEN.** Confirm provider errors do not leak raw internals and the Worker still fails closed when KV is missing or unavailable.

## Task 2: Add testable safe storage and meal primitives

**Files:** Create `app-core.js`, `test-app-core.mjs`; later wire these into `index.html` in Task 4.

**Interfaces:**

- `GlowUpCore.readProfile(storage, key, defaults) -> {status, data, raw}` where `status` is `empty`, `ready`, `recovery`, or `unavailable`.
- `GlowUpCore.writeProfile(storage, key, data) -> {ok, error?}`; it never mutates `data` or masks a failed write.
- `GlowUpCore.createMeal({id, text, kcal, protein, date, source, confidence, notes}) -> meal` using existing `n`, `c`, `p`, `date`, `estimate`, `estimateMethod`, `confidence`, and `nutritionNotes` fields. Manual unknown values become `null`.
- `GlowUpCore.appendMeal(profile, meal) -> nextProfile` returns a new profile with the meal appended to both `meals` and `mealHistory`; it does not mutate the input profile.
- `GlowUpCore.appendPendingMeal(profile, pendingMeal) -> nextProfile` includes a failed meal once in both arrays for a local retry or backup without mutating the prior profile.
- `GlowUpCore.createBackupSnapshot(profile, options) -> backup` returns the existing importable backup format and can include a pending meal in its copied data.
- `GlowUpCore.nutrientTotals(meals) -> {kcal, protein, unknownKcal, unknownProtein}` returns `null` totals when no values are known.

- [x] **Step 1: Add failing `test-app-core.mjs` assertions** for legacy v5 round-trip including existing sessions/check-ins, default merging without an automatic write, preservation of unknown top-level keys, corrupt/wrong-type recovery, quota failure retaining prior bytes, manual unknown values, non-mutating meal append, pending-meal retry/backup recovery, and unknown nutrients excluded from totals.
- [x] **Step 2: Run `node test-app-core.mjs` and verify RED.** Expected failure is an assertion that `GlowUpCore` and its declared functions are available, not a syntax or harness error.
- [x] **Step 3: Implement the dependency-free functions in `app-core.js`.** Validate stored shapes against the defaults, retain unknown fields, keep invalid raw text, and return explicit write failure results.
- [x] **Step 4: Run `node test-app-core.mjs` and verify GREEN.** Confirm a failed write leaves the exact preexisting key value unchanged.

## Task 3: Add a bounded, testable AI client

**Files:** Create `ai-client.js`, `test-ai-client.mjs`.

**Interfaces:**

- `GlowUpAIClient.request({endpoint, action, payload, fetchImpl, onUsage, timeoutMs}) -> {result, usageWarning}`.
- On failure, throw an error with `.code`, `.status`, and `.message`; call `onUsage` before throwing if the Worker supplied usage. An `onUsage` failure sets `usageWarning` for success and never masks a valid result.
- Use one request only. Default client timeout is 30 seconds; no automatic retry.

- [x] **Step 1: Add failing `test-ai-client.mjs` assertions** for success, usage callback, structured Worker error code/message, usage callback before a Worker error, invalid/non-JSON response, network failure, timeout, and no retry.
- [x] **Step 2: Run `node test-ai-client.mjs` and verify RED.** The expected failure is the missing `GlowUpAIClient.request` assertion.
- [x] **Step 3: Implement `ai-client.js`.** Parse JSON defensively, translate Worker errors without discarding their codes, use `AbortController`, and call usage recording before returning or raising a typed error.
- [x] **Step 4: Run `node test-ai-client.mjs` and verify GREEN.** Confirm each mocked request runs once and timed-out requests clear their timer/controller state.

## Task 4: Wire safe meal, storage, accessibility, and privacy flows

**Files:** Modify `index.html`; use `app-core.js` and `ai-client.js` from Tasks 2–3.

**Interfaces:**

- Keep `callGlowAI(action, payload)` as the UI-facing wrapper and preserve existing coach/recipe/meal call signatures; pantry calls pass `recipeCount` explicitly.
- Add a manual meal save action using `GlowUpCore.createMeal` and `appendMeal`; it works without AI consent or a Worker URL and writes before changing in-memory profile state.
- Keep existing AI meal response validation and clear the input only after successful profile persistence.

- [x] **Step 1: Perform the failing local browser checks before editing UI.** Serve the repo locally; switch from Start to Training and confirm visual active state changes while `aria-current` incorrectly stays on Start. Confirm there is no manual meal save control.
- [x] **Step 2: Implement the UI changes.** Load both helper scripts before the inline app script; route profile reads/writes through `GlowUpCore`; show a recovery banner with raw-text download or a transient unsaved banner with export/retry; add optional kcal/protein fields and “Ohne KI speichern”; show unknown values without coercing them to zero; prevent duplicate in-flight AI clicks; preserve text on AI/storage failure; update `aria-current`; and make the consent description explicit about meal, recipe, coach, and optional training/check-in context.
- [x] **Step 3: Repeat the local browser checks and verify GREEN.** Confirm navigation state, manual meal storage without a network request, no addition after AI failure, text retention after failure, unknown totals as `—`/open and still unknown after backup/restore, and updated consent wording.
- [x] **Step 4: Run `node test-app-core.mjs` and `node test-ai-client.mjs`.** Confirm the UI wiring uses the tested helper paths and still keeps the `glowup2026-v5` key.

## Task 5: Version the PWA cache and correct deployment guidance

**Files:** Modify `sw.js`, `README_DEPLOYMENT_DE.txt`, `package.json`; create `README_IPHONE_DEPLOYMENT_DE.txt`; add `test-service-worker.mjs`.

- [x] **Step 1: Add failing `test-service-worker.mjs` checks** that the cache version is bumped, all runtime helper files are precached, and a failed navigation fetch returns the cached app shell.
- [x] **Step 2: Run `node test-service-worker.mjs` and verify RED.** Expected failures are the old cache version/missing helper assets, not VM harness errors.
- [x] **Step 3: Update the PWA and documentation.** Use a new `glowup-2026-v30` cache name; cache `app-core.js` and `ai-client.js`; align request/token limits and KV caveats in the Worker README; write the iPhone guide with backup-first upload steps, GitHub Pages completion check, optional manual Worker update, and a reminder not to paste secrets into GitHub.
- [x] **Step 4: Add `npm test` in `package.json`** to run `test-worker.mjs`, `test-app-core.mjs`, `test-ai-client.mjs`, and `test-service-worker.mjs` in order.
- [x] **Step 5: Run `node test-service-worker.mjs` and `npm test` and verify GREEN.** Confirm no dependency install is needed.

## Task 6: Final validation and deliverables

**Files:** Create the final ZIP and guide copies under the task `outputs/` directory; no external repository changes.

- [x] **Step 1: Run the full suite with `npm test`.** Expected: all four dependency-free test files pass.
- [x] **Step 2: Run syntax and whitespace checks.** Use `node --check index.js`, `node --check app-core.js`, `node --check ai-client.js`, an inline-script syntax check for `index.html`, and `git diff --check`.
- [x] **Step 3: Perform desktop and iPhone-sized local browser smoke checks.** Verify app load at repository-subpath simulation, navigation/ARIA state, manual meal persistence, workout start/pause/resume/finish, backup export/import confirmation, and service-worker asset loading. Use stubbed API responses only; do not call OpenAI.
- [x] **Step 4: Package the complete repository without `.git`, secrets, or node_modules.** Place `GLOW_UP_2026_Stability_Upgrade.zip` and a standalone `README_IPHONE_DEPLOYMENT_DE.txt` in `outputs/`.
- [x] **Step 5: Inspect the ZIP contents and scan its config for secrets or a real KV namespace ID; run `git status --short --branch`.** Confirm the package includes the app, Worker, exercise library, PWA assets, tests, and guide; confirm deployment config contains only a placeholder KV ID, and no push or deployment occurred.

