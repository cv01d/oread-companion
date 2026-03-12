# How Settings Work - User Guide

## 📝 Overview

Your Ollama Chat settings are **automatically saved** - you don't need to click a "Save" button!

---

## 🔄 Automatic Saving

### How It Works

Every time you make a change in the Settings page, the system automatically:

1. **Instantly saves to your browser** (localStorage) - No delay, happens immediately
2. **Saves to the backend server** (after 1 second) - Syncs across devices

### Visual Confirmation

Open your **browser console** (F12 or Right-click → Inspect → Console tab) to see:
- `✅ Settings saved to localStorage` - Immediate save
- `💾 Saving settings to backend...` - Backend save started
- `✅ Settings saved to backend successfully` - Backend save complete

---

## 🎯 Using Templates

### Step 1: Choose a Template
1. Go to **Settings** → **Mode & Templates** tab
2. Click the **dropdown menu** that says "Select a template..."
3. Choose from 8 templates:
   - 🎭 **Roleplay**: Fantasy Tavern, Sci-Fi Explorer, Detective Noir, Cyberpunk Hacker, Companion
   - 🛠️ **Utility**: Expert Tutor, Code Review Partner, Research Assistant

### Step 2: Preview
After selecting, you'll see a **preview box** showing:
- Template name and type (Roleplay or Utility)
- Description of what the template does

### Step 3: Apply
Click the **"Apply Template" button** to load all the template settings

### Step 4: Automatic Save
The template settings are **immediately saved automatically** - no extra action needed!

---

## 📂 Where Are Settings Stored?

### Two Locations:

1. **Browser localStorage** (your computer)
   - Instant access
   - Works offline
   - Specific to this browser

2. **Backend API** (server)
   - File: `/Users/fastandcurious/apps/chat/data/settings.json`
   - Cross-device sync
   - Backup of your settings

---

## 🎨 Customizing Settings

After applying a template, you can customize any field:

### Roleplay Settings Tab
- **World & Narrative**: Lore, opening scene, narrator voice, pacing
- **Character Mode**: Single character or multiple characters
- **Character Details**: Name, personality, backstory, avatar image

### Utility Settings Tab
- **Assistant Identity**: Persona and communication style
- **Guardrails**: What the assistant should/shouldn't do

### User Persona Tab
- **Your Info**: Name, profession, bio, skills
- **Preferences**: Interests, hobbies, media preferences
- **Linguistic Filters**: Banned words/phrases

### General Tab
- **Generation Parameters**: Temperature, Top P, Max Tokens
- **Features**: Web search, chat search, memory

### Models Tab
- **Select Model**: Choose which Ollama model to use
- **Download Models**: Get new models from Ollama or HuggingFace

---

## 💾 Import/Export Settings

### Export
Click **"Export Settings"** to download a JSON file of your configuration

### Import
Click **"Import Settings"** to load settings from a JSON file

### Copy to Clipboard
Click **"Copy to Clipboard"** to copy settings as JSON text

### Reset
Click **"Reset to Defaults"** to clear all customizations

---

## 🔀 Mode Switching

### Two Ways to Switch Modes:

#### 1. In Settings
- Go to **Mode & Templates** tab
- Click either **🎭 Roleplay** or **🛠️ Normal/Utility** button

#### 2. In Chat (Temporary Override)
- Type `/play` to temporarily use Roleplay mode for one response
- Type `/chat` to temporarily use Normal mode for one response
- The mode returns to your Settings default after the response

---

## 🎭 Character Avatars

### Upload Character Images:
1. Go to **Roleplay Settings** → **Character Configuration**
2. Scroll to **Avatar Image** section
3. Three ways to upload:
   - **Drag & drop** an image file
   - **Click to browse** files
   - **Paste image URL** and click "Load URL"

### Image Specs:
- **Auto-resized** to 512x512 pixels
- **Max size**: 500KB recommended
- **Stored as**: Base64 encoded in settings

---

## 🔍 Troubleshooting

### "Apply Template" Does Nothing
- **Check the browser console** (F12) - you should see save confirmations
- Make sure the dropdown has a template selected
- Try refreshing the page

### Settings Don't Persist
- Check if backend server is running (Terminal 1: `npm start`)
- Check browser console for errors
- Verify `/Users/fastandcurious/apps/chat/data/settings.json` is writable

### Template Not Loading
- Make sure you clicked **"Apply Template"** button (not just selected from dropdown)
- Navigate to other tabs (Roleplay Settings, etc.) to see the loaded values
- Check console for errors

---

## ⚙️ Technical Details

### Save Timing
- **localStorage**: Immediate (0ms delay)
- **Backend API**: Debounced (1000ms = 1 second after last change)

### API Endpoints
- `GET /api/settings` - Load settings
- `POST /api/settings` - Save settings
- `DELETE /api/settings` - Reset to defaults

### Variable Mapping
Your settings are converted into system prompts using variable mapping:
```
"You are the {{Narrator Voice}}. The story takes place in {{World Setting}}.
Current NPC: {{NPC Name}} is a {{NPC Personality}} {{NPC Profession}}.
User is: {{User Name}}, who is known for {{User Skills}}."
```

All fields automatically populate the prompt sent to Ollama!

---

## 🚀 Quick Start Example

1. **Start servers**:
   ```bash
   # Terminal 1
   npm start

   # Terminal 2
   cd client && npm run dev
   ```

2. **Open** http://localhost:5173

3. **Go to Settings** → **Mode & Templates**

4. **Select** "Fantasy Tavern" from dropdown

5. **Click** "Apply Template"

6. **Check console** - See save confirmations

7. **Go to Chat** - Start talking to Elara the tavern keeper!

---

## 📞 Need Help?

Check the browser console (F12) - all save operations are logged there with clear status messages.
