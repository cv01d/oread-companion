// Character management controller
// Handles loading, saving, and managing character JSON files
// NEW: Supports defaults folder for template characters

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
 * Get all user character files (not including defaults)
 */
export function getAllCharacters() {
  try {
    const files = fs.readdirSync(CHARACTERS_DIR)
      .filter(file => file.endsWith('.json'));

    const characters = files.map(file => {
      const filePath = path.join(CHARACTERS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        id: path.basename(file, '.json'),
        ...data
      };
    });

    return { success: true, characters };
  } catch (error) {
    console.error('Error loading characters:', error);
    return { success: false, error: error.message, characters: [] };
  }
}

/**
 * Get all default character files
 */
export function getAllDefaultCharacters() {
  try {
    const files = fs.readdirSync(DEFAULTS_DIR)
      .filter(file => file.endsWith('.json'));

    const characters = files.map(file => {
      const filePath = path.join(DEFAULTS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        id: path.basename(file, '.json'),
        ...data
      };
    });

    return { success: true, characters };
  } catch (error) {
    console.error('Error loading default characters:', error);
    return { success: false, error: error.message, characters: [] };
  }
}

/**
 * Get a specific character by ID
 * Checks user characters first, then defaults
 */
export function getCharacter(characterId) {
  try {
    // First check user characters
    let filePath = path.join(CHARACTERS_DIR, `${characterId}.json`);

    // If not found, check defaults
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DEFAULTS_DIR, `${characterId}.json`);
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Character not found' };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      success: true,
      character: {
        id: characterId,
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
    const filePath = path.join(DEFAULTS_DIR, `${characterId}.json`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Default character not found' };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      success: true,
      character: {
        id: characterId,
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
    const defaultPath = path.join(DEFAULTS_DIR, `${characterId}.json`);
    const userPath = path.join(CHARACTERS_DIR, `${characterId}.json`);

    if (!fs.existsSync(defaultPath)) {
      return { success: false, error: 'Default character not found' };
    }

    // Copy the file
    const data = fs.readFileSync(defaultPath, 'utf8');
    fs.writeFileSync(userPath, data, 'utf8');

    const characterData = JSON.parse(data);
    console.log(`✅ Copied default character '${characterId}' to user characters`);

    return {
      success: true,
      character: {
        id: characterId,
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
    const defaultPath = path.join(DEFAULTS_DIR, `${characterId}.json`);
    const userPath = path.join(CHARACTERS_DIR, `${characterId}.json`);

    if (!fs.existsSync(defaultPath)) {
      return { success: false, error: 'No default version exists for this character' };
    }

    // Overwrite user version with default
    const data = fs.readFileSync(defaultPath, 'utf8');
    fs.writeFileSync(userPath, data, 'utf8');

    const characterData = JSON.parse(data);
    console.log(`✅ Reset character '${characterId}' to default`);

    return {
      success: true,
      character: {
        id: characterId,
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
    const filePath = path.join(CHARACTERS_DIR, `${characterId}.json`);

    const dataToSave = {
      version: "2.0",
      type: "character",
      character: characterData
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

    return {
      success: true,
      character: {
        id: characterId,
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
    const filePath = path.join(CHARACTERS_DIR, `${characterId}.json`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Character not found' };
    }

    fs.unlinkSync(filePath);
    console.log(`✅ Deleted user character '${characterId}'`);

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
  // User characters folder should remain empty until user creates/applies templates
  // Defaults folder should have all template characters
  console.log('✅ Character system initialized (defaults ready, user folder empty)');
}
