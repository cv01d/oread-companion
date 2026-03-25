/**
 * Manages the phi4-mini extraction model lifecycle.
 * Checks availability on startup, auto-downloads if missing,
 * and exposes readiness state for gating extraction calls.
 */

import ollamaService from './ollama.js';

const EXTRACTION_MODEL = process.env.OLLAMA_EXTRACTION_MODEL || 'phi4-mini';

class ExtractionModelManager {
  constructor() {
    this._ready = false;
    this._downloading = false;
    this._error = null;
    this._progress = 0;
    this._modelName = EXTRACTION_MODEL;
  }

  get modelName() {
    return this._modelName;
  }

  isReady() {
    return this._ready;
  }

  getStatus() {
    if (this._ready) return { status: 'ready', model: this._modelName };
    if (this._downloading) return { status: 'downloading', model: this._modelName, progress: this._progress };
    if (this._error) return { status: 'error', model: this._modelName, error: this._error };
    return { status: 'pending', model: this._modelName };
  }

  /**
   * Ensure the extraction model is ready, waiting for download if needed.
   * Use this for explicit user actions (like re-extraction) where we should
   * block until the model is available rather than silently skipping.
   *
   * @param {number} timeoutMs - Max time to wait (default 5 minutes)
   * @returns {Promise<boolean>} true if ready, false if timed out or failed
   */
  async ensureReady(timeoutMs = 300000) {
    if (this._ready) return true;

    // If not downloading yet, kick off initialization
    if (!this._downloading && !this._error) {
      await this.initialize();
      if (this._ready) return true;
    }

    // Wait for in-progress download
    if (this._downloading) {
      const start = Date.now();
      while (this._downloading && (Date.now() - start) < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return this._ready;
    }

    return false;
  }

  /**
   * Initialize: check if model exists, download if not.
   * Non-blocking — returns immediately, download runs in background.
   */
  async initialize() {
    try {
      const available = await ollamaService.isModelAvailable(this._modelName);
      if (available) {
        this._ready = true;
        console.log(`✅ Extraction model (${this._modelName}) is available`);
        return;
      }

      console.log(`⬇️  Extraction model (${this._modelName}) not found. Downloading in background...`);
      this._downloadInBackground();
    } catch (err) {
      this._error = err.message;
      console.error(`❌ Failed to check extraction model availability:`, err.message);
    }
  }

  async _downloadInBackground() {
    this._downloading = true;
    this._error = null;
    this._progress = 0;

    try {
      const stream = await ollamaService.pullModel(this._modelName);
      for await (const chunk of stream) {
        if (chunk.total && chunk.completed) {
          this._progress = Math.round((chunk.completed / chunk.total) * 100);
        }
      }
      this._ready = true;
      this._downloading = false;
      console.log(`✅ Extraction model (${this._modelName}) downloaded successfully`);
    } catch (err) {
      this._downloading = false;
      this._error = err.message;
      console.error(`❌ Failed to download extraction model:`, err.message);
    }
  }
}

export default new ExtractionModelManager();
