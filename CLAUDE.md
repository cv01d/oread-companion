# Oread Chat Interface

Full-stack local AI chat app with Ollama integration. Streaming chat, roleplay/character system, session management.

**Design**: Dark theme, Montserrat font, teal accent `#4db8a8`, `#1a1a1a` backgrounds.

## Stack

- **Backend**: Node.js (ES Modules), Express, SQLite (WAL mode, FTS5), SSE streaming
- **Frontend**: React 19, Vite, Zustand (sliced stores), SCSS (`global.scss` + `*.module.scss`)
- **AI**: Ollama (`ollama` npm package), phi4-mini (LLM-based fact/world/session state extraction)
- **Security**: Helmet, express-rate-limit, Joi validation, CSRF tokens, express-session

## Running

```bash
OLLAMA_MAX_LOADED_MODELS=2 OLLAMA_NUM_PARALLEL=4 ollama serve  # Recommended: multi-model support
npm run dev          # Backend :3001 (auto-reload)
cd client && npm run dev  # Frontend :5173 (proxies /api/* → :3001)
npm test             # Vitest + Supertest
```

Ollama must be running. The recommended launch command keeps both the chat model and the extraction model (phi4-mini) loaded in memory. If phi4-mini is not installed, it auto-downloads on first startup.

## Key Architecture

### Settings (3-place sync)
Settings = a special "active" template at `data/templates/active.json`.
- **Save**: `setSettings()` → localStorage (instant) → 1s debounce → `PUT /api/templates/active`
- **Load**: localStorage first (instant), then `GET /api/templates/active` (authoritative, overwrites)

### Chat Flow
```
sendMessage() → build system prompt (promptBuilder.js) → load characters if needed
  → POST /api/chat { model, messages, systemPrompt, temperature, topP, maxTokens, sessionId, settings }
  → load DB messages + context window selection (contextWindow.js)
  → detect recall triggers → FTS5 archive search if triggered
  → load global memory (if crossSessionMemory enabled)
  → append context block (story notes + summary + facts + world/session state + discoveries + stances + debates + global memory) to system prompt
  → ollamaService.chat() → SSE stream → save to SQLite
  → postChatProcessor: fact extraction → summarization → state extraction (+ history diff) → stance extraction → debate extraction → global memory promotion
  → frontend reloads world/session state after stream ends (live panel update)
```

### Zustand Store (Sliced Architecture)
The store is split into domain-specific slices composed into a single flat store:
- `client/src/store/slices/settingsSlice.js` — settings, setSettings, loadSettings, loadCharactersForPrompt
- `client/src/store/slices/chatSlice.js` — messages, sendMessage, activeMode, SSE streaming
- `client/src/store/slices/modelSlice.js` — models, fetchModels, downloadModel, ollamaStatus, checkHealth
- `client/src/store/slices/sessionSlice.js` — sessions, createSession, selectSession, messageHistory
- `client/src/store/slices/memorySlice.js` — storyNotes, pins, worldState, globalMemories, relationships
- `client/src/store/slices/templateSlice.js` — templates, saveAsTemplate, deleteTemplate, fetchTemplates
- `client/src/store/slices/uiSlice.js` — currentPage

**Patterns:**
- Always use selectors: `useStore((s) => s.x)` — never `useStore().property`
- `setSettings()` auto-saves; don't call save separately
- `sendMessage()` handles the full chat flow including SSE streaming
- Cross-slice access works via `get()` which returns the full composed store

### Memory System (Tiered)

**LLM extraction tier** (phi4-mini via Ollama, every turn):
- Fact extraction via phi4-mini — people, places, events, facts (JSON output, max 5 per category)
- Smart deduplication with turn-age awareness (`deduplicateAndCap`, 80 facts, 40-turn age)
- World state extraction — location, time, present characters (physically in scene only), departed characters, events, discoveries, mood, known characters registry, event lifecycle, location breadcrumbs (roleplay mode)
- Session state extraction — focus topic, open questions, decisions, parked items, known entities, discoveries/insights (utility/normal mode)
- **Discoveries** — new field tracked in both modes. Key information, theories, revelations. Ages slower than events (15 turns → fading, 30 → resolved). Injected as `Key discoveries:` (roleplay) or `Key insights:` (utility)
- Auto-download: phi4-mini is downloaded automatically on first startup if missing
- Graceful degradation: if phi4-mini is not yet available, extraction is skipped (chat still works)
- `ensureReady(timeoutMs)` — blocks and waits for download; used by re-extraction endpoint to avoid silent no-ops

**Zero-inference tier** (regex-based, every turn):
- Character stance extraction — opinion markers, dialectic style inference (roleplay only)

**Inference tier** (Ollama, background):
- Rolling summarization — triggers at 20 messages, then every 15. Non-blocking via `setImmediate()`
- Controlled by `settings.general.autoSummarize` (default true)
- Debate extraction — `services/debateExtractor.js`, triggers every 10 turns in both modes. Mode-aware prompts (roleplay: character debates; utility: approach disagreements). Extracts topic, participants, positions, state via Ollama. Non-blocking via `setImmediate()`

**Cross-session tier** (enabled by default):
- Global memory table — facts promoted from sessions, deduplicated by entity_key
- Character relationships — trust level, interaction count, key moments
- FTS5 full-text search over global memory
- World snapshots — `world_snapshots` table, created on session archive (both modes), seeds new sessions with same character/template
- Controlled by `settings.general.crossSessionMemory` (default true, can be disabled)

**Context window** (`services/contextWindow.js`) — token-budgeted selection, 9 priority levels:
1. System prompt (always)
2. Rolling summary (max 15% of remaining)
3. World state + character stances (max 5%)
4. Story notes + extracted facts (max 10%)
5. Global memory — relationship history + long-term memories (max 10%)
6. Anchors — first user message + first assistant reply
7. Pinned messages — newest-first when over budget
8. Recalled messages — FTS5 archive search triggered by "remember when..." patterns
9. Recent messages — fills remaining budget, newest→oldest

**Post-chat processing** (`services/postChatProcessor.js`) — orchestrates all 6 extractors:
1. Fact extraction (phi4-mini, async — gated on extraction model readiness)
2. Summarization check + background Ollama call
3. State extraction + history diff logging (phi4-mini, async, both modes — gated on extraction model readiness, dispatches to `extractWorldState()` or `extractSessionState()` by mode)
4. Character stance extraction (zero-inference regex, roleplay only)
5. Debate extraction (inference, background, every 10 turns, both modes — mode-aware prompt)
6. Global memory promotion + relationship update (if crossSessionMemory enabled)

### Hierarchical Memory Search
- `services/memorySearch.js` — FTS5 full-text search over message archives
- `detectRecallTriggers()` — zero-inference regex for patterns like "remember when...", "you mentioned..."
- Automatically injects recalled messages into context block when triggered
- Manual search: `GET /api/sessions/:id/search?q=<query>`

### World / Session State Manager
Same pipes, different extraction strategies per mode. Both store in `sessions.world_state` JSON. Both use phi4-mini via `ollamaService.extract()` with JSON format mode.

**Extraction Model Manager** (`services/extractionModelManager.js`):
- Singleton that manages phi4-mini lifecycle
- On startup: checks if model exists, auto-downloads in background if missing
- Exposes `isReady()` (boolean) and `getStatus()` (status object)
- Extraction is skipped gracefully when model isn't ready (chat still works)
- Model name configurable via `OLLAMA_EXTRACTION_MODEL` env var (default: `phi4-mini`)

**Roleplay mode** (`extractWorldState(settings)`):
- Settings-aware: passes character names + user persona name to the LLM prompt for reliable character detection
- LLM extracts: `currentLocation`, `currentTime`, `presentCharacters` (physically in scene only), `departedCharacters`, `newEvents`, `newDiscoveries`, `mood` — returns structured JSON
- Prompt explicitly distinguishes "physically present in the room" from "merely mentioned or discussed" — organizations, groups, and referenced-but-absent people are excluded from presentCharacters
- State snapshot sent to LLM includes recent events and discoveries for context continuity
- Post-extraction lifecycle logic: event aging (10/20 turns), discovery aging (15/30 turns), location trail, knownCharacters registry, mood validation against allowed values

**Utility mode** (`extractSessionState()`):
- LLM extracts: `currentFocus`, `newQuestions`, `newDecisions`, `newParkedItems`, `newEntities`, `newDiscoveries` — returns structured JSON
- Post-extraction lifecycle logic: question aging, auto-park, decision aging, entity tracking, discovery aging
- Open questions that were never answered (lastConfirmed === firstDetected) auto-park after 10 turns; answered-then-dropped questions follow normal fading lifecycle
- Decisions age slower (30 turns → fading, 40 → `archived` — out of context but logged to history and queryable)

**Shared infrastructure:**
- `diffWorldState()` — config-driven field comparison, works for both modes. Produces change log in `world_state_history` (capped at 50)
- `matchEvent()` — fuzzy Jaccard similarity + proper noun matching for deduplication
- **Event Lifecycle** — objects `{ text, firstDetected, lastConfirmed, state }`. States: `active` → `fading` → `resolved` (or `archived` for decisions). Used for events, discoveries, questions, decisions, parked items. Aging rates: events (10/20), discoveries (15/30), questions (10/20), decisions (30/40)
- **Debate Tracking** — `services/debateExtractor.js` runs every 10 turns in both modes with mode-aware prompts. Stored in `world_state.debates`. Merged by topic keyword overlap, capped at 10
- **World Snapshots** — `services/worldSnapshotService.js` creates snapshots on session archive (both modes), seeds new sessions (requires `crossSessionMemory` enabled)
- `WorldStatePanel.jsx` — dual-mode collapsible panel (collapsed by default): "World State" (roleplay) or "Session State" (utility). Re-extract button (↻) replays all messages through current extractor (shows error if phi4-mini unavailable). Shows discoveries in both modes. History log shows state changes in reverse chronological order. Auto-reloads after each message via `loadWorldState()` in `chatSlice.js` `sendMessage()` finally block
- API: `GET/PUT /api/sessions/:id/world-state`, `POST /api/sessions/:id/reextract-state`

### Story Notes vs Auto-Extracted State
Story notes and world/session state serve complementary roles:
- **Story notes** — manual, free-form, user-written. For authorial intent, meta-instructions, secret plot points, and reminders. Tracks *what you want to happen* or *what the AI should know but hasn't been told yet*.
- **World/session state** — automatic, structured, LLM-extracted via phi4-mini. Tracks *what happened* — locations, characters, events, discoveries, decisions, open questions.
- Both are injected into context every turn as `[Story Notes]` and `[World State]`/`[Session State]` blocks. They don't overlap — one is directive, the other is observational.

### Character Enforcement / Dialectic
- `services/stanceExtractor.js` — detects opinion markers, tracks character positions
- Dialectic mode inferred from character traits (socratic, confrontational, gentle-challenge)
- Injected into system prompt: characters must maintain positions, push back on disagreements
- Stances stored per-session in `character_stances` column

### DB Tables
- `sessions` — id, name, character_name, mode, settings_snapshot, message_count, archived, story_notes, extracted_facts, rolling_summary, last_summarized_at, world_state, world_state_history, character_stances
- `messages` — id, session_id, role, content, timestamp, pinned
- `messages_fts` — FTS5 virtual table for full-text message search (auto-synced via triggers)
- `global_memory` — id, entity_type, entity_key, content, source_session_id, confidence, access_count
- `global_memory_fts` — FTS5 virtual table for global memory search
- `character_relationships` — id, character_name, user_name, relationship_summary, trust_level, interaction_count, key_moments
- `world_snapshots` — id, template_id, character_name, world_state_summary, key_locations, key_characters, key_events, source_session_id

### API Endpoints

**Sessions:**
- `POST /api/sessions` — create session
- `GET /api/sessions` — list sessions (paginated, filters archived)
- `GET /api/sessions/:id` — get session
- `PUT /api/sessions/:id` — update session (name, archived)
- `DELETE /api/sessions/:id` — delete session
- `POST /api/sessions/:id/messages` — save message
- `GET /api/sessions/:id/messages` — get messages (paginated)
- `PATCH /api/sessions/:sessionId/messages/:messageId/pin` — toggle pin
- `GET /api/sessions/:id/notes` — read story notes
- `PUT /api/sessions/:id/notes` — save story notes
- `GET /api/sessions/:id/world-state` — get world state + history
- `PUT /api/sessions/:id/world-state` — update world state
- `POST /api/sessions/:id/reextract-state` — replay all messages through extractor, rebuild state + history from scratch. Calls `ensureReady()` to wait for phi4-mini download if needed. Returns 503 if extraction model unavailable.
- `GET /api/sessions/:id/search?q=<query>` — FTS5 message search

**Memory:**
- `GET /api/memory/global` — list global memories (filterable by type)
- `GET /api/memory/search?q=<query>` — search global memory
- `PUT /api/memory/global/:id` — edit a memory
- `DELETE /api/memory/global/:id` — delete a memory
- `POST /api/memory/promote/:sessionId` — manually promote session to global
- `GET /api/memory/relationships` — list all character relationships
- `GET /api/memory/relationships/:characterName` — get specific relationship

**Other:**
- `POST /api/chat` — main chat endpoint (SSE streaming)
- `GET /api/health` — health check
- `GET /api/models` — list models
- `POST /api/models/pull` — download model (SSE streaming)
- `GET /api/templates` — list templates
- `GET/PUT /api/templates/active` — active settings
- `POST /api/templates/user` — create user template
- `DELETE /api/templates/user/:id` — delete user template
- `GET/POST/DELETE /api/characters/:id` — character CRUD

## Adding a New Setting Field
1. `client/src/data/defaultSettings.js` — add to `DEFAULT_SETTINGS`
2. `controllers/templateController.js` — add to `BLANK_SETTINGS`
3. `middleware/validation.js` — add to `settingsSchema` (**required** or it gets stripped by `stripUnknown`)
4. Add UI in the appropriate settings panel
5. Add to `promptBuilder.js` if it affects the system prompt

## Adding a New API Endpoint
1. Route handler in `routes/*.js`
2. Joi schema in `middleware/validation.js` + `validate(schema)` middleware
3. Register router in `server.js` if new file

## Adding a New Post-Chat Extractor
1. Create `services/<name>Extractor.js` with extraction function
2. Add to `services/postChatProcessor.js` — import and call in `processPostChat()`
3. Add DB column if needed (ALTER TABLE migration in `database.js`)
4. Add to `contextWindow.js` `buildContextBlock()` if it should be injected into context
5. Update `selectMessages()` signature if passing new data through

## User Templates (Worlds)
Users can save current settings as a named "world" template. Stored as JSON in `data/templates/user/` (gitignored).
- **Save**: `POST /api/templates/user` → generates ID from name, handles collisions (`-2`, `-3`)
- **Delete**: `DELETE /api/templates/user/:id`
- **List**: `GET /api/templates` returns both `defaults/` and `user/` templates, tagged with `isUserTemplate: true/false`
- Frontend: `saveAsTemplate()` / `deleteTemplate()` in templateSlice, `templateAPI.js` for API calls
- UI: "Save as World" button below settings tabs, "Choose Your World" section in Mode tab

## Gotchas
1. `/api/templates/active` and `/api/templates/user` must be registered before `/:id` — otherwise they are captured as template IDs
2. **Zustand selectors** — always `useStore((s) => s.x)`, never destructure the whole store
3. **`validate()` uses `stripUnknown: true`** — new setting fields must be in `settingsSchema` or silently removed
4. **`TextField.onChange`** receives the value directly, not the event
5. **`characterMode`** is `'single'` or `'multi'` (not `'multiple'`)
6. **SSE parsing** — always check `line.startsWith('data: ')` before JSON.parse
7. WAL files (`.db-shm`, `.db-wal`) are normal; don't delete while app is running
8. CSRF bypassed in dev when `ENABLE_AUTH=false` (default). `apiFetch()` handles CSRF token injection
9. **Model selection priority** — dropdown selection wins over `settings.general.selectedModel` (which is the fallback default)
10. **Story notes race condition** — handled by flushing pending debounced saves on session switch and capturing `sessionId` at typing time
11. **`contextBudget`** must be in `settingsSchema` (see gotcha 3) — added to `general` object
12. **FTS5 backfill** — existing messages are auto-indexed on first startup after migration. The backfill runs once and is safe to re-run.
13. **Cross-session memory is on by default** — `settings.general.crossSessionMemory` defaults to `true`. Can be disabled in settings. When disabled, no global memory promotion or retrieval occurs.
14. **postChatProcessor is fire-and-forget** — called without `await` in the chat endpoint. Summarization and debate extraction run in `setImmediate()`. Errors are caught and logged, never block the SSE response.
15. **Event backward compat** — `ongoingEvents` and `discoveries` can contain strings (legacy) or objects (new). Always check `typeof` before accessing `.text` or `.state`. The extractor auto-migrates strings to objects.
16. **`_resolvedEvents` is transient** — set by `extractWorldState()` for `postChatProcessor` to log, then deleted before saving to DB. Never persisted.
17. **Debate extraction is inference-based** — unlike other state extraction, `debateExtractor.js` calls the chat model (not phi4-mini). Runs in `setImmediate()` every 10 turns, both modes. Mode-aware prompt selected via `mode` parameter.
18. **World snapshots** — created on archive and seeded on create by default. Only skipped if `crossSessionMemory` is explicitly set to `false`. Works for both modes.
19. **Session state extraction (utility mode)** — `extractSessionState()` tracks focus, questions, decisions, parked items, entities, discoveries. Same data flow as roleplay: stored in `world_state` JSON, diffed by `diffWorldState()`, injected as `[Session State]` in context block.
20. **`diffWorldState()` is config-driven** — uses `DIFF_FIELDS` config object instead of hardcoded field arrays. Supports both roleplay fields (location, characters, discoveries) and utility fields (focus, questions, decisions, discoveries). Adding new fields only requires updating the config.
21. **Extraction model (phi4-mini)** — Auto-downloaded on startup if missing. Extraction is skipped while downloading (graceful degradation). Health endpoint includes `extractionModel` status. Override model name with `OLLAMA_EXTRACTION_MODEL` env var. Run Ollama with `OLLAMA_MAX_LOADED_MODELS=2` to keep both models warm. Re-extraction endpoint calls `ensureReady()` to block until model is available (returns 503 if not).
22. **Present characters are physically-present only** — The extraction prompt explicitly instructs the LLM to only list characters physically in the scene, not organizations, groups, or people merely mentioned in dialogue. `departedCharacters` is a separate LLM output field for characters who left the scene.

## Environment Variables
`PORT` (3001), `OLLAMA_URL` (localhost:11434), `OLLAMA_CHAT_MODEL` (llama2), `OLLAMA_EXTRACTION_MODEL` (phi4-mini), `SESSION_SECRET` (auto-gen), `OREAD_ENCRYPTION_PASSPHRASE` (auto-gen, required in prod), `ENABLE_AUTH` (false), `ENABLE_CSRF` (true), `CORS_ORIGINS` (localhost:5173,localhost:3000)

**Recommended Ollama launch:** `OLLAMA_MAX_LOADED_MODELS=2 OLLAMA_NUM_PARALLEL=4 ollama serve` — keeps chat model and extraction model (phi4-mini) loaded simultaneously.

## In-Progress Branches
- **`cloud-api-integration`** — Adds OpenAI + Anthropic cloud model support alongside Ollama. Provider auto-detected from model name. API keys encrypted (AES-256-GCM) in SQLite `api_keys` table. UI in Settings > Integrations.

## Merged Branches
- **`architecture-overhaul`** — Tiered memory system, world/session state, dialectic, FTS5 search, cross-session memory. Squash-merged to main.
