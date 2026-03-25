/**
 * Fact extraction using phi4-mini via Ollama.
 * Replaces the previous compromise-based zero-inference approach
 * with LLM-based extraction for higher accuracy.
 */

import ollamaService from './ollama.js';
import extractionModelManager from './extractionModelManager.js';

const FACT_EXTRACTION_PROMPT = `Extract key facts from this conversation turn. Return a JSON object with these arrays (use empty arrays if nothing found for a category):

{
  "people": ["full names of people/characters mentioned or referenced"],
  "places": ["physical locations, facilities, cities, rooms, geographic features"],
  "events": ["significant actions, movements, or plot developments (NOT dialogue or opinions)"],
  "facts": ["concrete factual details: dates, quantities, timelines, technical specs, named things"]
}

Rules:
- People: full names when stated (e.g. "Dr. Amara Osei", "Yuki Tanaka"), first names if that's all given. Only actual characters/people, NOT organizations or groups.
- Places: physical locations only — a facility, a room, a city, a geographic feature. NOT metaphorical.
- Events: what happened or what someone did. NOT what someone said or believes. Keep under 120 chars.
- Facts: concrete, specific information — "signal detected 2 weeks ago", "200 unique sequences received", "uses AES-256 encryption". NOT vague summaries.
- Max 5 entries per category. Quality over quantity.

User message:
{USER_MESSAGE}

Assistant response:
{ASSISTANT_RESPONSE}`;

/**
 * Extract facts from a user message and assistant response.
 *
 * @param {string} userMessage - The user's message content
 * @param {string} assistantResponse - The assistant's response content
 * @param {number} turn - The turn number for attribution
 * @returns {Promise<Array<{type: string, text: string, turn: number}>>}
 */
export async function extractFacts(userMessage, assistantResponse, turn = 0) {
  if (!extractionModelManager.isReady()) {
    return [];
  }

  const prompt = FACT_EXTRACTION_PROMPT
    .replace('{USER_MESSAGE}', userMessage || '(none)')
    .replace('{ASSISTANT_RESPONSE}', assistantResponse || '(none)');

  try {
    const result = await ollamaService.extract(extractionModelManager.modelName, prompt);
    const facts = [];
    const seen = new Set();

    const addFact = (type, text) => {
      const normalized = (typeof text === 'string' ? text : '').trim();
      if (!normalized || normalized.length < 2) return;
      const key = `${type}:${normalized.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      facts.push({ type, text: normalized, turn });
    };

    for (const person of (result.people || [])) addFact('person', person);
    for (const place of (result.places || [])) addFact('place', place);
    for (const event of (result.events || [])) addFact('event', event);
    for (const fact of (result.facts || [])) addFact('fact', fact);

    return facts;
  } catch (err) {
    console.error('Fact extraction LLM error:', err.message);
    return [];
  }
}

/**
 * Deduplicate and cap extracted facts with turn-age awareness.
 * Replaces the naive .slice(-50) approach.
 *
 * @param {Array<{type: string, text: string, turn: number}>} existing - Previously stored facts
 * @param {Array<{type: string, text: string, turn: number}>} newFacts - Newly extracted facts
 * @param {Object} options
 * @param {number} options.maxFacts - Maximum facts to keep (default 80)
 * @param {number} options.maxTurnAge - Drop facts older than this many turns (default 40)
 * @returns {Array<{type: string, text: string, turn: number}>}
 */
export function deduplicateAndCap(existing, newFacts, { maxFacts = 80, maxTurnAge = 40 } = {}) {
  const currentTurn = newFacts.length > 0 ? newFacts[0].turn : (existing.length > 0 ? existing[existing.length - 1].turn : 0);
  const all = [...existing, ...newFacts];

  // Deduplicate: later facts overwrite earlier ones (fresher data wins)
  const seen = new Map();
  for (const fact of all) {
    const key = `${fact.type}:${fact.text.toLowerCase()}`;
    seen.set(key, fact);
  }

  let deduped = [...seen.values()];

  // Remove facts older than maxTurnAge
  if (currentTurn > 0) {
    deduped = deduped.filter(f => currentTurn - (f.turn || 0) < maxTurnAge);
  }

  // Cap at maxFacts, keeping newest
  return deduped.slice(-maxFacts);
}
