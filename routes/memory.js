import express from 'express';
import langchainRAG from '../services/langchainRAG.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateUUID } from '../middleware/validation.js';

const router = express.Router();

// Create embeddings for session messages (background job)
router.post('/embed', asyncHandler(async (req, res) => {
  const { sessionId, messages } = req.body;

  if (!sessionId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'sessionId and messages array required' });
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  // Run embedding in background (don't await)
  langchainRAG.addDocuments(sessionId, messages)
    .then(result => {
      console.log(`✅ Embedded ${result.embedded} messages for session ${sessionId}`);
    })
    .catch(error => {
      console.error('Embedding error:', error);
    });

  res.json({ success: true, message: 'Embedding started', count: messages.length });
}));

// Semantic search across session
router.post('/search', asyncHandler(async (req, res) => {
  const { sessionId, query, topK = 5 } = req.body;

  if (!sessionId || !query) {
    return res.status(400).json({ error: 'sessionId and query required' });
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' });
  }

  const queryVector = await langchainRAG.embeddings.embedQuery(query);
  const results = await langchainRAG.searchVectors(sessionId, queryVector, topK);

  res.json({
    success: true,
    query,
    results: results.results || [],
    count: results.results?.length || 0
  });
}));

// Get embedding status for session
router.get('/status/:sessionId', validateUUID('sessionId'), asyncHandler(async (req, res) => {
  const stats = await langchainRAG.getIndexStats(req.params.sessionId);
  res.json({ success: true, sessionId: req.params.sessionId, ...stats });
}));

export default router;
