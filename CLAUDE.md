# Claude Developer Documentation

> **Purpose**: This document provides complete context for AI assistants (like Claude) to understand and continue development on this project without prior knowledge.

## Project Overview

**Name**: Oread Chat Interface (formerly Ollama Chat Interface)
**Type**: Full-stack web application
**Purpose**: Local AI chat interface that integrates with Ollama to download and chat with LLM models
**Design**: Dark-themed interface with Montserrat font and teal accent colors

### Core Functionality
1. Download AI models from Ollama library or HuggingFace
2. Select and switch between downloaded models
3. Chat with selected models using streaming responses
4. Real-time progress tracking for model downloads
5. **Comprehensive Settings System** with roleplay and utility modes
6. **Template-based Configuration** with 8 preset templates
7. **Character Management** for roleplay scenarios
8. **Persistent Settings Storage** in individual JSON files
9. **Memory System** with session management and RAG (NEW v3.0.0)
10. **Chat History Persistence** via SQLite and MCP (NEW v3.0.0)
11. **Vector Memory** using FAISS and LangChain (NEW v3.0.0)
12. **Auto-Extraction** of character details from conversations (NEW v3.0.0)

---

## Technology Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **AI Integration**: Ollama (via official `ollama` npm package v0.6.3+)
- **Communication**: REST API + Server-Sent Events (SSE) for streaming
- **Memory System**: LangChain + Model Context Protocol (MCP) (NEW v3.0.0)
- **Database**: SQLite (via MCP server)
- **Vector Store**: FAISS (via custom MCP server)
- **Embeddings**: Ollama nomic-embed-text model

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: JavaScript (JSX)
- **Styling**: SCSS (organized into global.scss + component modules)
- **Design System**: Dark theme with Montserrat font family
- **Typography**: Montserrat (weights: 300, 400, 500, 600, 700)
- **Color Palette**: Teal/cyan accent (#4db8a8), dark backgrounds (#1a1a1a)
- **State Management**: Zustand (centralized store)

### External Dependencies
- **Ollama Service**: Must be running locally on `http://localhost:11434`
- Models are stored and managed by Ollama
- **MCP Servers**: SQLite, Filesystem, Vector Store (auto-started by backend)
- **Embedding Model**: nomic-embed-text (download: `ollama pull nomic-embed-text`)

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (port 5173)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │      React App + Zustand Store                    │  │
│  │  - Components (20+ total, including memory UI)    │  │
│  │  - Session/History/RAG State Management          │  │
│  │  - SSE Client for streaming                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                      │
                      │ HTTP + SSE (Vite Proxy)
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Express Backend (port 3001)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  API Routes (10+ endpoints)                       │  │
│  │  - /api/health, /api/models, /api/chat (SSE+RAG) │  │
│  │  - /api/settings (GET/POST/DELETE)                │  │
│  │  - /api/sessions/* (CRUD, messages) [NEW]        │  │
│  │  - /api/memory/* (embed, search, status) [NEW]   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Services (LangChain + MCP)                       │  │
│  │  - services/ollama.js                             │  │
│  │  - services/database.js [NEW]                     │  │
│  │  - services/mcpClient.js [NEW]                    │  │
│  │  - services/langchainRAG.js [NEW]                 │  │
│  │  - services/extractionAgent.js [NEW]              │  │
│  │  - controllers/settingsController.js              │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  MCP Client → MCP Servers (stdio transport)      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                    │                    │
           │ HTTP               │ stdio              │ stdio
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
│ Ollama (11434)   │  │ MCP Servers      │  │ Vector Store   │
│ - Chat LLM       │  │ - SQLite Server  │  │ - FAISS Index  │
│ - Embeddings     │  │ - Filesystem     │  │ - Custom MCP   │
│ - nomic-embed    │  │ - Settings Tools │  │ - Per Session  │
└──────────────────┘  └──────────────────┘  └────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │ Persistent Data  │
                      │ - chat.db        │
                      │ - settings/*.json│
                      │ - vector-store/  │
                      └──────────────────┘
```

### Frontend Component Architecture

**Philosophy**: Granular, reusable, single-responsibility components

**State Management**: Zustand store (centralized, no prop drilling)

```
App.jsx (Minimal - routing & initialization)
├── Header.jsx (Navigation & Status)
│   └── Status Indicator (connection state)
│
├── ChatPage.jsx (Chat view with session management)
│   ├── Sidebar
│   │   ├── Character Avatar & Name
│   │   ├── SessionManager.jsx [NEW]
│   │   │   ├── Session List with create/delete
│   │   │   └── Session selection
│   │   └── Track Selector
│   │
│   ├── ChatInterface.jsx
│   │   ├── MessageHistoryViewer.jsx [NEW]
│   │   │   ├── Infinite scroll history loading
│   │   │   ├── "Jump to present" button
│   │   │   └── ChatBubble.jsx[] (from history + current)
│   │   │
│   │   └── ChatInput.jsx
│   │       ├── TextField.jsx ← UI Primitive
│   │       └── Button.jsx ← UI Primitive
│   │
│   └── AutoUpdateSuggestions.jsx [NEW]
│       └── Modal for extracted character updates
│
└── Settings.jsx (Settings view with tabs)
    ├── TemplateSelector.jsx (Preset templates)
    ├── ModeSelector.jsx (Roleplay/Utility toggle)
    ├── WorldSettingsPanel.jsx (Roleplay world config)
    ├── CharacterEditor.jsx (Character creation)
    ├── CharacterList.jsx (Multiple characters)
    ├── UtilitySettingsPanel.jsx (Assistant config)
    ├── UserPersonaPanel.jsx (User preferences)
    ├── GeneralSettingsPanel.jsx (Model, temperature, memory)
    ├── ModelSelector.jsx (Model dropdown)
    └── ModelDownloader.jsx (Download models)

Zustand Store (useStore.js - Extended)
├── Settings State (mode, roleplay, utility, persona, general)
├── Chat State (messages, isSending, activeMode)
├── Model State (models, selectedModel, downloading)
├── Ollama Status (connected/disconnected)
├── Session Management State [NEW]
│   ├── currentSessionId, currentSession
│   ├── chatSessions, sessionsLoading
│   └── Actions: createSession, loadSessions, selectSession, deleteSession
├── Message History State [NEW]
│   ├── messageHistory, historyLoading, historyHasMore
│   └── Actions: loadMessageHistory (with pagination)
├── RAG/Vector Context State [NEW]
│   ├── vectorContext, contextLoading
│   └── Actions: loadVectorContext
├── Auto-Extraction State [NEW]
│   ├── extractedSuggestions, extractionLoading
│   └── Actions: analyzeForUpdates, applyExtractedUpdates
└── UI State (currentPage: chat/settings)
```

---

## File Structure

```
/chat                                 # Project root
├── .gitignore                        # Git ignore (data/, node_modules/, etc.)
├── package.json                      # Backend dependencies (express, ollama, cors)
├── package-lock.json
├── server.js                         # Express server entry point
├── README.md                        # User documentation
├── CLAUDE.md                        # This file - developer documentation
│
├── services/
│   ├── ollama.js                    # Ollama API wrapper
│   ├── database.js                  # SQLite schema initialization [NEW]
│   ├── mcpClient.js                 # MCP client for all servers [NEW]
│   ├── langchainRAG.js              # LangChain RAG orchestration [NEW]
│   └── extractionAgent.js           # Character extraction agent [NEW]
│
├── controllers/
│   └── settingsController.js        # Settings CRUD operations
│
├── routes/
│   ├── settings.js                  # Settings API routes
│   ├── sessions.js                  # Session CRUD API [NEW]
│   └── memory.js                    # RAG/embedding API [NEW]
│
├── mcp-servers/                     # Custom MCP Servers [NEW]
│   ├── vector-store-server.js       # FAISS vector store MCP
│   └── settings-tools-server.js     # Settings extraction tools MCP
│
├── mcp-config.json                  # MCP server configurations [NEW]
│
├── data/
│   ├── chat.db                      # SQLite database (auto-created) [NEW]
│   ├── vector-store/                # FAISS indexes per session [NEW]
│   │   ├── {session-id}.index       # FAISS index file
│   │   └── {session-id}.meta.json   # Vector metadata
│   └── settings/                    # User settings (individual JSON files)
│       ├── mode.json                # Current mode (roleplay/normal)
│       ├── roleplay.json            # Roleplay settings
│       ├── utility.json             # Utility settings
│       ├── userPersona.json         # User persona
│       ├── general.json             # General settings
│       └── meta.json                # Metadata
│
├── docs/                            # Documentation
│   ├── README.md                    # Documentation index
│   ├── ZUSTAND_MIGRATION.md         # State management guide
│   ├── SETTINGS_PERSISTENCE.md      # Settings storage guide
│   ├── HOW_SETTINGS_WORK.md         # Settings architecture
│   ├── IMPLEMENTATION_PLAN.md       # Original plan
│   ├── IMPLEMENTATION_SUMMARY.md    # Summary
│   ├── QUICK_START.md               # Quick start guide
│   └── TEST_SYSTEM_PROMPT.md        # Testing guide
│
├── MEMORY_SYSTEM_GUIDE.md           # Memory system testing guide [NEW]
│
└── client/                          # Frontend (Vite project)
    ├── package.json                 # Frontend deps (react, zustand, sass)
    ├── package-lock.json
    ├── vite.config.js               # Vite config with proxy
    ├── index.html                   # HTML entry point
    │
    └── src/
        ├── main.jsx                 # React app bootstrap
        ├── App.jsx                  # Root component (30 lines - minimal!)
        │
        ├── store/
        │   └── useStore.js          # Zustand store (700+ lines, extended with memory)
        │
        ├── pages/
        │   ├── ChatPage.jsx         # Chat view
        │   └── Settings.jsx         # Settings view (tabbed)
        │
        ├── components/
        │   ├── ui/                  # Reusable UI Primitives (7)
        │   │   ├── Button.jsx
        │   │   ├── TextField.jsx
        │   │   ├── TextArea.jsx
        │   │   ├── Dropdown.jsx
        │   │   ├── ProgressBar.jsx
        │   │   ├── TagInput.jsx
        │   │   └── ImageUpload.jsx
        │   │
        │   ├── chat/                # Chat Components (7) [UPDATED]
        │   │   ├── ChatBubble.jsx
        │   │   ├── MessageList.jsx (legacy)
        │   │   ├── ChatInput.jsx
        │   │   ├── ChatInterface.jsx
        │   │   ├── MessageHistoryViewer.jsx [NEW]
        │   │   ├── MessageHistoryViewer.module.scss [NEW]
        │   │   ├── AutoUpdateSuggestions.jsx [NEW]
        │   │   └── AutoUpdateSuggestions.module.scss [NEW]
        │   │
        │   ├── session/             # Session Components [NEW]
        │   │   ├── SessionManager.jsx
        │   │   └── SessionManager.module.scss
        │   │
        │   ├── model/               # Model Management (2)
        │   │   ├── ModelSelector.jsx
        │   │   └── ModelDownloader.jsx
        │   │
        │   ├── layout/              # Layout Components (1)
        │   │   └── Header.jsx
        │   │
        │   └── settings/            # Settings Components (10)
        │       ├── TemplateSelector.jsx
        │       ├── ModeSelector.jsx
        │       ├── SettingsSection.jsx
        │       ├── WorldSettingsPanel.jsx
        │       ├── CharacterEditor.jsx
        │       ├── CharacterList.jsx
        │       ├── UtilitySettingsPanel.jsx
        │       ├── UserPersonaPanel.jsx
        │       └── GeneralSettingsPanel.jsx
        │
        ├── data/
        │   ├── templates.js         # 8 preset templates
        │   └── defaultSettings.js   # Default settings structure
        │
        ├── utils/
        │   ├── settingsAPI.js       # Settings API client
        │   ├── settingsStorage.js   # LocalStorage wrapper
        │   ├── promptBuilder.js     # System prompt generation
        │   ├── imageProcessor.js    # Avatar image handling
        │   ├── settingsImportExport.js  # Import/export utilities
        │   └── sessionAPI.js        # Session API client [NEW]
        │
        └── styles/
            ├── global.scss          # Global styles & variables
            ├── App.module.scss      # App layout styles
            ├── Settings.module.scss # Settings page styles
            └── ... (component-specific SCSS modules)
```

---

## Component Specifications

### UI Primitives (Fully Reusable)

#### Button.jsx
**Location**: `client/src/components/ui/Button.jsx`
**Purpose**: Generic button component with variants

```jsx
Props:
- onClick: function - Click handler
- disabled: boolean - Disabled state (default: false)
- className: string - Additional CSS classes (default: '')
- variant: 'primary' | 'secondary' - Button style (default: 'primary')
- children: ReactNode - Button content/text

CSS Classes:
- .btn (base)
- .btn-primary (blue background)
- .btn-secondary (gray background)
- .btn-disabled (opacity 0.5, no hover)

Usage Example:
<Button onClick={handleClick} variant="primary">Submit</Button>
```

#### TextField.jsx
**Location**: `client/src/components/ui/TextField.jsx`
**Purpose**: Generic text input component

```jsx
Props:
- value: string - Input value
- onChange: function(value) - Called with new value (NOT event)
- placeholder: string - Placeholder text (default: '')
- disabled: boolean - Disabled state (default: false)
- className: string - Additional CSS classes (default: '')
- type: string - Input type (default: 'text')
- onKeyPress: function - Key press handler (optional)

CSS Classes:
- .text-field (base)
- .text-field-disabled

Important: onChange receives the VALUE directly, not the event
Usage Example:
<TextField value={text} onChange={setText} placeholder="Enter text" />
```

#### Dropdown.jsx
**Location**: `client/src/components/ui/Dropdown.jsx`
**Purpose**: Generic select/dropdown component

```jsx
Props:
- options: Array<{value: string, label: string}> - Options array
- value: string - Selected value
- onChange: function(value) - Called with selected value
- placeholder: string - Default option text (default: 'Select an option')
- disabled: boolean - Disabled state (default: false)
- className: string - Additional CSS classes (default: '')

CSS Classes:
- .dropdown (base)
- .dropdown-disabled

Usage Example:
<Dropdown
  options={[{value: 'llama2', label: 'Llama 2'}]}
  value={selected}
  onChange={setSelected}
/>
```

#### ProgressBar.jsx
**Location**: `client/src/components/ui/ProgressBar.jsx`
**Purpose**: Visual progress indicator

```jsx
Props:
- progress: number - Percentage 0-100 (default: 0)
- status: string - Status text (e.g., "Downloading...")
- message: string - Additional message (optional)

CSS Classes:
- .progress-bar (container)
- .progress-fill (colored bar, width controlled by progress prop)
- .progress-text (overlaid text)
- .progress-status (bold status text)
- .progress-message (smaller message text)

Usage Example:
<ProgressBar progress={75} status="Downloading..." message="50MB/100MB" />
```

### Chat Components

#### ChatBubble.jsx
**Location**: `client/src/components/chat/ChatBubble.jsx`
**Purpose**: Individual message bubble with role-based styling

```jsx
Props:
- message: string - Message content
- role: 'user' | 'assistant' - Sender role
- timestamp: Date - Message timestamp (optional)

CSS Classes:
- .chat-bubble (base)
- .chat-bubble.user (blue, right-aligned)
- .chat-bubble.bot (gray, left-aligned)
- .bubble-content (message text)
- .bubble-timestamp (small timestamp text)

Behavior:
- User messages: blue background, align right
- Bot messages: gray background, align left
- Timestamps shown if provided

Usage Example:
<ChatBubble message="Hello" role="user" timestamp={new Date()} />
```

#### MessageList.jsx
**Location**: `client/src/components/chat/MessageList.jsx`
**Purpose**: Scrollable chat message container with auto-scroll

```jsx
Props:
- messages: Array<{role: string, content: string, timestamp: Date}>

CSS Classes:
- .message-list (scrollable container)
- .message-list-empty (shown when no messages)

Behavior:
- Auto-scrolls to bottom when new messages arrive
- Shows "No messages yet" when empty
- Maps messages array to ChatBubble components

Usage Example:
<MessageList messages={[
  {role: 'user', content: 'Hi', timestamp: new Date()},
  {role: 'assistant', content: 'Hello!', timestamp: new Date()}
]} />
```

#### ChatInput.jsx
**Location**: `client/src/components/chat/ChatInput.jsx`
**Purpose**: Message input field with send button

```jsx
Props:
- onSendMessage: function(message) - Called when message sent
- disabled: boolean - Disable input/send (default: false)
- placeholder: string - Input placeholder (default: 'Type a message...')

Composed of:
- TextField (message input)
- Button (send button with .send-btn class)

CSS Classes:
- .chat-input-container (flex container)
- .send-btn (send button)

Behavior:
- Enter key sends message
- Clears input after send
- Send button disabled if input empty or disabled prop true
- Internal state manages input value

Usage Example:
<ChatInput
  onSendMessage={handleSend}
  disabled={isLoading}
  placeholder="Type here..."
/>
```

#### ChatInterface.jsx
**Location**: `client/src/components/chat/ChatInterface.jsx`
**Purpose**: Main chat area container

```jsx
Props:
- messages: Array<{role: string, content: string}>
- onSendMessage: function(message)
- isLoading: boolean - Chat is processing
- selectedModel: string | null - Currently selected model

Composed of:
- MessageList (top section)
- ChatInput (bottom section)

CSS Classes:
- .chat-interface (container)
- .chat-interface-container (messages + input)
- .chat-interface-empty (no model selected state)

Behavior:
- Shows "Select a model to start chatting" if no model selected
- Disables input when isLoading
- Changes placeholder when loading

Usage Example:
<ChatInterface
  messages={msgs}
  onSendMessage={send}
  isLoading={false}
  selectedModel="llama2"
/>
```

### Model Management Components

#### ModelSelector.jsx
**Location**: `client/src/components/model/ModelSelector.jsx`
**Purpose**: Model selection dropdown with refresh

```jsx
Props:
- models: Array<{name: string, size: string}> - Available models
- selectedModel: string | null - Currently selected model name
- onSelectModel: function(modelName) - Called when model selected
- onRefreshModels: function() - Called when refresh clicked

Composed of:
- Dropdown (model list)
- Button (refresh button, secondary variant)

CSS Classes:
- .model-selector (container)
- .model-dropdown (flex container)

Behavior:
- Converts models array to dropdown options
- Refresh button refetches models list

Usage Example:
<ModelSelector
  models={[{name: 'llama2', size: '7B'}]}
  selectedModel="llama2"
  onSelectModel={setModel}
  onRefreshModels={fetchModels}
/>
```

#### ModelDownloader.jsx
**Location**: `client/src/components/model/ModelDownloader.jsx`
**Purpose**: Model download interface with progress

```jsx
Props:
- onDownloadModel: function(modelName) - Called when download starts
- isDownloading: boolean - Download in progress
- downloadProgress: {progress: number, status: string, message: string}

Composed of:
- TextField (model name input)
- Button (download button)
- ProgressBar (conditional, shown when downloading)

CSS Classes:
- .model-downloader (container)
- .download-section (input + button)

Behavior:
- Internal state manages model name input
- Clears input after download starts
- Disables input/button while downloading
- Shows progress bar when isDownloading true

Supported Model Formats:
- Ollama library: "llama2", "mistral", "codellama"
- HuggingFace GGUF: "hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF"

Usage Example:
<ModelDownloader
  onDownloadModel={handleDownload}
  isDownloading={downloading}
  downloadProgress={{progress: 50, status: 'Downloading...'}}
/>
```

### Layout Components

#### Header.jsx
**Location**: `client/src/components/layout/Header.jsx`
**Purpose**: App header with connection status

```jsx
Props:
- ollamaStatus: 'connected' | 'disconnected' | 'checking' - Ollama connection state

CSS Classes:
- .header (dark blue header bar)
- .status-indicator (flex container)
- .status-dot (colored circle)
- .status-connected (green dot with pulse animation)
- .status-disconnected (red dot)
- .status-text (status text)

Behavior:
- Shows green pulsing dot when connected
- Shows red dot when disconnected
- Shows gray dot when checking

Usage Example:
<Header ollamaStatus="connected" />
```

#### Sidebar.jsx
**Location**: `client/src/components/layout/Sidebar.jsx`
**Purpose**: Left sidebar containing model management UI

```jsx
Props:
- models: Array - Available models
- selectedModel: string | null
- onSelectModel: function(modelName)
- onRefreshModels: function()
- onDownloadModel: function(modelName)
- isDownloading: boolean
- downloadProgress: object

Composed of:
- ModelSelector (top section)
- ModelDownloader (bottom section)

CSS Classes:
- .sidebar (dark gray background)
- .sidebar-section (spacing for sections)

Behavior:
- Passes props to child components
- Provides container styling and layout

Usage Example:
<Sidebar
  models={models}
  selectedModel={model}
  onSelectModel={setModel}
  onRefreshModels={refresh}
  onDownloadModel={download}
  isDownloading={false}
  downloadProgress={{progress: 0, status: ''}}
/>
```

### Root Component

#### App.jsx
**Location**: `client/src/App.jsx` (180+ lines)
**Purpose**: Root component with global state and API logic

```jsx
State:
- messages: Array<{role, content, timestamp}> - Chat history
- selectedModel: string | null - Current model
- models: Array<{name, size}> - Available models
- isDownloading: boolean - Download in progress
- downloadProgress: {progress, status, message} - Download state
- ollamaStatus: 'checking' | 'connected' | 'disconnected' - Backend status
- isSending: boolean - Chat request in progress

Composed of:
- Header (ollamaStatus)
- Sidebar (all model-related props)
- ChatInterface (all chat-related props)

Key Functions:
- checkHealth() - Checks Ollama backend connection
- fetchModels() - Gets available models from backend
- handleSelectModel(name) - Switches model, clears messages
- handleRefreshModels() - Refetches models and checks health
- handleDownloadModel(name) - Downloads model via SSE stream
- handleSendMessage(content) - Sends chat message via SSE stream

CSS Classes:
- .app (flex column, full height)
- .app-container (grid: sidebar + main)
- .main-content (chat area)

API Integration:
- All fetch() calls use relative URLs (/api/...)
- Vite proxy forwards to backend on port 3001
- SSE streaming handled with ReadableStream API

Usage:
Root component - rendered by main.jsx
```

---

## State Management with Zustand

**Migration**: The app was migrated from prop-drilling to Zustand for centralized state management.

### Why Zustand?

**Benefits**:
- No prop drilling - components access state directly
- Automatic re-renders - only components using changed state re-render
- Simple API - no boilerplate like Redux
- DevTools support - for debugging
- Reduced App.jsx from 300+ lines to 30 lines

### Store Structure

**Location**: `client/src/store/useStore.js` (500+ lines)

**State Categories**:

1. **Settings State**
   - `settings` - All user settings (mode, roleplay, utility, persona, general)
   - `setSettings(newSettings)` - Updates and auto-saves
   - `loadSettings()` - Loads from localStorage + backend API

2. **Chat State**
   - `messages` - Chat history
   - `isSending` - Request in progress
   - `activeMode` - Mode override for /chat and /play commands
   - `sendMessage(content, model)` - Send with streaming
   - `clearMessages()` - Clear history

3. **Model State**
   - `models` - Available models
   - `selectedModel` - Current model
   - `isDownloading` - Download in progress
   - `downloadProgress` - Progress data
   - `fetchModels()` - Fetch from backend
   - `downloadModel(modelName)` - Download with progress

4. **Ollama Connection State**
   - `ollamaStatus` - checking/connected/disconnected
   - `checkHealth()` - Check connection

5. **UI State**
   - `currentPage` - chat/settings
   - `setCurrentPage(page)` - Navigate

6. **Initialization**
   - `initialize()` - Loads all data on app mount

### Usage in Components

**Simple Read**:
```javascript
import useStore from '../store/useStore';

function MyComponent() {
  const messages = useStore((state) => state.messages);
  return <div>{messages.length} messages</div>;
}
```

**Read + Write**:
```javascript
const settings = useStore((state) => state.settings);
const setSettings = useStore((state) => state.setSettings);

const updateTemp = (temp) => {
  setSettings({ ...settings, general: { ...settings.general, temperature: temp } });
};
```

**Actions**:
```javascript
const sendMessage = useStore((state) => state.sendMessage);
const selectedModel = useStore((state) => state.selectedModel);

sendMessage(content, selectedModel);
```

### Auto-Save Strategy

**Hybrid Persistence**:
1. **LocalStorage** (instant) - `localStorage.setItem('ollama-chat-settings', JSON.stringify(settings))`
2. **Backend API** (debounced 1s) - POST `/api/settings`

**Flow**:
```
User changes setting
  ↓
setSettings() called
  ↓
Immediate save to localStorage
  ↓
Debounced save to backend (1s delay)
  ↓
Backend saves to individual JSON files
```

**Console Logging**:
- `✅ Settings loaded from localStorage`
- `✅ Settings loaded from backend API`
- `💾 Saving settings to localStorage...`
- `💾 Saving settings to backend API...`
- `✅ Settings saved successfully`

See [docs/ZUSTAND_MIGRATION.md](docs/ZUSTAND_MIGRATION.md) for complete migration details.

---

## Memory System (NEW v3.0.0)

**Comprehensive memory system** using **LangChain + MCP (Model Context Protocol) architecture**.

### Overview

The memory system provides four key features:
1. **Session Management** - Create, switch, and manage multiple conversation sessions
2. **Message Persistence** - All messages stored in SQLite via MCP
3. **RAG (Retrieval Augmented Generation)** - Semantic search using FAISS and embeddings
4. **Auto-Extraction** - AI-powered character detail extraction with user approval

### Architecture Components

**MCP Servers** (Model Context Protocol):
- **SQLite MCP** - Session and message storage (`@modelcontextprotocol/server-sqlite`)
- **Filesystem MCP** - Settings file access (`@modelcontextprotocol/server-filesystem`)
- **Vector Store MCP** - FAISS vector search (custom implementation)
- **Settings Tools MCP** - Character extraction tools (custom implementation)

**LangChain Services**:
- **langchainRAG.js** - RAG orchestration with Ollama embeddings (nomic-embed-text)
- **extractionAgent.js** - Character extraction using LLM analysis

### Data Flow

```
User sends message
  ↓
Chat endpoint receives (with sessionId)
  ↓
Check if session > 50 messages
  ↓ YES → Use RAG
  ↓   ├── Get recent 20 messages
  ↓   ├── Semantic search top 5 similar
  ↓   └── Build hybrid context
  ↓ NO → Use full history
  ↓
Stream response to frontend
  ↓
Background tasks:
  ├── Save messages to SQLite (via MCP)
  ├── Create embeddings → FAISS index
  └── Every 5 messages: Run extraction agent
      └── Analyze for new character details
          └── Store suggestions in database
```

### Database Schema

**sessions table**:
```sql
id, name, character_name, character_mode, mode,
settings_snapshot, created_at, updated_at, message_count,
last_message_at, archived, metadata
```

**messages table**:
```sql
id, session_id, role, content, timestamp, model,
system_prompt_hash, token_count, embedded, embedding_id,
extracted_data, extraction_status
```

**embeddings table**:
```sql
id, session_id, message_id, text_hash, text_preview,
model, vector_file, created_at, metadata
```

### Vector Store

- **Location**: `/data/vector-store/`
- **Format**: FAISS IndexFlatL2 (768 dimensions)
- **Per Session**: `{session-id}.index` + `{session-id}.meta.json`
- **Embeddings Model**: Ollama nomic-embed-text
- **Search**: Cosine similarity via FAISS

### API Endpoints

**Session Management**:
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions (with pagination)
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/messages` - Save message
- `GET /api/sessions/:id/messages` - Get messages (with pagination)

**Memory/RAG**:
- `POST /api/memory/embed` - Create embeddings (background)
- `POST /api/memory/search` - Semantic search
- `GET /api/memory/status/:sessionId` - Embedding status

**Chat** (Modified):
- `POST /api/chat` - Now accepts `sessionId` and `settings`
  - Automatically uses RAG if session > 50 messages
  - Background: saves messages, creates embeddings, runs extraction

### Frontend Components

**SessionManager.jsx**:
- Session list with create/delete/select
- Shows character name, mode, message count, last update
- Modal for creating new sessions
- Delete confirmation

**MessageHistoryViewer.jsx**:
- Replaces MessageList with infinite scroll
- Loads last 50 messages by default
- Scrolling up loads more (50 at a time)
- "Jump to present" button when scrolled up
- Loading indicators and "beginning of conversation" marker

**AutoUpdateSuggestions.jsx**:
- Modal showing extracted character updates
- Category icons (personality, backstory, knowledge)
- Confidence badges (High/Medium/Low)
- Before/after preview
- Multi-select approval
- Apply selected updates to settings

### Key Features

**Session Creation Triggers**:
1. User clicks "+ New" button
2. Mode switches (roleplay ↔ utility)
3. First message sent with no session

**RAG Activation**:
- Triggers when session `message_count > 50`
- Uses recent 20 messages + top 5 semantic search results
- Hybrid context maintains conversation continuity

**Auto-Extraction** (Roleplay Mode):
- Runs every 5 messages
- Analyzes last 10 messages for new character details
- Categories: personality, backstory, knowledge, appearance, voice
- Confidence scoring (0.0-1.0)
- **Always requires user confirmation** - no auto-apply
- Updates appended to existing settings (never replaced)

### Configuration

**Enable Memory System**:
- `settings.general.memory = true` - Enable persistence and RAG
- Automatically creates session on first message

**For Auto-Extraction**:
- `settings.mode = 'roleplay'` - Roleplay mode
- `settings.general.memory = true` - Memory enabled

### Testing Guide

See [MEMORY_SYSTEM_GUIDE.md](MEMORY_SYSTEM_GUIDE.md) for complete testing instructions.

**Quick Test**:
```bash
# Ensure nomic-embed-text is downloaded
ollama pull nomic-embed-text

# Start backend
npm start

# Start frontend (new terminal)
cd client && npm run dev

# Open http://localhost:5173
# Create session, send messages
# Check backend console for:
# - "✅ All services initialized"
# - "✅ Messages saved to session"
# - "🧠 Using RAG" (after 50 messages)
# - "🔍 Running extraction analysis" (every 5 messages in roleplay)
```

---

## Settings System

**Comprehensive settings system** with two modes: **Roleplay** and **Utility/Normal**

### Settings Architecture

**Two-Mode System**:

1. **Roleplay Mode** - Character-based interaction
   - World settings (lore, scene, narrator voice)
   - Character configuration (single or multiple)
   - Character details (identity, personality, backstory)
   - Avatar support with image upload

2. **Utility/Normal Mode** - Standard AI assistant
   - Assistant identity (persona, communication style)
   - Guardrails (constraints, formatting preferences)

**Cross-Mode Settings**:
- User Persona (name, bio, skills, interests, boundaries)
- General (model, temperature, top_p, max_tokens)
- Linguistic Filters (banned words/phrases)

### Template System

**8 Preset Templates** (5 roleplay + 3 utility):

**Roleplay Templates**:
1. Fantasy Tavern Keeper
2. Sci-Fi Ship AI Explorer
3. Noir Detective Partner
4. Cyberpunk Hacker Mentor
5. Companion Character

**Utility Templates**:
1. Expert Tutor
2. Code Review Partner
3. Research Assistant

Templates provide complete, ready-to-use settings configurations.

### Variable Mapping in System Prompts

**Dynamic Prompt Generation** using template variables:

```javascript
// In roleplay settings
narratorVoice: "Dark and mysterious"
singleCharacter.identity.name: "Echo"

// In system prompt
"You are the {{Narrator Voice}}. Current character: {{NPC Name}}"
  ↓
"You are the Dark and mysterious. Current character: Echo"
```

**Available Variables**:
- `{{Narrator Voice}}` → `settings.roleplay.world.narratorVoice`
- `{{NPC Name}}` → `settings.roleplay.singleCharacter.identity.name`
- `{{User Name}}` → `settings.userPersona.name`
- And many more...

See [docs/HOW_SETTINGS_WORK.md](docs/HOW_SETTINGS_WORK.md) for complete variable mapping.

### Settings Persistence

**Individual JSON Files** in `/data/settings/`:

```
/data/settings/
├── mode.json           # Current mode
├── roleplay.json       # Roleplay config
├── utility.json        # Utility config
├── userPersona.json    # User persona
├── general.json        # General settings
└── meta.json          # Metadata
```

**Why Individual Files?**:
- Granular backup/restore
- Easy manual editing
- Human-readable JSON
- Separate user data from code
- Version control friendly

**Load Process**:
```
App Startup
  ↓
initialize() in Zustand store
  ↓
loadSettings() → GET /api/settings
  ↓
Backend reads 6 JSON files and merges
  ↓
Settings loaded into Zustand store
```

**Save Process**:
```
User changes setting
  ↓
setSettings() in Zustand
  ↓
Auto-save (debounced 1s) → POST /api/settings
  ↓
Backend writes each category to its JSON file
```

See [docs/SETTINGS_PERSISTENCE.md](docs/SETTINGS_PERSISTENCE.md) for complete details.

### Mode Toggle Commands

**Mid-Conversation Mode Switching**:

```
User: "/chat"  → Switches to normal mode (even if roleplay mode is enabled)
User: "/play"  → Switches to roleplay mode (even if normal mode is enabled)
```

**Implementation**:
- `activeMode` state in Zustand overrides `settings.mode`
- Allows temporary mode switching without changing saved settings
- Cleared on new conversation

### Settings UI

**Tabbed Interface** in Settings page:

1. **Mode & Templates** - Select mode and apply templates
2. **Roleplay Settings** - World, characters, narrative config
3. **Utility Settings** - Assistant identity and guardrails
4. **User Persona** - User information and preferences
5. **General** - Model selection and generation parameters
6. **Models** - Model selector and downloader

**Features**:
- Auto-save with visual confirmation
- Import/Export settings (JSON file)
- Copy to clipboard
- Reset to defaults
- Template preview before applying

---

## API Endpoints

### Backend Server (server.js)
**Port**: 3001
**Base URL**: `http://localhost:3001/api`

#### GET /api/health
**Purpose**: Check Ollama service connection
**Response**:
```json
{
  "status": "ok" | "error",
  "message": "Ollama service is running",
  "error": "error message if failed"
}
```

#### GET /api/models
**Purpose**: List all available models
**Response**:
```json
{
  "success": true,
  "models": [
    {
      "name": "llama2",
      "size": "3.8GB",
      "modified_at": "2024-01-01T00:00:00Z",
      ...other Ollama model fields
    }
  ]
}
```

#### POST /api/models/pull
**Purpose**: Download/pull a model
**Content-Type**: `application/json`
**Request Body**:
```json
{
  "modelName": "llama2" | "hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF"
}
```
**Response**: Server-Sent Events (SSE) stream
**Event Format**:
```
data: {"status": "pulling manifest", "digest": "sha256:..."}
data: {"status": "downloading", "completed": 1024, "total": 2048}
data: {"completed": true, "status": "success"}
```
**Error Format**:
```
data: {"status": "error", "error": "error message"}
```

#### POST /api/chat
**Purpose**: Send chat message and receive streaming response
**Content-Type**: `application/json`
**Request Body**:
```json
{
  "model": "llama2",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant..."},
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "How are you?"}
  ]
}
```
**Note**: First message is the system prompt (generated from settings)

**Response**: Server-Sent Events (SSE) stream
**Event Format**:
```
data: {"message": {"role": "assistant", "content": "I"}}
data: {"message": {"role": "assistant", "content": "'m"}}
data: {"message": {"role": "assistant", "content": " doing"}}
...
```
**Error Format**:
```
data: {"error": "error message"}
```

#### GET /api/settings
**Purpose**: Load user settings from individual JSON files
**Response**:
```json
{
  "success": true,
  "settings": {
    "mode": "roleplay",
    "roleplay": {
      "world": {
        "settingLore": "...",
        "openingScene": "...",
        "narratorVoice": "...",
        "pacing": "...",
        "hardRules": ["Never speak/act for the User"],
        "turnLogic": "..."
      },
      "characterMode": "single",
      "singleCharacter": { /* character details */ },
      "multipleCharacters": []
    },
    "utility": {
      "assistantIdentity": { "persona": "...", "communicationStyle": "..." },
      "guardrails": { "negativeConstraints": "...", "formattingPreferences": "..." }
    },
    "userPersona": {
      "name": "...",
      "bio": "...",
      "skills": "...",
      "profession": "...",
      "tastes": { /* interests, hobbies, media */ },
      "linguisticFilters": { "bannedPhrases": [], "bannedWords": [] },
      "boundaries": "..."
    },
    "general": {
      "selectedModel": "llama2",
      "webSearch": false,
      "chatSearch": false,
      "memory": true,
      "temperature": 0.7,
      "topP": 0.9,
      "maxTokens": 2048
    },
    "meta": {
      "templateId": "cyberpunk-hacker",
      "lastModified": "2026-03-12T04:00:49.351Z",
      "version": "1.0.0"
    }
  }
}
```

#### POST /api/settings
**Purpose**: Save user settings to individual JSON files
**Content-Type**: `application/json`
**Request Body**:
```json
{
  "settings": {
    "mode": "roleplay",
    "roleplay": { /* ... */ },
    "utility": { /* ... */ },
    "userPersona": { /* ... */ },
    "general": { /* ... */ },
    "meta": { /* ... */ }
  }
}
```
**Response**:
```json
{
  "success": true,
  "settings": { /* updated settings with new lastModified */ }
}
```

#### DELETE /api/settings
**Purpose**: Reset settings to defaults (deletes all JSON files)
**Response**:
```json
{
  "success": true,
  "settings": { /* default settings */ }
}
```

---

## Data Flow

### Model Download Flow

```
User Input (ModelDownloader)
  ↓ modelName
App.handleDownloadModel(modelName)
  ↓ POST /api/models/pull
Express Server
  ↓ ollama.pull({model: modelName, stream: true})
Ollama Service
  ↓ SSE Stream (progress chunks)
App (updates downloadProgress state)
  ↓ re-render
ProgressBar (shows progress)
  ↓ on complete
App.fetchModels() (refresh model list)
  ↓
ModelSelector (updated dropdown)
```

### Chat Message Flow

```
User Input (ChatInput)
  ↓ message content
App.handleSendMessage(content)
  ↓ adds user message to state
  ↓ POST /api/chat
Express Server
  ↓ ollama.chat({model, messages, stream: true})
Ollama Service
  ↓ SSE Stream (token chunks)
App (appends to assistant message)
  ↓ re-render on each chunk
MessageList → ChatBubble[] (shows streaming response)
```

### State Management Pattern (Zustand)

**Modern Pattern - No Prop Drilling**:

```jsx
// Zustand store (client/src/store/useStore.js)
const useStore = create((set, get) => ({
  // State
  messages: [],
  settings: DEFAULT_SETTINGS,

  // Actions
  setMessages: (messages) => set({ messages }),
  setSettings: (newSettings) => {
    set({ settings: newSettings });
    // Auto-save to localStorage + backend
    localStorage.setItem('ollama-chat-settings', JSON.stringify(newSettings));
    debouncedSaveToBackend(newSettings);
  },

  sendMessage: async (content, model) => {
    // Add user message
    get().addMessage({ role: 'user', content });

    // Build system prompt from settings
    const systemPrompt = buildSystemPrompt(get().settings);

    // Call API with streaming
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...get().messages
        ]
      })
    });

    // Stream response...
  }
}));

// Components access store directly
function ChatPage() {
  const messages = useStore((state) => state.messages);
  const sendMessage = useStore((state) => state.sendMessage);
  const selectedModel = useStore((state) => state.selectedModel);

  return <ChatInterface
    messages={messages}
    onSendMessage={(content) => sendMessage(content, selectedModel)}
  />;
}

// Settings page - no props needed!
function Settings() {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  // Auto-save on every change
  const updateTemp = (temp) => {
    setSettings({
      ...settings,
      general: { ...settings.general, temperature: temp }
    });
  };

  return <input type="range" onChange={(e) => updateTemp(e.target.value)} />;
}
```

**Old Pattern (Deprecated)**:
- All state in App.jsx
- Props drilled 3-4 levels deep
- 20+ props passed to Settings component
- 300+ lines in App.jsx

**New Pattern (Current)**:
- Zustand centralized store
- Components access state directly
- No prop drilling
- App.jsx reduced to 30 lines

---

## Styling Architecture

### Design System - Oread Theme

**Color Palette**:
```scss
// Primary Colors
$color-primary: #4db8a8;              // Teal/cyan accent
$color-primary-hover: #3da89a;        // Darker teal on hover

// Backgrounds (Dark Theme)
$color-bg-light: #1a1a1a;             // Very dark background
$color-bg-white: #2a2a2a;             // Dark card background
$color-bg-dark: #0d0d0d;              // Darker header/sidebar
$color-bg-chat: #1a1a1a;              // Chat area background
$color-bg-bubble-user: #4db8a8;       // Teal user messages
$color-bg-bubble-bot: #2d2d2d;        // Dark bot messages

// Text Colors
$color-text-primary: #e0e0e0;         // Light gray text
$color-text-white: #ffffff;           // Pure white
$color-text-light: #b0b0b0;           // Medium gray
$color-text-muted: #808080;           // Muted gray
```

**Typography**:
- **Font Family**: Montserrat (Google Fonts)
- **Weights**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Usage**:
  - Headers: 400-500 weight
  - Body text: 400 weight
  - Hints/captions: 300 weight
  - Buttons/labels: 500 weight

### CSS Organization

**Single SCSS File**:
- **global.scss** - All styles using BEM methodology and SCSS variables

**Key Features**:
- BEM (Block Element Modifier) naming convention
- SCSS variables for consistent theming
- Google Fonts import for Montserrat
- Dark theme with transparency layers
- Smooth transitions and hover effects

### CSS Class Naming Convention

**BEM Methodology**:
- Block: `.chat-bubble`, `.model-selector`
- Element: `.chat-bubble__content`, `.header__title`
- Modifier: `.chat-bubble--user`, `.btn--primary`
- State classes: `.btn--disabled`, `.settings__tab--active`

### Key CSS Classes Reference

```css
/* Layout */
.app                         /* Full height flex column, dark bg */
.app__container              /* Flex container for main content */
.header                      /* Dark header with teal dot logo */
.header__title               /* "OREAD" with letter-spacing */
.header__actions             /* Heart, menu, refresh buttons */

.chat-page                   /* Flex container for chat */
.chat-page__sidebar          /* 180px left sidebar with avatar */
.chat-page__avatar           /* 120px circular avatar */
.chat-page__character-name   /* Uppercase character name */
.chat-page__track-selector   /* Background music selector */

/* UI Primitives */
.btn                         /* Base button with Montserrat font */
.btn--primary                /* Teal button with glow on hover */
.btn--secondary              /* Transparent button with border */
.text-field                  /* Dark input with teal focus */
.dropdown                    /* Dark dropdown with teal accent */
.progress-bar                /* Dark progress with teal fill + glow */

/* Chat */
.chat-bubble                 /* 18px border-radius, flex layout */
.chat-bubble--user           /* Teal bg, cutoff bottom-right corner */
.chat-bubble--bot            /* Dark gray bg, cutoff bottom-left */
.chat-bubble__content        /* Message text, line-height 1.6 */
.message-list                /* Scrollable with custom thin scrollbar */
.chat-input                  /* Transparent bg, pill-shaped input */
.chat-input__send            /* Circular send button with ▶ icon */

/* Settings */
.settings                    /* Dark bg with padding */
.settings__tab               /* Transparent with teal underline */
.settings__tab--active       /* Teal color + border-bottom */
.settings-section            /* Card with transparent dark bg */
.mode-selector__option       /* Hover lift + glow effect */
.character-card              /* Hover transform + teal border glow */

/* Status */
.status                      /* Connection status indicator */
.status__dot                 /* Colored circle */
.status--connected           /* Green with pulse animation */
```

### Design Principles

1. **Dark Theme First**: All components designed for dark backgrounds
2. **Teal Accent**: Primary color used for interactive elements, focus states
3. **Transparency Layers**: rgba(255, 255, 255, 0.03-0.1) for subtle depth
4. **Smooth Transitions**: 0.2s ease on hover/focus states
5. **Modern Aesthetics**:
   - Rounded corners (8px-25px depending on element)
   - Subtle shadows and glows
   - Thin custom scrollbars (6px)
   - Hover transforms (translateY, scale)

---

## Key Implementation Details

### SSE Streaming Pattern

**Frontend** (App.jsx):
```javascript
// Streaming response pattern used in both download and chat
const response = await fetch('/api/endpoint', {method: 'POST', ...});
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const {done, value} = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim() !== '');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Handle data (update progress, append message, etc.)
    }
  }
}
```

**Backend** (server.js):
```javascript
// SSE response setup
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Send data
for await (const chunk of stream) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

res.end();
```

### Vite Proxy Configuration

**client/vite.config.js**:
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**Effect**: All `/api/*` requests from frontend are proxied to backend

### Ollama Service Integration

**services/ollama.js**:
```javascript
import { Ollama } from 'ollama';

class OllamaService {
  constructor() {
    this.ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
  }

  async listModels() {
    const response = await this.ollama.list();
    return { success: true, models: response.models || [] };
  }

  async pullModel(modelName) {
    return await this.ollama.pull({ model: modelName, stream: true });
  }

  async chat(model, messages) {
    return await this.ollama.chat({ model, messages, stream: true });
  }
}

export default new OllamaService();
```

### Message State Management Pattern

```javascript
// App.jsx - Streaming message updates
const handleSendMessage = async (content) => {
  // 1. Add user message immediately
  const userMessage = {role: 'user', content, timestamp: new Date()};
  setMessages(prev => [...prev, userMessage]);

  // 2. Create empty assistant message
  let assistantMessage = {role: 'assistant', content: '', timestamp: new Date()};
  setMessages(prev => [...prev, assistantMessage]);

  // 3. Stream: update last message in array
  for await (const chunk of stream) {
    assistantMessage.content += chunk.message.content;
    setMessages(prev => {
      const newMessages = [...prev];
      newMessages[newMessages.length - 1] = {...assistantMessage};
      return newMessages;
    });
  }
};
```

---

## Key Utilities

### promptBuilder.js
**Location**: `client/src/utils/promptBuilder.js`
**Purpose**: Generate system prompts from settings with variable mapping

**Key Functions**:
```javascript
buildSystemPrompt(settings, activeMode = null)
  // Returns complete system prompt string
  // Uses variable mapping like {{Narrator Voice}} → settings.roleplay.world.narratorVoice

detectModeToggle(content)
  // Detects /chat or /play commands
  // Returns: 'normal', 'roleplay', or null
```

**Variable Mapping Examples**:
- `{{Narrator Voice}}` → Roleplay narrator style
- `{{NPC Name}}` → Character name
- `{{User Name}}` → User's name from persona
- `{{Setting Lore}}` → World lore
- And 20+ more variables

### settingsAPI.js
**Location**: `client/src/utils/settingsAPI.js`
**Purpose**: Backend API client for settings

**Key Functions**:
```javascript
loadSettings()
  // GET /api/settings
  // Returns: { success: true, settings: {...} }

saveSettings(settings)
  // POST /api/settings
  // Auto-updates lastModified timestamp

deleteSettings()
  // DELETE /api/settings
  // Resets to defaults
```

### settingsStorage.js
**Location**: `client/src/utils/settingsStorage.js`
**Purpose**: LocalStorage wrapper for settings

**Key Functions**:
```javascript
saveSettingsToStorage(settings)
  // Saves to localStorage['ollama-chat-settings']

loadSettingsFromStorage()
  // Loads from localStorage
  // Returns null if not found

clearSettingsStorage()
  // Removes from localStorage
```

### settingsImportExport.js
**Location**: `client/src/utils/settingsImportExport.js`
**Purpose**: Import/Export settings as JSON files

**Key Functions**:
```javascript
exportSettings(settings, filename = 'ollama-chat-settings.json')
  // Downloads settings as JSON file
  // Returns: { success: true/false, error?: string }

importSettings(file)
  // Reads JSON file and parses settings
  // Validates structure
  // Returns: { success: true, settings: {...} } or { success: false, error: string }

copySettingsToClipboard(settings)
  // Copies settings JSON to clipboard
  // Returns: { success: true/false, error?: string }
```

### imageProcessor.js
**Location**: `client/src/utils/imageProcessor.js`
**Purpose**: Process avatar images (resize, convert to base64)

**Key Functions**:
```javascript
processImage(file)
  // Resizes to 512x512px
  // Converts to base64 data URL
  // Returns: Promise<base64String>

validateImageFile(file)
  // Validates file type and size
  // Returns: { valid: true/false, error?: string }
```

### defaultSettings.js
**Location**: `client/src/data/defaultSettings.js`
**Purpose**: Default settings structure

**Exports**:
```javascript
export const DEFAULT_SETTINGS = {
  mode: 'normal',
  roleplay: { /* complete structure */ },
  utility: { /* complete structure */ },
  userPersona: { /* complete structure */ },
  general: { /* complete structure */ },
  meta: { /* complete structure */ }
};
```

### templates.js
**Location**: `client/src/data/templates.js`
**Purpose**: 8 preset templates

**Structure**:
```javascript
export const TEMPLATES = [
  {
    id: 'fantasy-tavern',
    name: 'Fantasy Tavern Keeper',
    category: 'roleplay',
    description: '...',
    settings: { /* complete settings object */ }
  },
  // ... 7 more templates
];
```

---

## Common Development Tasks

### Adding a New UI Component

1. Create file in appropriate directory:
   - Reusable primitives → `client/src/components/ui/`
   - Chat-related → `client/src/components/chat/`
   - Model-related → `client/src/components/model/`
   - Layout → `client/src/components/layout/`

2. Follow component pattern:
```jsx
export default function ComponentName({ prop1, prop2 }) {
  return (
    <div className="component-name">
      {/* content */}
    </div>
  );
}
```

3. Add styles to appropriate CSS file
4. Import and use in parent component

### Adding a New API Endpoint

1. Add route in `server.js`:
```javascript
app.get('/api/new-endpoint', async (req, res) => {
  try {
    const result = await ollamaService.someMethod();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

2. Add method to `services/ollama.js` if needed
3. Call from frontend using `fetch('/api/new-endpoint')`

### Modifying State

**Always in App.jsx**:
1. Add state: `const [newState, setNewState] = useState(initialValue);`
2. Create handler: `const handleNewAction = (data) => { setNewState(data); }`
3. Pass to child: `<ChildComponent onAction={handleNewAction} />`
4. Child calls: `props.onAction(newData)`

---

## Testing & Verification

### Prerequisites Checklist
- [ ] Node.js v18+ installed
- [ ] Ollama installed and running (`ollama serve`)
- [ ] Backend dependencies installed (`npm install` in root)
- [ ] Frontend dependencies installed (`npm install` in client/)

### Running the App

**Terminal 1** (Backend):
```bash
cd /Users/fastandcurious/apps/chat
npm start
# Should show: "🚀 Ollama Chat Backend running on http://localhost:3001"
```

**Terminal 2** (Frontend):
```bash
cd /Users/fastandcurious/apps/chat/client
npm run dev
# Should show: "Local: http://localhost:5173/"
```

**Browser**: Open `http://localhost:5173`

### Verification Steps

1. **Check Connection**: Header should show green "Connected" status
2. **List Models**: Dropdown should populate (if models exist)
3. **Download Model**:
   - Enter "llama2" or "hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF"
   - Click Download
   - Progress bar should update
4. **Chat**:
   - Select model from dropdown
   - Type message and send
   - Response should stream token-by-token

### Common Issues

**"Disconnected" status**:
- Ensure Ollama is running: `ollama serve`
- Test: `curl http://localhost:11434/api/tags`

**Models not loading**:
- Check backend is running on port 3001
- Check browser console for errors
- Verify Vite proxy in `client/vite.config.js`

**Chat not working**:
- Ensure model is selected
- Check backend logs for errors
- Verify SSE streaming in network tab

---

## Design Decisions & Rationale

### Why Granular Components?

**Decision**: 13 small components instead of 3-4 large ones

**Rationale**:
- **Reusability**: UI primitives (Button, TextField) used multiple times
- **Testability**: Easier to test small, focused components
- **Maintainability**: Single responsibility, easy to locate bugs
- **Composability**: Build complex UIs from simple building blocks

**Example**: ChatInput is composed of TextField + Button, not a monolithic form

### Why SSE Instead of WebSockets?

**Decision**: Server-Sent Events for streaming

**Rationale**:
- **Simplicity**: Unidirectional (server → client) matches our use case
- **HTTP-based**: Works with existing infrastructure, easier to debug
- **Automatic reconnection**: Browser handles reconnects
- **No WebSocket server**: Simpler backend implementation

**Use case fit**: We only need server → client streaming (Ollama responses, download progress)

### Why Separate CSS Files?

**Decision**: 3 CSS files instead of CSS-in-JS or single file

**Rationale**:
- **Organization**: Related styles grouped logically
- **Performance**: No JS processing for styles
- **Simplicity**: No build-time CSS processing needed
- **Familiarity**: Standard CSS, easy for anyone to modify

**Structure**: Global layout → Component primitives → Domain-specific (chat)

### Why Zustand for State Management?

**Decision**: Migrated from useState in App.jsx to Zustand centralized store

**Previous Approach** (v1.0.0):
- All state in App.jsx
- Prop drilling 3-4 levels deep
- 20+ props to Settings component
- 300+ lines in App.jsx

**Current Approach** (v2.0.0):
- Zustand centralized store
- Components access state directly
- No prop drilling
- App.jsx reduced to 30 lines

**Rationale**:
- **Scalability**: Settings system added 50+ state variables
- **Maintainability**: No more passing props through intermediate components
- **Performance**: Only components using changed state re-render
- **Developer Experience**: Simpler component code, easier debugging
- **Simplicity**: Zustand is lighter than Redux, no boilerplate

**Alternative considered**: Context API, but Zustand provides better performance and simpler API

### Why Individual JSON Files for Settings?

**Decision**: Store settings as 6 individual JSON files instead of one monolithic file

**File Structure**:
```
/data/settings/
├── mode.json
├── roleplay.json
├── utility.json
├── userPersona.json
├── general.json
└── meta.json
```

**Rationale**:
- **Granular Backup**: Backup/restore specific categories
- **Human-Readable**: Easy to manually edit and inspect
- **Version Control**: Git-friendly (smaller diffs)
- **Debugging**: Easy to see what's saved without inspecting localStorage
- **Separation of Concerns**: User data isolated from application code
- **Flexibility**: Share individual categories between users

**Alternative considered**: Single JSON file, but less flexible for backup/restore

### Why Hybrid Persistence (localStorage + Backend)?

**Decision**: Save to both localStorage and backend API

**Flow**:
```
User changes setting
  ↓
Immediate save to localStorage
  ↓
Debounced save to backend (1s delay)
```

**Rationale**:
- **Instant Feedback**: localStorage save is synchronous
- **Cross-Session**: Backend persists across browser sessions
- **Backup**: File-based backup is easy
- **Offline**: Works without backend connection
- **Sync Potential**: Could sync across devices using backend

**Alternative considered**: Backend-only, but UX suffers from network latency

---

## Future Enhancement Ideas

### Potential Features
1. **Conversation History**: Persist chats to localStorage
2. **System Prompts**: Allow custom system prompts per model
3. **Model Info**: Display model size, parameters, capabilities
4. **Multi-chat**: Multiple conversation tabs
5. **Export**: Export conversations as JSON/Markdown
6. **Settings**: Temperature, top_p, max_tokens controls
7. **Model Cards**: Visual cards instead of dropdown
8. **Dark Mode**: Theme toggle
9. **Code Highlighting**: Syntax highlighting in responses
10. **File Upload**: Support for image inputs (vision models)

### Technical Improvements
1. **Error Boundary**: React error boundary component
2. **Loading States**: Better loading indicators
3. **Retry Logic**: Auto-retry failed requests
4. **Abort Controllers**: Cancel in-flight requests
5. **TypeScript**: Add type safety
6. **Tests**: Jest + React Testing Library
7. **E2E Tests**: Playwright/Cypress tests
8. **Docker**: Containerization for easy deployment
9. **Environment Variables**: Config management
10. **Logging**: Structured logging on backend

### Refactoring Opportunities
1. **API Client**: Extract fetch logic to separate module
2. **Custom Hooks**: `useOllama()`, `useChat()` hooks
3. **Context API**: For deeply nested state if app grows
4. **Component Library**: Extract UI primitives to separate package
5. **Constants**: Extract magic strings to constants file

---

## Dependencies

### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",                           // Web framework
    "cors": "^2.8.5",                                // CORS middleware
    "ollama": "^0.6.3",                              // Official Ollama client
    "langchain": "^0.1.0",                           // LangChain framework [NEW]
    "@langchain/community": "^0.0.40",               // Community integrations [NEW]
    "@langchain/ollama": "^0.0.1",                   // Ollama LangChain [NEW]
    "@modelcontextprotocol/sdk": "^0.5.0",           // MCP SDK [NEW]
    "sqlite": "^5.1.1",                              // SQLite driver [NEW]
    "sqlite3": "^5.1.7",                             // SQLite3 library [NEW]
    "uuid": "^11.0.3",                               // UUID generation [NEW]
    "faiss-node": "^0.5.1"                           // FAISS vector search [NEW]
  }
}
```

**MCP Servers** (installed globally or via npx):
```bash
# SQLite MCP Server
@modelcontextprotocol/server-sqlite

# Filesystem MCP Server
@modelcontextprotocol/server-filesystem
```

### Frontend (client/package.json)
```json
{
  "dependencies": {
    "react": "^19.2.0",         // UI framework
    "react-dom": "^19.2.0",     // React DOM rendering
    "zustand": "^5.0.2"         // State management
  },
  "devDependencies": {
    "vite": "^7.3.1",                      // Build tool
    "@vitejs/plugin-react": "^5.1.1",      // React plugin for Vite
    "sass": "^1.83.4",                     // SCSS preprocessor
    "eslint": "^9.39.1",                   // Linter
    // ... other dev dependencies
  }
}
```

---

## Documentation Structure

**Root Level**:
- **README.md** - User-facing setup and usage instructions
- **CLAUDE.md** (this file) - Complete developer documentation

**docs/ Folder** (Technical Documentation):
- **[docs/README.md](docs/README.md)** - Documentation index
- **[docs/ZUSTAND_MIGRATION.md](docs/ZUSTAND_MIGRATION.md)** - State management migration guide
- **[docs/SETTINGS_PERSISTENCE.md](docs/SETTINGS_PERSISTENCE.md)** - Settings storage architecture
- **[docs/HOW_SETTINGS_WORK.md](docs/HOW_SETTINGS_WORK.md)** - Settings system deep dive
- **[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)** - Original implementation plan
- **[docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** - Feature summary
- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Quick start guide
- **[docs/TEST_SYSTEM_PROMPT.md](docs/TEST_SYSTEM_PROMPT.md)** - System prompt testing guide

## Key Files to Understand

**Priority order for understanding the codebase**:

1. **README.md** - User documentation, setup instructions
2. **CLAUDE.md** (this file) - Complete developer context
3. **[docs/ZUSTAND_MIGRATION.md](docs/ZUSTAND_MIGRATION.md)** - Understand state management
4. **[docs/SETTINGS_PERSISTENCE.md](docs/SETTINGS_PERSISTENCE.md)** - Understand settings storage
5. **client/src/store/useStore.js** (500+ lines) - Centralized state and actions
6. **client/src/App.jsx** (30 lines) - Minimal routing and initialization
7. **server.js** - Backend API routes, SSE streaming
8. **controllers/settingsController.js** - Settings CRUD operations
9. **services/ollama.js** - Ollama integration layer
10. **client/src/utils/promptBuilder.js** - System prompt generation
11. **UI Components** - Reusable building blocks
12. **SCSS Files** - Styling and layout

---

## Environment & Ports

**Backend**: http://localhost:3001
**Frontend (dev)**: http://localhost:5173
**Ollama Service**: http://localhost:11434
**Frontend → Backend**: Proxied via Vite (see client/vite.config.js)

---

## Quick Reference Commands

```bash
# Backend
npm install                  # Install backend dependencies
npm start                    # Start backend (http://localhost:3001)
npm run dev                  # Start with auto-reload (if Node 20+)

# Frontend
cd client
npm install                  # Install frontend dependencies
npm run dev                  # Start dev server (http://localhost:5173)
npm run build                # Build for production
npm run preview              # Preview production build

# Ollama
ollama serve                 # Start Ollama service
ollama list                  # List installed models
ollama pull llama2           # Download a model
curl http://localhost:11434/api/tags  # Test Ollama API
```

---

## Architecture Principles

1. **Component Composition**: Build complex UIs from simple, focused components
2. **Unidirectional Data Flow**: Props down, events up
3. **Single Source of Truth**: All state in App.jsx
4. **Separation of Concerns**: UI components vs API logic vs styling
5. **Streaming-First**: Use SSE for real-time updates
6. **Fail Gracefully**: Show errors to user, don't crash
7. **Mobile-Ready**: Responsive CSS (though not fully optimized)
8. **Developer Experience**: Clear file structure, consistent naming

---

## Notes for AI Assistants

### When Continuing This Project

1. **Read this file first** - Contains all architectural decisions
2. **Check README.md** - User-facing documentation
3. **Review App.jsx** - Central state and logic
4. **Understand component tree** - See "Component Architecture" section
5. **Follow existing patterns** - Consistent with established code style

### Making Changes

1. **Preserve granularity** - Keep components small and focused
2. **Update documentation** - Modify this file if architecture changes
3. **Maintain CSS organization** - Keep 3-file structure
4. **Test streaming** - Verify SSE endpoints after changes
5. **Check both dev servers** - Backend (3001) and Frontend (5173)

### Common Gotchas

1. **Zustand State Access**: Always use selectors `useStore((state) => state.property)`, not `useStore().property`
2. **Settings Auto-Save**: Changes auto-save with 1s debounce - check console for save confirmations
3. **System Prompts**: Generated from settings using variable mapping - check `promptBuilder.js`
4. **onChange in TextField**: Receives VALUE, not event object
5. **SSE parsing**: Remember to check `line.startsWith('data: ')`
6. **Message state updates**: Update last item in array for streaming
7. **CSS/SCSS**: Using SCSS modules + global.scss, not plain CSS
8. **Settings Persistence**: Individual JSON files in `/data/settings/`, not single file
9. **Vite proxy**: Only works in dev mode, not production build
10. **Model names**: Support both Ollama format and HuggingFace `hf.co/...` format
11. **Mode Toggle**: `/chat` and `/play` commands set `activeMode`, which overrides `settings.mode`
12. **Template Application**: Completely replaces settings except general.selectedModel

---

**Last Updated**: 2026-03-11
**Project Version**: 3.0.0 (Memory System with LangChain + MCP)
**Node Version**: 18+
**React Version**: 19.2.0
**Zustand Version**: 5.0.2
**LangChain Version**: 0.1.0
**MCP SDK Version**: 0.5.0

## Recent Major Updates

### v3.0.0 (2026-03-11) - Memory System with LangChain + MCP
- ✅ **LangChain Integration** - RAG orchestration with Ollama embeddings
- ✅ **MCP Architecture** - Model Context Protocol for standardized data access
- ✅ **Session Management** - Create, switch, and manage conversation sessions
- ✅ **Message Persistence** - All messages stored in SQLite via MCP
- ✅ **Vector Memory (RAG)** - FAISS-based semantic search with nomic-embed-text
- ✅ **Smart Context** - Automatically switches to RAG after 50 messages
- ✅ **Auto-Extraction** - AI-powered character detail extraction
- ✅ **Infinite Scroll History** - Load entire conversation history with pagination
- ✅ **Session UI** - SessionManager component with create/delete/select
- ✅ **Update Suggestions** - Modal for reviewing and applying extracted character details
- ✅ **Background Embeddings** - Automatic vector generation for all messages
- ✅ **Custom MCP Servers** - Vector store and settings tools implementations
- ✅ **19 New Files** - 13 backend services/routes, 6 frontend components
- ✅ **Documentation** - MEMORY_SYSTEM_GUIDE.md with complete testing instructions

**Key Files**:
- Backend: `services/langchainRAG.js`, `services/extractionAgent.js`, `services/mcpClient.js`
- MCP Servers: `mcp-servers/vector-store-server.js`, `mcp-servers/settings-tools-server.js`
- Frontend: `SessionManager.jsx`, `MessageHistoryViewer.jsx`, `AutoUpdateSuggestions.jsx`
- Database: SQLite schema with sessions, messages, and embeddings tables

### v2.1.0 (2026-03-11) - Oread Design System
- ✅ **Dark Theme** - Complete redesign with dark color palette (#1a1a1a backgrounds)
- ✅ **Montserrat Font** - Professional typography system (weights 300-700)
- ✅ **Teal Accent Color** - Primary color changed from blue (#3498db) to teal (#4db8a8)
- ✅ **Character Sidebar** - Left sidebar (180px) with circular avatar and character name
- ✅ **Redesigned Chat Bubbles** - 18px border-radius with cutoff corners, improved spacing
- ✅ **Pill-Shaped Input** - Rounded input field (25px border-radius) with circular send button
- ✅ **Header Redesign** - "OREAD" branding with teal dot, action buttons (♥, ⋯, ↻)
- ✅ **Track Selector** - Background ambient music selector in sidebar
- ✅ **Enhanced Animations** - Hover transforms, glows, and smooth transitions
- ✅ **Custom Scrollbars** - Thin (6px) dark scrollbars throughout
- ✅ **Settings UI Updates** - All cards and components updated for dark theme
- ✅ **Transparency Layers** - Subtle depth using rgba overlays

### v2.0.0 (2026-03-12)
- ✅ **Zustand Migration** - Centralized state management, no prop drilling
- ✅ **Comprehensive Settings System** - Roleplay and Utility modes
- ✅ **Template System** - 8 preset templates (5 roleplay + 3 utility)
- ✅ **Settings Persistence** - Individual JSON files in `/data/settings/`
- ✅ **Variable Mapping** - Dynamic system prompt generation
- ✅ **Character Management** - Single and multiple character support
- ✅ **Image Upload** - Avatar support with auto-resize
- ✅ **Mode Toggle Commands** - `/chat` and `/play` for mid-conversation switching
- ✅ **Auto-Save** - Hybrid localStorage + backend persistence (1s debounce)
- ✅ **Import/Export** - Settings backup and restore
- ✅ **Documentation** - Moved to `/docs/` folder with comprehensive guides

### v1.0.0 (2026-03-11)
- Initial release with model download and chat functionality
