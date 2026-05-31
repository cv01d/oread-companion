// Settings validation utility (roleplay-only)
//
// Used by settingsImportExport.js to validate/sanitize imported settings JSON.
// The app is roleplay-only, so there is no utility/assistant-mode validation.

/**
 * Validate settings object structure and data types.
 * @param {Object} settings
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings || typeof settings !== 'object') {
    return { valid: false, errors: ['Settings must be an object'] };
  }

  // mode is roleplay-only; accept missing (we default it on sanitize), reject other values.
  if (settings.mode !== undefined && settings.mode !== 'roleplay') {
    errors.push('Mode must be "roleplay"');
  }

  if (settings.roleplay) {
    errors.push(...validateRoleplaySettings(settings.roleplay));
  }

  if (settings.userPersona) {
    errors.push(...validateUserPersona(settings.userPersona));
  }

  if (settings.general) {
    errors.push(...validateGeneralSettings(settings.general));
  }

  return { valid: errors.length === 0, errors };
}

function validateRoleplaySettings(roleplay) {
  const errors = [];

  if (!roleplay.world || typeof roleplay.world !== 'object') {
    errors.push('Roleplay world settings must be an object');
  }

  if (roleplay.characterMode && !['single', 'multi'].includes(roleplay.characterMode)) {
    errors.push('Character mode must be either "single" or "multi"');
  }

  if (roleplay.characters !== undefined && !Array.isArray(roleplay.characters)) {
    errors.push('Characters must be an array');
  }

  return errors;
}

function validateUserPersona(persona) {
  const errors = [];

  if (persona.tastes && typeof persona.tastes !== 'object') {
    errors.push('User tastes must be an object');
  }

  if (persona.linguisticFilters) {
    if (!Array.isArray(persona.linguisticFilters.bannedWords)) {
      errors.push('Banned words must be an array');
    }
    if (!Array.isArray(persona.linguisticFilters.bannedPhrases)) {
      errors.push('Banned phrases must be an array');
    }
  }

  return errors;
}

function validateGeneralSettings(general) {
  const errors = [];

  if (typeof general.temperature !== 'number' || general.temperature < 0 || general.temperature > 2) {
    errors.push('Temperature must be a number between 0 and 2');
  }

  if (typeof general.topP !== 'number' || general.topP < 0 || general.topP > 1) {
    errors.push('Top P must be a number between 0 and 1');
  }

  if (typeof general.maxTokens !== 'number' || general.maxTokens < 1) {
    errors.push('Max tokens must be a positive number');
  }

  return errors;
}

/**
 * Sanitize a settings object (coerce types, clamp values, ensure arrays).
 * @param {Object} settings
 * @returns {Object} sanitized settings
 */
export function sanitizeSettings(settings) {
  const sanitized = JSON.parse(JSON.stringify(settings));

  // Roleplay-only.
  sanitized.mode = 'roleplay';

  if (sanitized.roleplay) {
    if (sanitized.roleplay.world?.hardRules && !Array.isArray(sanitized.roleplay.world.hardRules)) {
      sanitized.roleplay.world.hardRules = [];
    }
    if (sanitized.roleplay.characters && !Array.isArray(sanitized.roleplay.characters)) {
      sanitized.roleplay.characters = [];
    }
  }

  if (sanitized.userPersona?.linguisticFilters) {
    const lf = sanitized.userPersona.linguisticFilters;
    if (!Array.isArray(lf.bannedWords)) lf.bannedWords = [];
    if (!Array.isArray(lf.bannedPhrases)) lf.bannedPhrases = [];
  }

  if (sanitized.general) {
    const g = sanitized.general;
    g.temperature = Math.max(0, Math.min(2, g.temperature ?? 0.8));
    g.topP = Math.max(0, Math.min(1, g.topP ?? 0.9));
    g.maxTokens = Math.max(1, g.maxTokens ?? 2048);
  }

  return sanitized;
}
