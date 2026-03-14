# Unified Memory System — FAISS + LangChain with Token Budgeting

> **Status:** Implementation Plan
> **Date:** 2026-03-14
> **Dependencies:** LangChain (installed), FAISS (installed), nomic-embed-text (Ollama), SQLite (installed)

---

## Problem

The current system stuffs the entire character card (backstory, knowledge, hobbies, inventory, thingsToAvoid) into every system prompt regardless of relevance. With 20 characters × 5 fields = 100 lorebook documents + 1000+ conversation messages, all competing for ~2096 tokens of context, this approach doesn't scale. We need intelligent retrieval that pulls in only what's relevant per message.

## Solution

A three-layer memory system using a **unified FAISS index per session** with strict **token budgeting**:

1. **Character Lorebook** (static) — character fields retrieved via semantic search
2. **Conversation Summary Buffer** — LLM-summarized history + recent messages verbatim
3. **Entity Memory** — facts about the user extracted and recalled across turns

---

## Architecture: Token Budget Breakdown

```
~2096 token budget:
├── ~500  FIXED: Template frame (world, narrative style, protocol, mode toggle, filters)
├── ~150  FIXED: Primary character identity (name, role, active traits)
├── ~100  FIXED: User info (name, context)
└── ~1300 DYNAMIC: Unified FAISS retrieval pool
            ├── Character lorebook hits (backstory, skills, hobbies, inventory, avoid — any character)
            ├── Conversation history hits (semantically relevant past messages)
            ├── Entity memory hits (known facts about user)
            └── Ranked by relevance score → filled until ~1300 tokens exhausted
```

---

## Three Memory Layers

### Layer 1: Character Lorebook (Static)

Each character's fields are indexed as separate documents in the session's unified FAISS index.

- 20 characters × 5 fields = up to 100 documents
- Metadata: `{ type: "lorebook", characterId, field, characterName }`
- Reindexed when character data changes
- Documents are prefixed with field label + character name for self-describing retrieval:
  ```
  "BACKSTORY [Echo]: I'm Echo, your default AI companion..."
  "KNOWLEDGE [Echo]: Tech & Internet, AI developments..."
  "HOBBIES [Nova]: Underground techno raves, vintage hardware..."
  ```

**What stays in the fixed prompt (always):**
- NAME, IDENTITY (age/gender/species), ROLE
- PERSONALITY ENGINE (active Discourse/Conduct traits)

**What moves to lorebook (retrieved on demand):**
- backstory, knowledgeSkills, hobbiesInterests, thingsToAvoid, inventory

For multi-character: only the primary character's identity+traits go in the fixed prompt. All supporting character data is entirely in the FAISS pool.

### Layer 2: Conversation History (Dynamic)

Each message is indexed after it's sent, replacing the current "send all messages" or "send last 20" approach.

- Metadata: `{ type: "message", role, timestamp, messageId }`
- Already partially implemented in `services/embeddingService.js`
- Combined with `ConversationSummaryBufferMemory` from LangChain:
  - `maxTokenLimit: 800` — keeps recent messages verbatim up to this limit
  - Summarizes older messages using the chat model
  - Summary stored in SQLite (`sessions.summary` column)

### Layer 3: Entity Memory (Dynamic)

Facts the user reveals about themselves are extracted and tracked across turns.

- After each exchange (background, fire-and-forget):
  - Small LLM call: "Extract any facts the user revealed about themselves"
  - Store in SQLite `entities` table
  - Embed and add to session FAISS index
- Documents: `"User is a software engineer"`, `"User loves jazz"`
- Metadata: `{ type: "entity", entityName, extractedAt }`
- On session load, entity docs are re-added to the index

---

## Implementation Plan

### Step 1: Unified Session Index Service

**New file:** `services/memoryManager.js`

Core orchestrator managing the unified FAISS index per session:

```javascript
class MemoryManager {
  // Index management
  async initializeSession(sessionId, characters)
    // Creates/loads FAISS index
    // Indexes all character lorebook fields
    // Loads any existing entity memories from SQLite

  async addMessages(sessionId, messages)
    // Embed and add conversation messages to index

  async addEntity(sessionId, entityName, entityInfo)
    // Embed and add extracted entity fact to index

  // Retrieval with token budgeting
  async retrieve(sessionId, userMessage, tokenBudget = 1300)
    // 1. Embed user message with nomic-embed-text
    // 2. Search unified index (topK = 15-20, over-fetch)
    // 3. Score + rank all results
    // 4. Fill token budget greedily (highest relevance first)
    // 5. Return chunks that fit within budget

  // Index invalidation
  async rebuildCharacterDocs(sessionId, characterId, characterData)
    // Remove old docs for this character, add new ones
    // Called when character is edited

  async deleteSession(sessionId)
    // Clean up index files
}
```

**Token counting:** `words × 1.3 ≈ tokens` heuristic (or `tiktoken` for accuracy).

**Index storage:** `data/vectors/{sessionId}/` (unified: lorebook + messages + entities)

### Step 2: Character Lorebook Indexing

When a session starts or a template is applied:

1. Extract character data from `settings.roleplay.character` (single) or iterate all characters (multi)
2. For each character, create documents for non-empty fields (prefixed with label + name)
3. Add to unified session FAISS index with lorebook metadata
4. Skip empty fields — don't index them

### Step 3: Modify Chat Endpoint

**File:** `server.js`

```
POST /api/chat flow:

1. Receive { systemPrompt, messages, sessionId, settings }
2. Get user's latest message
3. Initialize memory if needed:
   memoryManager.initializeSession(sessionId, characters)
4. Retrieve relevant context:
   chunks = memoryManager.retrieve(sessionId, userMessage, tokenBudget=1300)
5. Augment system prompt:
   systemPrompt += "\nRETRIEVED CONTEXT:\n" + chunks.map(c => c.content).join("\n")
6. Build message array:
   - ConversationSummaryBuffer provides summary + recent messages
7. Send to Ollama
8. Background (fire-and-forget):
   a. Index new user + assistant messages
   b. Extract entities from exchange (Layer 3)
```

### Step 4: Slim Down Client-Side Prompt

**File:** `client/src/utils/promptBuilder.js`

The CHARACTER CARD keeps ONLY identity + traits. Everything else (backstory, skills, hobbies, avoid, inventory) is removed — the server injects relevant pieces via FAISS retrieval into the `RETRIEVED CONTEXT` section.

### Step 5: Conversation Summary Buffer

**New file:** `services/conversationMemory.js`

Uses LangChain's `ConversationSummaryBufferMemory`:
- `maxTokenLimit: 800`
- Summarizes older messages using the user's selected chat model
- Summary stored in SQLite (`sessions.summary` column)
- Replaces the current crude message windowing

### Step 6: Entity Extraction

**New file:** `services/entityMemory.js`

After each exchange (background):
- LLM call: "Extract any facts the user revealed about themselves"
- Store in SQLite `entities` table: `session_id, entity_name, entity_info, updated_at`
- Embed and add to session FAISS index
- On session load, re-add entity docs to index

### Step 7: Database Schema Changes

**File:** `services/database.js`

```sql
ALTER TABLE sessions ADD COLUMN summary TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_info TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| **NEW** `services/memoryManager.js` | Create | Unified FAISS index + token-budgeted retrieval |
| **NEW** `services/conversationMemory.js` | Create | LangChain ConversationSummaryBufferMemory |
| **NEW** `services/entityMemory.js` | Create | Entity extraction + persistence |
| `server.js` | Modify | Integrate memory manager into chat endpoint |
| `services/database.js` | Modify | Add summary column + entities table |
| `client/src/utils/promptBuilder.js` | Modify | Slim CHARACTER CARD to identity+traits only |
| `routes/characters.js` | Modify | Trigger lorebook reindex on character save |

---

## Implementation Order

1. **Steps 1+2** — MemoryManager + lorebook indexing (highest impact, enables field-level RAG)
2. **Steps 3+4** — Server integration + prompt slimming (connects it end-to-end)
3. **Step 5** — Summary buffer (replaces crude message windowing)
4. **Steps 6+7** — Entity memory + DB changes (adds user knowledge tracking)

Each phase is independently shippable.

---

## Verification Checklist

- [ ] **Lorebook:** "tell me about yourself" → backstory retrieved. "what's 2+2" → no lorebook fields.
- [ ] **Multi-char:** Scene with 3 characters → only relevant character's fields retrieved.
- [ ] **Token budget:** Console log retrieved chunks + token count — never exceeds ~1300.
- [ ] **Summary:** 50+ message conversation → verify summary generated, Ollama receives condensed history.
- [ ] **Entities:** "I'm a chef" → next message, entity recalled without it being in recent messages.
- [ ] **Scale test:** Load 20 characters, verify retrieval stays fast and within budget.

---

## Existing Infrastructure Being Reused

| Component | File | What we reuse |
|-----------|------|---------------|
| FAISS store | `services/vectorSearch.js` | `FaissStore` patterns, save/load, similarity search |
| Embeddings | `services/embeddingService.js` | `OllamaEmbeddings` with nomic-embed-text (768-dim) |
| Message indexing | `services/embeddingService.js` | `addDocuments()`, `shouldUseRAG()` patterns |
| Vector storage | `data/vectors/` | Directory structure, per-session isolation |
| LangChain deps | `package.json` | `@langchain/community`, `@langchain/core`, `@langchain/ollama`, `langchain` |
