import express from 'express';
import database from '../services/database.js';
import { promoteToGlobalMemory } from '../services/globalMemory.js';
import { validateUUID } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// List global memories
router.get('/global', asyncHandler(async (req, res) => {
  const { type, limit = '20', offset = '0' } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);

  let query = 'SELECT * FROM global_memory';
  const params = [];

  if (type) {
    query += ' WHERE entity_type = ?';
    params.push(type);
  }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(parsedLimit, parsedOffset);

  const memories = await database.all(query, params);
  res.json({ success: true, memories });
}));

// Search global memory
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = '10' } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
  }

  const parsedLimit = Math.min(parseInt(limit) || 10, 50);
  let results = [];

  try {
    const sanitized = q.replace(/['"]/g, '').trim();
    results = await database.all(
      `SELECT gm.* FROM global_memory_fts fts
       JOIN global_memory gm ON gm.rowid = fts.rowid
       WHERE global_memory_fts MATCH ?
       ORDER BY rank LIMIT ?`,
      [sanitized, parsedLimit]
    );
  } catch (err) {
    // Fallback to LIKE
    results = await database.all(
      `SELECT * FROM global_memory WHERE content LIKE ? ORDER BY updated_at DESC LIMIT ?`,
      [`%${q}%`, parsedLimit]
    );
  }

  res.json({ success: true, results });
}));

// List character relationships
router.get('/relationships', asyncHandler(async (req, res) => {
  const relationships = await database.all(
    'SELECT * FROM character_relationships ORDER BY updated_at DESC'
  );
  res.json({ success: true, relationships });
}));

// Get specific character relationship
router.get('/relationships/:characterName', asyncHandler(async (req, res) => {
  const relationship = await database.get(
    'SELECT * FROM character_relationships WHERE character_name = ?',
    [req.params.characterName]
  );

  if (!relationship) {
    return res.status(404).json({ success: false, error: 'Relationship not found' });
  }

  res.json({ success: true, relationship });
}));

// Edit a global memory
router.put('/global/:id', asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ success: false, error: 'Content is required' });
  }

  const result = await database.run(
    `UPDATE global_memory SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [content, req.params.id]
  );

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Memory not found' });
  }

  res.json({ success: true });
}));

// Delete a global memory
router.delete('/global/:id', asyncHandler(async (req, res) => {
  const result = await database.run(
    'DELETE FROM global_memory WHERE id = ?',
    [req.params.id]
  );

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Memory not found' });
  }

  res.json({ success: true });
}));

// Manually promote session to global memory
router.post('/promote/:sessionId', validateUUID('sessionId'), asyncHandler(async (req, res) => {
  const session = await database.get(
    'SELECT extracted_facts, rolling_summary FROM sessions WHERE id = ?',
    [req.params.sessionId]
  );

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  let facts = [];
  try { facts = JSON.parse(session.extracted_facts || '[]'); } catch (e) { /* */ }

  await promoteToGlobalMemory(req.params.sessionId, facts, session.rolling_summary || '');

  res.json({ success: true, promoted: facts.length });
}));

export default router;
