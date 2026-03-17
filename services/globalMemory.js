/**
 * Cross-session memory: global memory promotion, retrieval, and relationship tracking.
 * Enables persistent companion relationships that span all conversations.
 */

import database from './database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Promote session facts to global memory.
 * Called after summarization or on session close.
 *
 * @param {string} sessionId
 * @param {Array<{type: string, text: string, turn: number}>} extractedFacts
 * @param {string} rollingSummary
 */
export async function promoteToGlobalMemory(sessionId, extractedFacts, rollingSummary) {
  for (const fact of extractedFacts) {
    const entityKey = `${fact.type}:${fact.text.toLowerCase().trim()}`;

    try {
      // Upsert: update if exists, insert if not
      const existing = await database.get(
        'SELECT id, access_count FROM global_memory WHERE entity_key = ?',
        [entityKey]
      );

      if (existing) {
        await database.run(
          `UPDATE global_memory SET content = ?, access_count = access_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [fact.text, existing.id]
        );
      } else {
        await database.run(
          `INSERT INTO global_memory (id, entity_type, entity_key, content, source_session_id) VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), fact.type, entityKey, fact.text, sessionId]
        );
      }
    } catch (err) {
      // Non-critical — skip this fact
      console.error('Global memory promotion error:', err.message);
    }
  }

  // Also store the summary as a special 'summary' type
  if (rollingSummary && rollingSummary.trim()) {
    const summaryKey = `summary:session:${sessionId}`;
    try {
      const existing = await database.get(
        'SELECT id FROM global_memory WHERE entity_key = ?',
        [summaryKey]
      );
      if (existing) {
        await database.run(
          `UPDATE global_memory SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [rollingSummary, existing.id]
        );
      } else {
        await database.run(
          `INSERT INTO global_memory (id, entity_type, entity_key, content, source_session_id) VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), 'summary', summaryKey, rollingSummary, sessionId]
        );
      }
    } catch (err) {
      console.error('Global memory summary promotion error:', err.message);
    }
  }
}

/**
 * Retrieve relevant global memories for context injection.
 *
 * @param {string} characterName - Current character
 * @param {string} userName - User's name
 * @param {string} currentMessage - Current user message (for relevance)
 * @param {Object} options
 * @param {number} options.limit - Max memories to return (default 10)
 * @returns {{ memories: Array, relationship: Object|null }}
 */
export async function getRelevantGlobalMemories(characterName, userName, currentMessage, { limit = 10 } = {}) {
  let relationship = null;
  let memories = [];

  // 1. Load character-user relationship
  try {
    relationship = await database.get(
      'SELECT * FROM character_relationships WHERE character_name = ? AND user_name = ?',
      [characterName, userName]
    );
  } catch (err) {
    console.error('Relationship load error:', err.message);
  }

  // 2. Search global memory by message terms (FTS if available, fallback to LIKE)
  try {
    const sanitized = currentMessage.replace(/['"]/g, '').trim();
    if (sanitized.length >= 3) {
      memories = await database.all(
        `SELECT gm.entity_type, gm.content, gm.access_count
         FROM global_memory_fts fts
         JOIN global_memory gm ON gm.rowid = fts.rowid
         WHERE global_memory_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [sanitized, Math.floor(limit / 2)]
      );
    }
  } catch (err) {
    // FTS fallback
    try {
      const words = currentMessage.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (words.length > 0) {
        const conditions = words.map(() => 'content LIKE ?').join(' OR ');
        const params = words.map(w => `%${w}%`);
        memories = await database.all(
          `SELECT entity_type, content, access_count FROM global_memory WHERE ${conditions} ORDER BY updated_at DESC LIMIT ?`,
          [...params, Math.floor(limit / 2)]
        );
      }
    } catch (e) {
      console.error('Global memory search fallback error:', e.message);
    }
  }

  // 3. Include frequently accessed memories
  try {
    const frequent = await database.all(
      `SELECT entity_type, content, access_count FROM global_memory
       WHERE entity_type != 'summary'
       ORDER BY access_count DESC, updated_at DESC LIMIT ?`,
      [Math.floor(limit / 2)]
    );

    // Merge, deduplicate
    const seen = new Set(memories.map(m => m.content));
    for (const mem of frequent) {
      if (!seen.has(mem.content)) {
        memories.push(mem);
        seen.add(mem.content);
      }
    }
  } catch (err) {
    console.error('Frequent memory load error:', err.message);
  }

  return { memories: memories.slice(0, limit), relationship };
}

/**
 * Update character-user relationship after a session.
 *
 * @param {string} characterName
 * @param {string} userName
 * @param {string} sessionId
 * @param {string} sessionSummary
 */
export async function updateRelationship(characterName, userName, sessionId, sessionSummary) {
  if (!characterName || !userName) return;

  try {
    const existing = await database.get(
      'SELECT * FROM character_relationships WHERE character_name = ? AND user_name = ?',
      [characterName, userName]
    );

    if (existing) {
      // Update existing relationship
      let keyMoments = [];
      try { keyMoments = JSON.parse(existing.key_moments || '[]'); } catch (e) { /* */ }

      // Add session summary as a key moment (cap at 20)
      if (sessionSummary) {
        keyMoments.push(sessionSummary.substring(0, 200));
        keyMoments = keyMoments.slice(-20);
      }

      await database.run(
        `UPDATE character_relationships
         SET interaction_count = interaction_count + 1,
             last_interaction_session = ?,
             key_moments = ?,
             relationship_summary = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          sessionId,
          JSON.stringify(keyMoments),
          sessionSummary ? sessionSummary.substring(0, 500) : existing.relationship_summary,
          existing.id
        ]
      );
    } else {
      // Create new relationship
      await database.run(
        `INSERT INTO character_relationships (id, character_name, user_name, first_met_session, last_interaction_session, interaction_count, relationship_summary, key_moments)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          uuidv4(),
          characterName,
          userName,
          sessionId,
          sessionId,
          sessionSummary ? sessionSummary.substring(0, 500) : '',
          sessionSummary ? JSON.stringify([sessionSummary.substring(0, 200)]) : '[]'
        ]
      );
    }
  } catch (err) {
    console.error('Relationship update error:', err.message);
  }
}
