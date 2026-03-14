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
  const { world, characterMode, singleCharacterRef, multipleCharacterRefs, _loadedCharacters } = roleplay;

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
  // Use _loadedCharacters if available (loaded from files), otherwise fall back to refs
  if (characterMode === 'single') {
    const character = _loadedCharacters?.[0] || { name: singleCharacterRef };
    prompt += buildSingleCharacterSection(character);
  } else {
    const characters = _loadedCharacters || multipleCharacterRefs.map(ref => ({ name: ref }));
    prompt += buildMultipleCharactersSection(characters);
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
  let section = `**MAIN CHARACTER:**\n`;

  // Basic Identity
  if (character.name) {
    section += `Name: ${character.name}\n`;
  }
  if (character.age) {
    section += `Age: ${character.age}\n`;
  }
  if (character.gender) {
    section += `Gender: ${character.gender}\n`;
  }
  if (character.species) {
    section += `Species: ${character.species}\n`;
  }
  if (character.role) {
    section += `Role: ${character.role}\n`;
  }

  section += `\n`;

  // Character Details
  if (character.knowledgeSkills) {
    section += `**Knowledge & Skills:**\n${character.knowledgeSkills}\n\n`;
  }
  if (character.hobbiesInterests) {
    section += `**Hobbies/Interests:**\n${character.hobbiesInterests}\n\n`;
  }
  if (character.thingsToAvoid) {
    section += `**Things They Avoid:**\n${character.thingsToAvoid}\n\n`;
  }
  if (character.backstory) {
    section += `**Backstory:**\n${character.backstory}\n\n`;
  }
  if (character.inventory) {
    section += `**Inventory:**\n${character.inventory}\n\n`;
  }

  // Personality Traits
  if (character.traits) {
    section += `**PERSONALITY TRAITS:**\n`;

    if (character.traits.emotionalExpression && character.traits.emotionalExpression.length > 0) {
      section += `Emotional Expression: ${character.traits.emotionalExpression.join(', ')}\n`;
    }
    if (character.traits.socialEnergy && character.traits.socialEnergy.length > 0) {
      section += `Social Energy: ${character.traits.socialEnergy.join(', ')}\n`;
    }
    if (character.traits.thinkingStyle && character.traits.thinkingStyle.length > 0) {
      section += `Thinking Style: ${character.traits.thinkingStyle.join(', ')}\n`;
    }
    if (character.traits.humorPersonality && character.traits.humorPersonality.length > 0) {
      section += `Humor & Personality: ${character.traits.humorPersonality.join(', ')}\n`;
    }
    if (character.traits.coreValues && character.traits.coreValues.length > 0) {
      section += `Core Values: ${character.traits.coreValues.join(', ')}\n`;
    }
    if (character.traits.howTheyCare && character.traits.howTheyCare.length > 0) {
      section += `How They Care: ${character.traits.howTheyCare.join(', ')}\n`;
    }
    if (character.traits.energyPresence && character.traits.energyPresence.length > 0) {
      section += `Energy & Presence: ${character.traits.energyPresence.join(', ')}\n`;
    }
    if (character.traits.lifestyleInterests && character.traits.lifestyleInterests.length > 0) {
      section += `Lifestyle & Interests: ${character.traits.lifestyleInterests.join(', ')}\n`;
    }

    section += `\n`;
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
  section += `You may play any of the following characters as needed. The first character is the main character. Choose the most appropriate character based on the scene and user interaction.\n\n`;

  characters.forEach((character, index) => {
    const characterType = index === 0 ? 'MAIN CHARACTER' : 'SUPPORTING CHARACTER';
    section += `--- ${characterType}: ${character.name || 'Unnamed'} ---\n`;

    // Basic Identity
    if (character.name) section += `Name: ${character.name}\n`;
    if (character.age) section += `Age: ${character.age}\n`;
    if (character.gender) section += `Gender: ${character.gender}\n`;
    if (character.species) section += `Species: ${character.species}\n`;
    if (character.role) section += `Role: ${character.role}\n`;
    section += `\n`;

    // Character Details
    if (character.knowledgeSkills) {
      section += `Knowledge & Skills: ${character.knowledgeSkills}\n`;
    }
    if (character.hobbiesInterests) {
      section += `Hobbies/Interests: ${character.hobbiesInterests}\n`;
    }
    if (character.thingsToAvoid) {
      section += `Things They Avoid: ${character.thingsToAvoid}\n`;
    }
    if (character.backstory) {
      section += `Backstory: ${character.backstory}\n`;
    }
    if (character.inventory) {
      section += `Inventory: ${character.inventory}\n`;
    }

    // Personality Traits
    if (character.traits) {
      const hasTraits = Object.values(character.traits).some(arr => arr && arr.length > 0);
      if (hasTraits) {
        section += `\n**Personality Traits:**\n`;

        if (character.traits.emotionalExpression && character.traits.emotionalExpression.length > 0) {
          section += `- Emotional Expression: ${character.traits.emotionalExpression.join(', ')}\n`;
        }
        if (character.traits.socialEnergy && character.traits.socialEnergy.length > 0) {
          section += `- Social Energy: ${character.traits.socialEnergy.join(', ')}\n`;
        }
        if (character.traits.thinkingStyle && character.traits.thinkingStyle.length > 0) {
          section += `- Thinking Style: ${character.traits.thinkingStyle.join(', ')}\n`;
        }
        if (character.traits.humorPersonality && character.traits.humorPersonality.length > 0) {
          section += `- Humor & Personality: ${character.traits.humorPersonality.join(', ')}\n`;
        }
        if (character.traits.coreValues && character.traits.coreValues.length > 0) {
          section += `- Core Values: ${character.traits.coreValues.join(', ')}\n`;
        }
        if (character.traits.howTheyCare && character.traits.howTheyCare.length > 0) {
          section += `- How They Care: ${character.traits.howTheyCare.join(', ')}\n`;
        }
        if (character.traits.energyPresence && character.traits.energyPresence.length > 0) {
          section += `- Energy & Presence: ${character.traits.energyPresence.join(', ')}\n`;
        }
        if (character.traits.lifestyleInterests && character.traits.lifestyleInterests.length > 0) {
          section += `- Lifestyle & Interests: ${character.traits.lifestyleInterests.join(', ')}\n`;
        }
      }
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
