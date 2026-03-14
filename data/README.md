# Data Folder Structure

This folder contains both default templates (tracked in git) and user data (excluded from git).

## Folder Structure

```
data/
├── avatars/                    # Default avatar images (in git)
│   └── Echo.svg
│
├── characters/
│   ├── defaults/               # Default character templates (in git)
│   │   ├── echo.json          # Companion - sassy & playful
│   │   ├── kairos.json        # Companion - calm & reflective
│   │   ├── assistant.json     # Default utility assistant
│   │   ├── elara.json         # Fantasy tavern keeper
│   │   ├── commander-zara.json # Sci-fi ship AI
│   │   ├── jack-marlowe.json  # Noir detective
│   │   └── nova.json          # Cyberpunk hacker
│   │
│   └── *.json                  # User-created characters (excluded from git)
│
├── personality-system/         # Personality trait templates (in git)
│   ├── emotional-expression.json  # 10 traits for emotional tone
│   ├── social-energy.json         # 8 traits for social interaction
│   ├── thinking-style.json        # 9 traits for cognitive style (to be created)
│   ├── humor-edge.json            # 9 traits for wit and personality (to be created)
│   ├── core-values.json           # 10 traits for motivations (to be created)
│   ├── how-they-care.json         # 9 traits for care expression (to be created)
│   ├── energy-presence.json       # 8 traits for vibe and presence (to be created)
│   └── lifestyle-interests.json   # 8 traits for lifestyle alignment (to be created)
│
├── settings/
│   ├── defaults/               # Default settings templates (in git)
│   │   ├── mode.json          # Default mode setting
│   │   ├── roleplay.json      # Default roleplay settings
│   │   ├── utility.json       # Default utility settings
│   │   ├── userPersona.json   # Default user persona
│   │   ├── general.json       # Default general settings
│   │   └── meta.json          # Default metadata
│   │
│   └── *.json                  # User settings (excluded from git)
│
├── chat.db                     # SQLite database (excluded from git)
├── chat.db-shm                 # SQLite shared memory (excluded from git)
├── chat.db-wal                 # SQLite write-ahead log (excluded from git)
│
└── vector-store/               # Vector embeddings (excluded from git)
```

## What's in Git vs What's Not

### ✅ Tracked in Git (Defaults & Templates)
- `avatars/` - Default avatar images
- `characters/defaults/` - Default character templates
- `personality-system/` - Personality trait templates
- `settings/defaults/` - Default settings templates
- This README file

### ❌ Excluded from Git (User Data)
- `settings/*.json` - User's personal settings
- `characters/*.json` - User-created characters
- `chat.db*` - Conversation history database
- `vector-store/` - RAG embeddings
- `.oread-chat-key` - Session encryption key (root level)

## First-Time Setup

When a new user clones the repository:

1. **Default characters** are available immediately in `characters/defaults/`
2. **Default settings** are available in `settings/defaults/`
3. **User settings** are automatically copied from defaults on first API call
4. **Database** is created automatically when first message is sent
5. **User characters** are created when templates are applied or custom characters are made

On first run, the backend automatically:
- Copies `settings/defaults/*.json` → `settings/*.json`
- User can then customize their settings without affecting defaults

## Applying Templates

When you apply a template (e.g., "Fantasy Tavern Keeper"):

1. The character is copied from `characters/defaults/elara.json`
2. To the user folder as `characters/elara.json`
3. Settings reference the character by ID: `singleCharacterRef: "elara"`
4. User can now customize their copy without affecting the default

## Resetting to Defaults

You can reset any character to its default version:

1. API: `POST /api/characters/reset/:id`
2. This copies from `characters/defaults/:id.json` → `characters/:id.json`
3. User customizations are overwritten with the default template

## Personality System

The personality system contains 8 trait categories with detailed definitions and emotion-specific guidance. These traits are available as multi-select options in the character editor.

### How It Works:
1. User selects traits in character editor (e.g., "Warm", "Extroverted", "Curious")
2. Selected traits are stored in character JSON file under `traits` object
3. Traits are rendered in system prompt under **PERSONALITY TRAITS** section
4. LLM uses traits to influence dialogue generation

### Trait Categories:
Each category contains 8-10 specific traits with emotion-aware tone/action guidance for future RAG enhancement:

1. **Emotional Expression** (10 traits) - How they show feelings
2. **Social Energy** (8 traits) - How they interact with the world
3. **Thinking Style** (9 traits) - How they think and communicate
4. **Humor & Edge** (9 traits) - Their wit and character depth
5. **Core Values** (10 traits) - What drives them
6. **How They Care** (9 traits) - How they relate to others
7. **Energy & Presence** (8 traits) - Their vibe and how they show up
8. **Lifestyle & Interests** (8 traits) - What matters to them

### JSON File Structure:
Each personality trait file contains emotion-specific responses with `tone` (how character sounds) and `action` (behaviors exhibited), plus priority weighting and directive mapping for future dialogue generation enhancements.
