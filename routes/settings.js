import express from 'express';
import { getSettings, saveSettings, deleteSettings } from '../controllers/settingsController.js';

const router = express.Router();

// GET /api/settings - Load user settings
router.get('/', getSettings);

// POST /api/settings - Save user settings
router.post('/', saveSettings);

// DELETE /api/settings - Reset to defaults
router.delete('/', deleteSettings);

export default router;
