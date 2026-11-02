# GLOW UP 2026 Stability Upgrade — Design Specification

**Status:** Proposed for review · **Date:** 2026-11-02

## Goal

Make the existing GLOW UP 2026 app stable and safe to update on an iPhone while keeping its current GitHub Pages frontend, Cloudflare Worker, and local user data. Deliver a complete local package and a short iPhone deployment guide; do not change Cloudflare secrets or deploy externally.

## Current project and evidence

- The app is a static German-language HTML PWA on GitHub Pages. Its Cloudflare Worker lives in `index.js`; the UI and most browser logic are in `index.html`.
- Existing features include workout logging and progression hints, training statistics, calorie/protein goals and history, AI meals and recipes, pantry/shopping lists, JSON backup/restore, and a service worker.
- Existing user data is stored under `glowup2026-v5`. The app currently merges defaults into that data at startup.
- `node test-worker.mjs` passes and the inline JavaScript parses. The worker test does not cover the reported JSON-mode or incomplete-response errors.
- A local probe reproduced the API JSON-mode error: the request sets `text.format.type` to `json_object`, while the actual input message contains no `json` text.
- A local probe reproduced the recipe failure: a simulated response with `status: "incomplete"` and a truncated JSON body becomes the generic `Invalid AI JSON response.` error. The recipe output budget is currently 650 tokens.
- `sendMeal()` correctly avoids saving an unvalidated AI estimate and keeps the input text after failure, but provides no manual-save path. Local reads silently fall back to defaults on a parse error; `save()` and `persist()` do not handle storage write failures.
- The app already includes iPhone safe-area spacing, large touch targets, reduced-motion support, offline caching, and backup/restore. The navigation's `aria-current` marker remains on Start after a tab change. The AI-consent label does not clearly mention coach questions.

The OpenAI JSON-mode requirement and incomplete-response fields are documented by OpenAI: [JSON mode guidance](https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Design decisions

1. **Harden the current architecture.** Keep static GitHub Pages and the separate Cloudflare Worker. Do not introduce a framework, database, account system, or new runtime dependency.
2. **Preserve existing data.** Keep `glowup2026-v5` and existing record shapes. Do not clear, rename, rewrite, or destructively migrate user data. Only add optional fields where needed; absent or `null` nutrition values mean “unknown,” never zero.
3. **Make failure visible and recoverable.** Do not claim a save unless local persistence succeeded. Do not discard meal text after AI or storage errors. Provide a manual meal-save path that works without AI and does not incur API cost.
4. **Avoid surprise cost.** Do not automatically retry AI requests. Keep existing per-IP rate limits and `store: false`; derive the recipe output cap from an explicit count of one or three, and report token usage when the provider supplies it, including incomplete responses.
5. **Keep deployment under user control.** Produce a local package and instructions only. Do not edit secrets, change external settings, push commits, or deploy the Worker or site.

## Components and behavior

### 1. Worker response contract

- Include the required JSON instruction in the actual user input sent to the Responses API; relying only on the top-level `instructions` field is insufficient.
- Inspect the provider response status before extracting or parsing text. Parse only `completed` outputs. Return the existing string `error` field plus a stable `code`: `AI_OUTPUT_INCOMPLETE` (502), `AI_REFUSED` (422), `AI_INVALID_JSON` (502), `AI_INVALID_RESULT` (502), `AI_PROVIDER_UNAVAILABLE` (502), `AI_TIMEOUT` (504), or `AI_RATE_LIMITED` (429). The app's own KV quota uses `REQUEST_LIMIT_REACHED` (429). Include a concise German message and optional `usage`; do not expose raw provider internals.
- Continue validating action-specific results; strengthen recipe validation for the name, ingredient entries, steps, and the exact requested result count. Pantry requests send `recipeCount: 1 | 3` as a distinct field.
- Keep output budgets bounded and action-specific: meal 400 tokens, one recipe 1,400, three recipes 3,200, and coach 1,000. The health action stays local and makes no provider call. Keep the existing five requests per minute and 30 per day defaults. Documentation must clarify that KV rate limiting is best-effort and is not a guaranteed euro spending cap.
- Return available token usage on both success and structured incomplete/error responses. Do not include prompts, API keys, stack traces, or raw provider internals in logs or public error responses.
- Preserve `store: false`, CORS allowlisting, fail-closed KV behavior, and server-side API-key handling.

### 2. Client AI and meal flow

- Add a bounded client timeout and prevent duplicate clicks from launching concurrent requests.
- Record provider usage before surfacing a response error when usage data is present. Never increment usage when no provider usage was returned. A local usage-meter write failure must not turn a valid AI answer into an error or prevent its meal/recipe from being saved; report that the meter could not be updated.
- Keep user prompts in their fields after failure. Show a specific retryable message for incomplete output; retries remain manual.
- Add a manual meal save that stores `n`, `c`, `p`, `date`, `estimate: false`, and `estimateMethod: "manual"` in the existing meal shape without calling AI. Calories (`c`) and protein (`p`) are independently optional; an unknown value is `null` and excluded from totals. Render unknown nutrition as “offen”/“—” rather than zero.
- Save an AI estimate only after response validation and successful local persistence. Write the next meal state first, then update in-memory data; if persistence fails, do not add an in-memory duplicate, keep the text, and do not show success.
- Update meal consent copy to cover meal, recipe, and coach text. Make clear that training/check-in details are sent only when the separate context checkbox is selected.

### 3. Local data safety

- Keep the key and all existing top-level arrays/objects. Add only missing defaults in memory; do not perform an automatic write solely because the app loaded.
- Move storage read/write behavior behind a small dependency-free helper that can be tested with an in-memory storage implementation.
- Accept only a stored top-level object. When present, `sessions`, `meals`, `mealHistory`, `checks`, `savedRecipes`, `shop`, `pantryItems`, and `activities` must be arrays; `waterDays`, `trainingDaySlots`, `nutritionGoals`, and `exerciseLibraryPrefs` must be non-array objects. Treat invalid JSON or a wrong known-field type as a recovery state: keep the original key untouched, surface a clear message, and block profile writes. Offer a download of the original stored text for recovery. Retain all unknown top-level keys so later app versions' data is not stripped. Do not silently turn that state into an empty saved profile.
- Catch quota/security write errors. A failed write must leave the prior localStorage value intact and must not be announced as saved. For a transient write error, mark the in-memory profile unsaved and show export/retry actions; for a recovery state, do not offer a retry that could overwrite the original value. AI usage-meter failure is non-blocking.
- Preserve the existing JSON export and user-confirmed restore flow. Manual meals with unknown nutrients must round-trip through backup and restore.

### 4. UI, training, and nutrition

- Keep the current workout planner, active/paused/completed sessions, progression hints, training analytics, exercise library, food goals, weekly/daily calorie and protein summaries, recipes, pantry, and shopping list.
- Do not change training recommendations or backfill nutrition values without evidence. Add regression coverage that loading and saving preserves existing workout/check-in records.
- Update `aria-current` as navigation changes and use existing live regions for storage/AI status. Keep keyboard focus, large touch targets, safe-area spacing, reduced-motion behavior, and the existing single-page interaction model.
- Clearly distinguish AI estimates, manual entries, and unknown values in meal summaries and nutrition analytics.

### 5. PWA, privacy, cost, and delivery

- Bump the service-worker cache version and include any new same-origin runtime file. Keep the GitHub Pages repository subpath compatible.
- Correct deployment documentation so worker limits match `wrangler.toml` and the code. State that local token counts are not euro billing and that the provider's project-level spending controls are separate.
- Do not put secrets or the real KV namespace ID in the package. Keep the existing Worker URL editable through the app settings.
- Deliver a ZIP of the full deployable repository plus a short German iPhone guide. The guide must tell the user to export a backup before replacing files, upload the full changed site files, wait for GitHub Pages to finish, and update the Worker manually only if they choose; it must not ask them to expose a secret.

## Verification and acceptance criteria

- Extend the existing dependency-free worker test to cover the JSON keyword in the actual request, one/three-recipe budgets, successful recipe results, incomplete output, refusal, malformed JSON, schema validation, returned error codes, usage reporting, and existing CORS/KV/rate-limit protections.
- Add dependency-free client/storage tests for existing `glowup2026-v5` data round-trips, unreadable data remaining untouched, failed writes not replacing prior storage, and manual meals with unknown nutrients not counting as zero.
- Validate inline JavaScript syntax and run all repository tests.
- Perform local browser smoke checks at desktop and iPhone-sized viewports for navigation/accessibility state, manual and AI meal flows with stubbed responses, workout logging, backup flow, PWA assets, and offline cache behavior. Do not call the real OpenAI API.
- Deliver a local ZIP and iPhone guide. Leave GitHub and Cloudflare external state unchanged.

## Out of scope

- Cloud or cross-device data synchronization, user accounts, or database migration.
- Real API calls during tests, automatic AI retries, or claiming a hard euro budget from KV/IP quotas.
- Changing or revealing secrets, editing Cloudflare account settings, pushing to GitHub, or deploying the app/Worker.
