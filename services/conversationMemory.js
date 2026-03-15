/**
 * Conversation Summary Buffer — replaces crude message windowing.
 *
 * Keeps recent messages verbatim (up to ~800 tokens).
 * Older messages are summarized by the chat model and stored in sessions.summary.
 * On each turn the summary is incrementally updated if new messages overflow the buffer.
 */

import { ChatOllama } from '@langchain/ollama';
import database from './database.js';
import { CONFIG } from '../config/index.js';

const MAX_BUFFER_TOKENS = 800;

class ConversationMemoryService {
  constructor() {
    this._llm = null;
    this._currentModel = null;
  }

  _getLLM(model) {
    if (this._llm && this._currentModel === model) return this._llm;
    this._llm = new ChatOllama({
      baseUrl: CONFIG.OLLAMA_URL,
      model,
      temperature: 0.3 // Low temp for factual summarization
    });
    this._currentModel = model;
    return this._llm;
  }

  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Get conversation context for sending to the LLM:
   * - Existing summary (if any)
   * - Recent messages that fit within the buffer
   *
   * Returns { summary, recentMessages: [{ role, content }] }
   */
  async getConversationContext(sessionId) {
    // Load existing summary
    const session = await database.get(
      'SELECT summary FROM sessions WHERE id = ?',
      [sessionId]
    );
    const summary = session?.summary || '';

    // Load all messages (most recent first, then reverse)
    const messages = await database.all(
      `SELECT role, content FROM messages
       WHERE session_id = ? AND role != 'system'
       ORDER BY timestamp DESC`,
      [sessionId]
    );
    messages.reverse();

    // Fill recent buffer from the end (most recent first)
    const recent = [];
    let tokenCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const tokens = this._estimateTokens(msg.content);
      if (tokenCount + tokens > MAX_BUFFER_TOKENS) break;
      recent.unshift(msg);
      tokenCount += tokens;
    }

    return { summary, recentMessages: recent };
  }

  /**
   * Update the running summary after a new exchange.
   * Called as a background task after each chat turn.
   *
   * Incrementally summarizes messages that have fallen out of the recent buffer.
   */
  async updateSummary(sessionId, model) {
    try {
      const session = await database.get(
        'SELECT summary, message_count FROM sessions WHERE id = ?',
        [sessionId]
      );

      // Only summarize when we have enough messages to overflow the buffer
      if (!session || session.message_count < 10) return;

      // Load all messages
      const messages = await database.all(
        `SELECT role, content FROM messages
         WHERE session_id = ? AND role != 'system'
         ORDER BY timestamp ASC`,
        [sessionId]
      );

      // Find which messages are "old" (outside the recent buffer)
      let recentTokens = 0;
      let cutoff = messages.length;
      for (let i = messages.length - 1; i >= 0; i--) {
        const tokens = this._estimateTokens(messages[i].content);
        if (recentTokens + tokens > MAX_BUFFER_TOKENS) {
          cutoff = i + 1;
          break;
        }
        recentTokens += tokens;
      }

      const oldMessages = messages.slice(0, cutoff);
      if (oldMessages.length === 0) return;

      // Build the text of messages that need summarizing
      const existingSummary = session.summary || '';
      const newMessagesText = oldMessages
        .slice(-10) // Only summarize the most recent 10 old messages (incremental)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      if (!newMessagesText.trim()) return;

      const llm = this._getLLM(model);
      const prompt = existingSummary
        ? `You are a conversation summarizer. Here is the existing summary of an ongoing conversation:\n\n${existingSummary}\n\nHere are new messages to incorporate:\n\n${newMessagesText}\n\nWrite an updated summary that captures all important facts, decisions, and context. Be concise (max 200 words). Focus on what would be needed to continue the conversation coherently.`
        : `You are a conversation summarizer. Summarize this conversation concisely (max 200 words). Focus on key facts, decisions, and context needed to continue coherently:\n\n${newMessagesText}`;

      const response = await llm.invoke(prompt);
      const newSummary = response.content.trim();

      await database.run(
        'UPDATE sessions SET summary = ? WHERE id = ?',
        [newSummary, sessionId]
      );

      console.log(`📝 Summary updated for session ${sessionId.slice(0, 8)} (${this._estimateTokens(newSummary)} tokens)`);
    } catch (error) {
      console.error('Summary update error:', error);
      // Non-critical — don't throw
    }
  }

  /**
   * Build the messages array to send to Ollama, incorporating summary context.
   * Returns [{ role, content }] with summary prepended as a system-level context.
   */
  buildMessagesForLLM(summary, recentMessages) {
    const result = [];

    if (summary) {
      result.push({
        role: 'system',
        content: `CONVERSATION HISTORY SUMMARY:\n${summary}`
      });
    }

    result.push(...recentMessages.map(m => ({
      role: m.role,
      content: m.content
    })));

    return result;
  }
}

export default new ConversationMemoryService();
