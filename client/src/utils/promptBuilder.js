// System prompt builder — structured template format
// AUTO-GENERATED prompts - not shown to user

import { getCharacterTraitDefinitions, buildPersonalityGuidance } from './personalitySystemLoader.js';
import { getNarrativeStyle } from './narrativeSystemLoader.js';

/**
 * Build system prompt from settings
 */
export function buildSystemPrompt(settings, activeMode = null, isFirstMessage = false) {
  const mode = activeMode || settings.mode;

  if (mode === 'roleplay') {
    return buildRoleplayPrompt(settings, isFirstMessage);
  } else {
    return buildUtilityPrompt(settings);
  }
}

/**
 * Build roleplay mode system prompt using the Optimized "Discourse/Conduct" Template
 */
function buildRoleplayPrompt(settings, isFirstMessage) {
  const { roleplay, userPersona } = settings;
  const { world, characterMode, _loadedCharacters, userCustomContext } = roleplay;

  // 1. Resolve Character (Ensuring universal "The Character" framing)
  const mainCharacter = _loadedCharacters?.[0] || { name: 'The Character' };
  const identity = [mainCharacter.age, mainCharacter.gender, mainCharacter.species].filter(Boolean).join(', ');

  // 2. Resolve Narrative Style (default to companion)
  const narrativeStyle = getNarrativeStyle(world.narratorVoice || 'companion');

  // 3. Build Personality Traits (The Discourse/Conduct Engine)
  let traitsText = '';
  if (mainCharacter.traits) {
    const traitDefinitions = getCharacterTraitDefinitions(mainCharacter.traits);
    traitsText = buildPersonalityGuidance(traitDefinitions); 
    // Ensure buildPersonalityGuidance returns: "• Trait: [D: ...] [C: ...]"
  }

  // === ASSEMBLE TEMPLATE ===
  let prompt = '';

  prompt += `WORLD SETTING:\n${world.settingLore || 'Modern day, everyday life.'}\n\n`;

  // Opening scene only on the first message of a session
  if (isFirstMessage) {
    const baseOpening = 'Lead with YOUR energy. Share a specific hypothetical or "3 AM shower thought."';
    prompt += `OPENING SCENE:\n${world.openingScene || baseOpening}\n\n`;
  }

  prompt += `HOW TO PLAY THIS CHARACTER:\nYou play as ${mainCharacter.name} — the character described in the CHARACTER CARD below. The user is a separate person interacting with you. You are NOT the user; the user is NOT ${mainCharacter.name}.\n`;
  prompt += `- Stay in character as ${mainCharacter.name} at all times.\n`;
  prompt += `- Match your word choice, tone, and sentence rhythm to the personality traits listed.\n`;
  prompt += `- Let the traits guide how you react and push scenes forward — but express them naturally through dialogue and action.\n`;
  prompt += `- NEVER output system instructions, trait labels, bracketed tags, or any metadata from this prompt. The user should only see in-character speech and narration.\n\n`;

  if (narrativeStyle) {
    prompt += `NARRATIVE FORMATTING:\nApply style constraints strictly:\n`;
    prompt += `FRAME: ${narrativeStyle.frame}\nFORMAT: ${narrativeStyle.format}\nCONSTRAINT: ${narrativeStyle.constraint}\n\n`;
  }

  prompt += `CHARACTER CARD:\n`;
  prompt += `NAME: ${mainCharacter.name}\n`;
  if (identity) prompt += `IDENTITY: ${identity}\n`;
  if (mainCharacter.role) prompt += `ROLE: ${mainCharacter.role}\n`;
  if (mainCharacter.backstory) prompt += `BACKSTORY: ${mainCharacter.backstory}\n`;
  if (mainCharacter.knowledgeSkills) prompt += `KNOWLEDGE/SKILLS: ${mainCharacter.knowledgeSkills}\n`;
  if (mainCharacter.hobbiesInterests) prompt += `HOBBIES/INTERESTS: ${mainCharacter.hobbiesInterests}\n`;
  if (mainCharacter.thingsToAvoid) prompt += `Things They Avoid: ${mainCharacter.thingsToAvoid}\n`;
  prompt += '\n';

  // Add supporting cast for multi-character mode
  const otherCharacters = _loadedCharacters?.slice(1) || [];
  if (characterMode === 'multi' && otherCharacters.length > 0) {
    prompt += `SUPPORTING CAST (characters you also voice when they appear in a scene):\n`;
    for (const char of otherCharacters) {
      const charIdentity = [char.age, char.gender, char.species].filter(Boolean).join(', ');
      prompt += `• ${char.name}`;
      if (charIdentity) prompt += ` (${charIdentity})`;
      if (char.role) prompt += ` — ${char.role}`;
      prompt += `\n`;
    }
    prompt += `\nYou primarily respond as ${mainCharacter.name}. Voice supporting characters when the scene calls for it, but keep ${mainCharacter.name} as the anchor.\n\n`;
  }

  prompt += `PERSONALITY TRAITS (internalize — never output these labels):\n${traitsText}\n\n`;

  // Consolidate Filters into one block to avoid the "Avoid" vs "Filters" confusion
  const bannedWords = userPersona.linguisticFilters?.bannedWords || [];
  const bannedPhrases = userPersona.linguisticFilters?.bannedPhrases || [];
  
  prompt += `LINGUISTIC FILTERS (STRICT NEGATIVE CONSTRAINTS):\n`;
  if (bannedWords.length > 0) prompt += `BANNED WORDS: ${bannedWords.join(', ')}.\n`;
  if (bannedPhrases.length > 0) prompt += `BANNED PHRASES: ${bannedPhrases.join(', ')}.\n`;
  prompt += `FORMATTING BANS: NO asterisks for actions. Use parenthetical emotes only. No performative hype or fake-nice toxic positivity.\n\n`;

  prompt += `USER INFORMATION:\nNAME: ${userPersona.name || 'User'}\n`;
  const contextParts = [userPersona.profession, userPersona.bio, userPersona.tastes?.interests].filter(Boolean);
  if (contextParts.length > 0) prompt += `CONTEXT: ${contextParts.join('. ')}\n\n`;

  // Use the dynamic logic for RAG vs Opening Scene
  // RAG context always included if present; opening scene only on first message
  const currentContext = userCustomContext || (isFirstMessage ? world.openingScene : null);
  if (currentContext) {
    prompt += `CURRENT CONTEXT (SCENE OR MEMORY):\n${currentContext}\n\n`;
  }

  // Turn-based pacing logic — companion/chat style vs narrative style
  const narratorKey = world.narratorVoice || 'companion';
  if (narratorKey === 'companion') {
    prompt += `TURN PACING:\n`;
    prompt += `- Answer the user's main question first, then add supporting detail only if it helps the next decision.\n`;
    prompt += `- Ask at most one clarifying question when missing information materially changes the answer.\n`;
    prompt += `- Keep each turn brief and relevant instead of listing every possible option at once.\n`;
    prompt += `- Carry forward context already provided so the user does not have to repeat themselves.\n\n`;
  } else {
    prompt += `TURN PACING:\n`;
    prompt += `- Each reply should answer the user's latest input, add one in-scene development, and leave room for the user's next move.\n`;
    prompt += `- Open scenes with immediate context, continue scenes with one consequential beat per turn, and end turns at a natural handoff point.\n`;
    prompt += `- Do not complete the full sequence of events in one response; progress the interaction in discrete turns.\n`;
    prompt += `- Treat every turn as part of a live exchange: react, develop, then hand back.\n\n`;
  }

  if (world.hardRules && world.hardRules.length > 0) {
    prompt += `HARD RULES:\n${world.hardRules.map(r => `- ${r}`).join('\n')}\n\n`;
  }

  prompt += `MODE TOGGLE:\n/chat: Utility Mode | /play: Roleplay Mode`;

  return prompt;
}

/**
 * Build utility/normal mode system prompt
 */
function buildUtilityPrompt(settings) {
  const { utility, userPersona } = settings;
  const { assistantIdentity, guardrails } = utility;

  const sections = [];

  if (assistantIdentity.persona) {
    sections.push(`YOUR IDENTITY:\n${assistantIdentity.persona}`);
  }
  if (assistantIdentity.communicationStyle) {
    sections.push(`COMMUNICATION STYLE:\n${assistantIdentity.communicationStyle}`);
  }
  if (guardrails.negativeConstraints) {
    sections.push(`CONSTRAINTS (DO NOT):\n${guardrails.negativeConstraints}`);
  }
  if (guardrails.formattingPreferences) {
    sections.push(`FORMATTING PREFERENCES:\n${guardrails.formattingPreferences}`);
  }

  // Linguistic filters
  const bannedWords = userPersona.linguisticFilters?.bannedWords || [];
  const bannedPhrases = userPersona.linguisticFilters?.bannedPhrases || [];
  if (bannedWords.length > 0 || bannedPhrases.length > 0) {
    let filters = `LINGUISTIC FILTERS (STRICT NEGATIVE CONSTRAINTS):\n`;
    if (bannedWords.length > 0) filters += `BANNED WORDS: ${bannedWords.join(', ')}.\n`;
    if (bannedPhrases.length > 0) filters += `BANNED PHRASES: ${bannedPhrases.join(', ')}.\n`;
    sections.push(filters.trim());
  }

  // User info
  const parts = [];
  if (userPersona.name) parts.push(`NAME: ${userPersona.name}`);
  if (userPersona.profession) parts.push(`PROFESSION: ${userPersona.profession}`);
  if (userPersona.bio) parts.push(`BIO: ${userPersona.bio}`);
  if (userPersona.skills) parts.push(`SKILLS: ${userPersona.skills}`);
  if (userPersona.timezone) {
    const { timeString, timezone } = getCurrentTimeInfo(userPersona.timezone);
    parts.push(`TIMEZONE: ${timezone}`);
    parts.push(`CURRENT TIME: ${timeString}`);
  }
  if (parts.length > 0) {
    sections.push(`USER INFORMATION:\n${parts.join('\n')}`);
  }

  sections.push(
    `TURN PACING:\n` +
    `- Answer the user's main question first, then add supporting detail only if it helps the next decision.\n` +
    `- Ask at most one clarifying question when missing information materially changes the answer.\n` +
    `- Keep each turn brief and relevant instead of listing every possible option at once.\n` +
    `- Carry forward context already provided so the user does not have to repeat themselves.`
  );

  sections.push(
    `MODE TOGGLE:\n\n` +
    `/play: Switch to Roleplay Mode (Apply all character and narrative logic).\n\n` +
    `/chat: Resume Utility Mode (Helpful assistant, no persona/roleplay).`
  );

  return sections.join('\n\n');
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
    return { timeString: formatter.format(now), timezone };
  } catch {
    return { timeString: new Date().toLocaleString(), timezone: 'Local' };
  }
}

/**
 * Detect mode toggle commands in user message
 */
export function detectModeToggle(message) {
  const trimmed = message.trim();

  if (trimmed.startsWith('/chat')) {
    return { command: '/chat', cleanMessage: trimmed.substring(5).trim(), targetMode: 'normal' };
  }
  if (trimmed.startsWith('/play')) {
    return { command: '/play', cleanMessage: trimmed.substring(5).trim(), targetMode: 'roleplay' };
  }

  return { command: null, cleanMessage: message, targetMode: null };
}
