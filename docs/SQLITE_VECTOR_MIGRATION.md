# Plan: Eliminate File Locking Issues and Secure Session Data

## Problem Statement
- Current architecture uses separate FAISS `.index` files per session → file locking issues
- Session data stored in separate files → security vulnerabilities
- No authentication/authorization on session access
- Potential for concurrent access conflicts

## Solution: Unified SQLite Storage with Embedded Vectors

### Core Changes

1. **Remove FAISS file-based storage entirely**
2. **Store vectors directly in SQLite** using BLOB columns
3. **Implement proper session security**
4. **Add cryptographic session IDs**
5. **Single database file = single lock = no file sync issues**

## Implementation Plan

### Phase 1: Add Vector Storage to SQLite

**File: `services/database.js`**

Add new table for storing vectors directly in SQLite:

```sql
CREATE TABLE IF NOT EXISTS message_vectors (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  vector BLOB NOT NULL,          -- Raw float32 array (3KB for 768-dim)
  dimension INTEGER NOT NULL,     -- 768 for nomic-embed-text
  model TEXT NOT NULL,            -- Track which embedding model
  model_version TEXT,             -- For re-indexing when upgrading models
  checksum TEXT,                  -- Verify vector integrity
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vectors_session ON message_vectors(session_id);
CREATE INDEX IF NOT EXISTS idx_vectors_message ON message_vectors(message_id);
CREATE INDEX IF NOT EXISTS idx_vectors_model ON message_vectors(model, model_version);
```

**Critical: Enable WAL Mode**

```javascript
// In database initialization
async initialize() {
  this.db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // CRITICAL: Enable WAL mode for concurrent reads/writes
  await this.db.run('PRAGMA journal_mode = WAL');
  await this.db.run('PRAGMA foreign_keys = ON');

  console.log('✅ WAL mode enabled - concurrent access safe');
}
```

**Why WAL is essential:**
- Allows RAG searches while writing new vectors
- No read blocking during writes
- Single writer, multiple readers
- Eliminates the exact locking issue you want to avoid

**Why this works:**
- Vectors stored as BLOBs (768 × 4 bytes = 3KB each)
- 1,000 messages = only 3MB in memory
- No separate files = no file locking conflicts
- SQLite handles all locking automatically
- One database file = one lock mechanism
- Atomic transactions across vectors + messages
- Model versioning for future upgrades

### Phase 2: Replace FAISS with In-Memory Similarity Search

**File: `services/vectorSearch.js` (NEW)**

Create a simple cosine similarity search that loads vectors from SQLite:

```javascript
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
```

**Performance Optimizations:**

1. **Sliding Window (100 messages)**: Prevents "forever sessions" from loading 10,000+ vectors
2. **4-byte alignment**: Ensures efficient Float32Array creation
3. **Direct Buffer views**: Uses `byteOffset` to avoid reading wrong memory region
4. **JOIN with messages**: Sorts by timestamp for recency
5. **Model filtering**: Prevents mixing embeddings from different models (prevents hallucination)
6. **Checksum validation**: Detects corrupted vectors (use in migration/maintenance, not hot path)

**Math:**
- 768 dimensions × 4 bytes = 3 KB per vector
- 100 vectors = 300 KB in memory
- Even 1,000 vectors = only 3 MB (perfectly safe)

**When to Verify Checksums:**
- ✅ During migration (one-time)
- ✅ Weekly background maintenance task
- ❌ NOT during search (too slow, ~1ms per vector)

### Phase 3: Add Cryptographic Session Security

**File: `services/sessionSecurity.js` (NEW)**

```javascript
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const KEY_FILE = path.join(os.homedir(), '.oread-chat-key');

class SessionSecurity {
  constructor() {
    this.encryptionKey = null;
  }

  // Initialize encryption key (machine-specific "pepper" strategy)
  async initialize() {
    try {
      // Try to load existing key
      const keyData = await fs.readFile(KEY_FILE, 'utf8');
      this.encryptionKey = Buffer.from(keyData, 'hex');
      console.log('✅ Loaded encryption key from', KEY_FILE);
    } catch (error) {
      // Generate new machine-specific key on first run
      if (error.code === 'ENOENT') {
        console.log('🔐 Generating machine-specific encryption key...');
        this.encryptionKey = crypto.randomBytes(32); // 256-bit key

        // Save to restricted file
        await fs.writeFile(KEY_FILE, this.encryptionKey.toString('hex'), {
          mode: 0o600 // Read/write for owner only
        });

        console.log('✅ Encryption key saved to', KEY_FILE);
        console.log('⚠️  Keep this file safe! Without it, encrypted data is unrecoverable.');
      } else {
        throw error;
      }
    }

    return this.encryptionKey;
  }

  // Generate cryptographically secure session IDs
  generateSecureSessionId() {
    return crypto.randomBytes(16).toString('hex'); // 32 char hex string
  }

  // Hash session ID for storage (prevents guessing)
  hashSessionId(sessionId) {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
  }

  // Encrypt sensitive session data
  encryptSessionData(data) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call initialize() first.');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  decryptSessionData(encrypted) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call initialize() first.');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      Buffer.from(encrypted.iv, 'hex')
    );

    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Verify encrypted data integrity
  verifyIntegrity(encrypted, expectedHash) {
    const hash = crypto.createHash('sha256')
      .update(encrypted.data)
      .digest('hex');
    return hash === expectedHash;
  }
}

export default new SessionSecurity();
```

**Security Improvements:**

1. **Machine-Specific Key**: Generated on first run, stored in `~/.oread-chat-key`
2. **File Permissions**: `0o600` (owner read/write only)
3. **No Environment Variables**: Key persists across restarts
4. **Defense in Depth**: Even if someone copies `chat.db`, they need the key file
5. **AES-256-CBC**: Industry-standard encryption
6. **Unique IVs**: Each encryption uses a new initialization vector

**Update sessions table:**
```sql
ALTER TABLE sessions ADD COLUMN session_hash TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN encryption_iv TEXT;
```

### Phase 4: Remove FAISS Dependencies

**Files to modify:**

1. **`package.json`** - Remove `faiss-node` dependency
2. **`mcp-servers/vector-store-server.js`** - DELETE (no longer needed)
3. **`services/mcpClient.js`** - Remove vector store client
4. **`services/langchainRAG.js`** - Replace FAISS calls with SQLiteVectorSearch
5. **`/data/vector-store/`** - DELETE directory (backup first)

### Phase 5: Update RAG Service

**File: `services/langchainRAG.js`**

Replace FAISS usage:

```javascript
// OLD:
import { FaissStore } from '@langchain/community/vectorstores/faiss';

// NEW:
import { SQLiteVectorSearch } from './vectorSearch.js';

class RAGService {
  constructor() {
    this.vectorSearch = new SQLiteVectorSearch();
  }

  async getRelevantContext(sessionId, query, model) {
    // Generate embedding for query
    const embedding = await this.generateEmbedding(query, model);

    // Search SQLite vectors (no file access!)
    const results = await this.vectorSearch.search(sessionId, embedding, 5);

    // Load message content
    const messages = await Promise.all(
      results.map(r => this.loadMessage(r.messageId))
    );

    return messages;
  }

  async storeEmbedding(sessionId, messageId, text, model) {
    // Generate embedding
    const embedding = await this.generateEmbedding(text, model);

    // Store directly in SQLite (no files!)
    await db.run(`
      INSERT INTO message_vectors (id, message_id, session_id, vector, dimension, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      messageId,
      sessionId,
      this.vectorSearch.float32ArrayToBlob(embedding),
      embedding.length,
      model
    ]);
  }
}
```

## Benefits of This Architecture

### ✅ No File Locking Issues
- Single SQLite file = single lock manager
- SQLite handles all concurrency automatically
- WAL mode allows concurrent reads during writes
- No separate FAISS index files to lock

### ✅ Atomic Operations
- Vectors + messages in same database
- Transactions span both tables
- No partial writes
- Rollback on error

### ✅ Secure by Default
- Cryptographic session IDs (crypto.randomBytes)
- Session data encryption (AES-256)
- No predictable file paths
- All data in one protected database file

### ✅ Simpler Architecture
- One storage system (SQLite)
- No MCP vector server needed
- Fewer moving parts = fewer failure points
- Easy backup: copy one file

### ✅ Performance
- In-memory cosine similarity is fast
- SQLite indexes for quick lookups
- No disk I/O for similarity calculations
- Efficient for <10K vectors per session

## Migration Strategy

### Step 1: Add new tables (non-breaking)
- Run schema migration
- Keep existing FAISS files

### Step 2: Dual-write period
- Write to both SQLite and FAISS
- Validate correctness
- Test performance

### Step 3: Switch reads to SQLite
- Use SQLiteVectorSearch for queries
- Keep FAISS as backup

### Step 4: Remove FAISS
- Delete vector-store directory
- Remove dependencies
- Clean up code

## File Changes Summary

### New Files:
- `services/vectorSearch.js` - In-memory similarity search
- `services/sessionSecurity.js` - Cryptographic utilities
- `scripts/migrate-vectors-to-sqlite.js` - Migration script

### Modified Files:
- `services/database.js` - Add message_vectors table
- `services/langchainRAG.js` - Use SQLite vectors
- `services/mcpClient.js` - Remove FAISS client
- `routes/sessions.js` - Add session security
- `package.json` - Remove faiss-node

### Deleted Files:
- `mcp-servers/vector-store-server.js`
- `/data/vector-store/*` (after migration)

## Testing Plan

1. **Unit Tests**
   - Test cosine similarity calculations
   - Verify BLOB serialization
   - Test encryption/decryption

2. **Integration Tests**
   - Create session with vectors
   - Search and verify results
   - Test concurrent access

3. **Migration Test**
   - Export existing FAISS data
   - Import to SQLite
   - Verify search results match

4. **Performance Test**
   - Benchmark search with 1K, 5K, 10K vectors
   - Compare with FAISS performance
   - Ensure <100ms search time

## Rollback Plan

If issues arise:
1. Keep FAISS files during migration
2. Switch reads back to FAISS
3. Debug SQLite implementation
4. Re-enable after fixes

## Security Improvements

### Session Access Control

Add middleware to validate session ownership:

```javascript
// middleware/sessionAuth.js
async function validateSessionAccess(req, res, next) {
  const sessionId = req.params.sessionId;
  const userId = req.user?.id; // Assume auth middleware sets this

  const session = await db.get(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );

  if (!session) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}
```

### Encrypted Settings Snapshot

Encrypt sensitive data in settings_snapshot:

```javascript
// When creating session
const encrypted = sessionSecurity.encryptSessionData(
  settings,
  process.env.ENCRYPTION_KEY
);

await db.run(`
  INSERT INTO sessions (id, settings_snapshot, encryption_iv)
  VALUES (?, ?, ?)
`, [sessionId, encrypted.data, encrypted.iv]);
```

## Performance Considerations

### When to Use In-Memory vs FAISS

**In-Memory SQLite (Recommended for this app):**
- Sessions with <10,000 messages ✅
- Local single-user app ✅
- Simplicity matters ✅

**FAISS (Only if needed later):**
- Sessions with >100,000 messages
- Multi-user cloud deployment
- Sub-10ms search requirements

**Current use case:** In-memory is perfect.

## Verification Steps

After implementation:

1. Create new session → verify secure ID generated
2. Send 100 messages → verify vectors stored in SQLite
3. Query with RAG → verify search results correct
4. Check data/ directory → no .index files created
5. Run concurrent requests → no file locking errors
6. Check database size → reasonable (vectors are compact)
7. Export database → verify single file contains everything

## Migration Script

**File: `scripts/migrate-vectors-to-sqlite.js`**

Script to migrate existing FAISS `.index` files to SQLite:

```javascript
import fs from 'fs/promises';
import path from 'path';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OllamaEmbeddings } from '@langchain/ollama';
import database from '../services/database.js';
import vectorSearch from '../services/vectorSearch.js';

const VECTOR_STORE_DIR = path.join(process.cwd(), 'data', 'vector-store');

async function migrateVectorsToSQLite() {
  console.log('🚀 Starting FAISS → SQLite migration...\n');

  await database.initialize();

  // Get all session IDs from database
  const sessions = await database.all('SELECT id, name FROM sessions');
  console.log(`Found ${sessions.length} sessions\n`);

  let totalMigrated = 0;
  let errors = 0;

  for (const session of sessions) {
    const sessionId = session.id;
    const indexPath = path.join(VECTOR_STORE_DIR, `${sessionId}.index`);
    const metaPath = path.join(VECTOR_STORE_DIR, `${sessionId}.meta.json`);

    try {
      // Check if FAISS files exist
      await fs.access(indexPath);
      await fs.access(metaPath);

      console.log(`📦 Migrating session: ${session.name} (${sessionId})`);

      // Load FAISS store
      const embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' });
      const store = await FaissStore.load(
        path.join(VECTOR_STORE_DIR, sessionId),
        embeddings
      );

      // Extract vectors and metadata
      const { docstore, index } = store;
      const vectorCount = index.ntotal();

      console.log(`  Found ${vectorCount} vectors`);

      // Get all vectors
      for (let i = 0; i < vectorCount; i++) {
        try {
          // Get vector from FAISS index
          const vector = index.getVector(i);

          // Get metadata from docstore
          const docId = store.indexToDocstoreId[i];
          const doc = docstore.search(docId);

          if (!doc) {
            console.log(`  ⚠️  Skipping vector ${i} - no document found`);
            continue;
          }

          // Extract message ID from metadata
          const messageId = doc.metadata.messageId;

          if (!messageId) {
            console.log(`  ⚠️  Skipping vector ${i} - no message ID`);
            continue;
          }

          // Calculate checksum
          const checksum = vectorSearch.calculateChecksum(vector);

          // Insert into SQLite
          await database.run(`
            INSERT INTO message_vectors (
              id, message_id, session_id, vector, dimension,
              model, model_version, checksum
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
          `, [
            crypto.randomUUID(),
            messageId,
            sessionId,
            vectorSearch.float32ArrayToBlob(vector),
            vector.length,
            'nomic-embed-text',
            '1.0',
            checksum
          ]);

          totalMigrated++;
        } catch (vecError) {
          console.log(`  ❌ Error migrating vector ${i}:`, vecError.message);
          errors++;
        }
      }

      console.log(`  ✅ Migrated ${vectorCount} vectors\n`);

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⏭️  No FAISS files found, skipping\n`);
      } else {
        console.log(`  ❌ Error:`, error.message, '\n');
        errors++;
      }
    }
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Total vectors migrated: ${totalMigrated}`);
  console.log(`   Errors: ${errors}`);

  // Verify migration
  const count = await database.get(
    'SELECT COUNT(*) as count FROM message_vectors'
  );
  console.log(`   Vectors in SQLite: ${count.count}`);

  await database.close();
}

migrateVectorsToSQLite().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
```

**Run migration:**
```bash
node scripts/migrate-vectors-to-sqlite.js
```

**Backup old files before deletion:**
```bash
# After successful migration
tar -czf vector-store-backup.tar.gz data/vector-store/
rm -rf data/vector-store/
```

## Background Maintenance Script

**File: `scripts/verify-vector-integrity.js`**

Weekly maintenance task to detect database corruption:

```javascript
import database from '../services/database.js';
import vectorSearch from '../services/vectorSearch.js';

async function verifyVectorIntegrity() {
  console.log('🔍 Starting vector integrity check...\n');

  await database.initialize();

  // Get all vectors
  const vectors = await database.all(`
    SELECT id, message_id, vector, dimension, checksum
    FROM message_vectors
  `);

  console.log(`Checking ${vectors.length} vectors...\n`);

  let verified = 0;
  let corrupted = [];

  for (const row of vectors) {
    try {
      const vector = vectorSearch.blobToFloat32Array(row.vector, row.dimension);
      const calculatedChecksum = vectorSearch.calculateChecksum(vector);

      if (calculatedChecksum !== row.checksum) {
        corrupted.push({
          messageId: row.message_id,
          expected: row.checksum,
          actual: calculatedChecksum
        });
        console.log(`❌ Corrupted vector: message ${row.message_id}`);
      } else {
        verified++;
      }
    } catch (error) {
      console.log(`❌ Error reading vector for message ${row.message_id}:`, error.message);
      corrupted.push({ messageId: row.message_id, error: error.message });
    }
  }

  console.log(`\n✅ Verification complete!`);
  console.log(`   Verified: ${verified}`);
  console.log(`   Corrupted: ${corrupted.length}`);

  if (corrupted.length > 0) {
    console.log('\n⚠️  Corrupted vectors found:');
    corrupted.forEach(c => {
      console.log(`   - Message: ${c.messageId}`);
      if (c.error) {
        console.log(`     Error: ${c.error}`);
      } else {
        console.log(`     Expected: ${c.expected}, Got: ${c.actual}`);
      }
    });

    console.log('\n💡 To fix: Re-generate embeddings for corrupted messages');
  }

  await database.close();
}

verifyVectorIntegrity().catch(error => {
  console.error('❌ Integrity check failed:', error);
  process.exit(1);
});
```

**Run weekly via cron:**
```bash
# Add to crontab
0 2 * * 0 cd /path/to/chat && node scripts/verify-vector-integrity.js
```

## Model Migration Strategy

**What happens when user upgrades embedding model?**

**Scenario:** User switches from `nomic-embed-text` to `mxbai-embed-large`

**Solution:** Keep both models' vectors, filter by model during search

```javascript
// In services/langchainRAG.js

async function getRelevantContext(sessionId, query) {
  const currentModel = 'mxbai-embed-large'; // From settings

  // Generate embedding with current model
  const embedding = await generateEmbedding(query, currentModel);

  // Search only vectors from SAME model
  const results = await vectorSearch.search(
    sessionId,
    embedding,
    5,
    true,
    currentModel  // Filter by model
  );

  return results;
}
```

**Background Re-Indexing:** (Optional)

```javascript
// scripts/reindex-session.js
async function reindexSession(sessionId, newModel) {
  console.log(`🔄 Re-indexing session ${sessionId} with model ${newModel}...`);

  // Get all messages in session
  const messages = await database.all(
    'SELECT id, content FROM messages WHERE session_id = ?',
    [sessionId]
  );

  for (const msg of messages) {
    // Generate new embedding
    const embedding = await generateEmbedding(msg.content, newModel);
    const checksum = vectorSearch.calculateChecksum(embedding);

    // Insert new vector (keep old one for rollback)
    await database.run(`
      INSERT INTO message_vectors (id, message_id, session_id, vector, dimension, model, model_version, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      msg.id,
      sessionId,
      vectorSearch.float32ArrayToBlob(embedding),
      embedding.length,
      newModel,
      '1.0',
      checksum
    ]);
  }

  console.log(`✅ Re-indexed ${messages.length} messages`);
}
```

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Update `services/database.js` - add `message_vectors` table
- [ ] Enable WAL mode with `PRAGMA journal_mode = WAL`
- [ ] Add indexes for performance
- [ ] Add model version and checksum columns

### Phase 2: Vector Search Service
- [ ] Create `services/vectorSearch.js`
- [ ] Implement sliding window search (100 messages)
- [ ] Implement 4-byte aligned BLOB conversion
- [ ] Add checksum calculation
- [ ] Test cosine similarity calculations

### Phase 3: Security Layer
- [ ] Create `services/sessionSecurity.js`
- [ ] Implement machine-specific key generation
- [ ] Save key to `~/.oread-chat-key` with `0o600` permissions
- [ ] Add AES-256-CBC encryption
- [ ] Add session ID hashing

### Phase 4: Update RAG Service
- [ ] Modify `services/langchainRAG.js`
- [ ] Replace FAISS calls with `SQLiteVectorSearch`
- [ ] Update embedding storage to use SQLite
- [ ] Test RAG with new vector search
- [ ] Verify search results match old behavior

### Phase 5: Migration
- [ ] Create `scripts/migrate-vectors-to-sqlite.js`
- [ ] Test migration on backup database
- [ ] Run migration on production database
- [ ] Verify vector counts match
- [ ] Backup FAISS files: `tar -czf vector-store-backup.tar.gz data/vector-store/`

### Phase 6: Cleanup
- [ ] Remove FAISS dependencies from `package.json`
- [ ] Delete `mcp-servers/vector-store-server.js`
- [ ] Update `services/mcpClient.js` - remove vector store client
- [ ] Delete `/data/vector-store/` directory
- [ ] Update documentation

### Phase 7: Testing
- [ ] Create new session, send messages
- [ ] Verify vectors stored in SQLite
- [ ] Test RAG search with 50+ messages
- [ ] Test concurrent access (multiple searches)
- [ ] Verify no `.index` files created
- [ ] Check database file size is reasonable
- [ ] Test encryption/decryption of session data

## Next Steps

Ready to implement! Start with Phase 1 (database setup) to maintain backward compatibility.
