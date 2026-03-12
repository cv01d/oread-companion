// Settings import/export utility

import { validateSettings, sanitizeSettings } from './settingsValidation.js';

/**
 * Export settings to JSON file
 * @param {Object} settings - Settings object to export
 * @param {String} filename - Filename (default: 'ollama-chat-settings.json')
 */
export function exportSettings(settings, filename = 'ollama-chat-settings.json') {
  try {
    // Add metadata
    const exportData = {
      ...settings,
      meta: {
        ...settings.meta,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, message: 'Settings exported successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import settings from JSON file
 * @param {File} file - File object from input
 * @returns {Promise<Object>} { success: boolean, settings?: Object, error?: string }
 */
export function importSettings(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonString = e.target.result;
        const settings = JSON.parse(jsonString);

        // Validate imported settings
        const validation = validateSettings(settings);
        if (!validation.valid) {
          resolve({
            success: false,
            error: `Invalid settings file: ${validation.errors.join(', ')}`
          });
          return;
        }

        // Sanitize settings
        const sanitized = sanitizeSettings(settings);

        resolve({
          success: true,
          settings: sanitized,
          message: 'Settings imported successfully'
        });
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse settings file: ${error.message}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read file'
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Export settings as shareable URL (base64 encoded)
 * @param {Object} settings - Settings to share
 * @returns {String} Shareable URL
 */
export function exportSettingsAsURL(settings) {
  try {
    // Create a lightweight version (no metadata)
    const exportData = {
      mode: settings.mode,
      roleplay: settings.roleplay,
      utility: settings.utility,
      userPersona: settings.userPersona,
      general: settings.general
    };

    const jsonString = JSON.stringify(exportData);
    const base64 = btoa(jsonString);

    const url = `${window.location.origin}${window.location.pathname}?settings=${base64}`;
    return url;
  } catch (error) {
    console.error('Failed to export settings as URL:', error);
    return null;
  }
}

/**
 * Import settings from URL parameter
 * @returns {Object|null} Settings object or null if not found/invalid
 */
export function importSettingsFromURL() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const settingsParam = urlParams.get('settings');

    if (!settingsParam) {
      return null;
    }

    const jsonString = atob(settingsParam);
    const settings = JSON.parse(jsonString);

    // Validate and sanitize
    const validation = validateSettings(settings);
    if (!validation.valid) {
      console.error('Invalid settings from URL:', validation.errors);
      return null;
    }

    return sanitizeSettings(settings);
  } catch (error) {
    console.error('Failed to import settings from URL:', error);
    return null;
  }
}

/**
 * Copy settings to clipboard as JSON
 * @param {Object} settings - Settings to copy
 * @returns {Promise<Object>} { success: boolean, message?: string, error?: string }
 */
export async function copySettingsToClipboard(settings) {
  try {
    const jsonString = JSON.stringify(settings, null, 2);
    await navigator.clipboard.writeText(jsonString);
    return { success: true, message: 'Settings copied to clipboard' };
  } catch (error) {
    return { success: false, error: 'Failed to copy to clipboard' };
  }
}

/**
 * Import settings from clipboard JSON
 * @returns {Promise<Object>} { success: boolean, settings?: Object, error?: string }
 */
export async function importSettingsFromClipboard() {
  try {
    const jsonString = await navigator.clipboard.readText();
    const settings = JSON.parse(jsonString);

    // Validate
    const validation = validateSettings(settings);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid settings: ${validation.errors.join(', ')}`
      };
    }

    // Sanitize
    const sanitized = sanitizeSettings(settings);

    return {
      success: true,
      settings: sanitized,
      message: 'Settings imported from clipboard'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to import from clipboard: ${error.message}`
    };
  }
}

/**
 * Reset settings to defaults
 * @param {Object} defaultSettings - Default settings template
 * @returns {Object} Default settings
 */
export function resetToDefaults(defaultSettings) {
  return JSON.parse(JSON.stringify(defaultSettings));
}
