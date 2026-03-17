import { DEFAULT_SETTINGS } from '../../data/defaultSettings';
import { saveSettings as saveSettingsAPI, loadSettings as loadSettingsAPI } from '../../utils/settingsAPI';

let saveTimeoutRef = null;

export const createSettingsSlice = (set, get) => ({
  settings: DEFAULT_SETTINGS,
  isSavingSettings: false,
  lastSaved: null,

  setSettings: (newSettings) => {
    set({ settings: newSettings, isSavingSettings: true });

    try {
      localStorage.setItem('ollama-chat-settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }

    if (saveTimeoutRef) {
      clearTimeout(saveTimeoutRef);
    }

    saveTimeoutRef = setTimeout(async () => {
      try {
        const result = await saveSettingsAPI(newSettings);
        if (result.success) {
          set({ isSavingSettings: false, lastSaved: new Date() });

          const tid = newSettings.meta?.templateId;
          if (tid && newSettings.meta?.isUserTemplate) {
            const templates = get().templates;
            set({
              templates: templates.map(t =>
                t.id === tid ? { ...t, settings: newSettings } : t
              )
            });
          }
        } else {
          console.error('Failed to save settings to backend:', result.error);
          set({ isSavingSettings: false });
        }
      } catch (error) {
        console.error('Failed to save settings to backend:', error);
        set({ isSavingSettings: false });
      }
    }, 1000);
  },

  loadSettings: async () => {
    try {
      const localSettings = localStorage.getItem('ollama-chat-settings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        set({ settings: parsed });
      }

      const result = await loadSettingsAPI();
      if (result.success && result.settings) {
        set({ settings: result.settings });
        try {
          localStorage.setItem('ollama-chat-settings', JSON.stringify(result.settings));
        } catch (_) {}
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  loadCharactersForPrompt: (settings) => {
    const settingsCopy = { ...settings };

    if (settings.roleplay.characterMode === 'single') {
      settingsCopy.roleplay = {
        ...settingsCopy.roleplay,
        _loadedCharacters: settings.roleplay.character
          ? [settings.roleplay.character]
          : [{ name: 'Assistant', role: '', knowledgeSkills: '', hobbiesInterests: '',
               thingsToAvoid: '', backstory: '', inventory: '', traits: {} }]
      };
    }

    if (settings.roleplay.characterMode === 'multi' && settings.roleplay.characters?.length > 0) {
      const chars = [...settings.roleplay.characters];
      const activeIdx = settings.roleplay.activeCharacterIndex || 0;
      if (activeIdx > 0 && activeIdx < chars.length) {
        const [active] = chars.splice(activeIdx, 1);
        chars.unshift(active);
      }
      settingsCopy.roleplay = {
        ...settingsCopy.roleplay,
        _loadedCharacters: chars
      };
    }

    return settingsCopy;
  },
});
