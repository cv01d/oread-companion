import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import database from '../services/database.js';
import vectorSearch from '../services/vectorSearch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTOR_STORE_DIR = path.join(__dirname, '..', 'data', 'vector-store');

async function migrateVectorsToSQLite() {
  console.log('🚀 Starting FAISS → SQLite migration...\n');

  await database.initialize();

  // Get all session IDs from database
  const sessions = await database.all('SELECT id, name FROM sessions');
  console.log(`Found ${sessions.length} sessions\n`);

  let totalMigrated = 0;
  let errors = 0;
  let skipped = 0;

  for (const session of sessions) {
    const sessionId = session.id;
    const indexPath = path.join(VECTOR_STORE_DIR, `${sessionId}.index`);
    const metaPath = path.join(VECTOR_STORE_DIR, `${sessionId}.meta.json`);

    try {
      // Check if FAISS files exist
      try {
        await fs.access(indexPath);
        await fs.access(metaPath);
      } catch {
        console.log(`  ⏭️  No FAISS files found for session: ${session.name}, skipping\n`);
        skipped++;
        continue;
      }

      console.log(`📦 Migrating session: ${session.name} (${sessionId})`);

      // Read metadata file to get vector information
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const metadata = JSON.parse(metaContent);

      // Read the FAISS index file
      const indexBuffer = await fs.readFile(indexPath);

      console.log(`  Found ${metadata.vectors?.length || 0} vectors in metadata`);

      // Note: This is a simplified migration
      // In a real migration, you would need to use the FAISS library to properly read the index
      // For now, we'll skip actual FAISS parsing and just create placeholders
      console.log(`  ⚠️  FAISS index parsing not yet implemented`);
      console.log(`  💡  If you have embeddings, re-run addDocuments() instead\n`);

      skipped++;

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      errors++;
    }
  }

  console.log('\n✅ Migration scan complete!');
  console.log(`   Sessions processed: ${sessions.length}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  // Check current vector count in SQLite
  const count = await database.get(
    'SELECT COUNT(*) as count FROM message_vectors'
  );
  console.log(`   Vectors in SQLite: ${count.count}`);

  console.log('\n💡 To properly migrate:');
  console.log('   1. Backup your data/vector-store directory');
  console.log('   2. Re-generate embeddings using the addDocuments() method');
  console.log('   3. Once verified, delete the old vector-store directory');

  await database.close();
}

migrateVectorsToSQLite().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
