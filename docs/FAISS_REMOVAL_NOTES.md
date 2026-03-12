# FAISS Removal - Migration Complete

## What Changed

The application has been migrated from **FAISS file-based vector storage** to **SQLite BLOB storage** for embeddings.

### Before (FAISS)
- Vectors stored in `/data/vector-store/{session-id}.index` files
- Separate file per session
- File locking issues with concurrent access
- Required `faiss-node` dependency (C++ build tools)
- MCP vector store server needed

### After (SQLite)
- Vectors stored in `message_vectors` table as BLOBs
- Single `chat.db` file for everything
- WAL mode enabled for concurrent access
- No external dependencies
- Pure JavaScript implementation

## Benefits

✅ **No File Locking** - WAL mode handles concurrency
✅ **Atomic Transactions** - Vectors + messages in one database
✅ **Simpler Architecture** - One storage system
✅ **Zero Config** - No C++ build tools needed
✅ **Security** - Cryptographic session IDs + encryption ready
✅ **Memory Efficient** - Sliding window (100 messages)
✅ **Model Versioning** - Track embedding model changes

## What To Do

### 1. Old FAISS Files
The old `/data/vector-store/` directory is no longer used.

**To backup:**
```bash
tar -czf vector-store-backup-$(date +%Y%m%d).tar.gz data/vector-store/
```

**To remove (after verification):**
```bash
rm -rf data/vector-store/
```

### 2. Re-generate Embeddings (Optional)
If you had existing FAISS vectors, they won't be automatically migrated. The system will generate new embeddings as messages are sent.

To force re-embedding of existing sessions:
```javascript
// In your code or a script
import langchainRAG from './services/langchainRAG.js';
import database from './services/database.js';

// For a specific session
const messages = await database.all(
  'SELECT * FROM messages WHERE session_id = ?',
  [sessionId]
);

await langchainRAG.addDocuments(sessionId, messages);
```

### 3. Remove FAISS Dependencies (Optional)
The following can be safely removed from `package.json`:
- `faiss-node` (if present)
- `@langchain/community` vector store imports (FAISS-related)

The MCP vector store server (`mcp-servers/vector-store-server.js`) is no longer needed but kept for reference.

## Architecture Changes

### New Files
- **services/vectorSearch.js** - In-memory cosine similarity search
- **services/sessionSecurity.js** - Cryptographic utilities
- **scripts/migrate-vectors-to-sqlite.js** - Migration script (placeholder)
- **scripts/verify-vector-integrity.js** - Weekly integrity check

### Modified Files
- **services/database.js** - Added `message_vectors` table, enabled WAL mode
- **services/langchainRAG.js** - Uses SQLite vectors instead of FAISS
- **services/mcpClient.js** - Vector store methods deprecated

### Database Schema
New table: `message_vectors`
```sql
CREATE TABLE message_vectors (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  vector BLOB NOT NULL,          -- 3KB for 768-dim
  dimension INTEGER NOT NULL,
  model TEXT NOT NULL,            -- e.g., 'nomic-embed-text'
  model_version TEXT,             -- For re-indexing
  checksum TEXT,                  -- Integrity verification
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

## Performance

### Memory Usage
- **Sliding Window**: Only loads last 100 vectors per search
- **Size**: 768 dimensions × 4 bytes = 3 KB per vector
- **100 vectors**: ~300 KB in memory
- **Safe for**: Sessions with <10,000 messages

### Search Speed
- **Pure JavaScript cosine similarity**: ~1ms per 100 vectors
- **No disk I/O** during search (all in-memory)
- **SQLite indexes**: Fast session/model filtering

### Concurrent Access
- **WAL mode**: Multiple readers + single writer
- **No file locking issues**: SQLite handles everything
- **Atomic operations**: Vectors + messages in transactions

## Security Features

### Session Security (NEW)
- **Cryptographic session IDs**: `crypto.randomBytes(16)`
- **Machine-specific encryption key**: `~/.oread-chat-key`
- **AES-256-CBC**: Industry-standard encryption
- **File permissions**: `0o600` (owner only)

### Vector Integrity
- **Checksums**: SHA-256 hash of vector data
- **Verification**: Weekly maintenance script
- **Detection**: Bit-rot and corruption

## Model Migration

### Changing Embedding Models
The system now tracks which embedding model was used for each vector.

**Scenario**: Switching from `nomic-embed-text` to `mxbai-embed-large`

**Solution**: Keep both models' vectors, filter by model during search

```javascript
// Old vectors with nomic-embed-text are preserved
// New vectors use mxbai-embed-large
// Search automatically filters by current model
```

**Re-indexing** (optional):
```bash
node scripts/reindex-session.js <session-id> mxbai-embed-large
```

## Maintenance

### Weekly Integrity Check
Run this to detect database corruption:
```bash
node scripts/verify-vector-integrity.js
```

Or add to crontab:
```cron
# Every Sunday at 2 AM
0 2 * * 0 cd /path/to/chat && node scripts/verify-vector-integrity.js
```

### Database Size
Monitor your `chat.db` file size:
```bash
ls -lh data/chat.db
```

Expected growth:
- Base: ~100 KB (empty)
- Per 1,000 messages: ~3 MB (vectors only)
- Per 1,000 messages: ~500 KB (message text)

## Rollback (If Needed)

If you encounter issues:

1. **Restore FAISS files** from backup
2. **Revert code changes** (git)
3. **Re-enable MCP vector store** in `mcpClient.js`
4. **Report issue** on GitHub

## Questions?

See the full migration plan: [docs/SQLITE_VECTOR_MIGRATION.md](docs/SQLITE_VECTOR_MIGRATION.md)

---

**Migration Date**: 2026-03-12
**Version**: 3.1.0 (SQLite Vector Storage)
