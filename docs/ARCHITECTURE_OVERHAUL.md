# Oread Architecture Overhaul: Full 6-Phase Plan

## Context

Oread currently has a zero-inference memory system (compromise NLP + token-budgeted context window) with fully isolated sessions, a monolithic 775-line Zustand store, and static world settings. These 6 issues address the gap between "chat with a character" and "exist in a world with a persistent companion." The changes introduce tiered memory, dynamic world state, character dialectic enforcement, cross-session memory, and a cleaner store architecture to support it all.

## Dependency Graph

```
Phase 1: Zustand Store Split           (foundational — every later phase adds state)
   |
Phase 2: Summarization + Memory Tiers  ---------+  (can run parallel with Phase 3)
Phase 3: World State Manager           ---------+
   |                                             |
Phase 4: Character Enforcement / Dialectic       (builds on Phase 3)
Phase 5: Hierarchical Memory / FTS5 Search       (extends Phase 2)
   |                                             |
Phase 6: Cross-Session Memory                    (depends on Phases 2, 4, 5)
```

Implementation order: 1 -> 2+3 (parallel) -> 4+5 (parallel) -> 6

---

## Phase 1: Zustand Store Split

**Status**: Complete

**Why**: 775-line monolithic store will become unmanageable as Phases 2-6 each add new state domains.

### New files
| File | Contents | Source lines |
|------|----------|-------------|
| `client/src/store/slices/settingsSlice.js` | settings, setSettings, loadSettings, loadCharactersForPrompt | useStore.js 13-116 |
| `client/src/store/slices/chatSlice.js` | messages, sendMessage, activeMode | useStore.js 118-288 |
| `client/src/store/slices/modelSlice.js` | models, fetchModels, downloadModel, ollamaStatus, checkHealth | useStore.js 290-442 |
| `client/src/store/slices/sessionSlice.js` | sessions, createSession, selectSession, loadSessions, messageHistory | useStore.js 444-607 |
| `client/src/store/slices/memorySlice.js` | storyNotes, togglePinMessage, loadStoryNotes, saveStoryNotes | useStore.js 609-684 |
| `client/src/store/slices/templateSlice.js` | templates, saveAsTemplate, deleteTemplate, fetchTemplates | useStore.js 686-760 |
| `client/src/store/slices/uiSlice.js` | currentPage, setCurrentPage | useStore.js ~691-696 |

### Modified files
- `client/src/store/useStore.js` — reduced to ~40 lines: imports slices, composes with `create((...a) => ({ ...createSettingsSlice(...a), ...createChatSlice(...a), ... }))`, plus `initialize()`

### Approach
Use Zustand's slice pattern. Each slice is `(set, get) => ({...})`. Cross-slice access works because `get()` returns the full composed store. All existing `useStore((s) => s.x)` selectors continue working — the flat shape is preserved. No consumer changes needed.

Module-level `let saveTimeoutRef` moves into `settingsSlice.js`.

### Cleanup
- Delete the body of useStore.js (lines 13-760) after extraction
- Remove any commented-out code or unused imports carried into slices
- Verify: `grep -r "from.*useStore" client/src/` confirms no broken imports

### No DB, API, or backend changes.

---

## Phase 2: Summarization + Smarter Fact Management

**Status**: Complete

**Why**: Users lose early conversation context. The 50-fact hard cap drops old facts without summarizing them. No summarization exists today.

### New files
- `services/summarizer.js`
  - `summarizeMessages(model, messages, existingSummary)` — calls Ollama with `stream: false`, low temperature (0.3), max 600 tokens. Prompt: condense conversation into key facts, decisions, emotional beats, unresolved threads
  - `shouldSummarize(messageCount, lastSummarizedAt)` — first at 20 messages, then every 15 additional

### DB migrations (in `services/database.js`, same try/catch pattern as existing migrations)
```sql
ALTER TABLE sessions ADD COLUMN rolling_summary TEXT DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_summarized_at INTEGER DEFAULT 0;
```

### Modified files

**`services/contextWindow.js`**:
- `selectMessages()` gains `rollingSummary` parameter
- `buildContextBlock()` gains `rollingSummary` parameter, adds `[Conversation Summary]` section between `[Story Notes]` and `[Session Memory]`

**`services/factExtractor.js`**:
- Add exported `deduplicateAndCap(existing, newFacts, { maxFacts: 80, maxTurnAge: 40 })` — replaces the hard `.slice(-50)` on server.js:306. Deduplicates by `type:text.toLowerCase()`, drops facts older than 40 turns, caps at 80

**`server.js` (chat endpoint, after fact extraction block)**:
- After fact extraction, check `shouldSummarize()`. If true, run summarization in background via `setImmediate()` (non-blocking — user never waits):
  - Fetch unsummarized messages from DB
  - Call `summarizeMessages()` with existing `rolling_summary`
  - Update `sessions.rolling_summary` and `sessions.last_summarized_at`
- Pass `rollingSummary` to `selectMessages()` call

**`server.js` fact cap**: Replace `[...existing, ...newFacts].slice(-50)` with `deduplicateAndCap(existing, newFacts)`

### New setting
- `general.autoSummarize` (boolean, default `true`)
- Add to: `defaultSettings.js`, `BLANK_SETTINGS` in `templateController.js`, `settingsSchema` in `validation.js`
- UI: toggle in GeneralSettingsPanel

### Cleanup
- The `.slice(-50)` line is deleted, not wrapped
- Audit `factExtractor.js` for any helpers made redundant by `deduplicateAndCap`
- Audit `contextWindow.js` — verify old 2-param `buildContextBlock` signature isn't called elsewhere

---

## Phase 3: World State Manager

**Status**: Complete

**Why**: Static `world.settingLore` describes a world but doesn't track dynamic state. No time progression, location tracking, or character presence — the gap between "chat with a character" and "exist in a world."

### New files
- `services/worldStateExtractor.js`
  - `extractWorldState(userMessage, assistantResponse, currentWorldState, turnNumber)` — zero-inference using `compromise` NLP
  - Extracts: locations (via `doc.places()`), people present (via `doc.people()`), temporal markers (via `doc.match('#Duration|#Time|#Date')`), mood/events from sentences with strong verbs
  - Returns updated world state object

- `client/src/components/chat/WorldStatePanel.jsx` — collapsible panel showing current world state (time, location, present characters, events, mood). Editable for manual corrections. Styled like StoryNotes panel.

### Data structure
```js
{
  currentTime: "Late evening",
  currentLocation: "The Silver Tankard tavern, back room",
  presentCharacters: ["Kael", "Mira", "the barkeep"],
  ongoingEvents: ["A storm rages outside", "Mira is waiting for news from the courier"],
  mood: "Tense anticipation",
  lastUpdated: 5  // turn number
}
```

### DB migration
```sql
ALTER TABLE sessions ADD COLUMN world_state TEXT DEFAULT '{}';
```

### Modified files

**`server.js` chat endpoint** — after fact extraction, if mode is roleplay:
- Load `world_state` from session
- Call `extractWorldState()` with current exchange
- Save updated state back to DB
- Pass to `selectMessages()`

**`services/contextWindow.js`**:
- `selectMessages()` gains `worldState` parameter
- `buildContextBlock()` adds `[World State]` section with Time/Location/Present/Ongoing/Atmosphere

**`routes/sessions.js`** — two new endpoints:
- `GET /api/sessions/:id/world-state`
- `PUT /api/sessions/:id/world-state` (manual override)

**`middleware/validation.js`** — add `worldStateSchema`

**`client/src/store/slices/memorySlice.js`** — add `worldState`, `loadWorldState()`, `saveWorldState()`

### Cleanup
- If WorldStatePanel overlaps with any existing world-info display, remove the old one
- After Phases 2+3: extract all post-streaming logic (fact extraction + summarization + world state) from `server.js` into `services/postChatProcessor.js`

---

## Phase 4: Character Enforcement / Dialectic

**Status**: Complete

**Why**: Characters currently have personality flavor but no mechanism to maintain intellectual positions or push back. Socrates should hold the Socratic position, not agree with the user.

### New files
- `services/stanceExtractor.js`
  - `extractStances(assistantResponse, userMessage, currentStances, characterTraits)` — zero-inference, uses regex patterns for opinion markers ("I believe...", "I disagree...", "That's not how I see it...")
  - Maps character traits to dialectic style: Honest+Assertive -> confrontational, Wise+Patient -> socratic, Calm+Empathetic -> gentle-challenge
  - Returns updated stances object

### Data structure
```js
{
  "CharacterName": {
    positions: [{ topic, stance, reasoning }],
    dialecticMode: "socratic" | "confrontational" | "gentle-challenge",
    currentEmotionalState: "...",
    recentConflicts: []
  }
}
```

### DB migration
```sql
ALTER TABLE sessions ADD COLUMN character_stances TEXT DEFAULT '{}';
```

### Modified files

**`server.js` / `services/postChatProcessor.js`** — after world state extraction:
- Load `character_stances` from session
- Call `extractStances()`
- Save updated stances
- Pass to `selectMessages()`

**`services/contextWindow.js`**:
- `selectMessages()` gains `characterStances` parameter
- `buildContextBlock()` adds `[Character Positions]` section

Format in context block:
```
[Character Positions]
Kael strongly opposes magic regulation (because: personal freedom)
Kael is a reluctant supporter of the war (because: protecting home)
Dialectic approach: socratic -- defend positions through questioning, don't simply agree
```

**`client/src/utils/promptBuilder.js`** — add CHARACTER STANCE section after INTERACTION & AGENCY:
```
CHARACTER STANCE & DIALECTIC:
- {name} holds these positions and MUST maintain them unless genuinely persuaded
- When disagreeing, use {dialecticMode} approach
- Do NOT simply agree. Defend your positions with reasoning.
- May change position ONLY when presented a genuinely compelling argument
```

Note: Stances are injected both client-side (promptBuilder: behavioral instructions) AND server-side (contextBlock: specific position data).

### Frontend
- Add stances display in WorldStatePanel (or a sub-tab)
- Users can manually add/edit character positions

### Cleanup
- Consolidate all extractors (fact, world state, stance) behind a single orchestrator in `postChatProcessor.js`

---

## Phase 5: Hierarchical Memory / Full-Text Search

**Status**: Complete

**Why**: The context window drops everything that doesn't fit the token budget. When a user says "remember when we discussed X?", there's no way to search the archive.

### New files
- `services/memorySearch.js`
  - `searchMessages(sessionId, query, { limit: 5 })` — uses SQLite FTS5 for fast full-text search
  - `detectRecallTriggers(userMessage)` — zero-inference regex for recall patterns ("remember when...", "earlier you said...", "you mentioned...")
  - Returns `{ needsRecall: boolean, searchTerms: string[] }`

### DB schema (in `database.js` createTables)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
USING fts5(content, content='messages', content_rowid='rowid');

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
```

### Modified files

**`server.js` chat endpoint** — before context window selection:
- Call `detectRecallTriggers(userContent)`
- If triggered, call `searchMessages()` for each search term
- Pass `recalledMessages` to `selectMessages()`

**`services/contextWindow.js`**:
- `selectMessages()` gains `recalledMessages` parameter
- New priority level between pinned and recent:
  1. System prompt -> 2. Context block -> 3. Anchors -> 4. Pinned -> **5. Recalled** -> 6. Recent
- Recalled messages get gap marker: `[...recalled from earlier...]`

**`routes/sessions.js`** — new endpoint:
- `GET /api/sessions/:id/search?q=<query>&limit=5`

**`middleware/validation.js`** — add search schema

### Backfill
One-time migration script to populate `messages_fts` from existing messages. Store in `scripts/migrations/`, not in `services/`.

---

## Phase 6: Cross-Session Memory

**Status**: Complete

**Why**: Session isolation works for utility chat but fights the companion model. Users want ONE persistent relationship spanning all conversations.

### New files
- `services/globalMemory.js`
  - `promoteToGlobalMemory(sessionId, extractedFacts, rollingSummary)` — promotes session facts to global memory, deduplicates by `entity_key`
  - `getRelevantGlobalMemories(characterName, userName, currentMessage, { limit: 10 })` — FTS search + character-user relationship
  - `updateRelationship(characterName, userName, sessionId, sessionSummary)` — upserts relationship record

- `routes/memory.js` — new router:
  - `GET /api/memory/global?type=person&limit=20`
  - `GET /api/memory/search?q=<query>&limit=10`
  - `GET /api/memory/relationships`
  - `GET /api/memory/relationships/:characterName`
  - `PUT /api/memory/global/:id` (manual edit)
  - `DELETE /api/memory/global/:id`
  - `POST /api/memory/promote/:sessionId` (manual promote)

### DB schema
```sql
CREATE TABLE IF NOT EXISTS global_memory (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  content TEXT NOT NULL,
  source_session_id TEXT,
  confidence REAL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  UNIQUE(entity_key)
);

CREATE TABLE IF NOT EXISTS character_relationships (
  id TEXT PRIMARY KEY,
  character_name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  relationship_summary TEXT DEFAULT '',
  trust_level REAL DEFAULT 0.5,
  interaction_count INTEGER DEFAULT 0,
  first_met_session TEXT,
  last_interaction_session TEXT,
  key_moments TEXT DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(character_name, user_name)
);

CREATE VIRTUAL TABLE IF NOT EXISTS global_memory_fts
USING fts5(content, entity_key, content='global_memory', content_rowid='rowid');
```

### Modified files

**`server.js`**:
- Register `routes/memory.js`
- After summarization, call `promoteToGlobalMemory()` in background
- Before context window, if `crossSessionMemory` enabled, call `getRelevantGlobalMemories()` and inject

**`services/contextWindow.js`**:
- `selectMessages()` gains `globalContext` parameter
- `buildContextBlock()` adds `[Relationship History]` and `[Long-term Memory]` sections

**`server.js` chat endpoint** — after summarization:
- Call `updateRelationship()` with session summary

### New setting
- `general.crossSessionMemory` (boolean, default `false` — opt-in)
- Add to: `defaultSettings.js`, `BLANK_SETTINGS`, `settingsSchema`

### Frontend
- `client/src/store/slices/memorySlice.js` — add `globalMemories`, `characterRelationships`, load/search actions
- Memory management UI in Settings

### Cleanup
- If `memorySlice.js` exceeds ~200 lines, split into `memorySlice.js` (session-scoped) and `globalMemorySlice.js` (cross-session)

---

## Token Budget Strategy (Final State)

| Component | Budget share | Priority |
|---|---|---|
| System prompt | Unlimited (deducted first) | 1 |
| Rolling summary | Max 15% of remaining | 2 |
| World state + stances | Max 5% | 3 |
| Story notes + facts | Max 10% | 4 |
| Global memory | Max 10% | 5 |
| Anchors | Actual cost | 6 |
| Pinned | Actual cost | 7 |
| Recalled | Actual cost | 8 |
| Recent messages | Fills remaining | 9 |

If total context block exceeds its proportional share, trim components in reverse priority order.

---

## Settings Sync Checklist

Every new setting field must be added in all three places (per CLAUDE.md gotcha 3):

| Setting | Phase | defaultSettings.js | BLANK_SETTINGS | settingsSchema |
|---------|-------|-------------------|----------------|----------------|
| `general.autoSummarize` | 2 | `true` | `true` | `Joi.boolean().optional()` |
| `general.crossSessionMemory` | 6 | `false` | `false` | `Joi.boolean().optional()` |

---

## Refactoring & Cleanup Protocol

Each phase includes explicit cleanup steps to prevent dead code accumulation. The rule: **every new file or function added must be accompanied by deletion of what it replaces.**

### General Rules (All Phases)
- **No dead exports**: If a function is moved or renamed, update all call sites and delete the old one. Never re-export from the old location "for compatibility."
- **No `// removed` comments**: If code is deleted, it's deleted. Git history is the record.
- **No unused imports**: After each phase, verify no file has imports that are no longer used.
- **No wrapper functions**: If a new function replaces an old one, call sites call the new one directly. No `oldFunction() { return newFunction(); }` shims.
- **File count audit**: At the end of each phase, list new files created and old code removed. Net file count should grow minimally.

---

## Verification Checklist

### Phase 1
- [ ] All existing tests pass (`npm test`)
- [ ] Settings sync, chat flow, session management work identically
- [ ] No `useStore` import errors across all components

### Phase 2
- [ ] Session with 20+ messages has `rolling_summary` in DB
- [ ] Summary injected in context block (dev log: `Context window`)
- [ ] Facts deduplicate and old facts age out
- [ ] `autoSummarize: false` prevents new summaries

### Phase 3
- [ ] Roleplay mentions of locations/characters update `world_state` in DB
- [ ] WorldStatePanel displays and allows manual edits
- [ ] World state appears in context block
- [ ] `PUT /api/sessions/:id/world-state` works for manual override

### Phase 4
- [ ] Character expresses opinion, user challenges it, character pushes back
- [ ] `character_stances` in DB updates with positions
- [ ] Dialectic instructions appear in system prompt

### Phase 5
- [ ] "Remember when we discussed X" triggers archive recall
- [ ] `GET /api/sessions/:id/search?q=test` returns results
- [ ] FTS triggers keep index in sync on insert/delete

### Phase 6
- [ ] Two sessions with same character share global memory
- [ ] `character_relationships` record exists and updates
- [ ] New session loads relationship history in context
- [ ] `crossSessionMemory: false` disables global memory injection

---

## Risk Mitigations

1. **Summarization latency**: Ollama call runs in background via `setImmediate()` after SSE stream ends. User never waits.
2. **FTS5 availability**: Bundled with standard SQLite npm packages. Verify during Phase 5.
3. **Token budget pressure**: Proportional sub-budgets with reverse-priority trimming prevent context overflow.
4. **NLP extraction quality**: `compromise` is the zero-inference baseline. Optional Ollama enhancement can be added later.
5. **Migration safety**: All DB changes use `ALTER TABLE ADD COLUMN` with try/catch. No destructive migrations.
6. **Store split backward compatibility**: Composed store maintains identical flat interface. All `useStore((s) => s.x)` selectors unchanged.
