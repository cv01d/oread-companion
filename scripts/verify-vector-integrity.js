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
        if (verified % 100 === 0) {
          console.log(`  ✓ Verified ${verified} vectors...`);
        }
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
    corrupted.slice(0, 10).forEach(c => {
      console.log(`   - Message: ${c.messageId}`);
      if (c.error) {
        console.log(`     Error: ${c.error}`);
      } else {
        console.log(`     Expected: ${c.expected}, Got: ${c.actual}`);
      }
    });

    if (corrupted.length > 10) {
      console.log(`   ... and ${corrupted.length - 10} more`);
    }

    console.log('\n💡 To fix: Re-generate embeddings for corrupted messages');
  }

  await database.close();
}

verifyVectorIntegrity().catch(error => {
  console.error('❌ Integrity check failed:', error);
  process.exit(1);
});
