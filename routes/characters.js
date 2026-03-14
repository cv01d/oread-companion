// Character management API routes
import express from 'express';
import {
  getAllCharacters,
  getAllDefaultCharacters,
  getCharacter,
  getDefaultCharacter,
  copyDefaultToUser,
  resetCharacterToDefault,
  saveCharacter,
  deleteCharacter
} from '../controllers/characterController.js';

const router = express.Router();

/**
 * GET /api/characters
 * Get all user character files (not including defaults)
 */
router.get('/', (req, res) => {
  const result = getAllCharacters();
  res.json(result);
});

/**
 * GET /api/characters/defaults/all
 * Get all default character files
 */
router.get('/defaults/all', (req, res) => {
  const result = getAllDefaultCharacters();
  res.json(result);
});

/**
 * GET /api/characters/defaults/:id
 * Get a specific default character
 */
router.get('/defaults/:id', (req, res) => {
  const result = getDefaultCharacter(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

/**
 * POST /api/characters/copy/:id
 * Copy a default character to user characters folder
 * Used when applying templates
 */
router.post('/copy/:id', (req, res) => {
  const result = copyDefaultToUser(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

/**
 * POST /api/characters/reset/:id
 * Reset a user character to its default version
 */
router.post('/reset/:id', (req, res) => {
  const result = resetCharacterToDefault(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

/**
 * GET /api/characters/:id
 * Get a specific character by ID (checks user folder first, then defaults)
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
 */
router.post('/:id', (req, res) => {
  const result = saveCharacter(req.params.id, req.body.character);
  res.json(result);
});

/**
 * DELETE /api/characters/:id
 * Delete a character (user folder only, never deletes defaults)
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
