# Plan: Comprehensive Settings System with Roleplay/Non-Roleplay Modes

## Overview
Build a comprehensive settings page that supports two distinct modes:
1. **Roleplay Mode** - For creative storytelling with world-building, character management, and narrative controls
2. **Non-Roleplay/Utility Mode** - For assistant-based interactions with custom persona and communication preferences

Additionally, implement user persona settings, general app settings, and persistence layer for all configurations.

## Current State Analysis

### Existing Architecture
- **State Management**: Centralized in App.jsx (simple useState pattern)
- **Styling**: SCSS with BEM methodology in single `global.scss` file
- **Components**: 13 components organized by category (ui/, chat/, model/, layout/, pages/)
- **API**: 4 REST/SSE endpoints (health, models list, model pull, chat)
- **No Persistence**: Settings currently reset on page reload

### Key Files
- [App.jsx](client/src/App.jsx) - Root component with all state (181 lines)
- [Settings.jsx](client/src/pages/Settings.jsx) - Current settings page (model management only)
- [global.scss](client/src/styles/global.scss) - All styles (595 lines)
- [server.js](server.js) - Backend API (99 lines)
- [services/ollama.js](services/ollama.js) - Ollama service wrapper

## Implementation Plan

### Phase 1: Data Architecture & Persistence

#### 1.1 Settings State Structure
Create comprehensive settings state object in App.jsx:

```javascript
const [settings, setSettings] = useState({
  // Mode Selection
  mode: 'normal', // 'normal' | 'roleplay'

  // Roleplay Settings
  roleplay: {
    world: {
      settingLore: '',
      openingScene: '',
      narratorVoice: '',
      pacing: '',
      hardRules: ['Never speak/act for the User'],
      turnLogic: 'Stop after describing the scene/NPC reaction'
    },
    characterMode: 'single', // 'single' | 'multiple'
    singleCharacter: {
      identity: { name: '', age: '', gender: '', species: '', profession: '' },
      core: { personality: '', backstory: '', knowledge: '' },
      dynamics: { relationshipToUser: '', currentLocation: '' },
      vocalProfile: '',
      avatarImage: '' // Base64 encoded image or URL
    },
    multipleCharacters: [
      // Array of character objects with same structure + motivation/secrets + avatarImage
    ]
  },

  // Non-Roleplay/Utility Settings
  utility: {
    assistantIdentity: {
      persona: '',
      communicationStyle: ''
    },
    guardrails: {
      negativeConstraints: '',
      formattingPreferences: ''
    }
  },

  // User Persona Settings
  userPersona: {
    name: '',
    bio: '',
    skills: '',
    profession: '',
    tastes: {
      interests: '',
      hobbies: '',
      mediaPreferences: ''
    },
    linguisticFilters: {
      bannedPhrases: [],
      bannedWords: []
    },
    boundaries: ''
  },

  // General Settings
  general: {
    selectedModel: null,
    webSearch: false,
    chatSearch: false,
    memory: true,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2048
  },

  // Metadata
  meta: {
    templateId: null, // 'fantasy-tavern' | 'companion-roleplay' | 'expert-tutor' | etc. | null (custom)
    lastModified: null,
    version: '1.0.0'
  }
});
```

#### 1.2 Persistence Layer (Hybrid Approach: localStorage + Backend API)

**Strategy**: Use BOTH localStorage AND backend API for optimal UX and cross-device sync
- **localStorage**: Immediate save/load for responsive UX, offline support, instant feedback
- **Backend API**: Sync to server for cross-device access, data backup

**Implementation Flow**:
1. **On App Init**:
   - Try to load from backend API first (`GET /api/settings`)
   - If backend unavailable or returns 404, fallback to localStorage
   - If both exist and differ, use most recent (compare `meta.lastModified` timestamp)

2. **On Settings Change**:
   - Save to localStorage IMMEDIATELY (instant, no delay)
   - Debounce save to backend API (1 second delay after last change to avoid spam)
   - Update `meta.lastModified` timestamp on each save

3. **Image Handling**:
   - Avatar images stored as base64 in both localStorage and backend
   - Max image size: 512x512px (resize larger images client-side before storing)
   - Total localStorage budget: ~5MB (browser limit), recommend max 20 characters with avatars

#### 1.3 Backend Settings API

**Endpoints**:
- `GET /api/settings` - Load user settings from server (returns settings JSON)
- `POST /api/settings` - Save user settings to server (accepts settings JSON in body)
- `DELETE /api/settings` - Reset to defaults (delete saved file, returns empty settings)

**Storage**: File-based JSON storage at `server/data/settings.json`
- Simple file system approach (no database needed for MVP)
- One settings object (no multi-user support yet, future enhancement)
- Create `server/data/` directory if it doesn't exist

**Files to Create/Modify**:
- [App.jsx](client/src/App.jsx) - Add settings state, persistence logic, hybrid load/save
- New: `client/src/utils/settingsStorage.js` - localStorage wrapper functions
- New: `client/src/utils/settingsAPI.js` - Backend API client (fetch calls)
- New: `client/src/utils/imageProcessor.js` - Image resize/base64 conversion
- New: `server/routes/settings.js` - Settings API routes
- New: `server/controllers/settingsController.js` - Settings business logic
- New: `server/data/settings.json` - Storage file (created automatically)

---

### Phase 2: UI Component Architecture

#### 2.1 Create Reusable Settings Components

##### Core Components (in `client/src/components/settings/`)

1. **SettingsSection.jsx**
   - Reusable container for grouped settings
   - Props: title, description, children, collapsible (optional)
   - BEM: `.settings-section`, `.settings-section__header`, `.settings-section__content`

2. **ModeSelector.jsx**
   - Toggle between Roleplay/Normal modes
   - Visual tabs or radio buttons
   - Props: currentMode, onChange
   - BEM: `.mode-selector`, `.mode-selector__option`, `.mode-selector__option--active`

3. **TextArea.jsx** (new UI primitive)
   - Multi-line text input for long-form content (lore, backstory, etc.)
   - Props: value, onChange, placeholder, rows, disabled
   - BEM: `.text-area`, `.text-area--disabled`

4. **TagInput.jsx** (new UI primitive)
   - Input for managing lists (banned words/phrases, personality traits)
   - Add/remove tags dynamically
   - Props: tags (array), onAdd, onRemove, placeholder
   - BEM: `.tag-input`, `.tag-input__list`, `.tag-input__tag`, `.tag-input__remove`

5. **ImageUpload.jsx** (new UI primitive)
   - Image upload/preview component for character avatars
   - Supports: file upload, drag-and-drop, URL input
   - Auto-resizes images to max 512x512px
   - Converts to base64 for storage
   - Shows preview thumbnail with remove button
   - Props: value (base64 or URL), onChange, onRemove, maxSizeKB (default: 500)
   - BEM: `.image-upload`, `.image-upload__preview`, `.image-upload__input`, `.image-upload__dropzone`, `.image-upload__remove`

6. **CharacterEditor.jsx**
   - Complex component for editing single character profile
   - Uses TextField, TextArea, ImageUpload for all character fields (including avatar)
   - Props: character (object), onChange
   - BEM: `.character-editor`, `.character-editor__section`, `.character-editor__avatar`
   - BEM: `.character-editor`, `.character-editor__section`

7. **CharacterList.jsx**
   - Manages multiple characters (add/remove/edit)
   - Shows character cards, click to expand editor
   - Props: characters (array), onAddCharacter, onEditCharacter, onRemoveCharacter
   - BEM: `.character-list`, `.character-list__card`, `.character-list__card-avatar`, `.character-list__add-btn`

##### Advanced Components

8. **TemplateSelector.jsx**
   - Dropdown or card grid for selecting preset templates
   - Shows template preview (name, description, character preview)
   - Props: templates (array), selectedTemplateId, onSelect
   - Displays all 8 preset templates (5 roleplay + 3 utility)
   - BEM: `.template-selector`, `.template-selector__card`, `.template-selector__preview`, `.template-selector__description`

9. **WorldSettingsPanel.jsx**
   - Form for world/narrative settings (lore, opening scene, narrator voice)
   - Uses TextArea components
   - BEM: `.world-settings`

10. **UtilitySettingsPanel.jsx**
   - Form for assistant identity and guardrails
   - Uses TextArea, TextField
   - BEM: `.utility-settings`

11. **UserPersonaPanel.jsx**
   - Form for user information and preferences
   - Uses TextField, TextArea, TagInput
   - BEM: `.user-persona`

12. **GeneralSettingsPanel.jsx**
    - Model selection, toggles for features (web search, memory)
    - Sliders for temperature/topP
    - Uses ModelSelector, Dropdown, range inputs
    - BEM: `.general-settings`

**Files to Create**:
- `client/src/components/settings/SettingsSection.jsx`
- `client/src/components/settings/ModeSelector.jsx`
- `client/src/components/settings/TemplateSelector.jsx`
- `client/src/components/ui/TextArea.jsx`
- `client/src/components/ui/TagInput.jsx`
- `client/src/components/ui/ImageUpload.jsx`
- `client/src/components/settings/CharacterEditor.jsx`
- `client/src/components/settings/CharacterList.jsx`
- `client/src/components/settings/WorldSettingsPanel.jsx`
- `client/src/components/settings/UtilitySettingsPanel.jsx`
- `client/src/components/settings/UserPersonaPanel.jsx`
- `client/src/components/settings/GeneralSettingsPanel.jsx`

#### 2.2 Rebuild Settings Page

Completely redesign [Settings.jsx](client/src/pages/Settings.jsx):

**Structure**:
```jsx
<div className="settings">
  {/* Template Selection - Shows all 8 presets */}
  <TemplateSelector
    templates={availableTemplates}
    selectedTemplateId={settings.meta.templateId}
    onSelect={handleTemplateSelect}
  />

  <ModeSelector currentMode={settings.mode} onChange={handleModeChange} />

  {settings.mode === 'roleplay' && (
    <>
      <WorldSettingsPanel world={settings.roleplay.world} onChange={handleWorldChange} />

      <SettingsSection title="Character Configuration">
        <Dropdown
          value={settings.roleplay.characterMode}
          options={[{value: 'single', label: 'Single Character'}, {value: 'multiple', label: 'Multiple Characters'}]}
          onChange={handleCharacterModeChange}
        />

        {settings.roleplay.characterMode === 'single' ? (
          <CharacterEditor character={settings.roleplay.singleCharacter} onChange={handleCharacterChange} />
        ) : (
          <CharacterList
            characters={settings.roleplay.multipleCharacters}
            onAddCharacter={handleAddCharacter}
            onEditCharacter={handleEditCharacter}
            onRemoveCharacter={handleRemoveCharacter}
          />
        )}
      </SettingsSection>
    </>
  )}

  {settings.mode === 'normal' && (
    <UtilitySettingsPanel utility={settings.utility} onChange={handleUtilityChange} />
  )}

  <UserPersonaPanel persona={settings.userPersona} onChange={handlePersonaChange} />
  <GeneralSettingsPanel general={settings.general} onChange={handleGeneralChange} />

  <div className="settings__actions">
    <Button variant="secondary" onClick={handleReset}>Reset to Defaults</Button>
    <Button variant="primary" onClick={handleSave}>Save Settings</Button>
  </div>
</div>
```

**Files to Modify**:
- [client/src/pages/Settings.jsx](client/src/pages/Settings.jsx) - Complete rebuild

---

### Phase 3: Styling

#### 3.1 Add SCSS to global.scss

Following existing BEM patterns, add new sections for:

1. **Template Selector** (`.template-selector`, `.template-selector__card`, `.template-selector__preview`, `.template-selector__description`)
2. **Mode Selector** (`.mode-selector`, `.mode-selector__option`, `.mode-selector__option--active`)
3. **Text Area** (`.text-area`, `.text-area--disabled`)
4. **Tag Input** (`.tag-input`, `.tag-input__list`, `.tag-input__tag`, `.tag-input__remove`)
5. **Image Upload** (`.image-upload`, `.image-upload__preview`, `.image-upload__dropzone`, `.image-upload__remove`, `.image-upload__thumbnail`)
6. **Character Editor** (`.character-editor`, `.character-editor__section`, `.character-editor__field`, `.character-editor__avatar`)
7. **Character List** (`.character-list`, `.character-list__card`, `.character-list__card-avatar`, `.character-list__add-btn`)
8. **Settings Panels** (`.world-settings`, `.utility-settings`, `.user-persona`, `.general-settings`)
9. **Settings Actions** (`.settings__actions`)

#### 3.2 Design Considerations
- Use existing SCSS variables for colors and spacing
- Responsive design for mobile/tablet
- Visual distinction between Roleplay and Normal modes (consider different accent colors)
- Collapsible sections for better UX (world settings, character editor sections)
- Form validation states (error borders, success indicators)
- **Avatar display**: Circular thumbnails for character avatars (64x64px in lists, 128x128px in editor)
- **Drag-and-drop visual feedback**: Dashed border on dropzone, highlight on drag-over

**Files to Modify**:
- [client/src/styles/global.scss](client/src/styles/global.scss) - Add ~350-400 lines of new styles (includes ImageUpload, TemplateSelector with card grid)

---

### Phase 4: Backend Integration

#### 4.1 Modify Chat API to Accept Settings

Update `/api/chat` endpoint in [server.js](server.js) to accept additional parameters:

**New Request Body**:
```javascript
{
  model: string,
  messages: array,
  systemPrompt: string,      // Constructed from settings
  temperature: number,
  topP: number,
  maxTokens: number
}
```

#### 4.2 Preset Templates

Create preset template definitions in `client/src/data/templates.js`:

**Template Structure**:
```javascript
{
  id: 'fantasy-tavern',
  name: 'Fantasy Tavern',
  description: 'Classic fantasy RPG setting in a bustling tavern',
  mode: 'roleplay',
  settings: {
    roleplay: {
      world: {
        settingLore: 'Medieval fantasy world with magic...',
        openingScene: 'You push open the heavy oak door...',
        narratorVoice: 'Third-person limited, immersive fantasy prose',
        // ... full settings object
      },
      characterMode: 'single',
      singleCharacter: {
        identity: { name: 'Elara', age: '28', gender: 'Female', species: 'Human', profession: 'Tavern Keeper' },
        avatarImage: '/assets/avatars/elara.jpg', // Default avatar
        // ... full character
      }
    }
  }
}
```

**Preset Templates to Include (8 total)**:

**Roleplay Templates (5)**:
1. **Fantasy Tavern** (Roleplay - Single Character)
   - Character: Elara, 28, Human Female Tavern Keeper
   - Setting: Medieval fantasy tavern with adventurers
   - Narrator Voice: Third-person limited, immersive fantasy prose

2. **Sci-Fi Explorer** (Roleplay - Single Character)
   - Character: Commander Zara, 35, Alien Species (Velerian), Space Captain
   - Setting: Deep space station on the edge of known territory
   - Narrator Voice: Cinematic sci-fi, wonder and exploration

3. **Detective Noir** (Roleplay - Single Character)
   - Character: Jack Marlowe, 42, Human Male Private Investigator
   - Setting: 1940s Los Angeles, crime-ridden city streets
   - Narrator Voice: Gritty noir, first-person perspective

4. **Cyberpunk Hacker** (Roleplay - Single Character)
   - Character: Nova, 24, Human (Augmented) Netrunner
   - Setting: Neo-Tokyo 2089, neon-lit megacity
   - Narrator Voice: Fast-paced cyberpunk, tech-heavy

5. **Companion Roleplay** (Roleplay - Single Character) ⭐ NEW
   - Character: Alex, 26, Human (Gender-neutral/customizable), Supportive Friend
   - Identity: Warm, empathetic companion focused on emotional support
   - Personality: Kind, understanding, good listener, emotionally intelligent
   - Relationship: Close friend who knows user well, supportive presence
   - Vocal Profile: Warm, conversational, uses casual language
   - Setting: Modern day, adaptable location (coffee shop, park, home)
   - Narrator Voice: First-person casual, intimate and personal

**Non-Roleplay/Utility Templates (3)**:

6. **Expert Tutor** (Non-Roleplay) ⭐ NEW
   - Mode: Normal/Utility
   - Persona: Patient, knowledgeable educational assistant
   - Communication Style: Clear explanations with examples, uses analogies, breaks down complex topics
   - Guardrails: Focuses on teaching concepts rather than just giving answers, encourages critical thinking
   - Formatting: Uses bullet points for lists, code blocks for technical content, step-by-step instructions

7. **Code Review Partner** (Non-Roleplay) ⭐ NEW
   - Mode: Normal/Utility
   - Persona: Senior software engineer with 10+ years experience
   - Communication Style: Concise, technical, bullet-point feedback, direct but constructive
   - Guardrails: Focuses on best practices, security, performance, maintainability
   - Formatting: Uses markdown code blocks, highlights specific line numbers, suggests improvements with examples

8. **Research Assistant** (Non-Roleplay) ⭐ NEW
   - Mode: Normal/Utility
   - Persona: Thorough academic research assistant with expertise in literature review and source synthesis
   - Communication Style: Analytical, well-structured, citation-focused, comprehensive yet concise
   - Guardrails: Prioritizes credible sources, fact-checks claims, distinguishes between evidence and speculation
   - Formatting: Uses citations, organizes findings into themes, provides summaries with key takeaways

**Files to Create**:
- `client/src/data/templates.js` - Template definitions with all 8 templates (5 roleplay + 3 utility)
- `client/src/assets/avatars/` - Default avatar images for characters (optional, 5 images)

#### 4.3 System Prompt Generation

Create utility function to build system prompts from settings (AUTO-GENERATED, not user-editable):

**For Roleplay Mode**:
```
System Prompt =
  [World/Setting Lore]
  [Opening Scene]
  [Narrator Voice Instructions]
  [Pacing & Constraints]
  [Character Information (name, personality, backstory, vocal profile, relationship)]
  [User Persona Information]
```

**For Normal Mode**:
```
System Prompt =
  [Assistant Identity/Persona]
  [Communication Style]
  [Guardrails & Constraints]
  [Formatting Preferences]
  [User Persona Information]
```

**Important**: System prompts are generated internally and NOT shown to users in the UI.

Create function in `client/src/utils/promptBuilder.js`

#### 4.3 Update Ollama Service

Modify [services/ollama.js](services/ollama.js) to pass system prompt and parameters to Ollama:

```javascript
async chat(model, messages, options = {}) {
  const { systemPrompt, temperature, topP, maxTokens } = options;

  // Prepend system message if systemPrompt provided
  const fullMessages = systemPrompt
    ? [{role: 'system', content: systemPrompt}, ...messages]
    : messages;

  return await this.ollama.chat({
    model,
    messages: fullMessages,
    stream: true,
    options: {
      temperature,
      top_p: topP,
      num_predict: maxTokens
    }
  });
}
```

**Files to Create/Modify**:
- New: `client/src/utils/promptBuilder.js` - System prompt construction logic
- [server.js](server.js) - Update `/api/chat` endpoint to accept new parameters
- [services/ollama.js](services/ollama.js) - Update `chat()` method
- [App.jsx](client/src/App.jsx) - Update `handleSendMessage()` to send settings

---

### Phase 5: Integration & State Management

#### 5.1 Settings Context (Optional Enhancement)

If settings state becomes too large for App.jsx, create React Context:

```javascript
// client/src/contexts/SettingsContext.jsx
const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  // ... persistence logic
  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
```

**Decision Point**: Only create Context if App.jsx exceeds ~300 lines.

#### 5.2 Update Chat Flow

Modify [App.jsx](client/src/App.jsx) `handleSendMessage()` function:

```javascript
const handleSendMessage = async (content) => {
  // Build system prompt from settings
  const systemPrompt = buildSystemPrompt(settings);

  // Send to API with settings
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.general.selectedModel,
      messages: [...messages, { role: 'user', content }],
      systemPrompt,
      temperature: settings.general.temperature,
      topP: settings.general.topP,
      maxTokens: settings.general.maxTokens
    })
  });

  // ... streaming response handling
};
```

#### 5.3 Settings Reset & Import/Export

Add utility functions for:
- **Reset to Defaults** - Restore default settings object
- **Export Settings** - Download as JSON file
- **Import Settings** - Upload JSON file to restore settings

**Files to Create**:
- `client/src/utils/settingsImportExport.js` - Import/export utilities

---

### Phase 6: Validation & Error Handling

#### 6.1 Form Validation

Create validation utilities:
- Required field checking
- Character name uniqueness
- Banned words format validation
- Numeric range validation (temperature: 0-2, topP: 0-1)

**Files to Create**:
- `client/src/utils/settingsValidation.js` - Validation functions

#### 6.2 User Feedback

- Show validation errors inline with form fields
- Success toast/notification on save
- Warning before resetting to defaults
- Confirmation before deleting characters

---

## Critical Files Summary

### Files to Create (25 new files)

**Components** (12):
1. `client/src/components/settings/SettingsSection.jsx`
2. `client/src/components/settings/ModeSelector.jsx`
3. `client/src/components/settings/TemplateSelector.jsx`
4. `client/src/components/ui/TextArea.jsx`
5. `client/src/components/ui/TagInput.jsx`
6. `client/src/components/ui/ImageUpload.jsx`
7. `client/src/components/settings/CharacterEditor.jsx`
8. `client/src/components/settings/CharacterList.jsx`
9. `client/src/components/settings/WorldSettingsPanel.jsx`
10. `client/src/components/settings/UtilitySettingsPanel.jsx`
11. `client/src/components/settings/UserPersonaPanel.jsx`
12. `client/src/components/settings/GeneralSettingsPanel.jsx`

**Data & Utilities** (7):
13. `client/src/data/templates.js` - 8 preset templates (5 roleplay + 3 utility)
14. `client/src/utils/settingsStorage.js` - localStorage wrapper
15. `client/src/utils/settingsAPI.js` - Backend API client (fetch calls)
16. `client/src/utils/promptBuilder.js` - System prompt generator (auto-generated)
17. `client/src/utils/settingsImportExport.js` - Import/export JSON
18. `client/src/utils/settingsValidation.js` - Form validation
19. `client/src/utils/imageProcessor.js` - Image resize, base64 conversion

**Optional Context** (1):
20. `client/src/contexts/SettingsContext.jsx` (only if App.jsx becomes too large >300 lines)

**Backend** (5):
21. `server/routes/settings.js` - Settings API routes (GET, POST, DELETE)
22. `server/controllers/settingsController.js` - Settings business logic
23. `server/models/Settings.js` - Settings data model/schema
24. `server/data/` - Directory for data storage
25. `server/data/settings.json` - File-based storage (created automatically)

**Optional Assets**:
- `client/src/assets/avatars/` - Default character avatars for templates (5 images: elara.jpg, zara.jpg, marlowe.jpg, nova.jpg, alex.jpg)

### Files to Modify (5 existing files)

1. **[client/src/App.jsx](client/src/App.jsx)**
   - Add `settings` state
   - Add persistence logic
   - Update `handleSendMessage()` to use settings
   - Pass settings to Settings page

2. **[client/src/pages/Settings.jsx](client/src/pages/Settings.jsx)**
   - Complete rebuild with new component structure

3. **[client/src/styles/global.scss](client/src/styles/global.scss)**
   - Add ~350-400 lines of new component styles (includes ImageUpload, TemplateSelector with card grid, avatar styling)

4. **[server.js](server.js)**
   - Update `/api/chat` endpoint to accept settings parameters (systemPrompt, temperature, topP, maxTokens)
   - Add `/api/settings` routes (GET, POST, DELETE) or import from routes/settings.js

5. **[services/ollama.js](services/ollama.js)**
   - Update `chat()` method to accept options (systemPrompt, temperature, etc.)

---

## Implementation Order

### Stage 1: Foundation (Core Infrastructure)
1. Create settings state structure in App.jsx with metadata fields (`meta.templateId`, `meta.lastModified`, `meta.version`)
2. Create backend settings API (routes, controller, file storage in `server/data/settings.json`)
3. Implement localStorage persistence utilities (`settingsStorage.js`)
4. Implement backend API client (`settingsAPI.js`)
5. Add hybrid persistence logic to App.jsx (try backend first, fallback to localStorage, debounced saves)
6. Create basic UI primitives (TextArea, TagInput, ImageUpload with resize/base64 conversion)
7. Create image processor utility (`imageProcessor.js`)
8. Update global.scss with base component styles for new primitives

### Stage 2: Templates & Mode Selection
1. Create preset template definitions in `client/src/data/templates.js` (all 8 templates with full settings objects)
   - **Roleplay**: Fantasy Tavern, Sci-Fi Explorer, Detective Noir, Cyberpunk Hacker, Companion Roleplay
   - **Utility**: Expert Tutor, Code Review Partner, Research Assistant
2. Create TemplateSelector component (card grid display with preview)
3. Create ModeSelector component (Roleplay/Normal toggle)
4. Create SettingsSection wrapper component (collapsible sections)
5. Build GeneralSettingsPanel (model selection, temperature/topP sliders, toggles)
6. Test template loading, mode switching, and persistence (localStorage + backend sync)
7. Verify cross-device sync (save on one browser session, load on another)

### Stage 3: Roleplay Components with Avatar Support
1. Create WorldSettingsPanel (lore, opening scene, narrator voice, pacing)
2. Create CharacterEditor component with ImageUpload integration for avatars
3. Test avatar upload (file upload, drag-and-drop, URL input, auto-resize to 512x512)
4. Create CharacterList component (multiple character mode with avatar thumbnails)
5. Add character management logic to App.jsx (add/edit/delete, validate uniqueness)
6. Test single/multiple character modes with image uploads
7. Verify base64 storage in both localStorage and backend

### Stage 4: Utility & User Persona
1. Create UtilitySettingsPanel (assistant persona, communication style, guardrails, formatting)
2. Create UserPersonaPanel with TagInput for banned words/phrases
3. Add validation utilities (`settingsValidation.js`)
4. Test all settings panels with validation feedback (inline errors, success states)
5. Test linguistic filters (banned words added to user persona)

### Stage 5: Backend Integration & Prompt Generation
1. Create promptBuilder utility (`promptBuilder.js`) - auto-generated system prompts
2. Implement prompt building for Roleplay mode (world + character + user persona)
3. Implement prompt building for Normal mode (assistant identity + guardrails + user persona)
4. Update server.js `/api/chat` endpoint to accept systemPrompt, temperature, topP, maxTokens
5. Update Ollama service chat method to use system prompts and parameters
6. Update App.jsx handleSendMessage to build and send settings with each chat request
7. Test end-to-end flows:
   - Template → Settings → System Prompt → Chat Response
   - Roleplay mode produces narrative responses following character personality
   - Normal mode produces utility responses following assistant persona
   - Banned words are not present in responses

### Stage 6: Polish & Enhancements
1. Add import/export functionality (JSON download/upload)
2. Add reset to defaults with confirmation modal
3. Add form validation and error states (required fields, character name uniqueness)
4. Add loading states and success notifications (toast on save, loading spinner on template load)
5. Optimize image upload (enforce max size 500KB, show file size warnings)
6. Test localStorage size limits (verify max 20 characters with avatars)
7. Responsive design improvements for mobile (stack settings panels, touch-friendly controls)
8. Test cross-device sync edge cases (conflicting changes, network failures)
9. (Optional) Create SettingsContext if App.jsx exceeds 300 lines

---

## Testing Strategy

### Manual Testing Checklist

**Settings Persistence**:
- [ ] Settings save to localStorage on change
- [ ] Settings load from localStorage on app mount
- [ ] Reset to defaults works correctly

**Roleplay Mode**:
- [ ] Mode selector switches correctly
- [ ] World settings panel displays and saves
- [ ] Single character mode works (all fields)
- [ ] Multiple character mode works (add/edit/delete)
- [ ] Character data persists correctly

**Normal Mode**:
- [ ] Utility settings panel displays and saves
- [ ] Assistant identity and guardrails work

**User Persona**:
- [ ] All user persona fields save
- [ ] Tag input for banned words/phrases works
- [ ] Linguistic filters apply correctly

**General Settings**:
- [ ] Model selection dropdown works
- [ ] Temperature/topP sliders work
- [ ] Toggle switches (web search, memory) work

**Chat Integration**:
- [ ] System prompt generated correctly from settings
- [ ] Chat uses selected model from settings
- [ ] Temperature/topP parameters applied to responses
- [ ] Roleplay mode produces appropriate responses
- [ ] Normal mode produces appropriate responses

**Import/Export**:
- [ ] Export downloads valid JSON file
- [ ] Import loads settings from JSON file
- [ ] Invalid JSON shows error message

### Edge Cases
- Empty/null values in settings
- Very long text in text areas (10,000+ characters)
- Special characters in banned words
- Multiple characters with same name
- Switching modes with unsaved changes

---

## Verification Steps (Post-Implementation)

### End-to-End Flow Testing

**Roleplay Mode Flow**:
1. Open Settings page
2. Select "Roleplay" mode
3. Fill in world/lore information
4. Create single character with full profile
5. Add user persona information
6. Save settings
7. Navigate to Chat page
8. Send message
9. Verify AI response follows roleplay instructions (narrator voice, character behavior)
10. Refresh page
11. Verify settings persisted

**Normal Mode Flow**:
1. Open Settings page
2. Select "Normal" mode
3. Define assistant persona (e.g., "Expert Code Reviewer")
4. Set communication style (e.g., "Concise, bullet-point heavy")
5. Add formatting preferences
6. Add banned words to user persona
7. Save settings
8. Navigate to Chat page
9. Send message
10. Verify AI response follows utility assistant instructions
11. Verify banned words not present in response

**Multi-Character Roleplay Flow**:
1. Open Settings, select Roleplay mode
2. Change character mode to "Multiple Characters"
3. Add 3 characters with distinct personalities
4. Define relationship dynamics between characters and user
5. Save settings
6. Navigate to Chat
7. Send message that should trigger specific character response
8. Verify character speaks with correct vocal profile and personality

---

## Technical Considerations

### Performance
- Settings object in localStorage limited to ~5-10MB (browser dependent)
- Consider debouncing auto-save on text input changes
- Large character lists (50+) may need virtualization

### Accessibility
- All form inputs need proper labels
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader support (aria-labels, roles)
- Focus management in modals/dropdowns

### Browser Compatibility
- localStorage available in all modern browsers
- Test in Chrome, Firefox, Safari, Edge

### Future Enhancements (Out of Scope for Initial Implementation)
- Cloud sync for settings across devices
- Settings presets/templates
- Community-shared character cards
- Voice selection for TTS integration
- Memory/RAG integration for long-term context
- Multi-language support
- Dark mode toggle

---

## Success Criteria

This implementation will be considered complete when:

1. ✅ **Templates**: All 8 preset templates load correctly (5 roleplay + 3 utility)
   - Fantasy Tavern, Sci-Fi Explorer, Detective Noir, Cyberpunk Hacker templates work
   - **Companion Roleplay** template works (Alex character with supportive personality)
   - **Expert Tutor**, **Code Review Partner**, and **Research Assistant** utility templates work

2. ✅ **Mode Switching**: Users can switch between Roleplay and Normal modes seamlessly

3. ✅ **Settings Categories**: All settings categories fully functional
   - World/Narrative settings (lore, opening scene, narrator voice, pacing)
   - Character settings (single/multiple modes)
   - Utility settings (assistant persona, communication style, guardrails)
   - User Persona settings (bio, tastes, banned words/phrases)
   - General settings (model, temperature, topP, maxTokens, toggles)

4. ✅ **Persistence - Hybrid Approach**:
   - Settings save to localStorage immediately on change
   - Settings save to backend API (debounced, 1s delay)
   - Settings load from backend on app init, fallback to localStorage
   - Cross-device sync works (save on device A, load on device B)
   - Conflict resolution works (uses most recent `meta.lastModified`)

5. ✅ **Character Avatars**:
   - Avatar upload works (file upload, drag-and-drop, URL input)
   - Images auto-resize to max 512x512px before storage
   - Images stored as base64 in both localStorage and backend
   - Avatar thumbnails display correctly (64x64 in lists, 128x128 in editor)
   - Avatar images load with template characters

6. ✅ **System Prompts** (Auto-Generated):
   - System prompts correctly generated from settings (NOT shown to user)
   - Roleplay mode includes world + character + user persona
   - Normal mode includes assistant identity + guardrails + user persona
   - System prompts sent to Ollama with each chat request

7. ✅ **Chat Integration**:
   - Chat uses selected model from general settings
   - Temperature/topP/maxTokens parameters applied correctly
   - **Roleplay mode** produces appropriate narrative responses (follows narrator voice, character personality, vocal profile)
   - **Normal mode** produces appropriate utility responses (follows assistant persona, communication style)
   - Banned words from user persona are not present in AI responses
   - Companion roleplay template produces warm, empathetic responses

8. ✅ **Character Management**:
   - Single character mode works (all fields including avatar)
   - Multiple character mode works (add/edit/delete characters with avatars)
   - Character name uniqueness validation works

9. ✅ **Import/Export**: Settings export to JSON file and import from JSON file

10. ✅ **Reset to Defaults**: Reset functionality works with confirmation, clears both localStorage and backend

11. ✅ **UI/UX**:
    - All components follow existing BEM/SCSS patterns
    - Responsive design works on mobile/tablet/desktop
    - Form validation provides clear inline feedback
    - Loading states and success notifications work
    - Drag-and-drop visual feedback for image upload

12. ✅ **No Regressions**: Existing chat/model management functionality still works correctly

---

## Timeline Estimate (for reference, not a commitment)

This is a complex feature with many components. Breaking it into stages:
- **Stage 1-2 (Foundation + Mode Selection)**: Establishes infrastructure
- **Stage 3-4 (Roleplay + Utility panels)**: Core functionality
- **Stage 5 (Backend Integration)**: Makes settings functional in chat
- **Stage 6 (Polish)**: User experience refinements

---

## Notes

- **Persistence Strategy**: HYBRID approach with both localStorage (instant saves) AND backend API (cross-device sync), as per user preference
- **Avatar Images**: Image upload support included with auto-resize to 512x512px and base64 storage
- **System Prompts**: AUTO-GENERATED only (not user-editable), as per user preference
- **Templates**: 8 preset templates included (5 roleplay + 3 utility), as per user requirement:
  - **Companion Roleplay template** (Alex character) added for relationship-focused interactions
  - **Expert Tutor**, **Code Review Partner**, and **Research Assistant** utility templates added for non-roleplay use
- Settings Context is marked optional - only create if App.jsx becomes too large (>300 lines)
- The system prompt builder is critical - it translates settings into effective instructions for the LLM
- Character management with avatar support is the most complex UI component - may need iteration based on UX feedback
- Validation should be user-friendly (show errors inline, not blocking)
- Image upload should handle errors gracefully (invalid formats, oversized files, network failures)

---

## User Requirements Summary (Implemented)

This plan addresses all user requirements:

✅ **Roleplay Settings**:
- World & Narrative (setting/lore, opening scene, narrator voice, pacing, hard rules)
- Single character mode with full profile (identity, core, dynamics, vocal profile, **avatar image**)
- Multiple character mode (repeatable character profiles with avatars, motivation, secrets)

✅ **Non-Roleplay/Utility Settings**:
- Assistant Identity (persona, communication style)
- Guardrails & Preferences (negative constraints, formatting preferences)

✅ **User Persona Settings**:
- Name, Bio, Skills, Profession
- Tastes & Context (interests, hobbies, media preferences)
- Linguistic Filters (banned words/phrases)
- Boundaries

✅ **General Settings**:
- Model selection
- Web search, Chat search, Memory toggles
- Temperature, topP, maxTokens parameters

✅ **Preset Templates** (User-requested):
- **Companion Roleplay** template with default single character (Alex)
- **Non-roleplay examples**: Expert Tutor, Code Review Partner, Research Assistant
- 4 additional roleplay templates (Fantasy Tavern, Sci-Fi, Detective, Cyberpunk)

✅ **Image Upload** (User-requested):
- Character avatar images supported
- File upload, drag-and-drop, URL input
- Auto-resize and base64 storage

✅ **Backend API + localStorage** (User-requested):
- Hybrid persistence for cross-device sync
- Debounced backend saves
- Instant localStorage saves

✅ **Auto-Generated System Prompts** (User-requested):
- System prompts built automatically from settings
- NOT shown or editable by user
- Different prompts for roleplay vs normal mode

---

**End of Plan**
