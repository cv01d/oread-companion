import express from 'express';
import langchainRAG from '../services/langchainRAG.js';

const router = express.Router();

// Create embeddings for session messages (background job)
router.post('/embed', async (req, res) => {
  try {
    const { sessionId, messages } = req.body;

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'sessionId and messages array required'
      });
    }

    // Run embedding in background (don't await)
    langchainRAG.addDocuments(sessionId, messages)
      .then(result => {
        console.log(`✅ Embedded ${result.embedded} messages for session ${sessionId}`);
      })
      .catch(error => {
        console.error('Embedding error:', error);
      });

    res.json({
      success: true,
      message: 'Embedding started',
      count: messages.length
    });
  } catch (error) {
    console.error('Embed endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Semantic search across session
router.post('/search', async (req, res) => {
  try {
    const { sessionId, query, topK = 5 } = req.body;

    if (!sessionId || !query) {
      return res.status(400).json({
        error: 'sessionId and query required'
      });
    }

    // Create query embedding
    const queryVector = await langchainRAG.embeddings.embedQuery(query);

    // Search vectors
    const results = await langchainRAG.searchVectors(sessionId, queryVector, topK);

    res.json({
      success: true,
      query,
      results: results.results || [],
      count: results.results?.length || 0
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get embedding status for session
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get index stats
    const stats = await langchainRAG.getIndexStats(sessionId);

    res.json({
      success: true,
      sessionId,
      ...stats
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId: req.params.sessionId
    });
  }
});

export default router;
