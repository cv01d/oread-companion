import { DEFAULT_SETTINGS } from '../../data/defaultSettings';
import { saveSettings as saveSettingsAPI, loadSettings as loadSettingsAPI } from '../../utils/settingsAPI';

let saveTimeoutRef = null;

// The oread-cli backend may return active settings that omit some sections
// (e.g. `meta`, or fields the GUI expects). Deep-merge incoming settings onto
// DEFAULT_SETTINGS so the UI always has the full shape (meta.templateId, etc.).
function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeWithDefaults(loaded) {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const merge = (base, override) => {
    if (!isPlainObject(override)) return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
      const o = override[key];
      out[key] = isPlainObject(o) && isPlainObject(base[key]) ? merge(base[key], o) : o;
    }
    return out;
  };
  return merge(defaults, loaded || {});
}

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

});
