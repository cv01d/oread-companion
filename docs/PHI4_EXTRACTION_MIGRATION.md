# Phi4 Extraction Migration Plan

## Context

The app currently uses the `compromise` NLP library for zero-inference fact extraction and world/session state extraction. While fast, compromise's rule-based approach is limited in accuracy — it misses nuanced facts, misclassifies entities, and struggles with complex narrative text. We're replacing it with a small local model (`phi4-mini`) running on Ollama to produce higher-quality extractions.

Additionally, we're configuring Ollama to run with multiple loaded models (`OLLAMA_MAX_LOADED_MODELS=2`) and parallel request support (`OLLAMA_NUM_PARALLEL=4`) so the extraction model can stay warm alongside the user's chat model without constant loading/unloading.

## Two Goals

1. **Multi-model Ollama configuration** — Run Ollama with `OLLAMA_MAX_LOADED_MODELS=2 OLLAMA_NUM_PARALLEL=4` so the chat model and phi4-mini can coexist in memory.
2. **Replace compromise with phi4-mini** — Swap out rule-based NLP extraction for LLM-based extraction using `phi4-mini` as a dedicated background extraction model.

---

## Part 1: Multi-Model Ollama Configuration

### What Changes

We are **not** going to launch Ollama from the app or require these env vars. Instead:

- **Document** the recommended Ollama launch command in startup/health messaging
- **Health check enhancement** — When Ollama is connected, query its running config. If `OLLAMA_MAX_LOADED_MODELS < 2`, show a warning in the health endpoint and frontend that extraction performance may be degraded
- **No hard requirement** — The app works fine without these flags (models just load/unload more often)

### Files to Modify

| File | Change |
|------|--------|
| `services/ollama.js` | Add method to check loaded model count / server config if Ollama exposes it |
| `server.js` (`GET /api/health`) | Include Ollama config recommendation in health response |
| `client/src/store/slices/modelSlice.js` | Surface config warning in frontend if detected |
| `docs/QUICK_START.md` | Update Ollama launch instructions |
| `CLAUDE.md` | Update environment variables section |

---

## Part 2: Replace Compromise with Phi4-Mini Extraction

### Overview

Replace the synchronous, rule-based `compromise` calls in `factExtractor.js` and `worldStateExtractor.js` with async calls to `phi4-mini` via Ollama. The extraction model is a dedicated internal concern — not user-selectable.

### Model Auto-Download

If `phi4-mini` is not present when the app starts (or when extraction first runs), auto-pull it:

1. **On server startup** — After health check confirms Ollama is connected, call `ollamaService.listModels()`. If `phi4-mini` is not in the list, trigger `ollamaService.pullModel('phi4-mini')` in the background.
2. **Graceful degradation** — While phi4-mini is downloading (or if Ollama is offline), skip extraction silently. Log a warning. Don't block chat.
3. **Status tracking** — Add an `extractionModelReady` flag to the health endpoint so the frontend can show a status indicator.
4. **Startup log** — Print clear message: `"Extraction model (phi4-mini) not found. Downloading..."` and `"Extraction model ready."`.

### Files to Create

| File | Purpose |
|------|---------|
| `services/extractionModelManager.js` | Manages phi4-mini lifecycle: check availability, trigger download, track readiness state |

### Files to Modify

| File | Change |
|------|--------|
| `services/factExtractor.js` | Replace compromise parsing with phi4-mini prompt. Change from sync to async. Structured JSON output via prompt engineering |
| `services/worldStateExtractor.js` | Replace compromise calls in `extractWorldState()` and `extractSessionState()` with phi4-mini prompts. Becomes async |
| `services/postChatProcessor.js` | Update calls to now-async extractors. Add extraction model readiness check before calling extractors |
| `services/ollama.js` | Add `generate()` or `chat()` wrapper for extraction (low temp, JSON mode). Add `isModelAvailable(modelName)` helper |
| `server.js` | Call extraction model manager on startup. Add extraction model status to health endpoint |
| `package.json` | Remove `compromise` dependency |

### Extraction Prompt Design

Each extractor gets a focused prompt that returns structured JSON:

**Fact Extraction Prompt** (replaces `factExtractor.js` compromise logic):
```
Extract facts from this conversation turn. Return JSON:
{
  "people": ["name1", "name2"],
  "places": ["place1"],
  "events": ["event description"],
  "facts": ["factual statement"]
}

User: {userMessage}
Assistant: {assistantResponse}
```

**World State Extraction Prompt** (replaces `extractWorldState()` compromise logic):
```
Given this roleplay conversation turn and current world state, extract updates.
Return JSON with only changed fields:
{
  "currentLocation": "string or null",
  "currentTime": "string or null",
  "presentCharacters": ["char1", "char2"],
  "newEvents": ["event description"],
  "mood": "string or null"
}

Current state: {currentWorldState}
Characters in settings: {characterNames}
User: {userMessage}
Assistant: {assistantResponse}
```

**Session State Extraction Prompt** (replaces `extractSessionState()` compromise logic):
```
Given this utility conversation turn and current session state, extract updates.
Return JSON with only changed fields:
{
  "currentFocus": "string or null",
  "newQuestions": ["question"],
  "newDecisions": ["decision"],
  "newParkedItems": ["item"],
  "newEntities": ["entity name"]
}

Current state: {currentSessionState}
User: {userMessage}
Assistant: {assistantResponse}
```

### Key Design Decisions

1. **phi4-mini specifically** — Small enough to stay loaded alongside a 7-13B chat model. Fast inference. Good at structured extraction tasks.
2. **JSON mode** — Use Ollama's JSON format option (`format: 'json'`) to ensure parseable responses.
3. **Low temperature** — Use `temperature: 0.1` for deterministic extraction.
4. **Fire-and-forget stays fire-and-forget** — Extraction is still non-blocking. The switch from sync to async doesn't change the architecture; `postChatProcessor` is already called without `await`.
5. **No fallback to compromise** — Clean cut. If phi4-mini isn't available, extraction is skipped entirely until it's downloaded. This is fine because extraction is supplementary, not critical to chat.
6. **Existing data structures preserved** — The output format of facts, world state, and session state remains identical. Only the extraction method changes. No DB migrations needed.
7. **Deduplication and lifecycle logic stays** — `deduplicateAndCap()`, `diffWorldState()`, event lifecycle management, and all the state merging logic remain as-is. Only the "extract raw data from text" step changes.

### Extraction Model Manager (`extractionModelManager.js`)

```
Responsibilities:
- On init: check if phi4-mini exists in Ollama
- If missing: start background pull, track progress
- Expose: isReady(), getStatus(), ensureModel()
- Singleton pattern (like ollamaService)
```

### Migration Path for postChatProcessor

Current flow (sync extractors):
```
processPostChat() {
  facts = extractFacts(user, assistant, turn)        // sync, compromise
  save facts
  setImmediate(() => summarize())                     // async, ollama
  worldState = extractWorldState(...)                  // sync, compromise
  save worldState
  stances = extractStances(...)                        // sync, regex (UNCHANGED)
  save stances
  setImmediate(() => extractDebates())                // async, ollama
  setImmediate(() => promoteGlobalMemory())           // async
}
```

New flow (async extractors):
```
processPostChat() {
  if (!extractionModelManager.isReady()) {
    log.warn('Extraction model not ready, skipping extraction')
    // still run summarization, stances, debates, global memory
  } else {
    facts = await extractFacts(user, assistant, turn)  // async, phi4-mini
    save facts
    worldState = await extractWorldState(...)           // async, phi4-mini
    save worldState
  }
  stances = extractStances(...)                        // sync, regex (UNCHANGED)
  save stances
  setImmediate(() => summarize())                      // async, ollama (UNCHANGED)
  setImmediate(() => extractDebates())                 // async, ollama (UNCHANGED)
  setImmediate(() => promoteGlobalMemory())            // async (UNCHANGED)
}
```

Note: `stanceExtractor.js` does **not** use compromise — it's pure regex. It stays unchanged.

### What Stays the Same

- `stanceExtractor.js` — regex-based, no compromise, untouched
- `debateExtractor.js` — already uses Ollama, untouched
- `summarizer.js` — already uses Ollama, untouched
- `contextWindow.js` — consumes extraction output, format unchanged
- `deduplicateAndCap()` in factExtractor — logic stays, input format stays
- `diffWorldState()` — config-driven diffing stays identical
- Event lifecycle logic — `active/fading/resolved` state machine stays
- All DB schemas — no changes needed
- Frontend world state / session state panels — no changes needed

---

## Verification Plan

1. **Start app without phi4-mini installed**
   - Confirm health endpoint reports extraction model downloading
   - Confirm chat still works (extraction skipped gracefully)
   - Confirm phi4-mini auto-downloads in background
   - Confirm health endpoint updates to ready once download completes

2. **Send messages in roleplay mode**
   - Verify facts extracted and saved (check DB `extracted_facts` column)
   - Verify world state extracted: location, characters, events, mood
   - Verify `diffWorldState()` produces correct history entries
   - Verify WorldStatePanel shows live updates

3. **Send messages in utility mode**
   - Verify session state extracted: focus, questions, decisions, entities
   - Verify SessionStatePanel shows live updates

4. **Run existing tests**
   - `npm test` — update factExtractor tests to mock Ollama instead of compromise
   - worldStateExtractor tests need similar updates

5. **Performance check**
   - Extraction should complete in <2s per turn with phi4-mini
   - Chat response streaming should not be blocked by extraction
   - With `OLLAMA_MAX_LOADED_MODELS=2`, both models should stay warm

---

## Order of Implementation

1. Create `extractionModelManager.js` with auto-download logic
2. Wire it into server startup and health endpoint
3. Add `generate()`/extraction helper to `ollamaService.js`
4. Rewrite `factExtractor.js` to use phi4-mini prompts
5. Rewrite `worldStateExtractor.js` (`extractWorldState` + `extractSessionState`) to use phi4-mini prompts
6. Update `postChatProcessor.js` for async extractors + readiness check
7. Remove `compromise` from `package.json`
8. Update tests
9. Update `CLAUDE.md` and `QUICK_START.md` docs
10. Update health check / frontend to surface extraction model status
