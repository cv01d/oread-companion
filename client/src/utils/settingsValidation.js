// Settings validation utility

/**
 * Validate settings object structure and data types
 * @param {Object} settings - Settings object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings || typeof settings !== 'object') {
    return { valid: false, errors: ['Settings must be an object'] };
  }

  // Validate mode
  if (!['roleplay', 'normal'].includes(settings.mode)) {
    errors.push('Mode must be either "roleplay" or "normal"');
  }

  // Validate roleplay settings
  if (settings.roleplay) {
    const roleplayErrors = validateRoleplaySettings(settings.roleplay);
    errors.push(...roleplayErrors);
  }

  // Validate utility settings
  if (settings.utility) {
    const utilityErrors = validateUtilitySettings(settings.utility);
    errors.push(...utilityErrors);
  }

  // Validate user persona
  if (settings.userPersona) {
    const personaErrors = validateUserPersona(settings.userPersona);
    errors.push(...personaErrors);
  }

  // Validate general settings
  if (settings.general) {
    const generalErrors = validateGeneralSettings(settings.general);
    errors.push(...generalErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate roleplay settings
 */
function validateRoleplaySettings(roleplay) {
  const errors = [];

  if (!roleplay.world || typeof roleplay.world !== 'object') {
    errors.push('Roleplay world settings must be an object');
  }

  if (!['single', 'multi'].includes(roleplay.characterMode)) {
    errors.push('Character mode must be either "single" or "multi"');
  }

  // Validate character structure
  if (roleplay.characterMode === 'single') {
    if (!roleplay.singleCharacter || typeof roleplay.singleCharacter !== 'object') {
      errors.push('Single character must be defined');
    } else {
      const charErrors = validateCharacter(roleplay.singleCharacter, 'single');
      errors.push(...charErrors);
    }
  }

  if (roleplay.characterMode === 'multi') {
    if (!Array.isArray(roleplay.multipleCharacters)) {
      errors.push('Multiple characters must be an array');
    } else {
      roleplay.multipleCharacters.forEach((char, index) => {
        const charErrors = validateCharacter(char, 'multi');
        errors.push(...charErrors.map(err => `Character ${index + 1}: ${err}`));
      });
    }
  }

  return errors;
}

/**
 * Validate character structure
 */
function validateCharacter(character, mode) {
  const errors = [];

  if (!character.identity || typeof character.identity !== 'object') {
    errors.push('Character identity must be an object');
  }

  if (!character.core || typeof character.core !== 'object') {
    errors.push('Character core must be an object');
  }

  if (!character.dynamics || typeof character.dynamics !== 'object') {
    errors.push('Character dynamics must be an object');
  }

  // Validate avatar image if present (should be base64 or empty)
  if (character.avatarImage && typeof character.avatarImage !== 'string') {
    errors.push('Avatar image must be a string');
  }

  return errors;
}

/**
 * Validate utility settings
 */
function validateUtilitySettings(utility) {
  const errors = [];

  if (!utility.assistantIdentity || typeof utility.assistantIdentity !== 'object') {
    errors.push('Assistant identity must be an object');
  }

  if (!utility.guardrails || typeof utility.guardrails !== 'object') {
    errors.push('Guardrails must be an object');
  }

  return errors;
}

/**
 * Validate user persona
 */
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

/**
 * Validate general settings
 */
function validateGeneralSettings(general) {
  const errors = [];

  // Validate temperature
  if (typeof general.temperature !== 'number' || general.temperature < 0 || general.temperature > 2) {
    errors.push('Temperature must be a number between 0 and 2');
  }

  // Validate topP
  if (typeof general.topP !== 'number' || general.topP < 0 || general.topP > 1) {
    errors.push('Top P must be a number between 0 and 1');
  }

  // Validate maxTokens
  if (typeof general.maxTokens !== 'number' || general.maxTokens < 1) {
    errors.push('Max tokens must be a positive number');
  }

  // Validate boolean fields
  if (typeof general.webSearch !== 'boolean') {
    errors.push('Web search must be a boolean');
  }
  if (typeof general.chatSearch !== 'boolean') {
    errors.push('Chat search must be a boolean');
  }
  if (typeof general.memory !== 'boolean') {
    errors.push('Memory must be a boolean');
  }

  return errors;
}

/**
 * Sanitize settings object (remove invalid data, ensure correct types)
 * @param {Object} settings - Settings to sanitize
 * @returns {Object} Sanitized settings
 */
export function sanitizeSettings(settings) {
  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(settings));

  // Ensure mode is valid
  if (!['roleplay', 'normal'].includes(sanitized.mode)) {
    sanitized.mode = 'normal';
  }

  // Ensure arrays are arrays
  if (sanitized.roleplay?.world?.hardRules && !Array.isArray(sanitized.roleplay.world.hardRules)) {
    sanitized.roleplay.world.hardRules = [];
  }

  if (sanitized.roleplay?.multipleCharacters && !Array.isArray(sanitized.roleplay.multipleCharacters)) {
    sanitized.roleplay.multipleCharacters = [];
  }

  if (sanitized.userPersona?.linguisticFilters) {
    if (!Array.isArray(sanitized.userPersona.linguisticFilters.bannedWords)) {
      sanitized.userPersona.linguisticFilters.bannedWords = [];
    }
    if (!Array.isArray(sanitized.userPersona.linguisticFilters.bannedPhrases)) {
      sanitized.userPersona.linguisticFilters.bannedPhrases = [];
    }
  }

  // Clamp numeric values
  if (sanitized.general) {
    sanitized.general.temperature = Math.max(0, Math.min(2, sanitized.general.temperature || 0.8));
    sanitized.general.topP = Math.max(0, Math.min(1, sanitized.general.topP || 0.9));
    sanitized.general.maxTokens = Math.max(1, sanitized.general.maxTokens || 2048);
  }

  return sanitized;
}
