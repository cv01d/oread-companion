/**
 * World state extraction using phi4-mini via Ollama.
 * Replaces the previous compromise-based zero-inference approach.
 *
 * Roleplay mode: location, time, present characters, ongoing events, mood,
 *                known characters registry, event lifecycle, location breadcrumbs.
 * Utility mode:  current focus, open questions, decisions, parked items,
 *                known entities (topics/tools/APIs), event lifecycle.
 */

import ollamaService from './ollama.js';
import extractionModelManager from './extractionModelManager.js';

// Stopwords for fuzzy event matching
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'his', 'her', 'their', 'my', 'your', 'our'
]);

// Config-driven diff fields for both modes
const DIFF_FIELDS = {
  // Scalars
  currentLocation: { type: 'scalar' },
  currentTime: { type: 'scalar' },
  mood: { type: 'scalar' },
  currentFocus: { type: 'scalar' },
  // Arrays
  presentCharacters: { type: 'array', addAction: 'arrived', removeAction: 'departed' },
  ongoingEvents: { type: 'array', addAction: 'added', removeAction: 'resolved' },
  discoveries: { type: 'array', addAction: 'discovered', removeAction: 'superseded' },
  openQuestions: { type: 'array', addAction: 'raised', removeAction: 'resolved' },
  decisions: { type: 'array', addAction: 'made', removeAction: 'reversed' },
  parkedItems: { type: 'array', addAction: 'parked', removeAction: 'unparked' },
};

// ===== LLM Prompts =====

const WORLD_STATE_PROMPT = `You are tracking the world state of a roleplay scene. Given the current state and the latest exchange between a player and a character, extract what changed this turn.

Return JSON with ONLY fields that have new or changed information. Omit fields with no update.
{
  "currentLocation": "the physical place where the scene is now happening, or null if no movement",
  "currentTime": "in-story time of day or time reference (e.g. 'morning', '2 weeks ago', 'the next hour'), or null",
  "presentCharacters": ["ONLY characters physically present in the scene right now — NOT people merely mentioned, referenced, or discussed"],
  "departedCharacters": ["characters who left the scene this turn"],
  "newEvents": ["significant plot developments, actions, or discoveries this turn — not dialogue"],
  "newDiscoveries": ["important new information, theories, or revelations learned this turn"],
  "mood": "overall atmosphere: tense/calm/joyful/somber/mysterious/hostile/playful/romantic/eerie, or null"
}

CRITICAL RULES:
- presentCharacters = ONLY people physically in the room/scene. A government mentioned in conversation is NOT present. An organization is NOT a character. "Trusted colleagues" are NOT present unless they walk into the scene.
- Characters from settings who are part of this scene: {CHARACTER_NAMES}
- If a character is mentioned as "joining shortly" or "on the way", they are NOT yet present.
- newEvents: plot-advancing actions, movements, discoveries. NOT dialogue content or opinions. Keep under 120 chars each. Max 3 per turn.
- newDiscoveries: key information revealed this turn — theories, facts, data, revelations that advance the plot. Keep under 120 chars. Max 3 per turn.
- Location: only change if someone physically moves to a new place.
- currentTime: extract any in-story temporal reference, even relative ones ("two weeks ago", "in the last hour", "shortly").

Current world state:
{CURRENT_STATE}

User message:
{USER_MESSAGE}

Assistant response:
{ASSISTANT_RESPONSE}`;

const SESSION_STATE_PROMPT = `You are tracking session state from a utility/normal conversation. Identify key discussion elements from this turn.

Return JSON with ONLY fields that have new information. Omit fields with nothing new.
{
  "currentFocus": "the dominant topic of this exchange, 2-5 words",
  "newQuestions": ["open questions or unknowns raised this turn"],
  "newDecisions": ["clear decisions, conclusions, or agreements reached"],
  "newParkedItems": ["topics the user explicitly deferred for later"],
  "newEntities": ["specific tools, APIs, libraries, files, technical terms, or proper nouns"],
  "newDiscoveries": ["key insights, findings, or important information revealed"]
}

Rules:
- Focus: what this exchange is primarily about, not a generic category
- Questions: explicit questions, "we need to figure out...", or unresolved unknowns
- Decisions: only clear decisions — "let's use X", "we'll go with Y", "agreed on Z"
- Parked items: only if user explicitly defers ("table that", "come back to", "later")
- Entities: proper nouns, technical terms, specific tool/library/API names — NOT common English words
- Discoveries: important findings or insights that emerged, not restating what was already known

Current session state:
{CURRENT_STATE}

User message:
{USER_MESSAGE}

Assistant response:
{ASSISTANT_RESPONSE}`;

/**
 * Fuzzy match a new event text against existing events.
 * Uses Jaccard similarity on tokens, requiring a shared proper noun.
 *
 * @param {string} newText - The new event text
 * @param {Array} existingEvents - Array of event objects or strings
 * @param {number} threshold - Similarity threshold (default 0.4)
 * @returns {number} Index of matching event, or -1
 */
export function matchEvent(newText, existingEvents, threshold = 0.4) {
  const newTokens = tokenize(newText);
  const newProperNouns = extractProperNouns(newText);

  for (let i = 0; i < existingEvents.length; i++) {
    const existingText = typeof existingEvents[i] === 'string'
      ? existingEvents[i]
      : existingEvents[i].text;

    const existingTokens = tokenize(existingText);
    const existingProperNouns = extractProperNouns(existingText);

    // Require at least one shared proper noun
    const sharedProper = newProperNouns.some(n => existingProperNouns.includes(n));
    if (!sharedProper && newProperNouns.length > 0 && existingProperNouns.length > 0) continue;

    // Jaccard similarity
    const union = new Set([...newTokens, ...existingTokens]);
    const intersection = newTokens.filter(t => existingTokens.includes(t));
    const similarity = union.size > 0 ? intersection.length / union.size : 0;

    if (similarity >= threshold) return i;
  }
  return -1;
}

function tokenize(text) {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function extractProperNouns(text) {
  const words = text.split(/\s+/);
  const proper = [];
  for (let i = 1; i < words.length; i++) {
    const clean = words[i].replace(/[^a-zA-Z]/g, '');
    if (clean.length > 1 && clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase()) {
      proper.push(clean.toLowerCase());
    }
  }
  return proper;
}

/**
 * Diff two world/session states and produce a change log.
 * Config-driven — works for both roleplay and utility mode fields.
 *
 * @param {Object} oldState - Previous state
 * @param {Object} newState - Updated state
 * @param {number} turnNumber - Current turn number
 * @returns {Array} Array of change entries
 */
export function diffWorldState(oldState, newState, turnNumber) {
  const changes = [];
  if (!oldState || !newState) return changes;

  for (const [field, config] of Object.entries(DIFF_FIELDS)) {
    if (config.type === 'scalar') {
      const oldVal = oldState[field] || '';
      const newVal = newState[field] || '';
      if (oldVal !== newVal && newVal) {
        changes.push({ turn: turnNumber, field, from: oldVal || undefined, to: newVal });
      }
    } else if (config.type === 'array') {
      const oldArr = (oldState[field] || []).map(item =>
        typeof item === 'string' ? item : item.text || ''
      );
      const newArr = (newState[field] || []).map(item =>
        typeof item === 'string' ? item : item.text || ''
      );

      const oldSet = new Set(oldArr.map(s => s.toLowerCase()));
      const newSet = new Set(newArr.map(s => s.toLowerCase()));

      for (const item of newArr) {
        if (!oldSet.has(item.toLowerCase())) {
          changes.push({ turn: turnNumber, field, to: item, action: config.addAction });
        }
      }

      for (const item of oldArr) {
        if (!newSet.has(item.toLowerCase())) {
          changes.push({ turn: turnNumber, field, from: item, action: config.removeAction });
        }
      }
    }
  }

  return changes;
}

/**
 * Extract world state changes from the latest exchange (ROLEPLAY mode).
 * Uses phi4-mini for extraction, then applies lifecycle and merging logic.
 *
 * @param {string} userMessage - What the user said
 * @param {string} assistantResponse - What the character/narrator said
 * @param {Object} currentWorldState - Existing world state
 * @param {number} turnNumber - Current turn
 * @param {Object} settings - Current settings (for character names, user persona)
 * @returns {Promise<Object>} Updated world state
 */
export async function extractWorldState(userMessage, assistantResponse, currentWorldState = {}, turnNumber = 0, settings = {}) {
  const updates = { ...currentWorldState, lastUpdated: turnNumber };

  if (!extractionModelManager.isReady()) {
    return updates;
  }

  // Build character names from settings
  const settingsCharacters = getCharacterNames(settings);
  const userName = settings?.userPersona?.name || '';
  const allNames = [...settingsCharacters, userName].filter(Boolean);

  // Build a compact summary of current state for the prompt
  const stateSnapshot = {
    currentLocation: currentWorldState.currentLocation || 'unknown',
    currentTime: currentWorldState.currentTime || 'unknown',
    presentCharacters: currentWorldState.presentCharacters || [],
    mood: currentWorldState.mood || 'unknown',
    recentEvents: (currentWorldState.ongoingEvents || [])
      .filter(e => e.state === 'active')
      .slice(-3)
      .map(e => e.text || e),
    recentDiscoveries: (currentWorldState.discoveries || [])
      .filter(e => e.state === 'active')
      .slice(-3)
      .map(e => e.text || e)
  };

  const prompt = WORLD_STATE_PROMPT
    .replace('{CHARACTER_NAMES}', allNames.join(', ') || 'none specified')
    .replace('{CURRENT_STATE}', JSON.stringify(stateSnapshot))
    .replace('{USER_MESSAGE}', userMessage || '(none)')
    .replace('{ASSISTANT_RESPONSE}', assistantResponse || '(none)');

  let extracted;
  try {
    extracted = await ollamaService.extract(extractionModelManager.modelName, prompt);
  } catch (err) {
    console.error('World state extraction LLM error:', err.message);
    return updates;
  }

  // === Apply location ===
  if (extracted.currentLocation) {
    const newLocation = extracted.currentLocation;
    const currentLoc = (currentWorldState.currentLocation || '').toLowerCase();

    if (newLocation.toLowerCase() !== currentLoc) {
      // Location changed — update trail
      if (currentWorldState.currentLocation) {
        const trail = [...(currentWorldState.locationTrail || [])];
        trail.push({
          location: currentWorldState.currentLocation,
          arrivedTurn: currentWorldState.locationArrivedTurn || 0,
          departedTurn: turnNumber
        });
        updates.locationTrail = trail.slice(-10);
      }
      updates.currentLocation = newLocation;
      updates.locationArrivedTurn = turnNumber;
    }
  }

  if (updates.locationArrivedTurn === undefined && currentWorldState.locationArrivedTurn !== undefined) {
    updates.locationArrivedTurn = currentWorldState.locationArrivedTurn;
  }
  if (updates.locationTrail === undefined && currentWorldState.locationTrail !== undefined) {
    updates.locationTrail = currentWorldState.locationTrail;
  }

  // === Apply present characters ===
  const extractedChars = Array.isArray(extracted.presentCharacters) ? extracted.presentCharacters : [];
  const departedChars = Array.isArray(extracted.departedCharacters) ? extracted.departedCharacters : [];
  const departedSet = new Set(departedChars.map(c => c.toLowerCase()));
  const knownCharacters = { ...(currentWorldState.knownCharacters || {}) };
  const previousPresent = new Set((currentWorldState.presentCharacters || []).map(c => c.toLowerCase()));

  if (extractedChars.length > 0 || departedChars.length > 0) {
    // Start with currently present characters
    const merged = [...(currentWorldState.presentCharacters || [])];

    // Add newly arrived characters
    for (const person of extractedChars) {
      if (!previousPresent.has(person.toLowerCase())) {
        merged.push(person);
      }
    }

    // Remove explicitly departed characters
    const presentSet = new Set(extractedChars.map(c => c.toLowerCase()));
    const stillPresent = merged.filter(char => {
      const key = char.toLowerCase();
      // Keep if LLM listed them as present, or if they weren't explicitly departed
      if (presentSet.has(key)) return true;
      if (departedSet.has(key)) return false;
      // If LLM returned a list but didn't include this char, they left
      if (extractedChars.length > 0 && !presentSet.has(key)) return false;
      return true;
    });

    updates.presentCharacters = stillPresent.slice(-10);

    // Update known characters registry
    for (const person of extractedChars) {
      const key = person.toLowerCase();
      const existing = knownCharacters[key] || {};
      knownCharacters[key] = {
        firstSeen: existing.firstSeen ?? turnNumber,
        lastSeen: turnNumber,
        lastLocation: updates.currentLocation || currentWorldState.currentLocation || '',
        disposition: existing.disposition || 'neutral'
      };
    }

    for (const person of departedChars) {
      const key = person.toLowerCase();
      if (knownCharacters[key]) {
        knownCharacters[key].lastSeen = turnNumber;
      }
    }
  }

  // Cap knownCharacters at 20
  const knownEntries = Object.entries(knownCharacters);
  if (knownEntries.length > 20) {
    knownEntries.sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
    updates.knownCharacters = Object.fromEntries(knownEntries.slice(0, 20));
  } else {
    updates.knownCharacters = knownCharacters;
  }

  // === Apply time ===
  if (extracted.currentTime) {
    updates.currentTime = extracted.currentTime;
  }

  // === Apply events with lifecycle ===
  const newEventTexts = Array.isArray(extracted.newEvents) ? extracted.newEvents : [];

  let existingEvents = (currentWorldState.ongoingEvents || []).map(e => {
    if (typeof e === 'string') {
      return { text: e, firstDetected: Math.max(0, turnNumber - 5), lastConfirmed: turnNumber, state: 'active' };
    }
    return { ...e };
  });

  for (const text of newEventTexts.slice(0, 3)) {
    const matchIdx = matchEvent(text, existingEvents);
    if (matchIdx >= 0) {
      existingEvents[matchIdx].lastConfirmed = turnNumber;
      existingEvents[matchIdx].state = 'active';
    } else {
      existingEvents.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    }
  }

  for (const event of existingEvents) {
    const age = turnNumber - (event.lastConfirmed || 0);
    if (age > 20) event.state = 'resolved';
    else if (age > 10) event.state = 'fading';
  }

  const activeAndFading = existingEvents.filter(e => e.state !== 'resolved');
  updates.ongoingEvents = activeAndFading.slice(-8);
  updates._resolvedEvents = existingEvents.filter(e => e.state === 'resolved');

  // === Apply discoveries with lifecycle ===
  const newDiscoveryTexts = Array.isArray(extracted.newDiscoveries) ? extracted.newDiscoveries : [];

  let existingDiscoveries = (currentWorldState.discoveries || []).map(d => {
    if (typeof d === 'string') {
      return { text: d, firstDetected: Math.max(0, turnNumber - 5), lastConfirmed: turnNumber, state: 'active' };
    }
    return { ...d };
  });

  for (const text of newDiscoveryTexts.slice(0, 3)) {
    const matchIdx = matchEvent(text, existingDiscoveries, 0.35);
    if (matchIdx >= 0) {
      existingDiscoveries[matchIdx].lastConfirmed = turnNumber;
      existingDiscoveries[matchIdx].state = 'active';
    } else {
      existingDiscoveries.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    }
  }

  // Discoveries age slower than events — they're knowledge, not happenings
  for (const disc of existingDiscoveries) {
    const age = turnNumber - (disc.lastConfirmed || 0);
    if (age > 30) disc.state = 'resolved';
    else if (age > 15) disc.state = 'fading';
  }

  updates.discoveries = existingDiscoveries.filter(d => d.state !== 'resolved').slice(-10);

  // === Apply mood ===
  if (extracted.mood) {
    const validMoods = ['tense', 'calm', 'joyful', 'somber', 'mysterious', 'hostile', 'playful', 'romantic', 'eerie'];
    const normalizedMood = extracted.mood.toLowerCase();
    if (validMoods.includes(normalizedMood)) {
      updates.mood = normalizedMood.charAt(0).toUpperCase() + normalizedMood.slice(1);
    }
  }

  // Preserve debates if present (managed by debateExtractor)
  if (currentWorldState.debates) {
    updates.debates = currentWorldState.debates;
  }

  return updates;
}

/**
 * Get character names from settings (all characters + first names).
 */
function getCharacterNames(settings) {
  const names = new Set();
  const addChar = (char) => {
    if (!char?.name) return;
    names.add(char.name);
    const firstName = char.name.split(' ')[0];
    if (firstName.length > 1) names.add(firstName);
  };

  addChar(settings?.roleplay?.character);
  for (const char of (settings?.roleplay?.characters || [])) {
    addChar(char);
  }

  return [...names];
}

/**
 * Extract session state from the latest exchange (UTILITY/NORMAL mode).
 * Uses phi4-mini for extraction, then applies lifecycle logic.
 *
 * @param {string} userMessage - What the user said
 * @param {string} assistantResponse - What the assistant said
 * @param {Object} currentState - Existing session state
 * @param {number} turnNumber - Current turn
 * @returns {Promise<Object>} Updated session state
 */
export async function extractSessionState(userMessage, assistantResponse, currentState = {}, turnNumber = 0) {
  const updates = { ...currentState, lastUpdated: turnNumber };

  if (!extractionModelManager.isReady()) {
    return updates;
  }

  // Build compact state summary for prompt
  const stateSnapshot = {
    currentFocus: currentState.currentFocus || 'none',
    openQuestions: (currentState.openQuestions || []).map(q => q.text || q).slice(-5),
    decisions: (currentState.decisions || []).map(d => d.text || d).slice(-5),
    recentDiscoveries: (currentState.discoveries || [])
      .filter(d => d.state === 'active')
      .slice(-3)
      .map(d => d.text || d)
  };

  const prompt = SESSION_STATE_PROMPT
    .replace('{CURRENT_STATE}', JSON.stringify(stateSnapshot))
    .replace('{USER_MESSAGE}', userMessage || '(none)')
    .replace('{ASSISTANT_RESPONSE}', assistantResponse || '(none)');

  let extracted;
  try {
    extracted = await ollamaService.extract(extractionModelManager.modelName, prompt);
  } catch (err) {
    console.error('Session state extraction LLM error:', err.message);
    return updates;
  }

  // === Apply focus topic ===
  if (extracted.currentFocus) {
    updates.currentFocus = extracted.currentFocus;
  }

  // === Apply open questions with lifecycle ===
  const newQuestions = Array.isArray(extracted.newQuestions) ? extracted.newQuestions : [];

  let existingQuestions = (currentState.openQuestions || []).map(q => ({ ...q }));
  for (const text of newQuestions) {
    const matchIdx = matchEvent(text, existingQuestions, 0.3);
    if (matchIdx >= 0) {
      existingQuestions[matchIdx].lastConfirmed = turnNumber;
      existingQuestions[matchIdx].state = 'active';
    } else {
      existingQuestions.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    }
  }

  // Age open questions
  for (const q of existingQuestions) {
    const age = turnNumber - (q.lastConfirmed || 0);
    if (age > 20) q.state = 'resolved';
    else if (age > 10) q.state = 'fading';
  }

  // Auto-park: questions never addressed (lastConfirmed == firstDetected)
  let existingParked = (currentState.parkedItems || []).map(p => ({ ...p }));
  for (const q of existingQuestions) {
    if (q.state === 'fading' && q.lastConfirmed === q.firstDetected) {
      const alreadyParked = matchEvent(q.text, existingParked, 0.3);
      if (alreadyParked === -1) {
        existingParked.push({ text: q.text, firstDetected: q.firstDetected, lastConfirmed: turnNumber, state: 'active' });
      }
      q.state = 'parked';
    }
  }

  updates.openQuestions = existingQuestions.filter(q =>
    q.state === 'active' || q.state === 'fading'
  ).slice(-8);
  updates._resolvedEvents = existingQuestions.filter(q => q.state === 'resolved');

  // === Apply decisions with lifecycle ===
  const newDecisions = Array.isArray(extracted.newDecisions) ? extracted.newDecisions : [];

  let existingDecisions = (currentState.decisions || []).map(d => ({ ...d }));
  for (const text of newDecisions) {
    const matchIdx = matchEvent(text, existingDecisions, 0.3);
    if (matchIdx >= 0) {
      existingDecisions[matchIdx].lastConfirmed = turnNumber;
      existingDecisions[matchIdx].state = 'active';
    } else {
      existingDecisions.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    }
  }

  // Decisions age slower
  for (const d of existingDecisions) {
    const age = turnNumber - (d.lastConfirmed || 0);
    if (age > 40) d.state = 'archived';
    else if (age > 30) d.state = 'fading';
  }

  updates.decisions = existingDecisions.filter(d => d.state !== 'archived').slice(-8);

  const archivedDecisions = existingDecisions.filter(d => d.state === 'archived');
  if (archivedDecisions.length > 0) {
    updates._resolvedEvents = [
      ...(updates._resolvedEvents || []),
      ...archivedDecisions
    ];
  }

  // === Apply parked items ===
  const newParkedItems = Array.isArray(extracted.newParkedItems) ? extracted.newParkedItems : [];
  for (const text of newParkedItems) {
    const alreadyParked = matchEvent(text, existingParked, 0.3);
    if (alreadyParked === -1) {
      existingParked.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    } else {
      existingParked[alreadyParked].lastConfirmed = turnNumber;
    }
  }

  updates.parkedItems = existingParked.slice(-8);

  // === Apply known entities ===
  const newEntities = Array.isArray(extracted.newEntities) ? extracted.newEntities : [];
  const knownEntities = { ...(currentState.knownEntities || {}) };

  for (const name of newEntities) {
    const key = name.toLowerCase();
    const existing = knownEntities[key];
    if (existing) {
      knownEntities[key] = {
        ...existing,
        lastSeen: turnNumber
      };
    } else {
      knownEntities[key] = {
        firstSeen: turnNumber,
        lastSeen: turnNumber,
        context: ''
      };
    }
  }

  // Cap at 20, prioritize multi-turn entities
  const entityEntries = Object.entries(knownEntities);
  if (entityEntries.length > 20) {
    entityEntries.sort((a, b) => {
      const aMultiTurn = a[1].firstSeen < a[1].lastSeen ? 1 : 0;
      const bMultiTurn = b[1].firstSeen < b[1].lastSeen ? 1 : 0;
      if (bMultiTurn !== aMultiTurn) return bMultiTurn - aMultiTurn;
      return (b[1].lastSeen || 0) - (a[1].lastSeen || 0);
    });
    updates.knownEntities = Object.fromEntries(entityEntries.slice(0, 20));
  } else {
    updates.knownEntities = knownEntities;
  }

  // === Apply discoveries with lifecycle ===
  const newSessionDiscoveries = Array.isArray(extracted.newDiscoveries) ? extracted.newDiscoveries : [];

  let existingSessionDiscoveries = (currentState.discoveries || []).map(d => {
    if (typeof d === 'string') {
      return { text: d, firstDetected: Math.max(0, turnNumber - 5), lastConfirmed: turnNumber, state: 'active' };
    }
    return { ...d };
  });

  for (const text of newSessionDiscoveries.slice(0, 3)) {
    const matchIdx = matchEvent(text, existingSessionDiscoveries, 0.35);
    if (matchIdx >= 0) {
      existingSessionDiscoveries[matchIdx].lastConfirmed = turnNumber;
      existingSessionDiscoveries[matchIdx].state = 'active';
    } else {
      existingSessionDiscoveries.push({ text, firstDetected: turnNumber, lastConfirmed: turnNumber, state: 'active' });
    }
  }

  for (const disc of existingSessionDiscoveries) {
    const age = turnNumber - (disc.lastConfirmed || 0);
    if (age > 30) disc.state = 'resolved';
    else if (age > 15) disc.state = 'fading';
  }

  updates.discoveries = existingSessionDiscoveries.filter(d => d.state !== 'resolved').slice(-10);

  // Preserve debates if present (managed by debateExtractor)
  if (currentState.debates) {
    updates.debates = currentState.debates;
  }

  return updates;
}
