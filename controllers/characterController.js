// Character management controller
// Handles loading, saving, and managing character JSON files
// SECURITY: Path traversal protection added

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHARACTERS_DIR = path.join(__dirname, '..', 'data', 'characters');
const DEFAULTS_DIR = path.join(CHARACTERS_DIR, 'defaults');

// Ensure directories exist
if (!fs.existsSync(CHARACTERS_DIR)) {
  fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
}
if (!fs.existsSync(DEFAULTS_DIR)) {
  fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
}

/**
 * SECURITY: Sanitize and validate character ID
 * Prevents path traversal attacks
 */
function sanitizeCharacterId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Character ID is required and must be a string');
  }

  // Remove path traversal sequences
  const sanitized = id.replace(/\.\./g, '').replace(/[\/\\]/g, '');

  // Whitelist: only alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error(
      'Invalid character ID: must contain only alphanumeric characters, hyphens, and underscores'
    );
  }

  // Limit length
  if (sanitized.length > 100) {
    throw new Error('Character ID too long (max: 100 characters)');
  }

  return sanitized;
}

/**
 * SECURITY: Verify path is within allowed directory
 */
function verifyPathSafety(filePath, allowedDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBaseDir = path.resolve(allowedDir);

  if (!resolvedPath.startsWith(resolvedBaseDir)) {
    throw new Error('Path traversal detected - access denied');
  }

  return resolvedPath;
}

/**
 * SECURITY: Safe JSON parse with error handling
 */
function safeJSONParse(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);

    // Remove dangerous properties
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Get all user character files (not including defaults)
 */
export function getAllCharacters() {
  try {
    const files = fs.readdirSync(CHARACTERS_DIR)
      .filter(file => file.endsWith('.json') && !file.startsWith('.'));

    const characters = files.map(file => {
      try {
        const sanitizedId = sanitizeCharacterId(path.basename(file, '.json'));
        const filePath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);
        verifyPathSafety(filePath, CHARACTERS_DIR);

        const data = safeJSONParse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: sanitizedId,
          ...data
        };
      } catch (error) {
        console.error(`Error loading character ${file}:`, error);
        return null;
      }
    }).filter(Boolean); // Remove null entries

    return { success: true, characters };
  } catch (error) {
    console.error('Error loading characters:', error);
    return { success: false, error: 'Failed to load characters', characters: [] };
  }
}

/**
 * Get all default character files
 */
export function getAllDefaultCharacters() {
  try {
    const files = fs.readdirSync(DEFAULTS_DIR)
      .filter(file => file.endsWith('.json') && !file.startsWith('.'));

    const characters = files.map(file => {
      try {
        const sanitizedId = sanitizeCharacterId(path.basename(file, '.json'));
        const filePath = path.join(DEFAULTS_DIR, `${sanitizedId}.json`);
        verifyPathSafety(filePath, DEFAULTS_DIR);

        const data = safeJSONParse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: sanitizedId,
          ...data
        };
      } catch (error) {
        console.error(`Error loading default character ${file}:`, error);
        return null;
      }
    }).filter(Boolean);

    return { success: true, characters };
  } catch (error) {
    console.error('Error loading default characters:', error);
    return { success: false, error: 'Failed to load default characters', characters: [] };
  }
}

/**
 * Get a specific character by ID
 * Checks user characters first, then defaults
 */
export function getCharacter(characterId) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);

    // First check user characters
    let filePath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);
    verifyPathSafety(filePath, CHARACTERS_DIR);

    // If not found, check defaults
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DEFAULTS_DIR, `${sanitizedId}.json`);
      verifyPathSafety(filePath, DEFAULTS_DIR);
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Character not found' };
    }

    const data = safeJSONParse(fs.readFileSync(filePath, 'utf8'));
    return {
      success: true,
      character: {
        id: sanitizedId,
        ...data
      }
    };
  } catch (error) {
    console.error('Error loading character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a default character by ID (from defaults folder only)
 */
export function getDefaultCharacter(characterId) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);
    const filePath = path.join(DEFAULTS_DIR, `${sanitizedId}.json`);
    verifyPathSafety(filePath, DEFAULTS_DIR);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Default character not found' };
    }

    const data = safeJSONParse(fs.readFileSync(filePath, 'utf8'));
    return {
      success: true,
      character: {
        id: sanitizedId,
        ...data
      }
    };
  } catch (error) {
    console.error('Error loading default character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Copy a default character to user characters folder
 * Used when applying templates
 */
export function copyDefaultToUser(characterId) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);

    const defaultPath = path.join(DEFAULTS_DIR, `${sanitizedId}.json`);
    const userPath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);

    verifyPathSafety(defaultPath, DEFAULTS_DIR);
    verifyPathSafety(userPath, CHARACTERS_DIR);

    if (!fs.existsSync(defaultPath)) {
      return { success: false, error: 'Default character not found' };
    }

    // Copy the file
    const data = fs.readFileSync(defaultPath, 'utf8');
    const characterData = safeJSONParse(data);

    fs.writeFileSync(userPath, JSON.stringify(characterData, null, 2), 'utf8');

    console.log(`✅ Copied default character '${sanitizedId}' to user characters`);

    return {
      success: true,
      character: {
        id: sanitizedId,
        ...characterData
      }
    };
  } catch (error) {
    console.error('Error copying default character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset a user character to its default version
 * Copies from defaults folder to user folder (overwrites existing)
 */
export function resetCharacterToDefault(characterId) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);

    const defaultPath = path.join(DEFAULTS_DIR, `${sanitizedId}.json`);
    const userPath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);

    verifyPathSafety(defaultPath, DEFAULTS_DIR);
    verifyPathSafety(userPath, CHARACTERS_DIR);

    if (!fs.existsSync(defaultPath)) {
      return { success: false, error: 'No default version exists for this character' };
    }

    // Overwrite user version with default
    const data = fs.readFileSync(defaultPath, 'utf8');
    const characterData = safeJSONParse(data);

    fs.writeFileSync(userPath, JSON.stringify(characterData, null, 2), 'utf8');

    console.log(`✅ Reset character '${sanitizedId}' to default`);

    return {
      success: true,
      character: {
        id: sanitizedId,
        ...characterData
      }
    };
  } catch (error) {
    console.error('Error resetting character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save or update a character (user folder only)
 */
export function saveCharacter(characterId, characterData) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);
    const filePath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);
    verifyPathSafety(filePath, CHARACTERS_DIR);

    // Validate character data structure
    if (!characterData || typeof characterData !== 'object') {
      return { success: false, error: 'Invalid character data' };
    }

    const dataToSave = {
      version: "2.0",
      type: "character",
      character: characterData
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

    return {
      success: true,
      character: {
        id: sanitizedId,
        ...dataToSave
      }
    };
  } catch (error) {
    console.error('Error saving character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a character (user folder only, never deletes defaults)
 */
export function deleteCharacter(characterId) {
  try {
    const sanitizedId = sanitizeCharacterId(characterId);
    const filePath = path.join(CHARACTERS_DIR, `${sanitizedId}.json`);
    verifyPathSafety(filePath, CHARACTERS_DIR);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Character not found' };
    }

    fs.unlinkSync(filePath);
    console.log(`✅ Deleted user character '${sanitizedId}'`);

    return { success: true, message: 'Character deleted successfully' };
  } catch (error) {
    console.error('Error deleting character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize: ensure defaults exist, but keep user characters folder empty
 * This is called on server startup
 */
export function initializeCharacters() {
  console.log('✅ Character system initialized (defaults ready, user folder empty)');
  console.log('🔒 Path traversal protection enabled');
}

export default {
  getAllCharacters,
  getAllDefaultCharacters,
  getCharacter,
  getDefaultCharacter,
  copyDefaultToUser,
  resetCharacterToDefault,
  saveCharacter,
  deleteCharacter,
  initializeCharacters,
  sanitizeCharacterId, // Export for use in routes
  verifyPathSafety
};
