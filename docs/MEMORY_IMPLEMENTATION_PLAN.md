Claude’s Plan
Memory System Implementation Plan (LangChain + MCP Architecture)
Overview
This plan implements a comprehensive memory system using LangChain orchestration and MCP (Model Context Protocol) servers for the Oread Chat application:

Chat History Persistence - SQLite MCP server for session and message storage
Frontend History Loading - Paginated infinite-scroll message retrieval
Auto-Update Settings - LangChain agents with MCP tools for character extraction
RAG Vector Memory - LangChain RAG chains with vector store MCP server
MCP Tool Ecosystem - Extensible tool system (web search, settings, custom tools)
Current State Analysis
What Exists
✅ Settings persistence (6 JSON files + localStorage)
✅ Real-time chat with SSE streaming
✅ Dynamic system prompt generation from settings
✅ Ollama integration (v0.6.3) with chat, model download
✅ Zustand state management for UI
Critical Gaps
❌ No message persistence - All conversation history lost on refresh
❌ No context window management - Full history sent every time (will crash at ~2K tokens)
❌ No embeddings/RAG - Can't handle long conversations intelligently
❌ No session management - Can't switch between different roleplay sessions
❌ No auto-extraction - Character details revealed in chat aren't captured
Architecture Design
Data Flow (LangChain + MCP Architecture)

User sends message
  ↓
LangChain Orchestrator receives message
  ↓
MCP Servers provide data/tools:
  ├─ SQLite MCP: Load/save chat history
  ├─ Vector Store MCP: Semantic search
  ├─ Settings MCP: Character/world settings
  ├─ Web Search MCP: Real-time info (optional)
  └─ Custom Tools MCP: App-specific functions
  ↓
LangChain RAG Chain:
  1. Retrieve relevant context (vector search)
  2. Get recent messages (SQLite query)
  3. Load character settings (settings MCP)
  4. Build hybrid context
  ↓
Ollama LLM (via LangChain)
  - Streams response token-by-token
  ↓
Save to SQLite MCP + create embeddings (background)
  ↓
LangChain Agent (every 5 messages):
  - Analyze conversation using MCP tools
  - Extract character updates
  - Suggest settings modifications
Storage Architecture (MCP-Based)

/data/
├── chat.db (SQLite)           # Accessed via SQLite MCP Server
│   ├── sessions table         # Session info, character name, settings snapshot
│   ├── messages table         # All messages with role, content, timestamp
│   └── embeddings table       # Embedding metadata (vectors managed by MCP)
│
├── vector-store/              # Managed by Vector Store MCP Server
│   ├── index.faiss            # FAISS index (if using FAISS)
│   └── documents.json         # Document metadata
│
├── settings/                  # Accessed via Filesystem MCP Server
│   ├── mode.json
│   ├── roleplay.json
│   └── ...
│
└── mcp-config.json            # MCP server configurations
MCP Server Configuration

{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "/data/chat.db"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data/settings"]
    },
    "vector-store": {
      "command": "node",
      "args": ["./mcp-servers/vector-store-server.js"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    }
  }
}
Implementation Steps
Phase 1: MCP Server Setup & LangChain Integration
1.1 Install Dependencies
File: package.json (MODIFY)

New Dependencies:


{
  "dependencies": {
    "langchain": "^0.1.0",
    "@langchain/community": "^0.0.40",
    "@langchain/ollama": "^0.0.1",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7",
    "uuid": "^11.0.3",
    "faiss-node": "^0.5.1"
  }
}
MCP Servers (installed globally or via npx):


# SQLite MCP Server
npm install -g @modelcontextprotocol/server-sqlite

# Filesystem MCP Server
npm install -g @modelcontextprotocol/server-filesystem

# Brave Search MCP Server (optional)
npm install -g @modelcontextprotocol/server-brave-search
1.2 Initialize SQLite Database
File: services/database.js (NEW)

Purpose: Create database schema (still needed, MCP reads from this)

Key Features:

Initialize SQLite database at /data/chat.db
Create 3 tables: sessions, messages, embeddings
Database migrations
Schema versioning
Schema (same as before):


sessions: id, name, character_name, mode, settings_snapshot, created_at, updated_at, message_count
messages: id, session_id, role, content, timestamp, model, embedded, extraction_status
embeddings: id, session_id, message_id, text_hash, embedding_model, created_at
1.3 Create MCP Client Service
File: services/mcpClient.js (NEW)

Purpose: Interface to all MCP servers

Key Methods:


class MCPClientService {
  constructor() {
    this.clients = {
      sqlite: null,
      filesystem: null,
      vectorStore: null,
      braveSearch: null
    };
  }

  async initialize() {
    // Connect to MCP servers via stdio transport
    this.clients.sqlite = await this.connectToServer('sqlite');
    this.clients.filesystem = await this.connectToServer('filesystem');
    this.clients.vectorStore = await this.connectToServer('vector-store');
  }

  async connectToServer(serverName) {
    // Read config from mcp-config.json
    // Create stdio transport
    // Return MCP client
  }

  // SQLite operations via MCP
  async querySQLite(sql, params) {
    return this.clients.sqlite.callTool('query', { sql, params });
  }

  // Filesystem operations via MCP
  async readSettingsFile(filename) {
    return this.clients.filesystem.callTool('read_file', {
      path: `/data/settings/${filename}`
    });
  }

  async writeSettingsFile(filename, content) {
    return this.clients.filesystem.callTool('write_file', {
      path: `/data/settings/${filename}`,
      content
    });
  }

  // Vector store operations via MCP
  async searchVectors(sessionId, queryVector, topK = 5) {
    return this.clients.vectorStore.callTool('semantic_search', {
      session_id: sessionId,
      query_vector: queryVector,
      top_k: topK
    });
  }

  async addVectors(sessionId, documents, vectors) {
    return this.clients.vectorStore.callTool('add_vectors', {
      session_id: sessionId,
      documents,
      vectors
    });
  }
}

export default new MCPClientService();
1.4 Create API Routes (Thin Layer over MCP)
File: routes/sessions.js (NEW)

Endpoints (now using MCP client):

POST /api/sessions - Create new session (via SQLite MCP)
GET /api/sessions - List sessions (via SQLite MCP query)
GET /api/sessions/:id - Get session details (via SQLite MCP)
PUT /api/sessions/:id - Update session (via SQLite MCP)
DELETE /api/sessions/:id - Delete session (via SQLite MCP)
POST /api/sessions/:id/messages - Save message (via SQLite MCP)
GET /api/sessions/:id/messages - Get messages (via SQLite MCP)
1.3 Integrate with Server
File: server.js (MODIFY)

Changes:

Import chatHistory.js and initialize on startup
Mount session routes: app.use('/api/sessions', sessionRoutes)
Add initialization function that creates DB and tables
Dependencies (add to package.json):


{
  "sqlite": "^5.1.1",
  "sqlite3": "^5.1.7",
  "uuid": "^11.0.3"
}
Phase 2: LangChain RAG Implementation
2.1 Create Custom Vector Store MCP Server
File: mcp-servers/vector-store-server.js (NEW)

Purpose: MCP server for vector storage and search

Tools Exposed:


{
  "tools": [
    {
      "name": "add_vectors",
      "description": "Add document vectors to session index",
      "inputSchema": {
        "session_id": "string",
        "documents": "array<{id, text, metadata}>",
        "vectors": "array<array<number>>"
      }
    },
    {
      "name": "semantic_search",
      "description": "Search for similar documents",
      "inputSchema": {
        "session_id": "string",
        "query_vector": "array<number>",
        "top_k": "number"
      }
    },
    {
      "name": "get_index_stats",
      "description": "Get statistics about vector index",
      "inputSchema": {
        "session_id": "string"
      }
    }
  ]
}
Implementation:

Uses FAISS for vector indexing (fast approximate search)
Stores index per session: /data/vector-store/{session-id}.index
Metadata stored in JSON: /data/vector-store/{session-id}.meta.json
2.2 Create LangChain RAG Service
File: services/langchainRAG.js (NEW)

Purpose: LangChain-based RAG orchestration

Key Features:


import { ChatOllama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { RetrievalQAChain } from 'langchain/chains';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
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

  async createRetriever(sessionId) {
    // Load FAISS index for session via MCP
    const indexPath = `/data/vector-store/${sessionId}.index`;

    const vectorStore = await FaissStore.load(indexPath, this.embeddings);

    return vectorStore.asRetriever({
      k: 5,  // Return top 5 results
      searchType: 'similarity'
    });
  }

  async queryWithRAG(sessionId, userMessage, settings) {
    // Get retriever for this session
    const retriever = await this.createRetriever(sessionId);

    // Create RAG chain
    const chain = RetrievalQAChain.fromLLM({
      llm: this.llm,
      retriever,
      returnSourceDocuments: true,
      verbose: true
    });

    // Build system prompt from settings
    const systemPrompt = buildSystemPrompt(settings);

    // Query with context
    const response = await chain.call({
      query: userMessage,
      systemPrompt
    });

    return {
      answer: response.text,
      sourceDocuments: response.sourceDocuments,
      metadata: {
        retrievedDocs: response.sourceDocuments.length
      }
    };
  }

  async addDocuments(sessionId, messages) {
    // Create embeddings for new messages
    const documents = messages.map(msg => ({
      pageContent: msg.content,
      metadata: {
        messageId: msg.id,
        role: msg.role,
        timestamp: msg.timestamp
      }
    }));

    // Generate embeddings
    const vectors = await this.embeddings.embedDocuments(
      documents.map(d => d.pageContent)
    );

    // Store via MCP vector store server
    await mcpClient.addVectors(sessionId, documents, vectors);
  }
}

export default new LangChainRAGService();
2.2 Extend Ollama Service
File: services/ollama.js (MODIFY)

Add Method:


async embed(text) {
  return await this.ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: text
  });
}
2.3 Create Memory API Routes
File: routes/memory.js (NEW)

Endpoints:

POST /api/memory/embed - Create embeddings (background job)
POST /api/memory/search - Semantic search across session
GET /api/memory/status/:sessionId - Check embedding progress
2.3 Update Chat Endpoint with LangChain RAG
File: server.js (MODIFY /api/chat endpoint)

New Flow:


import langchainRAG from './services/langchainRAG.js';
import mcpClient from './services/mcpClient.js';

app.post('/api/chat', async (req, res) => {
  const { model, messages, sessionId, settings } = req.body;

  // Check if session has >50 messages
  const messageCount = await mcpClient.querySQLite(
    'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
    [sessionId]
  );

  let response;

  if (messageCount.count > 50 && settings.general.memory) {
    // Use LangChain RAG
    console.log('Using LangChain RAG for context retrieval');

    response = await langchainRAG.queryWithRAG(
      sessionId,
      messages[messages.length - 1].content,
      settings
    );

    // Stream response (convert LangChain response to SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({
      message: { role: 'assistant', content: response.answer }
    })}\n\n`);
    res.end();

  } else {
    // Use traditional full-history approach
    // (existing code)
  }

  // Background: Add new messages to vector store
  setTimeout(async () => {
    await langchainRAG.addDocuments(sessionId, [
      messages[messages.length - 1],  // User message
      { role: 'assistant', content: response.answer }  // Assistant message
    ]);
  }, 0);
});
Phase 3: LangChain Agents for Auto-Extraction
3.1 Create MCP Tools for Settings
File: mcp-servers/settings-tools-server.js (NEW)

Purpose: MCP server exposing settings operations as tools

Tools Exposed:


{
  "tools": [
    {
      "name": "get_character_settings",
      "description": "Get current character settings",
      "inputSchema": {}
    },
    {
      "name": "update_character_personality",
      "description": "Update character personality traits",
      "inputSchema": {
        "additions": "string",
        "confidence": "number"
      }
    },
    {
      "name": "update_character_backstory",
      "description": "Update character backstory",
      "inputSchema": {
        "additions": "string",
        "confidence": "number"
      }
    },
    {
      "name": "update_world_lore",
      "description": "Update world lore",
      "inputSchema": {
        "additions": "string",
        "confidence": "number"
      }
    },
    {
      "name": "analyze_messages",
      "description": "Analyze recent messages for character details",
      "inputSchema": {
        "messages": "array<{role, content}>",
        "focus": "string"
      }
    }
  ]
}
3.2 Create LangChain Agent for Extraction
File: services/extractionAgent.js (NEW)

Purpose: LangChain agent that uses MCP tools to extract and update settings

Key Features:


import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { ChatOllama } from '@langchain/ollama';
import { MCPTool } from '@langchain/community/tools/mcp';
import mcpClient from './mcpClient.js';

class ExtractionAgentService {
  constructor() {
    this.llm = new ChatOllama({
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      temperature: 0.3  // Low temp for consistent extraction
    });
  }

  async analyzeConversation(sessionId, messages, settings) {
    // Create MCP tools for agent to use
    const tools = [
      new MCPTool({
        name: 'get_character_settings',
        description: 'Get current character settings from filesystem',
        mcpClient: mcpClient.clients.filesystem,
        toolName: 'get_character_settings'
      }),
      new MCPTool({
        name: 'analyze_messages',
        description: 'Analyze messages for new character traits',
        mcpClient: mcpClient.clients.settingsTools,
        toolName: 'analyze_messages'
      }),
      new MCPTool({
        name: 'update_character_personality',
        description: 'Propose personality trait additions',
        mcpClient: mcpClient.clients.settingsTools,
        toolName: 'update_character_personality'
      })
    ];

    // Initialize agent
    const agent = await initializeAgentExecutorWithOptions(tools, this.llm, {
      agentType: 'zero-shot-react-description',
      verbose: true,
      maxIterations: 5
    });

    // Agent prompt
    const prompt = `
    Analyze the last ${messages.length} messages from a roleplay conversation.

    Current character name: ${settings.roleplay.singleCharacter.identity.name}
    Current personality: ${settings.roleplay.singleCharacter.core.personality}

    Task:
    1. Use the analyze_messages tool to identify any NEW personality traits, backstory details, or knowledge revealed
    2. Only extract information that is NOT already in the current settings
    3. For each finding, assess confidence (0-1)
    4. Use update_character_personality to propose additions with confidence scores

    Messages to analyze:
    ${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

    Return a JSON summary of proposed updates with confidence scores.
    `;

    const result = await agent.call({ input: prompt });

    return {
      success: true,
      proposed_updates: this.parseAgentOutput(result.output),
      agent_reasoning: result.intermediateSteps
    };
  }

  parseAgentOutput(output) {
    // Parse agent's JSON output
    // Return structured updates
  }
}

export default new ExtractionAgentService();
3.2 Create Extraction API Routes
File: routes/sessions.js (ADD to existing file)

Endpoints:

POST /api/sessions/:id/analyze - Analyze recent messages
POST /api/sessions/:id/apply-updates - Apply extracted updates to settings
3.3 Trigger Auto-Extraction
File: server.js (MODIFY at chat endpoint)

Logic:

After saving assistant message, check message count
If message_count % 5 === 0 (every 5 messages)
Trigger extraction in background (don't await)
Store results in messages.extracted_data field
Phase 4: Frontend Integration
4.1 Extend Zustand Store
File: client/src/store/useStore.js (MODIFY)

New State:


// Session management
currentSessionId: null,
currentSession: null,
chatSessions: [],
sessionsLoading: false,

// Message history (paginated)
messageHistory: [],
historyLoading: false,
historyHasMore: true,
historyOffset: 0,

// RAG context
vectorContext: [],
contextLoading: false,

// Auto-extraction
extractedSuggestions: null,
extractionLoading: false,
New Actions:


// Session management
createSession(name, settings)
loadSessions()
selectSession(sessionId)
deleteSession(sessionId)

// History loading
loadMessageHistory(sessionId, loadMore = false)

// Message persistence
saveMessage(sessionId, message)

// RAG
loadVectorContext(sessionId, query)

// Auto-extraction
analyzeForUpdates(sessionId)
applyExtractedUpdates(sessionId, updates)
Modify Existing:

sendMessage() - Add session persistence logic after sending
initialize() - Load sessions on app startup
4.2 Create Session Manager UI
File: client/src/components/session/SessionManager.jsx (NEW)

Features:

Session list with character avatars
Create new session button
Session search/filter
Archive/restore sessions
Delete confirmation modal
Location: Left sidebar panel (below character avatar)

4.3 Create Message History Viewer
File: client/src/components/chat/MessageHistoryViewer.jsx (NEW)

Features:

Load last 50 messages by default on session select
Infinite scroll: loads 50 more when scrolling up
Visual separator between history and current session
"Jump to present" button if scrolled up
Loading spinner when fetching more history
Behavior:


User selects session
  ↓
Load last 50 messages from DB
  ↓
Render in MessageList (scrolled to bottom)
  ↓
User scrolls up to top
  ↓
Trigger: loadMessageHistory(sessionId, loadMore=true)
  ↓
Append next 50 older messages above
  ↓
Repeat until no more messages
Integration: Replace MessageList with this component in ChatInterface

4.4 Create Auto-Update Suggestions UI
File: client/src/components/chat/AutoUpdateSuggestions.jsx (NEW)

Features:

Toast notification when updates available
Modal with diff view (before/after)
Accept/reject individual suggestions
Preview changes before applying
Trigger: Show when extractedSuggestions is not null in store

4.5 Create Session API Client
File: client/src/utils/sessionAPI.js (NEW)

Functions:


createSession(name, settings)
loadSessions(options)
getSession(sessionId)
updateSession(sessionId, updates)
deleteSession(sessionId)
saveMessage(sessionId, message)
getMessages(sessionId, options)
analyzeSession(sessionId, messages, settings)
applyUpdates(sessionId, updates)
searchMemory(sessionId, query)
Phase 5: Context Window Management
5.1 Add Token Counting
File: utils/tokenCounter.js (NEW)

Use: js-tiktoken library for GPT-based token estimation

Function:


estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
5.2 Smart Context Builder
File: services/memoryService.js (MODIFY getContext())

Algorithm:


1. Get last 20 messages (recent context)
2. Estimate tokens
3. If under 70% of max_tokens:
   - Get top 5 RAG results
   - Add until reaching max_tokens
4. Return hybrid context
5.3 Update Chat Endpoint
File: server.js (MODIFY /api/chat)

Changes:

Check if session ID provided in request
If yes and message_count > 50:
Use getContext() instead of full history
Send only recent + RAG messages to Ollama
Otherwise: use full history (backward compatible)
Database Schema Reference

-- Sessions Table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  character_name TEXT,
  character_mode TEXT,
  mode TEXT NOT NULL,
  settings_snapshot TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  last_message_at DATETIME,
  archived BOOLEAN DEFAULT 0,
  metadata TEXT
);

-- Messages Table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  model TEXT,
  system_prompt_hash TEXT,
  token_count INTEGER,
  embedded BOOLEAN DEFAULT 0,
  embedding_id TEXT,
  extracted_data TEXT,
  extraction_status TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Embeddings Table
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  text_hash TEXT NOT NULL,
  text_preview TEXT,
  model TEXT NOT NULL,
  vector_file TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_messages_session ON messages(session_id, timestamp DESC);
CREATE INDEX idx_embeddings_session ON embeddings(session_id);
CREATE INDEX idx_embeddings_hash ON embeddings(text_hash);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
Critical Files to Modify/Create
Backend - Core Services (9 files)
✨ NEW services/database.js - Initialize SQLite schema
✨ NEW services/mcpClient.js - MCP client for all servers
✨ NEW services/langchainRAG.js - LangChain RAG orchestration
✨ NEW services/extractionAgent.js - LangChain agent for auto-extraction
✨ NEW routes/sessions.js - Session API (uses MCP)
✨ NEW routes/memory.js - Memory API (uses LangChain)
🔧 MODIFY server.js - Initialize MCP, mount routes, update chat endpoint
🔧 MODIFY package.json - Add LangChain + MCP dependencies
Backend - MCP Servers (3 custom servers)
✨ NEW mcp-servers/vector-store-server.js - Custom vector store MCP server
✨ NEW mcp-servers/settings-tools-server.js - Settings tools MCP server
✨ NEW mcp-config.json - MCP server configurations
Frontend (6 files)
🔧 MODIFY client/src/store/useStore.js - Add session/history/RAG state and actions
✨ NEW client/src/components/session/SessionManager.jsx - Session list UI
✨ NEW client/src/components/chat/MessageHistoryViewer.jsx - Infinite scroll history
✨ NEW client/src/components/chat/AutoUpdateSuggestions.jsx - Extraction suggestions UI
✨ NEW client/src/utils/sessionAPI.js - Session API client
🔧 MODIFY client/src/pages/ChatPage.jsx - Integrate session manager
Data Files
✨ NEW /data/chat.db - SQLite database (auto-created)
✨ NEW /data/embeddings/ - Vector storage directory (auto-created)
Session Identification Strategy
Primary Trigger: Mode Switching

When to create new session:

User switches from roleplay → utility or utility → roleplay
User explicitly creates new session (button in UI)
First message sent (if no session exists)

// In useStore.js sendMessage() action:
function checkAndCreateSession(settings) {
  const currentMode = get().currentSession?.mode;
  const newMode = settings.mode;

  // Mode changed - create new session
  if (currentMode && currentMode !== newMode) {
    const name = newMode === 'roleplay'
      ? `Roleplay with ${settings.roleplay.singleCharacter.identity.name}`
      : `Utility Session - ${new Date().toLocaleDateString()}`;

    get().createSession(name, settings);
  }

  // No session exists - create one
  if (!get().currentSessionId) {
    get().createSession(
      newMode === 'roleplay'
        ? `Chat with ${settings.roleplay.singleCharacter.identity.name}`
        : 'Utility Session',
      settings
    );
  }
}
Session Naming:

Roleplay mode: "Roleplay with {Character Name} - {Date}"
Utility mode: "Utility Session - {Date}"
User can rename anytime via session manager
RAG Implementation Details
When to Use RAG
Threshold: 50 messages


IF session has > 50 messages AND settings.general.memory === true:
  Use RAG (recent + semantic search)
ELSE:
  Use full history
Why 50 messages:

~50 messages = ~2000-3000 tokens (typical conversation)
Below this, full history fits comfortably in context window
Above this, risk of exceeding model limits
Context Builder Algorithm

def build_context(session_id, current_message, max_tokens=4000):
  # 1. Get recent messages (last 20)
  recent = get_recent_messages(session_id, limit=20)

  # 2. Estimate tokens
  recent_tokens = sum(estimate_tokens(msg.content) for msg in recent)

  # 3. Reserve 30% for RAG
  rag_budget = max_tokens * 0.3
  recent_budget = max_tokens * 0.7

  # 4. Trim recent if over budget
  if recent_tokens > recent_budget:
    recent = trim_to_budget(recent, recent_budget)

  # 5. Get RAG results
  rag_results = semantic_search(session_id, current_message, limit=5)

  # 6. Add RAG until budget exhausted
  rag_messages = []
  rag_tokens = 0
  for result in rag_results:
    tokens = estimate_tokens(result.text)
    if rag_tokens + tokens > rag_budget:
      break
    rag_messages.append(result)
    rag_tokens += tokens

  return {
    recent_messages: recent,
    vector_results: rag_messages,
    total_tokens: recent_tokens + rag_tokens
  }
Embedding Model
Recommended: nomic-embed-text (Ollama)

Why:

Free, runs locally via Ollama
768 dimensions (good balance)
Fast inference (~50ms/message)
Optimized for semantic search
Download:


ollama pull nomic-embed-text
Auto-Extraction Implementation
Trigger Conditions

// In server.js, after saving assistant message:
if (settings.general.memory && settings.mode === 'roleplay') {
  const messageCount = await chatHistory.getMessageCount(sessionId);

  if (messageCount % 5 === 0) {
    // Background job - don't await
    settingsExtractor.extractUpdates(sessionId, messages, settings)
      .then(updates => {
        // Save to messages.extracted_data
        // Frontend polls or uses WebSocket for notification
      })
      .catch(err => console.error('Extraction failed:', err));
  }
}
Extraction Confidence
User Preference: Always Require Confirmation

Thresholds:

High (>0.8): Show in suggestion modal with "High confidence" badge
Medium (0.5-0.8): Show in suggestion modal with "Medium confidence" badge
Low (<0.5): Log but don't show to user
All suggestions require explicit user approval - no auto-apply

Update Merging
Strategy: Always append, never replace


// Example: Adding new personality trait
current = "Curious, diplomatic, thoughtful"
extracted = "loves classical music"

new_value = current + "; " + extracted
// Result: "Curious, diplomatic, thoughtful; loves classical music"
Migration & Backward Compatibility
Existing Behavior Preserved
If settings.general.memory === false: Skip all persistence
If no session active: Use in-memory messages only
Existing chat flow unchanged if memory disabled
First-Time Setup

// On first startup:
1. Create /data/chat.db
2. Create /data/embeddings/ directory
3. Show user onboarding:
   "Enable Memory System? (Stores chat history for later retrieval)"
   [Yes] [No, keep conversations private]
Data Import
Import localStorage messages (if any exist):


async function importLegacyMessages() {
  const oldMessages = JSON.parse(localStorage.getItem('chat-messages') || '[]');

  if (oldMessages.length > 0) {
    const session = await createSession('Imported from Browser', settings);

    for (const msg of oldMessages) {
      await saveMessage(session.id, msg);
    }

    console.log(`✅ Imported ${oldMessages.length} messages`);
  }
}
Verification Steps
Backend Testing
Database Creation:


npm start
# Check: /data/chat.db exists
# Check logs: "✅ Memory system ready"
Session API:


# Create session
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session", "settings": {...}}'

# List sessions
curl http://localhost:3001/api/sessions
Message Persistence:


# Save message
curl -X POST http://localhost:3001/api/sessions/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Hello"}'

# Retrieve messages
curl http://localhost:3001/api/sessions/{id}/messages
Embeddings:


# Create embeddings
curl -X POST http://localhost:3001/api/memory/embed \
  -H "Content-Type: application/json" \
  -d '{"session_id": "{id}", "messages": [...]}'

# Check: /data/embeddings/{id}_embeddings.json exists
Semantic Search:


curl -X POST http://localhost:3001/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"session_id": "{id}", "query": "What did we discuss?"}'
Frontend Testing
Session Manager:

Create new session (button in sidebar)
See session list with character avatars
Switch between sessions
Delete session (with confirmation)
Message History:

Send 100 messages
Refresh browser
Select session - messages should load
Scroll up - infinite scroll loads more
RAG Context:

Create session with >50 messages
Send new message
Check network: /api/chat request should include session_id
Backend should use RAG context instead of full history
Auto-Extraction:

Start roleplay session
Send 5 user/assistant exchanges
Reveal character detail (e.g., "I love classical music")
After 5th message, check for suggestion toast/modal
Accept suggestion
Verify settings updated in Settings page
End-to-End Testing
Complete Flow:


1. Start app (npm start + npm run dev)
2. Enable memory in Settings > General
3. Create new roleplay session (Fantasy Tavern template)
4. Send 10 messages
5. Refresh browser
6. Select session - history loads
7. Continue conversation (next 10 messages)
8. Check auto-extraction suggestions appear
9. Apply suggestion
10. Verify character backstory updated
11. Send message #51
12. Check backend logs: RAG context builder triggered
13. Verify response quality (should reference old messages)
Performance Targets
Operation	Target	Acceptable
Message save	<10ms	<50ms
Message retrieval (50)	<50ms	<200ms
Embedding creation	<100ms	<500ms
Semantic search (1000)	<200ms	<1000ms
Session list	<100ms	<500ms
Auto-extraction	<2000ms	<5000ms
Dependencies to Add
Backend Dependencies
File: package.json (MODIFY)


{
  "dependencies": {
    // LangChain Core
    "langchain": "^0.1.0",
    "@langchain/community": "^0.0.40",
    "@langchain/ollama": "^0.0.1",

    // MCP Protocol
    "@modelcontextprotocol/sdk": "^0.5.0",

    // Database
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7",

    // Vector Store
    "faiss-node": "^0.5.1",

    // Utilities
    "uuid": "^11.0.3"
  }
}
MCP Servers (Installed Globally or via npx)

# SQLite MCP Server
npm install -g @modelcontextprotocol/server-sqlite

# Filesystem MCP Server
npm install -g @modelcontextprotocol/server-filesystem

# Brave Search MCP Server (optional, for web search)
npm install -g @modelcontextprotocol/server-brave-search
Download Ollama Embedding Model

# Required for RAG
ollama pull nomic-embed-text
Future Enhancements (Out of Scope)
Multi-session search (search across all conversations)
Session branching (fork conversation at any point)
Message editing and regeneration
Export/import sessions (JSON files)
Contradiction detection (alert when new info conflicts with old)
Entity extraction (track character names, locations automatically)
Timeline view (visual timeline of conversation)
Session analytics (character development over time)
Complete System Architecture Diagram

┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Zustand)              │
│                                                                 │
│  SessionManager   MessageHistory   AutoUpdateSuggestions       │
│        │               │                    │                   │
│        └───────────────┴────────────────────┘                   │
│                        │                                        │
│                    sessionAPI.js                                │
└────────────────────────┼───────────────────────────────────────┘
                         │ HTTP/SSE
┌────────────────────────┼───────────────────────────────────────┐
│                        │         Express Backend                │
│  ┌─────────────────────▼────────────────────────────────────┐  │
│  │              API Routes (server.js)                      │  │
│  │  /api/sessions  /api/chat  /api/memory                   │  │
│  └──────┬──────────────┬──────────────────┬─────────────────┘  │
│         │              │                  │                     │
│  ┌──────▼──────┐  ┌────▼──────┐  ┌───────▼──────────┐          │
│  │  Sessions   │  │  LangChain│  │  Extraction      │          │
│  │  Routes     │  │  RAG      │  │  Agent           │          │
│  │  (MCP-based)│  │  Service  │  │  (LangChain)     │          │
│  └──────┬──────┘  └────┬──────┘  └───────┬──────────┘          │
│         │              │                  │                     │
│  ┌──────▼──────────────▼──────────────────▼─────────────────┐  │
│  │                 MCP Client Service                        │  │
│  │  - Connects to all MCP servers                           │  │
│  │  - Routes tool calls                                     │  │
│  │  - Manages connections                                   │  │
│  └──┬────────────┬─────────────┬────────────┬──────────────┘  │
└─────┼────────────┼─────────────┼────────────┼─────────────────┘
      │            │             │            │
      │ stdio      │ stdio       │ stdio      │ stdio
      │            │             │            │
┌─────▼────┐  ┌───▼──────┐  ┌───▼──────┐  ┌─▼───────────────┐
│  SQLite  │  │Filesystem│  │  Vector  │  │  Settings Tools │
│   MCP    │  │   MCP    │  │  Store   │  │      MCP        │
│  Server  │  │  Server  │  │   MCP    │  │     Server      │
└─────┬────┘  └───┬──────┘  └───┬──────┘  └─┬───────────────┘
      │           │             │            │
┌─────▼────┐  ┌───▼──────┐  ┌───▼──────┐  ┌─▼───────────────┐
│ chat.db  │  │/settings/│  │  FAISS   │  │    Settings     │
│          │  │ *.json   │  │  Indexes │  │    Updates      │
│ sessions │  │          │  │          │  │                 │
│ messages │  │ mode.json│  │ vectors  │  │  (in-memory)    │
│embeddings│  │roleplay  │  │ metadata │  │                 │
└──────────┘  └──────────┘  └──────────┘  └─────────────────┘

           ┌────────────────────────────────────┐
           │     LangChain Orchestration        │
           │                                    │
           │  ┌──────────────────────────────┐ │
           │  │  Ollama LLM (localhost:11434)│ │
           │  │  - Chat: llama2              │ │
           │  │  - Embeddings: nomic-embed   │ │
           │  └──────────────────────────────┘ │
           │                                    │
           │  ┌──────────────────────────────┐ │
           │  │  RAG Chain                   │ │
           │  │  1. Retrieve context (MCP)   │ │
           │  │  2. Build prompt             │ │
           │  │  3. Query LLM                │ │
           │  │  4. Stream response          │ │
           │  └──────────────────────────────┘ │
           │                                    │
           │  ┌──────────────────────────────┐ │
           │  │  Agent Executor              │ │
           │  │  - Uses MCP tools            │ │
           │  │  - Multi-step reasoning      │ │
           │  │  - Auto-extraction logic     │ │
           │  └──────────────────────────────┘ │
           └────────────────────────────────────┘
Summary
This plan delivers a production-ready LangChain + MCP memory system that:

✅ LangChain RAG - Automatic context retrieval and response generation
✅ MCP Architecture - Standardized access to SQLite, files, vectors
✅ Agent-Based Extraction - Multi-step reasoning for character updates
✅ Vector Search - FAISS-based semantic search (fast, scalable)
✅ Session Management - Create, switch, archive conversations
✅ Persistent Storage - SQLite for messages, FAISS for vectors
✅ Extensible Tools - Easy to add web search, GitHub, etc. via MCP
✅ Local First - All embeddings via Ollama (no external APIs)

Key Advantages Over Simple Implementation:

🚀 Scalable - FAISS handles 100K+ vectors efficiently
🧠 Intelligent - LangChain agents can reason and use tools
🔌 Extensible - Add MCP servers for new data sources
🏗️ Production-Ready - Industry-standard RAG architecture
🔧 Maintainable - Clear separation of concerns
Estimated Development Time: 20-24 hours

Estimated File Changes:

11 new backend files (8 services + 3 MCP servers)
6 new frontend files
2 modified backend files
2 modified frontend files
Total LOC: ~4000 lines of new code

