import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Configuration
import { CONFIG, validateConfig } from './config/index.js';

// Services
import ollamaService from './services/ollama.js';
import database from './services/database.js';
import embeddingService from './services/embeddingService.js';
import extractionAgent from './services/extractionAgent.js';
import memoryManager from './services/memoryManager.js';
import conversationMemory from './services/conversationMemory.js';
import entityMemory from './services/entityMemory.js';
import { initializeCharacters } from './controllers/characterController.js';

// Routes
import sessionsRouter from './routes/sessions.js';
import memoryRouter from './routes/memory.js';
import charactersRouter from './routes/characters.js';
import templatesRouter from './routes/templates.js';

// Middleware
import {
  securityHeaders,
  corsConfig,
  requestSizeMonitor,
  securityLogger,
  sanitizeInputs,
  csrfProtect,
  generateCsrfToken
} from './middleware/security.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { validate, chatSchema, modelPullSchema } from './middleware/validation.js';

const app = express();
const PORT = CONFIG.PORT;

// Validate configuration on startup
validateConfig();

// ===== SECURITY MIDDLEWARE =====

// Security headers (Helmet)
app.use(securityHeaders);

// CORS with strict configuration
app.use(cors(corsConfig));

// Cookie parser (for session management)
app.use(cookieParser());

// Session management
app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: CONFIG.isProduction, // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  },
  name: 'oread.sid' // Custom session name
}));

// Request size validation and monitoring
app.use(requestSizeMonitor);

// Body parser with size limit
app.use(express.json({ limit: CONFIG.MAX_UPLOAD_SIZE }));
app.use(express.urlencoded({ extended: true, limit: CONFIG.MAX_UPLOAD_SIZE }));

// Input sanitization
app.use(sanitizeInputs);

// Security logging
app.use(securityLogger);

// CSRF protection for state-changing requests
app.use(csrfProtect);

// ===== SERVICES INITIALIZATION =====

async function initializeServices() {
  try {
    console.log('🔌 Initializing services...');

    // Initialize database
    await database.initialize();

    // Initialize character system
    initializeCharacters();

    console.log('✅ All services initialized');
    console.log(`🔒 Security: Auth=${CONFIG.ENABLE_AUTH ? 'ENABLED' : 'DISABLED (dev mode)'}`);
    return true;
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

// ===== API ROUTES =====

// CSRF token endpoint — frontend calls this once on load, then sends token as X-CSRF-Token header
app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req);
  res.json({ success: true, csrfToken: token });
});

app.use('/api/sessions', sessionsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/templates', templatesRouter);

// ===== HEALTH CHECK =====

app.get('/api/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check Ollama
  try {
    await ollamaService.checkHealth();
    health.services.ollama = 'ok';
  } catch (error) {
    health.services.ollama = 'error';
    health.status = 'degraded';
  }

  // Check database
  try {
    await database.get('SELECT 1');
    health.services.database = 'ok';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
}));

// ===== MODEL MANAGEMENT =====

// List available models
app.get('/api/models', asyncHandler(async (req, res) => {
  const result = await ollamaService.listModels();
  res.json(result);
}));

// Pull/download a model with SSE for progress updates
app.post('/api/models/pull', validate(modelPullSchema), asyncHandler(async (req, res) => {
  const { modelName } = req.body;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await ollamaService.pullModel(modelName);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ status: 'success', completed: true })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ status: 'error', error: CONFIG.isDevelopment ? error.message : 'Download failed' })}\n\n`);
    res.end();
  }
}));

// ===== CHAT ENDPOINT =====

// Chat endpoint with streaming response and unified memory system
app.post('/api/chat', validate(chatSchema), asyncHandler(async (req, res) => {
  const { model, messages, systemPrompt, temperature, topP, frequencyPenalty, maxTokens, sessionId, settings } = req.body;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let messagesToSend = messages;
  let augmentedSystemPrompt = systemPrompt || '';
  let memoryUsed = false;

  try {
    const memoryEnabled = settings?.general?.memory;
    const userMessage = messages[messages.length - 1]?.content || '';

    // ── Unified Memory System ──────────────────────────────────
    if (sessionId && memoryEnabled) {
      try {
        // 1. Initialize session memory (indexes lorebook + loads entities)
        const characters = resolveCharacters(settings);
        await memoryManager.initializeSession(sessionId, characters);

        // 2. Retrieve relevant context from unified FAISS index (token-budgeted)
        const { chunks, totalTokens } = await memoryManager.retrieve(sessionId, userMessage, 1300);

        if (chunks.length > 0) {
          const contextBlock = memoryManager.formatRetrievedContext(chunks);
          augmentedSystemPrompt += `\n\n${contextBlock}`;
          memoryUsed = true;

          const typeCounts = {};
          for (const c of chunks) {
            typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
          }
          console.log(`🧠 Memory: ${chunks.length} chunks (${totalTokens} tokens) — ${JSON.stringify(typeCounts)}`);
        }

        // 3. Use conversation summary buffer instead of crude message windowing
        const { summary, recentMessages } = await conversationMemory.getConversationContext(sessionId);
        messagesToSend = conversationMemory.buildMessagesForLLM(summary, recentMessages);

        if (summary) {
          console.log(`📝 Using conversation summary (${recentMessages.length} recent messages)`);
        }
      } catch (memError) {
        console.error('Memory system error (falling back to full messages):', memError);
        // Fall back to raw messages on memory failure
      }
    }

    // Build options object
    const options = {
      systemPrompt: augmentedSystemPrompt || undefined,
      temperature: temperature !== undefined ? temperature : undefined,
      topP: topP !== undefined ? topP : undefined,
      frequencyPenalty: frequencyPenalty !== undefined ? frequencyPenalty : undefined,
      maxTokens: maxTokens !== undefined ? maxTokens : undefined
    };

    // Log received parameters (sanitized)
    if (CONFIG.isDevelopment) {
      console.log('💬 Chat Request:');
      console.log('Model:', model);
      console.log('Messages:', messagesToSend.length, memoryUsed ? '(Memory)' : '(Full)');
      console.log('Temperature:', temperature, 'Top P:', topP);
    }

    // Save user message before streaming so it's persisted regardless of what follows
    let userMsgId = null;
    if (sessionId) {
      const userMsg = messages[messages.length - 1];
      userMsgId = await saveMessageToSession(sessionId, userMsg);
    }

    const stream = await ollamaService.chat(model, messagesToSend, options);

    let assistantResponse = '';

    for await (const chunk of stream) {
      if (chunk.message?.content) {
        assistantResponse += chunk.message.content;
      }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Save assistant message before ending the response so the DB is consistent
    // before the client considers the turn complete
    let assistantMsgId = null;
    if (sessionId) {
      const assistantMsg = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      };
      assistantMsgId = await saveMessageToSession(sessionId, assistantMsg);
      console.log('✅ Messages saved to session');
    }

    res.end();

    // ── Background Tasks (serialized to avoid hogging Ollama) ──
    // Ollama processes requests sequentially on the GPU. Running embed +
    // multiple LLM calls in parallel queues them all up and blocks the
    // next chat request. Instead, run them in sequence: fast embed first,
    // then one LLM task at a time.
    if (sessionId && memoryEnabled) {
      const userMsg = messages[messages.length - 1];
      const assistantMsg = { role: 'assistant', content: assistantResponse };

      (async () => {
        try {
          // 1. Embed (fast, uses embed model — doesn't block chat model)
          await memoryManager.addMessages(sessionId, [
            { ...userMsg, id: userMsgId },
            { ...assistantMsg, id: assistantMsgId }
          ]);
        } catch (err) { console.error('Memory indexing error:', err); }

        try {
          // 2. Summary update (uses chat model — run alone)
          await conversationMemory.updateSummary(sessionId, model);
        } catch (err) { console.error('Summary update error:', err); }

        try {
          // 3. Entity extraction (uses chat model — run alone)
          await entityMemory.extractAndStore(sessionId, userMessage, assistantResponse, model);
        } catch (err) { console.error('Entity extraction error:', err); }

        // 4. Roleplay extraction (uses chat model — run last, least urgent)
        if (settings?.mode === 'roleplay') {
          try {
            const shouldAnalyze = await extractionAgent.shouldRunAnalysis(sessionId);
            if (shouldAnalyze) {
              console.log('🔍 Running extraction analysis...');
              const result = await extractionAgent.analyzeConversation(sessionId, settings);
              if (result.proposed_updates.length > 0) {
                console.log(`💡 Found ${result.proposed_updates.length} suggested updates`);
                await saveExtractionResults(sessionId, result.proposed_updates);
              }
            }
          } catch (err) { console.error('Extraction error:', err); }
        }
      })();
    }
  } catch (error) {
    const errorMsg = CONFIG.isDevelopment ? error.message : 'Chat request failed';
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
}));

/**
 * Resolve character data from settings for memory initialization.
 */
function resolveCharacters(settings) {
  if (!settings?.roleplay) return [];

  const { characterMode, character, characters, _loadedCharacters } = settings.roleplay;

  // Prefer _loadedCharacters (already resolved by the client)
  if (_loadedCharacters && _loadedCharacters.length > 0) {
    return _loadedCharacters;
  }

  if (characterMode === 'multi' && characters && characters.length > 0) {
    return characters;
  }

  if (character) {
    return [character];
  }

  return [];
}

// ===== HELPER FUNCTIONS =====

async function saveMessageToSession(sessionId, message) {
  const { v4: uuidv4 } = await import('uuid');
  const messageId = uuidv4();
  const timestamp = message.timestamp || new Date().toISOString();

  await database.transaction(async () => {
    await database.run(
      `INSERT INTO messages (id, session_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, sessionId, message.role, message.content, timestamp]
    );

    await database.run(
      `UPDATE sessions
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId]
    );
  });

  return messageId;
}

async function saveExtractionResults(sessionId, proposedUpdates) {
  try {
    await database.run(
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

// ===== ERROR HANDLING =====

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===== GRACEFUL SHUTDOWN =====

let server;

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');

      try {
        await database.close();
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===== SERVER STARTUP =====

async function startServer() {
  try {
    await initializeServices();

    server = app.listen(PORT, () => {
      console.log(`🚀 Oread Chat Backend running on http://localhost:${PORT}`);
      console.log(`🔒 Environment: ${CONFIG.NODE_ENV}`);
      console.log(`🔐 Security Features:`);
      console.log(`   - Rate Limiting: ENABLED`);
      console.log(`   - CORS: ${CONFIG.ALLOWED_ORIGINS.join(', ')}`);
      console.log(`   - Security Headers: ENABLED (Helmet)`);
      console.log(`   - Input Validation: ENABLED`);
      console.log(`   - Path Traversal Protection: ENABLED`);
      console.log(`   - SQL Injection Protection: ENABLED`);
      console.log(`   - File Upload Validation: ENABLED`);
      console.log(`📡 API endpoints:`);
      console.log(`   - GET  /api/health`);
      console.log(`   - GET  /api/models`);
      console.log(`   - POST /api/models/pull`);
      console.log(`   - POST /api/chat`);
   
      console.log(`   - /api/sessions/*`);
      console.log(`   - /api/memory/*`);
      console.log(`   - /api/characters/*`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
