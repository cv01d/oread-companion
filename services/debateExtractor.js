/**
 * Debate/argument tracking using Ollama inference.
 * Extracts stated positions, unresolved disagreements, and unanswered questions.
 * Runs periodically (every 10 turns) in both roleplay and utility modes.
 */

import ollamaService from './ollama.js';

const ROLEPLAY_DEBATE_PROMPT = `You are analyzing a roleplay conversation to track debates, disagreements, and open questions between characters.

For each debate or disagreement, identify:
- topic: a short label for the debate
- participants: who is involved
- positions: what each participant believes (as {name: stance} pairs)
- state: "active" if ongoing, "unresolved" if dropped without resolution, "resolved" if settled
- summary: one sentence describing the current state

Output valid JSON with a "debates" array. Maximum 5 debates, focus on the most significant.

Example output:
{"debates": [{"topic": "Whether to cross the river", "participants": ["Kael", "User"], "positions": {"Kael": "too dangerous, should find a bridge", "User": "we can swim across"}, "state": "active", "summary": "Neither side has conceded."}]}

If no debates are present, output: {"debates": []}
Output ONLY the JSON, no preamble or explanation.`;

const UTILITY_DEBATE_PROMPT = `You are analyzing a working conversation to track open questions, approach disagreements, and unresolved decisions between the user and assistant.

For each disagreement, open question about approach, or unresolved decision, identify:
- topic: a short label (e.g. "Database choice", "Authentication strategy")
- participants: who is involved (typically "User" and "Assistant")
- positions: what each suggested or argued for (as {name: stance} pairs)
- state: "active" if being discussed, "unresolved" if dropped without conclusion, "resolved" if decided
- summary: one sentence describing the current state

Output valid JSON with a "debates" array. Maximum 5 items, focus on the most significant.

Example output:
{"debates": [{"topic": "Database choice", "participants": ["User", "Assistant"], "positions": {"User": "prefers PostgreSQL for scalability", "Assistant": "suggested SQLite for deployment simplicity"}, "state": "active", "summary": "Still comparing trade-offs, concurrent writes not yet addressed."}]}

If no debates or open decisions are present, output: {"debates": []}
Output ONLY the JSON, no preamble or explanation.`;

/**
 * Determine if debate extraction should trigger.
 * @param {number} turnNumber - Current turn count
 * @returns {boolean}
 */
export function shouldExtractDebates(turnNumber) {
  return turnNumber > 0 && turnNumber % 10 === 0;
}

/**
 * Extract debates from recent messages using Ollama.
 *
 * @param {string} model - The Ollama model to use
 * @param {Array<{role: string, content: string}>} recentMessages - Last N messages
 * @param {Array} existingDebates - Currently tracked debates
 * @returns {Promise<Array>} Merged debates array
 */
export async function extractDebates(model, recentMessages, existingDebates = [], mode = 'roleplay') {
  const dialogue = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  let contextPrompt = `Conversation to analyze:\n${dialogue}`;
  if (existingDebates.length > 0) {
    contextPrompt += `\n\nPreviously tracked debates:\n${JSON.stringify(existingDebates)}`;
  }

  const stream = await ollamaService.chat(model, [
    { role: 'user', content: contextPrompt }
  ], {
    systemPrompt: mode === 'roleplay' ? ROLEPLAY_DEBATE_PROMPT : UTILITY_DEBATE_PROMPT,
    temperature: 0.2,
    maxTokens: 400
  });

  let result = '';
  for await (const chunk of stream) {
    if (chunk.message?.content) {
      result += chunk.message.content;
    }
  }

  // Defensive JSON parsing
  const parsed = parseDebateJSON(result.trim());
  if (!parsed || !Array.isArray(parsed.debates)) {
    return existingDebates;
  }

  // Merge new debates with existing
  return mergeDebates(existingDebates, parsed.debates);
}

/**
 * Parse debate JSON defensively (handles markdown fences, etc.)
 */
function parseDebateJSON(text) {
  // Strip markdown code fences
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return null;

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

/**
 * Merge new debates into existing, matching by topic keyword overlap.
 */
function mergeDebates(existing, incoming) {
  const merged = [...existing];

  for (const debate of incoming) {
    if (!debate.topic) continue;

    const matchIdx = findMatchingDebate(merged, debate);
    if (matchIdx >= 0) {
      // Update existing debate
      merged[matchIdx] = {
        ...merged[matchIdx],
        ...debate,
        // Preserve firstRaised if it exists
        lastRaised: debate.lastRaised || merged[matchIdx].lastRaised
      };
    } else {
      merged.push(debate);
    }
  }

  // Cap at 10, drop resolved first when over cap
  if (merged.length > 10) {
    const resolved = merged.filter(d => d.state === 'resolved');
    const active = merged.filter(d => d.state !== 'resolved');
    return [...active, ...resolved].slice(0, 10);
  }

  return merged;
}

/**
 * Find a matching debate by topic keyword overlap.
 */
function findMatchingDebate(debates, candidate) {
  const candidateWords = new Set(
    candidate.topic.toLowerCase().split(/\W+/).filter(w => w.length > 2)
  );

  for (let i = 0; i < debates.length; i++) {
    const existingWords = new Set(
      debates[i].topic.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    );

    let overlap = 0;
    for (const word of candidateWords) {
      if (existingWords.has(word)) overlap++;
    }

    const total = new Set([...candidateWords, ...existingWords]).size;
    if (total > 0 && overlap / total >= 0.4) return i;
  }

  return -1;
}
