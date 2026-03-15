/**
 * Optimized Ollama embedding client.
 *
 * - Calls /api/embed with batch input (single HTTP round-trip for N texts)
 * - LRU in-memory cache avoids re-embedding identical texts (lorebook, repeated queries)
 * - Single shared instance replaces the 3 separate OllamaEmbeddings from LangChain
 */

import { CONFIG } from '../config/index.js';

const MAX_CACHE_SIZE = 512;

class OllamaEmbedClient {
  constructor() {
    this.baseUrl = CONFIG.OLLAMA_URL;
    this.model = CONFIG.OLLAMA_EMBED_MODEL;
    // Simple LRU: Map preserves insertion order; we evict from the front.
    this._cache = new Map();
  }

  /**
   * Embed a single text string. Returns Float64Array.
   */
  async embedQuery(text) {
    const cached = this._cache.get(text);
    if (cached) {
      // Move to end (most recently used)
      this._cache.delete(text);
      this._cache.set(text, cached);
      return cached;
    }

    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text })
    });

    if (!res.ok) {
      throw new Error(`Ollama embed failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const vector = data.embeddings[0];
    this._cacheSet(text, vector);
    return vector;
  }

  /**
   * Embed multiple texts in one HTTP call. Returns array of vectors.
   */
  async embedDocuments(texts) {
    if (texts.length === 0) return [];

    // Separate cached from uncached
    const results = new Array(texts.length);
    const uncachedIndices = [];
    const uncachedTexts = [];

    for (let i = 0; i < texts.length; i++) {
      const cached = this._cache.get(texts[i]);
      if (cached) {
        // Refresh LRU position
        this._cache.delete(texts[i]);
        this._cache.set(texts[i], cached);
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    if (uncachedTexts.length === 0) return results;

    // Single batch call for all uncached texts
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: uncachedTexts })
    });

    if (!res.ok) {
      throw new Error(`Ollama embed failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const vectors = data.embeddings;

    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      results[idx] = vectors[j];
      this._cacheSet(uncachedTexts[j], vectors[j]);
    }

    return results;
  }

  _cacheSet(key, value) {
    if (this._cache.size >= MAX_CACHE_SIZE) {
      // Evict oldest entry
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  clearCache() {
    this._cache.clear();
  }
}

export default new OllamaEmbedClient();
