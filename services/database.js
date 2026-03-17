import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'chat.db');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('✅ Created /data directory');
      }

      // Open database connection
      this.db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
      });

      console.log('✅ Connected to SQLite database');

      // CRITICAL: Enable WAL mode for concurrent reads/writes
      await this.db.exec('PRAGMA journal_mode = WAL;');
      console.log('✅ WAL mode enabled - concurrent access safe');

      // Enable foreign key constraints (MUST be done per connection in SQLite)
      await this.db.exec('PRAGMA foreign_keys = ON;');
      console.log('✅ Foreign key constraints enabled');

      // Create schema
      await this.createTables();

      console.log('✅ Database schema initialized');

      return this.db;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    // Sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        character_name TEXT,
        character_mode TEXT,
        mode TEXT NOT NULL,
        settings_snapshot TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        last_message_at DATETIME,
        archived BOOLEAN DEFAULT 0,
        metadata TEXT
      );
    `);

    // Messages table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        model TEXT,
        system_prompt_hash TEXT,
        token_count INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, timestamp DESC);
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_role
      ON messages(role);
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_updated
      ON sessions(updated_at DESC);
    `);

    // Migrations: add columns for zero-inference memory system
    // ALTER TABLE ignores "duplicate column" errors — safe to re-run
    try {
      await this.db.exec(`ALTER TABLE messages ADD COLUMN pinned INTEGER DEFAULT 0`);
    } catch (e) { /* column already exists */ }

    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN story_notes TEXT DEFAULT ''`);
    } catch (e) { /* column already exists */ }

    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN extracted_facts TEXT DEFAULT '[]'`);
    } catch (e) { /* column already exists */ }

    // Phase 2: Summarization columns
    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN rolling_summary TEXT DEFAULT ''`);
    } catch (e) { /* column already exists */ }

    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN last_summarized_at INTEGER DEFAULT 0`);
    } catch (e) { /* column already exists */ }

    // Phase 3: World state column
    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN world_state TEXT DEFAULT '{}'`);
    } catch (e) { /* column already exists */ }

    // World state history column (state change log)
    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN world_state_history TEXT DEFAULT '[]'`);
    } catch (e) { /* column already exists */ }

    // Phase 4: Character stances column
    try {
      await this.db.exec(`ALTER TABLE sessions ADD COLUMN character_stances TEXT DEFAULT '{}'`);
    } catch (e) { /* column already exists */ }

    // Phase 5: FTS5 full-text search for messages
    try {
      await this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
        USING fts5(content, content='messages', content_rowid='rowid')
      `);
    } catch (e) {
      console.warn('FTS5 setup warning:', e.message);
    }

    try {
      await this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END
      `);
    } catch (e) { /* trigger already exists */ }

    try {
      await this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        END
      `);
    } catch (e) { /* trigger already exists */ }

    // Phase 6: Global memory and character relationships tables
    await this.db.exec(`
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
      )
    `);

    await this.db.exec(`
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
      )
    `);

    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_global_memory_type ON global_memory(entity_type)`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_global_memory_key ON global_memory(entity_key)`);

    try {
      await this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS global_memory_fts
        USING fts5(content, entity_key, content='global_memory', content_rowid='rowid')
      `);
    } catch (e) {
      console.warn('Global memory FTS5 setup warning:', e.message);
    }

    try {
      await this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS global_memory_fts_ai AFTER INSERT ON global_memory BEGIN
          INSERT INTO global_memory_fts(rowid, content, entity_key) VALUES (new.rowid, new.content, new.entity_key);
        END
      `);
    } catch (e) { /* trigger already exists */ }

    try {
      await this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS global_memory_fts_ad AFTER DELETE ON global_memory BEGIN
          INSERT INTO global_memory_fts(global_memory_fts, rowid, content, entity_key) VALUES('delete', old.rowid, old.content, old.entity_key);
        END
      `);
    } catch (e) { /* trigger already exists */ }

    try {
      await this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS global_memory_fts_au AFTER UPDATE ON global_memory BEGIN
          INSERT INTO global_memory_fts(global_memory_fts, rowid, content, entity_key) VALUES('delete', old.rowid, old.content, old.entity_key);
          INSERT INTO global_memory_fts(rowid, content, entity_key) VALUES (new.rowid, new.content, new.entity_key);
        END
      `);
    } catch (e) { /* trigger already exists */ }

    // World snapshots table for cross-session world persistence
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_snapshots (
        id TEXT PRIMARY KEY,
        template_id TEXT,
        character_name TEXT,
        world_state_summary TEXT NOT NULL,
        key_locations TEXT DEFAULT '[]',
        key_characters TEXT DEFAULT '[]',
        key_events TEXT DEFAULT '[]',
        source_session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_world_snapshots_lookup ON world_snapshots(template_id, character_name)`);

    // Backfill FTS index for existing messages (runs once — skips if already populated)
    try {
      const ftsCount = await this.db.get('SELECT COUNT(*) as count FROM messages_fts');
      const msgCount = await this.db.get('SELECT COUNT(*) as count FROM messages');
      if (ftsCount && msgCount && ftsCount.count < msgCount.count) {
        await this.db.exec(`INSERT INTO messages_fts(rowid, content) SELECT rowid, content FROM messages`);
        console.log(`FTS5: Backfilled ${msgCount.count} messages into search index`);
      }
    } catch (e) {
      // FTS backfill is non-critical
      console.warn('FTS5 backfill warning:', e.message);
    }

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_pinned
      ON messages(session_id, pinned);
    `);

  }

  // Helper methods
  async all(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return await this.db.all(sql, params);
  }

  async run(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return await this.db.run(sql, params);
  }

  async get(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return await this.db.get(sql, params);
  }

  async transaction(fn) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    await this.db.run('BEGIN');
    try {
      const result = await fn();
      await this.db.run('COMMIT');
      return result;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      console.log('✅ Database connection closed');
    }
  }
}

export default new DatabaseService();
