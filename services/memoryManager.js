/**
 * Unified Memory Manager — orchestrates a single FAISS index per session
 * containing lorebook docs, conversation messages, and entity facts.
 * Retrieval uses token-budgeted ranking across all document types.
 */

import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from '@langchain/core/documents';
import path from 'path';
import fs from 'fs/promises';
import { CONFIG } from '../config/index.js';
import database from './database.js';
import ollamaEmbed from './ollamaEmbed.js';

const VECTORS_DIR = path.join(process.cwd(), 'data', 'vectors');

// Lorebook fields to index per character
const LOREBOOK_FIELDS = ['backstory', 'knowledgeSkills', 'hobbiesInterests', 'thingsToAvoid', 'inventory'];

// Human-readable labels for lorebook fields
const FIELD_LABELS = {
  backstory: 'BACKSTORY',
  knowledgeSkills: 'KNOWLEDGE/SKILLS',
  hobbiesInterests: 'HOBBIES/INTERESTS',
  thingsToAvoid: 'THINGS THEY AVOID',
  inventory: 'INVENTORY'
};

class MemoryManager {
  constructor() {
    this.embeddings = ollamaEmbed;
    // Track which sessions have been initialized this server lifetime
    this._initialized = new Set();
    // In-memory FAISS store cache — avoids disk load/save on every operation
    this._storeCache = new Map();
    this._dirty = new Set(); // sessions with unsaved changes
  }

  _sessionDir(sessionId) {
    return path.join(VECTORS_DIR, sessionId);
  }

  async _indexExists(sessionId) {
    if (this._storeCache.has(sessionId)) return true;
    try {
      await fs.access(path.join(this._sessionDir(sessionId), 'faiss.index'));
      return true;
    } catch {
      return false;
    }
  }

  async _loadOrCreateStore(sessionId, docs = []) {
    const dir = this._sessionDir(sessionId);

    // Return cached store if available
    let store = this._storeCache.get(sessionId);
    if (store) {
      if (docs.length > 0) {
        await store.addDocuments(docs);
        this._dirty.add(sessionId);
        this._scheduleSave(sessionId);
      }
      return store;
    }

    // Load from disk or create new
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(path.join(dir, 'faiss.index'));
      store = await FaissStore.load(dir, this.embeddings);
      if (docs.length > 0) {
        await store.addDocuments(docs);
        this._dirty.add(sessionId);
      }
    } catch {
      if (docs.length > 0) {
        store = await FaissStore.fromDocuments(docs, this.embeddings);
        this._dirty.add(sessionId);
      } else {
        return null;
      }
    }

    this._storeCache.set(sessionId, store);
    this._scheduleSave(sessionId);
    return store;
  }

  /**
   * Debounced disk persist — batches rapid writes into a single save.
   * Waits 5s after the last write before flushing to disk.
   */
  _scheduleSave(sessionId) {
    if (!this._dirty.has(sessionId)) return;
    if (!this._saveTimers) this._saveTimers = new Map();

    if (this._saveTimers.has(sessionId)) {
      clearTimeout(this._saveTimers.get(sessionId));
    }

    this._saveTimers.set(sessionId, setTimeout(async () => {
      this._saveTimers.delete(sessionId);
      await this._flushToDisk(sessionId);
    }, 5000));
  }

  async _flushToDisk(sessionId) {
    if (!this._dirty.has(sessionId)) return;
    const store = this._storeCache.get(sessionId);
    if (!store) return;

    try {
      const dir = this._sessionDir(sessionId);
      await fs.mkdir(dir, { recursive: true });
      await store.save(dir);
      this._dirty.delete(sessionId);
    } catch (err) {
      console.error(`Failed to flush FAISS index for ${sessionId.slice(0, 8)}:`, err);
    }
  }

  // ── Initialization ──────────────────────────────────────────────

  /**
   * Initialize session memory: index lorebook fields + load entities.
   * Idempotent — skips if already initialized this server lifetime.
   */
  async initializeSession(sessionId, characters) {
    if (this._initialized.has(sessionId)) return;

    try {
      const docs = [];

      // Index lorebook fields for each character
      if (characters && characters.length > 0) {
        for (const char of characters) {
          const charDocs = this._buildLorebookDocs(char);
          docs.push(...charDocs);
        }
      }

      // Load existing entity memories from SQLite
      const entities = await database.all(
        'SELECT * FROM entities WHERE session_id = ?',
        [sessionId]
      );
      for (const entity of entities) {
        docs.push(new Document({
          pageContent: `${entity.entity_name}: ${entity.entity_info}`,
          metadata: {
            type: 'entity',
            entityName: entity.entity_name,
            entityId: entity.id,
            sessionId
          }
        }));
      }

      if (docs.length > 0) {
        await this._loadOrCreateStore(sessionId, docs);
        console.log(`🧠 Memory initialized: ${docs.length} docs (lorebook + entities) for session ${sessionId.slice(0, 8)}`);
      }

      this._initialized.add(sessionId);
    } catch (error) {
      console.error('Memory initialization error:', error);
      // Don't block chat on memory failure
    }
  }

  /**
   * Build lorebook documents for a single character.
   */
  _buildLorebookDocs(character) {
    const docs = [];
    const name = character.name || 'Unknown';

    for (const field of LOREBOOK_FIELDS) {
      const value = character[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) continue;

      const label = FIELD_LABELS[field] || field.toUpperCase();
      docs.push(new Document({
        pageContent: `${label} [${name}]: ${value}`,
        metadata: {
          type: 'lorebook',
          characterName: name,
          field,
          docId: `lorebook-${name}-${field}`
        }
      }));
    }
    return docs;
  }

  // ── Document Indexing ───────────────────────────────────────────

  /**
   * Embed and index new conversation messages.
   * messages: [{ id, content, role, timestamp }]
   */
  async addMessages(sessionId, messages) {
    const valid = messages.filter(m => m.role !== 'system' && m.content.length > 20);
    if (valid.length === 0) return;

    const docs = valid.map(msg => new Document({
      pageContent: msg.content,
      metadata: {
        type: 'message',
        messageId: msg.id,
        role: msg.role,
        timestamp: msg.timestamp
      }
    }));

    await this._loadOrCreateStore(sessionId, docs);

    // Mark as embedded in SQLite
    for (const msg of valid) {
      await database.run('UPDATE messages SET embedded = 1 WHERE id = ?', [msg.id]);
    }
  }

  /**
   * Embed and index an entity fact.
   */
  async addEntity(sessionId, entityId, entityName, entityInfo) {
    const doc = new Document({
      pageContent: `${entityName}: ${entityInfo}`,
      metadata: {
        type: 'entity',
        entityName,
        entityId,
        sessionId
      }
    });

    await this._loadOrCreateStore(sessionId, [doc]);
  }

  // ── Retrieval with Token Budgeting ──────────────────────────────

  /**
   * Retrieve relevant context from the unified index, ranked by relevance,
   * filling up to tokenBudget tokens.
   *
   * Returns: { chunks: [{ content, type, score, metadata }], totalTokens }
   */
  async retrieve(sessionId, userMessage, tokenBudget = 1300) {
    if (!await this._indexExists(sessionId)) {
      return { chunks: [], totalTokens: 0 };
    }

    try {
      // Embed the user's message
      const queryVector = await this.embeddings.embedQuery(userMessage);

      // Use cached store or load from disk
      const store = await this._loadOrCreateStore(sessionId);
      if (!store) return { chunks: [], totalTokens: 0 };
      const results = await store.similaritySearchVectorWithScore(queryVector, 20);

      // Score and rank all results
      const scored = results.map(([doc, distance]) => ({
        content: doc.pageContent,
        type: doc.metadata.type || 'message',
        score: 1 / (1 + distance), // L2 → similarity (0-1)
        metadata: doc.metadata
      }));

      // Sort by relevance (highest first)
      scored.sort((a, b) => b.score - a.score);

      // Fill token budget greedily
      const chunks = [];
      let totalTokens = 0;

      for (const item of scored) {
        const itemTokens = this._estimateTokens(item.content);
        if (totalTokens + itemTokens > tokenBudget) continue;
        chunks.push(item);
        totalTokens += itemTokens;
      }

      return { chunks, totalTokens };
    } catch (error) {
      console.error('Memory retrieval error:', error);
      return { chunks: [], totalTokens: 0 };
    }
  }

  /**
   * Format retrieved chunks into a string for injection into the system prompt.
   */
  formatRetrievedContext(chunks) {
    if (chunks.length === 0) return '';

    const lines = ['RETRIEVED CONTEXT:'];
    for (const chunk of chunks) {
      lines.push(chunk.content);
    }
    return lines.join('\n');
  }

  // ── Index Maintenance ───────────────────────────────────────────

  /**
   * Rebuild lorebook docs for a character. This re-initializes the session
   * so the next chat turn picks up the new data.
   */
  async rebuildCharacterDocs(sessionId) {
    // Force re-initialization on next chat turn
    this._initialized.delete(sessionId);
    this._storeCache.delete(sessionId);
    this._dirty.delete(sessionId);
  }

  /**
   * Clean up session index files.
   */
  async deleteSession(sessionId) {
    this._initialized.delete(sessionId);
    this._storeCache.delete(sessionId);
    this._dirty.delete(sessionId);
    if (this._saveTimers?.has(sessionId)) {
      clearTimeout(this._saveTimers.get(sessionId));
      this._saveTimers.delete(sessionId);
    }
    const dir = this._sessionDir(sessionId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  // ── Token Estimation ────────────────────────────────────────────

  _estimateTokens(text) {
    if (!text) return 0;
    // ~1.3 tokens per word heuristic (plan spec)
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }
}

export default new MemoryManager();
