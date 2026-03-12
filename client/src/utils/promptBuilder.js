// System prompt builder with variable mapping
// AUTO-GENERATED prompts - not shown to user

/**
 * Build system prompt from settings using variable mapping
 * @param {Object} settings - User settings object
 * @param {String} activeMode - Current active mode ('roleplay' or 'normal')
 * @returns {String} Generated system prompt
 */
export function buildSystemPrompt(settings, activeMode = null) {
  // Use activeMode if provided (for /chat and /play commands), otherwise use settings.mode
  const mode = activeMode || settings.mode;

  if (mode === 'roleplay') {
    return buildRoleplayPrompt(settings);
  } else {
    return buildUtilityPrompt(settings);
  }
}

/**
 * Build roleplay mode system prompt with variable mapping
 */
function buildRoleplayPrompt(settings) {
  const { roleplay, userPersona } = settings;
  const { world, characterMode, singleCharacter, multipleCharacters } = roleplay;

  let prompt = '';

  // === WORLD & NARRATIVE SECTION ===
  if (world.settingLore) {
    prompt += `**WORLD SETTING:**\n${world.settingLore}\n\n`;
  }

  if (world.openingScene) {
    prompt += `**OPENING SCENE:**\n${world.openingScene}\n\n`;
  }

  if (world.narratorVoice) {
    prompt += `**NARRATOR VOICE:**\nYou are the ${world.narratorVoice}. `;
    prompt += `Maintain this narrative style throughout the conversation.\n\n`;
  }

  if (world.pacing) {
    prompt += `**PACING & FLOW:**\n${world.pacing}\n\n`;
  }

  // Hard rules
  if (world.hardRules && world.hardRules.length > 0) {
    prompt += `**HARD RULES (NEVER VIOLATE):**\n`;
    world.hardRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`;
    });
    prompt += `\n`;
  }

  if (world.turnLogic) {
    prompt += `**TURN LOGIC:**\n${world.turnLogic}\n\n`;
  }

  // === CHARACTER SECTION ===
  if (characterMode === 'single') {
    prompt += buildSingleCharacterSection(singleCharacter);
  } else {
    prompt += buildMultipleCharactersSection(multipleCharacters);
  }

  // === USER PERSONA SECTION ===
  prompt += buildUserPersonaSection(userPersona);

  // === MODE TOGGLE INSTRUCTIONS ===
  prompt += `\n**MODE TOGGLE:**\n`;
  prompt += `- If the user sends the command "/chat", temporarily switch to Non-Roleplay/Utility mode for that response.\n`;
  prompt += `- If the user sends the command "/play", return to Roleplay mode.\n`;
  prompt += `- When in temporary utility mode, respond as a helpful assistant without roleplay elements.\n\n`;

  return prompt.trim();
}

/**
 * Build single character section with variable mapping
 */
function buildSingleCharacterSection(character) {
  let section = `**CHARACTER:**\n`;

  // Identity
  const { identity, core, dynamics, vocalProfile } = character;

  if (identity.name) {
    section += `Name: ${identity.name}\n`;
  }
  if (identity.age) {
    section += `Age: ${identity.age}\n`;
  }
  if (identity.gender) {
    section += `Gender: ${identity.gender}\n`;
  }
  if (identity.species) {
    section += `Species: ${identity.species}\n`;
  }
  if (identity.profession) {
    section += `Profession: ${identity.profession}\n`;
  }

  section += `\n`;

  // Core traits
  if (core.personality) {
    section += `**Personality:**\n${core.personality}\n\n`;
  }
  if (core.backstory) {
    section += `**Backstory:**\n${core.backstory}\n\n`;
  }
  if (core.knowledge) {
    section += `**Knowledge & Skills:**\n${core.knowledge}\n\n`;
  }

  // Dynamics
  if (dynamics.relationshipToUser) {
    section += `**Relationship to User:**\n${dynamics.relationshipToUser}\n\n`;
  }
  if (dynamics.currentLocation) {
    section += `**Current Location:**\n${dynamics.currentLocation}\n\n`;
  }

  // Vocal profile
  if (vocalProfile) {
    section += `**Vocal Profile & Speech Style:**\n${vocalProfile}\n\n`;
  }

  return section;
}

/**
 * Build multiple characters section with variable mapping
 */
function buildMultipleCharactersSection(characters) {
  if (!characters || characters.length === 0) {
    return `**CHARACTERS:**\nNo characters defined.\n\n`;
  }

  let section = `**CHARACTERS:**\n`;
  section += `You may play any of the following characters as needed. Choose the most appropriate character based on the scene and user interaction.\n\n`;

  characters.forEach((character, index) => {
    section += `--- Character ${index + 1}: ${character.identity.name || 'Unnamed'} ---\n`;

    // Identity
    const { identity, core, dynamics, vocalProfile, motivation, secrets } = character;

    if (identity.name) section += `Name: ${identity.name}\n`;
    if (identity.age) section += `Age: ${identity.age}\n`;
    if (identity.gender) section += `Gender: ${identity.gender}\n`;
    if (identity.species) section += `Species: ${identity.species}\n`;
    if (identity.profession) section += `Profession: ${identity.profession}\n`;
    section += `\n`;

    if (core.personality) {
      section += `Personality: ${core.personality}\n`;
    }
    if (core.backstory) {
      section += `Backstory: ${core.backstory}\n`;
    }
    if (dynamics.relationshipToUser) {
      section += `Relationship to User: ${dynamics.relationshipToUser}\n`;
    }
    if (vocalProfile) {
      section += `Vocal Profile: ${vocalProfile}\n`;
    }
    if (motivation) {
      section += `Motivation: ${motivation}\n`;
    }
    if (secrets) {
      section += `Secrets (hidden from user): ${secrets}\n`;
    }

    section += `\n`;
  });

  return section;
}

/**
 * Build utility/normal mode system prompt with variable mapping
 */
function buildUtilityPrompt(settings) {
  const { utility, userPersona } = settings;
  const { assistantIdentity, guardrails } = utility;

  let prompt = '';

  // === ASSISTANT IDENTITY ===
  if (assistantIdentity.persona) {
    prompt += `**YOUR IDENTITY:**\n${assistantIdentity.persona}\n\n`;
  }

  if (assistantIdentity.communicationStyle) {
    prompt += `**COMMUNICATION STYLE:**\n${assistantIdentity.communicationStyle}\n\n`;
  }

  // === GUARDRAILS ===
  if (guardrails.negativeConstraints) {
    prompt += `**CONSTRAINTS (DO NOT):**\n${guardrails.negativeConstraints}\n\n`;
  }

  if (guardrails.formattingPreferences) {
    prompt += `**FORMATTING PREFERENCES:**\n${guardrails.formattingPreferences}\n\n`;
  }

  // === USER PERSONA SECTION ===
  prompt += buildUserPersonaSection(userPersona);

  // === MODE TOGGLE INSTRUCTIONS ===
  prompt += `\n**MODE TOGGLE:**\n`;
  prompt += `- If the user sends the command "/play", temporarily switch to Roleplay mode for that response.\n`;
  prompt += `- If the user sends the command "/chat", return to Normal/Utility mode.\n`;
  prompt += `- When in temporary roleplay mode, adopt the roleplay settings if configured.\n\n`;

  return prompt.trim();
}

/**
 * Get current time in user's timezone
 */
function getCurrentTimeInfo(timezone) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const timeString = formatter.format(now);
    return { timeString, timezone };
  } catch (error) {
    // Fallback if timezone is invalid
    return { timeString: new Date().toLocaleString(), timezone: 'Local' };
  }
}

/**
 * Build user persona section (shared between both modes)
 */
function buildUserPersonaSection(userPersona) {
  let section = `**USER INFORMATION:**\n`;

  if (userPersona.name) {
    section += `User Name: ${userPersona.name}\n`;
  }
  if (userPersona.profession) {
    section += `Profession: ${userPersona.profession}\n`;
  }
  if (userPersona.bio) {
    section += `Bio: ${userPersona.bio}\n`;
  }
  if (userPersona.skills) {
    section += `Skills: ${userPersona.skills}\n`;
  }

  // Add timezone and current time
  if (userPersona.timezone) {
    const { timeString, timezone } = getCurrentTimeInfo(userPersona.timezone);
    section += `Timezone: ${timezone}\n`;
    section += `Current Time: ${timeString}\n`;
  }

  section += `\n`;

  // Tastes
  const { tastes } = userPersona;
  if (tastes.interests || tastes.hobbies || tastes.mediaPreferences) {
    section += `**User Preferences:**\n`;
    if (tastes.interests) section += `Interests: ${tastes.interests}\n`;
    if (tastes.hobbies) section += `Hobbies: ${tastes.hobbies}\n`;
    if (tastes.mediaPreferences) section += `Media Preferences: ${tastes.mediaPreferences}\n`;
    section += `\n`;
  }

  // Boundaries
  if (userPersona.boundaries) {
    section += `**Boundaries & Comfort:**\n${userPersona.boundaries}\n\n`;
  }

  // Linguistic filters
  const { linguisticFilters } = userPersona;

  // Hardcoded permanently banned phrases (always enforced)
  const PERMANENTLY_BANNED_PHRASES = [
    "I'm here",
    "i'm here",
    "I'm available",
    "i'm available",
    "I am here",
    "i am here",
    "I am available",
    "i am available",
    "I'm here for you",
    "i'm here for you",
    "I am here for you",
    "i am here for you"
  ];

  // Combine user-defined banned items with permanently banned phrases
  const allBannedWords = [...linguisticFilters.bannedWords];
  const allBannedPhrases = [...linguisticFilters.bannedPhrases, ...PERMANENTLY_BANNED_PHRASES];

  if (allBannedWords.length > 0 || allBannedPhrases.length > 0) {
    section += `**LINGUISTIC FILTERS (NEVER USE THESE - AUTOMATIC FAILURE):**\n`;
    if (allBannedWords.length > 0) {
      section += `Banned Words: ${allBannedWords.join(', ')}\n`;
    }
    if (allBannedPhrases.length > 0) {
      section += `Banned Phrases: ${allBannedPhrases.join(', ')}\n`;
    }
    section += `These phrases are completely forbidden. Do not use them in any form or context.\n`;
    section += `\n`;
  }

  return section;
}

/**
 * Detect mode toggle commands in user message
 * @param {String} message - User message
 * @returns {Object} { command: '/chat' | '/play' | null, cleanMessage: string }
 */
export function detectModeToggle(message) {
  const trimmed = message.trim();

  if (trimmed.startsWith('/chat')) {
    return {
      command: '/chat',
      cleanMessage: trimmed.substring(5).trim(),
      targetMode: 'normal'
    };
  }

  if (trimmed.startsWith('/play')) {
    return {
      command: '/play',
      cleanMessage: trimmed.substring(5).trim(),
      targetMode: 'roleplay'
    };
  }

  return {
    command: null,
    cleanMessage: message,
    targetMode: null
  };
}
