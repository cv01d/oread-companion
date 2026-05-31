// Default settings structure for the application

export const DEFAULT_SETTINGS = {
  mode: 'roleplay', // roleplay-only (the app is roleplay-only)

  roleplay: {
    world: {
      settingLore: '',
      openingScene: '',
      narratorVoice: 'companion',
      hardRules: []
    },
    characterMode: 'single', // 'single' or 'multi'
    character: null, // Inline character data (single mode)
    characters: [], // Inline character data array (multi mode)
    activeCharacterIndex: 0 // Which character is the "main" in multi mode
  },

  userPersona: {
    name: '',
    bio: '',
    skills: '',
    profession: '',
    timezone: 'America/Los_Angeles', // Default timezone
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
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 2048,
    contextBudget: 4096,
    autoSummarize: true,
    crossSessionMemory: true
  },

  meta: {
    templateId: null,
    lastModified: null,
    version: '1.0.0'
  }
};
