import crypto from 'crypto';
import database from './database.js';

class SQLiteVectorSearch {
  constructor() {
    this.SLIDING_WINDOW = 100; // Only search last 100 messages
  }

  async search(sessionId, queryVector, topK = 5, useWindow = true, embeddingModel = 'nomic-embed-text') {
    // 1. Load vectors with SLIDING WINDOW (prevents memory issues)
    // CRITICAL: Filter by model to prevent "hallucination soup" from model drift
    const query = useWindow
      ? `
        SELECT mv.id, mv.message_id, mv.vector, mv.dimension, m.timestamp
        FROM message_vectors mv
        JOIN messages m ON mv.message_id = m.id
        WHERE mv.session_id = ?
          AND mv.model = ?
        ORDER BY m.timestamp DESC
        LIMIT ?
      `
      : `
        SELECT id, message_id, vector, dimension
        FROM message_vectors
        WHERE session_id = ?
          AND model = ?
      `;

    const params = useWindow
      ? [sessionId, embeddingModel, this.SLIDING_WINDOW]
      : [sessionId, embeddingModel];
    const rows = await database.all(query, params);

    if (rows.length === 0) {
      return [];
    }

    // 2. Deserialize BLOBs to float32 arrays (optimized)
    const vectors = rows.map(row => ({
      id: row.id,
      messageId: row.message_id,
      vector: this.blobToFloat32Array(row.vector, row.dimension)
    }));

    // 3. Calculate cosine similarity for each
    const similarities = vectors.map(v => ({
      messageId: v.messageId,
      score: this.cosineSimilarity(queryVector, v.vector)
    }));

    // 4. Sort and return top K
    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  float32ArrayToBlob(arr) {
    // Ensure 4-byte alignment for optimal performance
    const float32 = new Float32Array(arr);
    return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
  }

  blobToFloat32Array(blob, dimension) {
    // OPTIMIZATION: Use Buffer directly, ensure 4-byte alignment
    // Avoids extra memory copying for large arrays
    if (blob.byteLength !== dimension * 4) {
      throw new Error(`Invalid vector size: expected ${dimension * 4} bytes, got ${blob.byteLength}`);
    }

    // CRITICAL: Node.js Buffers are often slices of larger ArrayBuffers
    // We MUST use byteOffset to avoid reading neighboring memory
    // See: https://nodejs.org/api/buffer.html#buffer_buf_buffer
    return new Float32Array(
      blob.buffer,
      blob.byteOffset,  // REQUIRED: prevents reading wrong memory region
      dimension         // length in elements (not bytes)
    );
  }

  async verifyVectorChecksum(messageId) {
    // Verify vector integrity (use during migration or maintenance)
    const row = await database.get(
      'SELECT vector, dimension, checksum FROM message_vectors WHERE message_id = ?',
      [messageId]
    );

    if (!row) {
      throw new Error(`Vector not found for message: ${messageId}`);
    }

    const vector = this.blobToFloat32Array(row.vector, row.dimension);
    const calculatedChecksum = this.calculateChecksum(vector);

    if (calculatedChecksum !== row.checksum) {
      throw new Error(`Checksum mismatch for message ${messageId}: expected ${row.checksum}, got ${calculatedChecksum}`);
    }

    return true;
  }

  calculateChecksum(vector) {
    // Verify vector integrity
    const hash = crypto.createHash('sha256');
    hash.update(this.float32ArrayToBlob(vector));
    return hash.digest('hex').substring(0, 16); // First 16 chars
  }
}

export default new SQLiteVectorSearch();
