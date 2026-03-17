/**
 * Ollama-based conversation summarizer.
 * Runs in background after assistant response — user never waits.
 */

import ollamaService from './ollama.js';

const SUMMARIZE_PROMPT = `You are a conversation summarizer. Condense the following conversation into a concise summary that preserves:
- Key facts and decisions made
- Emotional beats and relationship developments
- Unresolved questions or threads
- Names, places, and specific details mentioned

If a previous summary is provided, incorporate its content and update it with new information. Remove outdated details that have been superseded.

Output ONLY the summary paragraph, no preamble or labels. Maximum 500 words.`;

/**
 * Summarize a batch of messages using Ollama.
 *
 * @param {string} model - The Ollama model to use
 * @param {Array<{role: string, content: string}>} messages - Messages to summarize
 * @param {string} existingSummary - Previous rolling summary (if any)
 * @returns {Promise<string>} The new summary text
 */
export async function summarizeMessages(model, messages, existingSummary = '') {
  const dialogue = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  let userPrompt = '';
  if (existingSummary) {
    userPrompt = `Previous summary:\n${existingSummary}\n\nNew conversation to incorporate:\n${dialogue}`;
  } else {
    userPrompt = `Conversation to summarize:\n${dialogue}`;
  }

  const stream = await ollamaService.chat(model, [
    { role: 'user', content: userPrompt }
  ], {
    systemPrompt: SUMMARIZE_PROMPT,
    temperature: 0.3,
    maxTokens: 600
  });

  let result = '';
  for await (const chunk of stream) {
    if (chunk.message?.content) {
      result += chunk.message.content;
    }
  }

  return result.trim();
}

/**
 * Determine if summarization should trigger.
 *
 * @param {number} messageCount - Total messages in session
 * @param {number} lastSummarizedAt - Message count when last summary was created
 * @returns {boolean}
 */
export function shouldSummarize(messageCount, lastSummarizedAt) {
  if (messageCount >= 20 && lastSummarizedAt === 0) return true;
  if (lastSummarizedAt > 0 && messageCount - lastSummarizedAt >= 15) return true;
  return false;
}
