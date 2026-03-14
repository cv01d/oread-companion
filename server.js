import express from 'express';
import cors from 'cors';
import ollamaService from './services/ollama.js';
import settingsRouter from './routes/settings.js';
import sessionsRouter from './routes/sessions.js';
import memoryRouter from './routes/memory.js';
import charactersRouter from './routes/characters.js';
import mcpClient from './services/mcpClient.js';
import database from './services/database.js';
import langchainRAG from './services/langchainRAG.js';
import extractionAgent from './services/extractionAgent.js';
import { initializeCharacters } from './controllers/characterController.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Initialize services
async function initializeServices() {
  try {
    console.log('🔌 Initializing services...');

    // Initialize database
    await database.initialize();

    // Initialize MCP clients
    await mcpClient.initialize();

    // Initialize character system (defaults ready, user folder empty)
    initializeCharacters();

    console.log('✅ All services initialized');
    return true;
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

// API routes
app.use('/api/settings', settingsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/characters', charactersRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = await ollamaService.checkHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// List available models
app.get('/api/models', async (req, res) => {
  try {
    const result = await ollamaService.listModels();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pull/download a model with SSE for progress updates
app.post('/api/models/pull', async (req, res) => {
  const { modelName } = req.body;

  if (!modelName) {
    return res.status(400).json({
      success: false,
      error: 'Model name is required'
    });
  }

  try {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await ollamaService.pullModel(modelName);

    for await (const chunk of stream) {
      // Send progress updates to client
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({ status: 'success', completed: true })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Chat endpoint with streaming response and RAG support
app.post('/api/chat', async (req, res) => {
  const { model, messages, systemPrompt, temperature, topP, maxTokens, sessionId, settings } = req.body;

  if (!model || !messages) {
    return res.status(400).json({
      success: false,
      error: 'Model and messages are required'
    });
  }

  try {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let messagesToSend = messages;
    let ragUsed = false;

    // Check if we should use RAG
    if (sessionId && settings) {
      const shouldUseRAG = await langchainRAG.shouldUseRAG(sessionId, settings);

      if (shouldUseRAG) {
        console.log('🧠 Using RAG for context retrieval');

        // Get last user message
        const userMessage = messages[messages.length - 1]?.content || '';

        // Get RAG context
        const ragResult = await langchainRAG.queryWithRAG(sessionId, userMessage, settings, model);

        // Use only recent messages from RAG
        const recentMessages = await langchainRAG.getRecentMessages(sessionId, 20);
        messagesToSend = recentMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        ragUsed = true;
        console.log(`✅ RAG: ${ragResult.recentMessageCount} recent + ${ragResult.vectorResultCount} retrieved`);
      }
    }

    // Build options object
    const options = {
      systemPrompt: systemPrompt || undefined,
      temperature: temperature !== undefined ? temperature : undefined,
      topP: topP !== undefined ? topP : undefined,
      maxTokens: maxTokens !== undefined ? maxTokens : undefined
    };

    // Log received parameters
    console.log('💬 Chat Request Received:');
    console.log('Model:', model);
    console.log('Messages:', messagesToSend.length, 'messages', ragUsed ? '(RAG)' : '(Full)');
    console.log('System Prompt:', systemPrompt ? `${systemPrompt.substring(0, 100)}...` : 'None');
    console.log('Temperature:', temperature, 'Top P:', topP, 'Max Tokens:', maxTokens);

    const stream = await ollamaService.chat(model, messagesToSend, options);

    let assistantResponse = '';

    for await (const chunk of stream) {
      // Accumulate response
      if (chunk.message?.content) {
        assistantResponse += chunk.message.content;
      }

      // Send each token/chunk to client
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();

    // Background tasks after response sent
    if (sessionId) {
      // Save messages to session
      const userMsg = messages[messages.length - 1];
      const assistantMsg = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      };

      // Save messages (don't await)
      Promise.all([
        saveMessageToSession(sessionId, userMsg),
        saveMessageToSession(sessionId, assistantMsg)
      ]).then(async ([userMsgId, assistantMsgId]) => {
        console.log('✅ Messages saved to session');

        // Add to vector store if memory enabled
        if (settings?.general?.memory) {
          // Add IDs to messages for vector storage
          langchainRAG.addDocuments(sessionId, [
            { ...userMsg, id: userMsgId },
            { ...assistantMsg, id: assistantMsgId }
          ])
            .catch(err => console.error('Embedding error:', err));
        }

        // Check if we should run extraction
        if (settings?.mode === 'roleplay' && settings?.general?.memory) {
          const shouldAnalyze = await extractionAgent.shouldRunAnalysis(sessionId);
          if (shouldAnalyze) {
            console.log('🔍 Running extraction analysis...');
            extractionAgent.analyzeConversation(sessionId, settings)
              .then(result => {
                if (result.proposed_updates.length > 0) {
                  console.log(`💡 Found ${result.proposed_updates.length} suggested updates`);
                  // Store in database for frontend to retrieve
                  saveExtractionResults(sessionId, result.proposed_updates)
                    .catch(err => console.error('Save extraction error:', err));
                }
              })
              .catch(err => console.error('Extraction error:', err));
          }
        }
      }).catch(err => console.error('Background task error:', err));
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Helper function to save message to session
async function saveMessageToSession(sessionId, message) {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const messageId = uuidv4();

    await mcpClient.executeSQLite(
      `INSERT INTO messages (id, session_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [
        messageId,
        sessionId,
        message.role,
        message.content,
        message.timestamp || new Date().toISOString()
      ]
    );

    // Update session stats
    await mcpClient.executeSQLite(
      `UPDATE sessions
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId]
    );

    return messageId;
  } catch (error) {
    console.error('Save message error:', error);
    throw error;
  }
}

// Helper function to save extraction results
async function saveExtractionResults(sessionId, proposedUpdates) {
  try {
    // Store in latest message's extracted_data field
    await mcpClient.executeSQLite(
      `UPDATE messages
       SET extracted_data = ?,
           extraction_status = 'pending'
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [JSON.stringify(proposedUpdates), sessionId]
    );
  } catch (error) {
    console.error('Save extraction results error:', error);
    throw error;
  }
}

// Start server after initialization completes
async function startServer() {
  try {
    // Wait for all services to initialize
    await initializeServices();

    // Now start the server
    app.listen(PORT, () => {
      console.log(`🚀 Ollama Chat Backend running on http://localhost:${PORT}`);
      console.log(`📡 API endpoints:`);
      console.log(`   - GET  /api/health`);
      console.log(`   - GET  /api/models`);
      console.log(`   - POST /api/models/pull`);
      console.log(`   - POST /api/chat`);
      console.log(`   - GET  /api/settings`);
      console.log(`   - POST /api/settings`);
      console.log(`   - DELETE /api/settings`);
      console.log(`   - GET  /api/characters`);
      console.log(`   - GET  /api/characters/:id`);
      console.log(`   - POST /api/characters/:id`);
      console.log(`   - DELETE /api/characters/:id`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
