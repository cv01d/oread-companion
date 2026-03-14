// Template API routes
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, settingsSchema, userTemplateSchema } from '../middleware/validation.js';
import {
  getAllTemplates,
  getDefaultTemplate,
  getActiveTemplate,
  saveActiveTemplate,
  deleteActiveTemplate,
  saveUserTemplate,
  deleteUserTemplate
} from '../controllers/templateController.js';

const router = express.Router();

// ─── Active Template (Settings) ───────────────────────────────────────────────
// Must be registered before /:id to prevent "active" being captured as a template ID

router.get('/active', asyncHandler(getActiveTemplate));
router.put('/active', validate(settingsSchema), asyncHandler(saveActiveTemplate));
router.delete('/active', asyncHandler(deleteActiveTemplate));

// ─── User Templates ──────────────────────────────────────────────────────────
// Must be registered before /:id to prevent "user" being captured as a template ID

router.post('/user', validate(userTemplateSchema), asyncHandler(saveUserTemplate));
router.delete('/user/:id', asyncHandler(deleteUserTemplate));

// ─── All Templates ───────────────────────────────────────────────────────────

router.get('/', getAllTemplates);
router.get('/:id', getDefaultTemplate);

export default router;
