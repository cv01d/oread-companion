import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'data', 'templates');
const ACTIVE_FILE = path.join(TEMPLATES_DIR, 'active.json');

// Ensure templates directory exists
function ensureTemplatesDir() {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

// Blank settings used as fallback when no active template exists
const BLANK_SETTINGS = {
  mode: 'normal',
  roleplay: {
    world: {
      settingLore: '',
      openingScene: '',
      narratorVoice: '',
      pacing: '',
      hardRules: ['Never speak/act for the User'],
      turnLogic: 'Stop after describing the scene/NPC reaction'
    },
    characterMode: 'single',
    singleCharacterRef: '',
    multipleCharacterRefs: []
  },
  utility: {
    assistantIdentity: { persona: '', communicationStyle: '' },
    guardrails: { negativeConstraints: '', formattingPreferences: '' }
  },
  userPersona: {
    name: '',
    bio: '',
    skills: '',
    profession: '',
    tastes: { interests: '', hobbies: '', mediaPreferences: '' },
    linguisticFilters: { bannedPhrases: [], bannedWords: [] },
    boundaries: ''
  },
  general: {
    selectedModel: null,
    webSearch: false,
    chatSearch: false,
    memory: true,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2048
  },
  meta: {
    templateId: null,
    lastModified: null,
    version: '1.0.0'
  }
};

// Read the active template file and return its settings
async function readActiveSettings() {
  try {
    const data = await fs.readFile(ACTIVE_FILE, 'utf8');
    const template = JSON.parse(data);
    return template.settings || null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    console.error('Error reading active.json:', error);
    return null;
  }
}

// Write settings as the active template file
async function writeActiveSettings(settings) {
  ensureTemplatesDir();
  const template = {
    id: 'active',
    name: 'Active Settings',
    category: settings.mode === 'roleplay' ? 'roleplay' : 'utility',
    settings
  };
  await fs.writeFile(ACTIVE_FILE, JSON.stringify(template, null, 2), 'utf8');
}

// SECURITY: Validate avatar image upload
function validateAvatarImage(base64Data) {
  if (!base64Data) return;

  const match = base64Data.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image format. Only PNG, JPEG, and GIF allowed (no SVG).');
  }

  const [, mimeType, data] = match;
  const buffer = Buffer.from(data, 'base64');

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Image too large. Maximum size: 2MB');
  }

  const magicBytes = {
    'png': [0x89, 0x50, 0x4E, 0x47],
    'jpeg': [0xFF, 0xD8, 0xFF],
    'jpg': [0xFF, 0xD8, 0xFF],
    'gif': [0x47, 0x49, 0x46]
  };

  const signature = Array.from(buffer.slice(0, 4));
  const expectedMagic = magicBytes[mimeType];
  if (!expectedMagic || !expectedMagic.every((byte, i) => byte === signature[i])) {
    throw new Error('Invalid image file signature - file may be corrupted or not a real image');
  }
}

// GET /api/settings
export async function getSettings(req, res) {
  try {
    const settings = await readActiveSettings() || BLANK_SETTINGS;
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/settings
export async function saveSettings(req, res) {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings data required' });
    }

    // Validate avatar images
    try {
      if (settings.roleplay?.singleCharacter?.avatarImage) {
        validateAvatarImage(settings.roleplay.singleCharacter.avatarImage);
      }
      if (settings.roleplay?.multipleCharacters) {
        for (const character of settings.roleplay.multipleCharacters) {
          if (character.avatarImage) validateAvatarImage(character.avatarImage);
        }
      }
    } catch (error) {
      return res.status(400).json({ success: false, error: `Avatar validation failed: ${error.message}` });
    }

    settings.meta = {
      ...settings.meta,
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };

    await writeActiveSettings(settings);

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
}

// DELETE /api/settings - reset to blank
export async function deleteSettings(req, res) {
  try {
    await fs.unlink(ACTIVE_FILE).catch(err => {
      if (err.code !== 'ENOENT') throw err;
    });
    console.log('🗑️ Deleted active.json - settings reset to blank');
    res.json({ success: true, settings: BLANK_SETTINGS });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
