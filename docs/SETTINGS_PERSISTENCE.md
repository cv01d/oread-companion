# Settings Persistence Documentation

## Overview

User settings are now persisted as **individual JSON files** in the `/data/settings/` directory. This approach separates user data from application code and makes it easy to back up, share, or manually edit settings.

---

## Directory Structure

```
/data/settings/
├── .gitkeep              # Documentation about the directory
├── mode.json             # Current mode (roleplay/normal)
├── roleplay.json         # Roleplay mode settings
├── utility.json          # Utility mode settings
├── userPersona.json      # User persona and preferences
├── general.json          # General settings (model, temperature, etc.)
└── meta.json             # Metadata (template ID, timestamps)
```

**Important**: This directory contains **ONLY user data** (JSON files). No JavaScript or application code is stored here.

---

## File Breakdown

### mode.json
Stores the current mode setting.

```json
"roleplay"
```
or
```json
"normal"
```

### roleplay.json
Contains all roleplay mode configuration.

```json
{
  "world": {
    "settingLore": "A cyberpunk city in 2077",
    "openingScene": "Neon lights flicker across rain-slicked streets",
    "narratorVoice": "Dark and gritty",
    "pacing": "Fast-paced with occasional pauses for atmosphere",
    "hardRules": ["Never speak/act for the User"],
    "turnLogic": "Stop after describing the scene/NPC reaction"
  },
  "characterMode": "single",
  "singleCharacter": {
    "identity": {
      "name": "Echo",
      "age": "25",
      "gender": "Female",
      "species": "Human",
      "profession": "Netrunner"
    },
    "core": {
      "personality": "Rebellious, clever, and resourceful",
      "backstory": "Former corporate hacker turned underground activist",
      "knowledge": "Advanced cybersecurity and network infiltration"
    },
    "dynamics": {
      "relationshipToUser": "Mentor and guide",
      "currentLocation": "Underground hideout in the lower city"
    },
    "vocalProfile": "Sarcastic with lots of technical jargon",
    "avatarImage": ""
  },
  "multipleCharacters": []
}
```

### utility.json
Contains utility/normal mode configuration.

```json
{
  "assistantIdentity": {
    "persona": "Expert technical assistant",
    "communicationStyle": "Clear and concise"
  },
  "guardrails": {
    "negativeConstraints": "Avoid technical jargon unless requested",
    "formattingPreferences": "Use markdown formatting"
  }
}
```

### userPersona.json
Stores user persona and preferences (applies across all modes).

```json
{
  "name": "Alex",
  "bio": "Software engineer interested in AI",
  "skills": "Python, JavaScript, React",
  "profession": "Full-stack developer",
  "tastes": {
    "interests": "AI, cybersecurity, sci-fi",
    "hobbies": "Reading, coding, gaming",
    "mediaPreferences": "Cyberpunk, hard sci-fi"
  },
  "linguisticFilters": {
    "bannedPhrases": [],
    "bannedWords": []
  },
  "boundaries": "Keep responses professional"
}
```

### general.json
General application settings.

```json
{
  "selectedModel": "llama2",
  "webSearch": false,
  "chatSearch": false,
  "memory": true,
  "temperature": 0.7,
  "topP": 0.9,
  "maxTokens": 2048
}
```

### meta.json
Metadata about settings (template used, modification times).

```json
{
  "templateId": "cyberpunk-hacker",
  "lastModified": "2026-03-12T04:00:49.351Z",
  "version": "1.0.0"
}
```

---

## How It Works

### On App Startup

1. **Frontend initializes** ([App.jsx](client/src/App.jsx))
   ```javascript
   useEffect(() => {
     initialize();
   }, [initialize]);
   ```

2. **Zustand store loads settings** ([useStore.js](client/src/store/useStore.js))
   ```javascript
   initialize: async () => {
     await store.loadSettings();  // Loads from backend API
     await store.checkHealth();
     await store.fetchModels();
   }
   ```

3. **Backend API reads individual files** ([settingsController.js](controllers/settingsController.js))
   ```javascript
   // For each category (mode, roleplay, utility, etc.)
   for (const [key, filePath] of Object.entries(SETTINGS_FILES)) {
     if (fs.existsSync(filePath)) {
       settings[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
     } else {
       settings[key] = DEFAULT_SETTINGS[key]; // Use defaults
     }
   }
   ```

4. **Settings loaded into Zustand store** - Available to all components

### On Settings Change

1. **User modifies settings** in Settings page
2. **Zustand auto-save triggers** (debounced 1 second)
   ```javascript
   setSettings: (newSettings) => {
     set({ settings: newSettings });
     // Save to localStorage (instant)
     localStorage.setItem('ollama-chat-settings', JSON.stringify(newSettings));
     // Save to backend API (debounced 1s)
     debouncedSave(newSettings);
   }
   ```

3. **Backend API saves to individual files**
   ```javascript
   // For each category
   for (const [key, filePath] of Object.entries(SETTINGS_FILES)) {
     fs.writeFileSync(filePath, JSON.stringify(settings[key], null, 2));
   }
   ```

---

## Persistence Strategy

**Hybrid Persistence**: Both localStorage and file-based backend

### Why Both?

1. **localStorage** (instant)
   - Immediate persistence for UI responsiveness
   - Works offline
   - Device-specific

2. **Backend API** (debounced 1s)
   - Persistent across browser sessions
   - Can be backed up
   - Can be shared across devices
   - Individual files are human-readable and editable

### Load Priority

```
App Startup
  ↓
Load from localStorage (instant, cached)
  ↓
Load from backend API (overrides if newer)
  ↓
Settings ready for use
```

---

## API Endpoints

### GET /api/settings
Load all settings from individual JSON files.

**Response**:
```json
{
  "success": true,
  "settings": {
    "mode": "roleplay",
    "roleplay": { ... },
    "utility": { ... },
    "userPersona": { ... },
    "general": { ... },
    "meta": { ... }
  }
}
```

### POST /api/settings
Save all settings to individual JSON files.

**Request**:
```json
{
  "settings": {
    "mode": "roleplay",
    "roleplay": { ... },
    "utility": { ... },
    "userPersona": { ... },
    "general": { ... },
    "meta": { ... }
  }
}
```

**Response**:
```json
{
  "success": true,
  "settings": { ... }
}
```

### DELETE /api/settings
Reset all settings to defaults (deletes all JSON files).

**Response**:
```json
{
  "success": true,
  "settings": { /* default settings */ }
}
```

---

## Manual Editing

Since settings are stored as individual JSON files, you can manually edit them:

1. **Stop the backend server** (or changes may be overwritten)
2. **Edit the desired file** in `/data/settings/`
3. **Restart the backend server**
4. **Refresh the frontend** - settings will reload from files

### Example: Change Mode

Edit `/data/settings/mode.json`:
```json
"normal"
```

### Example: Update Character

Edit `/data/settings/roleplay.json`:
```json
{
  "world": { ... },
  "characterMode": "single",
  "singleCharacter": {
    "identity": {
      "name": "Nova",  // Changed from "Echo"
      "age": "28",
      ...
    }
  }
}
```

---

## Backing Up Settings

### Backup All Settings
```bash
cp -r /data/settings /data/settings-backup-$(date +%Y%m%d)
```

### Backup Specific Category
```bash
cp /data/settings/roleplay.json /data/settings/roleplay.json.backup
```

### Export Settings (from UI)
Use the "Export Settings" button in the Settings page to download a single JSON file containing all settings.

---

## Sharing Settings

### Share All Settings
1. Click "Export Settings" in the UI
2. Send the JSON file to another user
3. They click "Import Settings" and select the file

### Share Specific Category
1. Copy the individual JSON file (e.g., `roleplay.json`)
2. Send to another user
3. They place it in their `/data/settings/` directory
4. Restart the app

---

## Troubleshooting

### Settings Not Loading

1. **Check backend server is running**
   ```bash
   curl http://localhost:3001/api/settings
   ```

2. **Check file permissions**
   ```bash
   ls -la /data/settings/
   ```

3. **Check for JSON syntax errors**
   ```bash
   cat /data/settings/roleplay.json | python3 -m json.tool
   ```

### Settings Not Saving

1. **Check browser console** for save confirmations
2. **Check backend logs** for errors
3. **Verify directory exists**
   ```bash
   mkdir -p /data/settings
   ```

### Corrupted Settings

**Reset to defaults**:
```bash
rm /data/settings/*.json
```
or use "Reset to Defaults" button in UI.

---

## File Structure Reference

```javascript
// controllers/settingsController.js
const SETTINGS_FILES = {
  mode: 'data/settings/mode.json',
  roleplay: 'data/settings/roleplay.json',
  utility: 'data/settings/utility.json',
  userPersona: 'data/settings/userPersona.json',
  general: 'data/settings/general.json',
  meta: 'data/settings/meta.json'
};
```

---

## Benefits of This Approach

1. **User Data Separation**: No JavaScript code in settings directory
2. **Human Readable**: JSON files can be viewed and edited manually
3. **Granular Control**: Each category in its own file
4. **Easy Backup**: Copy entire `/data/settings/` directory
5. **Version Control**: Can track settings changes with git
6. **Portable**: Share individual categories or entire settings
7. **Debugging**: Easy to inspect what's saved without reading localStorage
8. **Cross-Device**: Settings can sync via backend (if using shared storage)

---

**Last Updated**: 2026-03-12
**Related Files**:
- [controllers/settingsController.js](controllers/settingsController.js) - Backend logic
- [client/src/store/useStore.js](client/src/store/useStore.js) - Frontend state management
- [ZUSTAND_MIGRATION.md](ZUSTAND_MIGRATION.md) - Zustand store documentation
