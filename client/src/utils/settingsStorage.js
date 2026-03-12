// localStorage wrapper for settings persistence

const SETTINGS_KEY = 'ollama_chat_settings';

// Default settings structure
export const DEFAULT_SETTINGS = {
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

// Load settings from localStorage
export function loadSettingsFromLocal() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return null;
  }
}

// Save settings to localStorage
export function saveSettingsToLocal(settings) {
  try {
    // Update last modified timestamp
    const updatedSettings = {
      ...settings,
      meta: {
        ...settings.meta,
        lastModified: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    return updatedSettings;
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
    throw error;
  }
}

// Clear settings from localStorage
export function clearSettingsFromLocal() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Error clearing settings from localStorage:', error);
  }
}

// Check if localStorage is available and has space
export function checkLocalStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

// Get estimated size of settings in localStorage (in bytes)
export function getSettingsSize() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return 0;
    // Calculate approximate size in bytes (UTF-16 encoding)
    return new Blob([stored]).size;
  } catch (error) {
    return 0;
  }
}
