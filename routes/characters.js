// Character management API routes
import express from 'express';
import {
  getAllCharacters,
  getCharacter,
  saveCharacter,
  deleteCharacter
} from '../controllers/characterController.js';
import memoryManager from '../services/memoryManager.js';
import database from '../services/database.js';

const router = express.Router();

/**
 * GET /api/characters
 * Get all user character files
 */
router.get('/', (req, res) => {
  const result = getAllCharacters();
  res.json(result);
});

/**
 * GET /api/characters/:id
 * Get a specific character by ID (user folder only)
 */
router.get('/:id', (req, res) => {
  const result = getCharacter(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

/**
 * POST /api/characters/:id
 * Save or update a character (user folder only)
 * Also invalidates lorebook cache for any active sessions using this character.
 */
router.post('/:id', async (req, res) => {
  const result = saveCharacter(req.params.id, req.body.character);
  res.json(result);

  // Background: invalidate lorebook cache for sessions using this character
  if (result.success) {
    try {
      const charName = req.body.character?.name;
      if (charName) {
        const sessions = await database.all(
          `SELECT id FROM sessions WHERE character_name = ? AND archived = 0`,
          [charName]
        );
        for (const session of sessions) {
          memoryManager.rebuildCharacterDocs(session.id);
        }
      }
    } catch (err) {
      console.error('Lorebook reindex trigger error:', err);
    }
  }
});

/**
 * DELETE /api/characters/:id
 * Delete a character (user folder only)
 */
router.delete('/:id', (req, res) => {
  const result = deleteCharacter(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

export default router;
