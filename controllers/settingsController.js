import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_DIR = path.join(__dirname, '..', 'data', 'settings');

// Individual JSON files for each settings category
const SETTINGS_FILES = {
  mode: path.join(SETTINGS_DIR, 'mode.json'),
  roleplay: path.join(SETTINGS_DIR, 'roleplay.json'),
  utility: path.join(SETTINGS_DIR, 'utility.json'),
  userPersona: path.join(SETTINGS_DIR, 'userPersona.json'),
  general: path.join(SETTINGS_DIR, 'general.json'),
  meta: path.join(SETTINGS_DIR, 'meta.json')
};

// Default settings structure
const DEFAULT_SETTINGS = {
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
    singleCharacter: {
      identity: { name: '', age: '', gender: '', species: '', profession: '' },
      core: { personality: '', backstory: '', knowledge: '' },
      dynamics: { relationshipToUser: '', currentLocation: '' },
      vocalProfile: '',
      avatarImage: ''
    },
    multipleCharacters: []
  },
  utility: {
    assistantIdentity: {
      persona: '',
      communicationStyle: ''
    },
    guardrails: {
      negativeConstraints: '',
      formattingPreferences: ''
    }
  },
  userPersona: {
    name: '',
    bio: '',
    skills: '',
    profession: '',
    tastes: {
      interests: '',
      hobbies: '',
      mediaPreferences: ''
    },
    linguisticFilters: {
      bannedPhrases: [],
      bannedWords: []
    },
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

// Ensure settings directory exists
function ensureSettingsDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

// Get settings
export async function getSettings(req, res) {
  try {
    ensureSettingsDir();

    // Load settings from individual JSON files
    const settings = {};

    for (const [key, filePath] of Object.entries(SETTINGS_FILES)) {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        settings[key] = JSON.parse(data);
      } else {
        // Use default if file doesn't exist
        settings[key] = DEFAULT_SETTINGS[key];
      }
    }

    // If no files exist at all, return full defaults
    const hasAnyFile = Object.values(SETTINGS_FILES).some(f => fs.existsSync(f));
    if (!hasAnyFile) {
      return res.json({ success: true, settings: DEFAULT_SETTINGS });
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Save settings
export async function saveSettings(req, res) {
  try {
    ensureSettingsDir();

    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings data required' });
    }

    // Update last modified timestamp
    settings.meta = {
      ...settings.meta,
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };

    // Save each category to its individual JSON file
    for (const [key, filePath] of Object.entries(SETTINGS_FILES)) {
      if (settings[key] !== undefined) {
        fs.writeFileSync(filePath, JSON.stringify(settings[key], null, 2), 'utf8');
      }
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Delete settings (reset to defaults)
export async function deleteSettings(req, res) {
  try {
    ensureSettingsDir();

    // Delete all individual JSON files
    for (const filePath of Object.values(SETTINGS_FILES)) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, settings: DEFAULT_SETTINGS });
  } catch (error) {
    console.error('Error deleting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
