/**
 * Entity Memory — Layer 3 of the memory system.
 *
 * After each exchange, an LLM call extracts facts the user revealed about themselves.
 * Facts are stored in SQLite `entities` table and embedded into the session FAISS index
 * so they surface during token-budgeted retrieval.
 */

import { ChatOllama } from '@langchain/ollama';
import { v4 as uuidv4 } from 'uuid';
import database from './database.js';
import memoryManager from './memoryManager.js';
import { CONFIG } from '../config/index.js';

const EXTRACTION_PROMPT = `You are an entity extraction system. Analyze the following exchange and extract any facts the USER revealed about THEMSELVES (not the AI character).

Focus on:
- Personal details (name, occupation, location, age)
- Preferences and interests (likes, dislikes, hobbies)
- Life events or experiences mentioned
- Skills, knowledge areas
- Relationships mentioned
- Goals or plans

Exchange:
USER: {userMessage}
ASSISTANT: {assistantMessage}

Return ONLY a JSON array of extracted facts. Each fact should be:
[
  { "entity": "user", "fact": "concise fact statement" }
]

If no new facts about the user were revealed, return: []
Do not include facts about the AI character. Only facts about the real person typing.`;

class EntityMemoryService {
  constructor() {
    this._llm = null;
    this._currentModel = null;
  }

  _getLLM(model) {
    if (this._llm && this._currentModel === model) return this._llm;
    this._llm = new ChatOllama({
      baseUrl: CONFIG.OLLAMA_URL,
      model,
      temperature: 0.1 // Very low temp for factual extraction
    });
    this._currentModel = model;
    return this._llm;
  }

  /**
   * Extract entities from a user/assistant exchange and store them.
   * Called as a background task (fire-and-forget) after each chat turn.
   */
  async extractAndStore(sessionId, userMessage, assistantMessage, model) {
    try {
      const llm = this._getLLM(model);

      const prompt = EXTRACTION_PROMPT
        .replace('{userMessage}', userMessage)
        .replace('{assistantMessage}', assistantMessage);

      const response = await llm.invoke(prompt);
      const facts = this._parseResponse(response.content);

      if (facts.length === 0) return;

      // Guard: session may have been deleted while extraction was running
      const session = await database.get(
        'SELECT id FROM sessions WHERE id = ?',
        [sessionId]
      );
      if (!session) return;

      // Check for duplicates against existing entities
      const existing = await database.all(
        'SELECT entity_info FROM entities WHERE session_id = ?',
        [sessionId]
      );
      const existingFacts = new Set(existing.map(e => e.entity_info.toLowerCase()));

      for (const fact of facts) {
        // Skip if substantially similar to an existing fact
        if (existingFacts.has(fact.fact.toLowerCase())) continue;

        const id = uuidv4();
        const entityName = fact.entity || 'user';

        // Store in SQLite
        await database.run(
          `INSERT INTO entities (id, session_id, entity_name, entity_info)
           VALUES (?, ?, ?, ?)`,
          [id, sessionId, entityName, fact.fact]
        );

        // Embed into session FAISS index
        await memoryManager.addEntity(sessionId, id, entityName, fact.fact);
      }

      if (facts.length > 0) {
        console.log(`🧩 Extracted ${facts.length} entity facts for session ${sessionId.slice(0, 8)}`);
      }
    } catch (error) {
      console.error('Entity extraction error:', error);
      // Non-critical — don't throw
    }
  }

  /**
   * Parse the LLM response into a facts array.
   */
  _parseResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.filter(item =>
        item.fact &&
        typeof item.fact === 'string' &&
        item.fact.trim().length > 0
      );
    } catch {
      return [];
    }
  }

  /**
   * Get all entities for a session (for debugging/display).
   */
  async getSessionEntities(sessionId) {
    return database.all(
      'SELECT * FROM entities WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
  }
}

export default new EntityMemoryService();
