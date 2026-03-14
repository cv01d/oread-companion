// Template API routes
import express from 'express';
import { getAllDefaultTemplates, getDefaultTemplate } from '../controllers/templateController.js';

const router = express.Router();

/**
 * GET /api/templates
 * Get all default templates
 */
router.get('/', (req, res) => {
  const result = getAllDefaultTemplates();
  res.json(result);
});

/**
 * GET /api/templates/:id
 * Get a single default template by ID
 */
router.get('/:id', (req, res) => {
  const result = getDefaultTemplate(req.params.id);
  if (!result.success) {
    return res.status(result.error === 'Template not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

export default router;
