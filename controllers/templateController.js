// Template management controller
// Loads template JSON files from data/templates/defaults/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'data', 'templates');
const DEFAULTS_DIR = path.join(TEMPLATES_DIR, 'defaults');

// Ensure directory exists
if (!fs.existsSync(DEFAULTS_DIR)) {
  fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
}

function safeJSONParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Get all default templates
 */
export function getAllDefaultTemplates() {
  try {
    const files = fs.readdirSync(DEFAULTS_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(file => {
      const filePath = path.join(DEFAULTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      return safeJSONParse(content);
    });
    return { success: true, templates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get a single default template by ID
 */
export function getDefaultTemplate(id) {
  try {
    const sanitized = id.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      return { success: false, error: 'Invalid template ID' };
    }

    const filePath = path.join(DEFAULTS_DIR, `${sanitized}.json`);
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(DEFAULTS_DIR);

    if (!resolvedPath.startsWith(resolvedBase)) {
      return { success: false, error: 'Access denied' };
    }

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: 'Template not found' };
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    return { success: true, template: safeJSONParse(content) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
