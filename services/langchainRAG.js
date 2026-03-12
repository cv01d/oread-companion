import { ChatOllama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import mcpClient from './mcpClient.js';

class LangChainRAGService {
  constructor() {
    // Initialize Ollama LLM
    this.llm = new ChatOllama({
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      temperature: 0.7
    });

    // Initialize embeddings model
    this.embeddings = new OllamaEmbeddings({
      baseUrl: 'http://localhost:11434',
      model: 'nomic-embed-text'
    });
  }

  /**
   * Query with RAG - combines recent messages with semantic search
   */
  async queryWithRAG(sessionId, userMessage, settings, model = 'llama2') {
    try {
      // 1. Get recent messages (last 20)
      const recentMessages = await mcpClient.querySQLite(
        `SELECT * FROM messages
         WHERE session_id = ?
         ORDER BY timestamp DESC
         LIMIT 20`,
        [sessionId]
      );

      // Reverse to get chronological order
      recentMessages.reverse();

      // 2. Create embedding for user query
      const queryVector = await this.embeddings.embedQuery(userMessage);

      // 3. Semantic search for relevant context
      let vectorResults = [];
      try {
        const searchResult = await mcpClient.searchVectors(sessionId, queryVector, 5);
        if (searchResult.success) {
          vectorResults = searchResult.results || [];
        }
      } catch (error) {
        console.warn('Vector search failed (index may not exist yet):', error.message);
      }

      // 4. Build hybrid context
      const context = this.buildContext(recentMessages, vectorResults, settings);

      // 5. Update LLM model if different
      if (this.llm.model !== model) {
        this.llm = new ChatOllama({
          baseUrl: 'http://localhost:11434',
          model,
          temperature: settings.general?.temperature || 0.7
        });
      }

      return {
        context,
        recentMessageCount: recentMessages.length,
        vectorResultCount: vectorResults.length
      };
    } catch (error) {
      console.error('RAG query error:', error);
      throw error;
    }
  }

  /**
   * Build hybrid context from recent messages and vector search results
   */
  buildContext(recentMessages, vectorResults, settings) {
    const contextParts = [];

    // Add vector search results as context (if any)
    if (vectorResults.length > 0) {
      contextParts.push('--- Relevant Past Context ---');
      vectorResults.forEach((result, idx) => {
        contextParts.push(`[${idx + 1}] ${result.text}`);
      });
      contextParts.push('');
    }

    // Add recent messages
    contextParts.push('--- Recent Conversation ---');
    recentMessages.forEach(msg => {
      contextParts.push(`${msg.role}: ${msg.content}`);
    });

    return contextParts.join('\n');
  }

  /**
   * Add documents to vector store (background embeddings)
   */
  async addDocuments(sessionId, messages) {
    try {
      // Filter out system messages and very short messages
      const documentsToEmbed = messages.filter(msg =>
        msg.role !== 'system' && msg.content.length > 20
      );

      if (documentsToEmbed.length === 0) {
        return { success: true, embedded: 0 };
      }

      // Create embeddings for messages
      const texts = documentsToEmbed.map(msg => msg.content);
      const vectors = await this.embeddings.embedDocuments(texts);

      // Prepare documents with metadata
      const documents = documentsToEmbed.map((msg, idx) => ({
        id: msg.id || `msg_${Date.now()}_${idx}`,
        text: msg.content,
        metadata: {
          messageId: msg.id,
          role: msg.role,
          timestamp: msg.timestamp || new Date().toISOString()
        }
      }));

      // Add to vector store via MCP
      await mcpClient.addVectors(sessionId, documents, vectors);

      // Mark messages as embedded in database
      for (const msg of documentsToEmbed) {
        if (msg.id) {
          await mcpClient.executeSQLite(
            'UPDATE messages SET embedded = 1 WHERE id = ?',
            [msg.id]
          );
        }
      }

      return {
        success: true,
        embedded: documentsToEmbed.length
      };
    } catch (error) {
      console.error('Add documents error:', error);
      throw error;
    }
  }

  /**
   * Get index statistics for a session
   */
  async getIndexStats(sessionId) {
    try {
      return await mcpClient.getIndexStats(sessionId);
    } catch (error) {
      console.error('Get index stats error:', error);
      return {
        success: false,
        error: error.message,
        session_id: sessionId,
        document_count: 0
      };
    }
  }

  /**
   * Estimate tokens (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if RAG should be used for this session
   */
  async shouldUseRAG(sessionId, settings) {
    if (!settings.general?.memory) {
      return false;
    }

    // Check message count
    const countResult = await mcpClient.querySQLite(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
      [sessionId]
    );

    const messageCount = countResult[0]?.count || 0;
    return messageCount > 50;
  }

  /**
   * Build message array for chat (without RAG)
   */
  async getRecentMessages(sessionId, limit = 20) {
    const messages = await mcpClient.querySQLite(
      `SELECT * FROM messages
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [sessionId, limit]
    );

    // Reverse to get chronological order
    return messages.reverse();
  }
}

export default new LangChainRAGService();
