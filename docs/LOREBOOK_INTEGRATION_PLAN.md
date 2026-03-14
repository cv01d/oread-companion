# Lorebook Integration Plan

## Overview

Integrate the old Python-based lorebook personality trait system into the current JavaScript/Node.js character system to enable emotion-responsive, directive-based personality synthesis.

## Old System Architecture

### Python Prompt Builder (prompt_builder.py)

**Key Components**:
1. **Character Card** - Markdown table with character metadata
2. **Player Profile** - Markdown table with user information
3. **Scene Brief** - Setting, goal, status with emotion-aware directives
4. **Dialogue Style** - Synthesized personality directives from lorebook traits
5. **Safety Protocols** - P0-P6 boundary enforcement

**5 Core Dialogue Directives**:
1. **EMOTIONAL TONE** - How character sounds/feels
2. **SOCIAL ACTION** - How character engages socially
3. **COGNITIVE STRUCTURE** - How character thinks/processes
4. **DIALOGUE NUANCE** - Humor, edge, pacing
5. **CORE MOTIVATION** - Values and care patterns

### Lorebook Templates (lorebook_templates.py)

**10 Trait Categories** (80+ individual trait templates):

1. **Emotional Expression** (10 traits) → Maps to EMOTIONAL TONE
   - Warm, Reserved, Passionate, Calm, Stoic, Sensitive, Expressive, Grumpy, Volatile, Abrasive

2. **Social Energy** (8 traits) → Maps to SOCIAL ACTION
   - Extroverted, Introverted, Friendly, Selective, Takes Initiative, Supportive, Independent, Surly

3. **Thinking Style** (9 traits) → Maps to COGNITIVE STRUCTURE
   - Analytical, Creative, Wise, Curious, Observant, Philosophical, Pensive, Poetic, Practical

4. **Humor & Edge** (9 traits) → Maps to DIALOGUE NUANCE
   - Witty, Sarcastic, Playful, Wry, Bold, Mysterious, Brooding, Lighthearted, Sharp-Tongued

5. **Core Values** (10 traits) → Maps to CORE MOTIVATION
   - Honest, Loyal, Courageous, Ambitious, Humble, Principled, Adventurous, Authentic, Justice-Oriented, Cynical

6. **How They Care** (9 traits) → Maps to EMOTIONAL TONE + CORE MOTIVATION
   - Kind, Compassionate, Empathetic, Patient, Generous, Encouraging, Protective, Respectful, Nurturing

7. **Energy & Presence** (8 traits) → Maps to SOCIAL ACTION
   - Energetic, Confident, Assertive, Gentle, Steady, Dynamic, Intense, Easygoing

8. **Lifestyle & Interests** (8 traits) → Maps to SCENE CONTEXT
   - Outdoorsy, Homebody, Romantic, Intellectual, Artistic, Active, Contemplative, Social

9. **Romantic Narrative Control** (11 traits) → Maps to DIALOGUE NUANCE (romantic mode)
   - Intimacy levels, pacing, scene detail, initiation styles

10. **Platonic Relationship Style** (9 traits) → Maps to SOCIAL ACTION (platonic mode)
    - Friendship dynamics, touch policies

**Emotion-Specific Response Pattern**:
Each trait template contains responses for:
- sadness, grief, fear, anxiety, anger
- joy, excitement, love
- neutral, default

Each response has:
- **tone**: How character should sound
- **action**: What character should do

## New System Integration Design

### 1. Data Storage Architecture

**Option A: JSON Files** (Recommended for Phase 1)
```
/data/lorebook/
  ├── emotional-expression.json
  ├── social-energy.json
  ├── thinking-style.json
  ├── humor-edge.json
  ├── core-values.json
  ├── how-they-care.json
  ├── energy-presence.json
  ├── lifestyle-interests.json
  ├── romantic-narrative.json
  └── platonic-style.json
```

**Option B: SQLite with RAG** (Phase 2 - Future Enhancement)
```sql
CREATE TABLE lorebook_traits (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  directive TEXT NOT NULL,
  priority INTEGER,
  ui_tag TEXT NOT NULL,
  emotion_responses TEXT, -- JSON blob
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_category ON lorebook_traits(category);
CREATE INDEX idx_directive ON lorebook_traits(directive);
```

### 2. Backend Architecture

**New Files**:
```
/data/lorebook/          # Lorebook trait JSON files
/controllers/lorebookController.js  # CRUD operations
/routes/lorebook.js      # API routes
/services/directiveSynthesizer.js   # Trait → directive synthesis
```

**lorebookController.js Functions**:
```javascript
- getAllTraits()              // Get all trait templates
- getTraitsByCategory(category)   // Get traits for specific category
- getTraitById(id)           // Get single trait template
- getTraitsForDirective(directive) // Get all traits mapping to a directive
- synthesizeDirectives(selectedTraits, emotion) // Build directive text
```

**directiveSynthesizer.js Core Logic**:
```javascript
class DirectiveSynthesizer {
  // Map character traits to 5 core directives
  synthesize(characterTraits, userEmotion = 'neutral') {
    return {
      emotionalTone: this._buildEmotionalTone(traits, emotion),
      socialAction: this._buildSocialAction(traits, emotion),
      cognitiveStructure: this._buildCognitiveStructure(traits, emotion),
      dialogueNuance: this._buildDialogueNuance(traits, emotion),
      coreMotivation: this._buildCoreMotivation(traits, emotion)
    };
  }

  _buildEmotionalTone(traits, emotion) {
    // Combine: emotional_expression + how_they_care
    // Extract tone + action from emotion_responses[emotion]
    // De-duplicate and synthesize into coherent directive
  }

  // ... similar for other directives
}
```

### 3. Frontend Integration

**Update Character Traits UI**:

Current system has 8 categories in CharacterEditor.jsx:
```javascript
const TRAIT_OPTIONS = {
  emotionalExpression: ['Warm', 'Reserved', ...],
  socialEnergy: ['Extroverted', 'Introverted', ...],
  thinkingStyle: ['Analytical', 'Creative', ...],
  humorPersonality: ['Witty', 'Sarcastic', ...],
  coreValues: ['Honest', 'Loyal', ...],
  howTheyCare: ['Kind', 'Compassionate', ...],
  energyPresence: ['Energetic', 'Confident', ...],
  lifestyleInterests: ['Outdoorsy', 'Homebody', ...]
};
```

**Enhancement Needed**:
1. Load trait options from lorebook API (dynamic, not hardcoded)
2. Add tooltips showing trait descriptions
3. Add romantic/platonic mode-specific traits when in roleplay mode

**New Character Schema**:
```javascript
{
  name: "Echo",
  traits: {
    emotionalExpression: ["Warm", "Expressive"],
    socialEnergy: ["Extroverted", "Takes Initiative"],
    thinkingStyle: ["Curious", "Practical"],
    humorPersonality: ["Witty", "Playful"],
    coreValues: ["Honest", "Loyal"],
    howTheyCare: ["Supportive"],
    energyPresence: ["Energetic"],
    lifestyleInterests: ["Social"],

    // NEW: Add mode-specific traits
    romanticNarrative: ["Slow Burn", "Consent-Focused"], // Only if romantic mode
    platonicStyle: ["Best Friend Dynamic"]  // Only if platonic mode
  }
}
```

### 4. Prompt Builder Integration

**Update promptBuilder.js**:

Current system uses simple trait mapping:
```javascript
buildRoleplayPrompt() {
  // ... existing code
  const traits = character.traits;
  // Just lists traits as bullet points
}
```

**New Enhanced System**:
```javascript
import { synthesizeDirectives } from '../utils/directiveSynthesizer';

buildRoleplayPrompt(settings, emotion = 'neutral') {
  const character = settings.roleplay._loadedCharacters[0];

  // Synthesize directives from traits + emotion
  const directives = synthesizeDirectives(character.traits, emotion);

  // Build prompt sections
  const characterCard = buildCharacterCard(character);
  const playerProfile = buildPlayerProfile(settings.userPersona);
  const sceneBrief = buildSceneBrief(settings.roleplay.world, emotion);
  const dialogueStyle = buildDialogueStyle(directives); // NEW

  return `
${characterCard}

${playerProfile}

${sceneBrief}

# DIALOGUE STYLE
Your responses should embody these directives:

## Emotional Tone
${directives.emotionalTone}

## Social Action
${directives.socialAction}

## Cognitive Structure
${directives.cognitiveStructure}

## Dialogue Nuance
${directives.dialogueNuance}

## Core Motivation
${directives.coreMotivation}
`;
}
```

### 5. Emotion Detection Integration

**Phase 1** (No emotion detection yet):
- Always use `emotion = 'neutral'` or `emotion = 'default'`
- Directives synthesized from default/neutral responses

**Phase 2** (Future - requires emotion detection):
- Integrate emotion detection library (e.g., sentiment analysis)
- Pass detected emotion to `synthesizeDirectives()`
- Dynamic directive adjustment based on user's emotional state

### 6. Migration Path

**Current System** → **Enhanced System**:

1. **Create Lorebook Data Files** (Phase 1a)
   - Convert Python templates to JSON
   - Store in `/data/lorebook/`
   - 10 files, one per category

2. **Add Backend Lorebook API** (Phase 1b)
   - `lorebookController.js`
   - `directiveSynthesizer.js`
   - Routes: GET `/api/lorebook/traits`, `/api/lorebook/synthesize`

3. **Update Frontend** (Phase 1c)
   - Load trait options dynamically from lorebook API
   - Add romantic/platonic trait categories to CharacterEditor
   - Update character save format

4. **Enhance Prompt Builder** (Phase 1d)
   - Add directive synthesis to `promptBuilder.js`
   - Generate 5-directive sections
   - Backward compatible with existing characters

5. **Add Emotion Detection** (Phase 2 - Optional)
   - Integrate sentiment analysis
   - Pass emotion to directive synthesizer
   - Dynamic personality adaptation

## Implementation Checklist

### Phase 1a: Data Layer
- [ ] Create `/data/lorebook/` directory structure
- [ ] Convert 10 Python trait categories to JSON files
- [ ] Validate JSON structure matches Python templates
- [ ] Add romantic-narrative.json
- [ ] Add platonic-style.json

### Phase 1b: Backend API
- [ ] Create `controllers/lorebookController.js`
- [ ] Create `services/directiveSynthesizer.js`
- [ ] Create `routes/lorebook.js`
- [ ] Register routes in `server.js`
- [ ] Test API endpoints

### Phase 1c: Frontend Updates
- [ ] Update CharacterEditor trait categories
- [ ] Add romantic/platonic mode-specific trait sections
- [ ] Load trait options from API instead of hardcoded
- [ ] Update character save format
- [ ] Migrate existing characters to new format

### Phase 1d: Prompt Builder Enhancement
- [ ] Create `client/src/utils/directiveSynthesizer.js` (frontend version)
- [ ] Update `promptBuilder.js` to use directive synthesis
- [ ] Add 5-directive sections to prompt template
- [ ] Test prompt generation with various trait combinations
- [ ] Ensure backward compatibility

### Phase 2: Advanced Features (Future)
- [ ] Add emotion detection library
- [ ] Integrate emotion detection in chat flow
- [ ] Pass detected emotion to directive synthesizer
- [ ] Add emotion-based directive switching
- [ ] Store emotion history in sessions

## Sample Directive Synthesis

**Input**:
```javascript
characterTraits = {
  emotionalExpression: ["Warm", "Expressive"],
  socialEnergy: ["Takes Initiative"],
  thinkingStyle: ["Curious"],
  humorPersonality: ["Witty", "Playful"],
  coreValues: ["Loyal"],
  howTheyCare: ["Supportive"],
  energyPresence: ["Energetic"],
  lifestyleInterests: ["Social"]
}
emotion = "joy"
```

**Output**:
```
## Emotional Tone
Express warmth openly and freely. Your tone should be delighted and animated,
letting happiness show naturally in your response. Be tender and openly
affectionate, creating intimate emotional connection through warm words.

## Social Action
Take initiative actively. Feed off their excitement and get more animated.
Lead the conversation forward with proactive suggestions. Draw energy from
interacting and engage actively.

## Cognitive Structure
Approach with genuine curiosity and interest. Ask engaging questions. Show
fascination with their thoughts and ideas. Remain intellectually engaged and
openly interested.

## Dialogue Nuance
Bring playful wit to the conversation. Use clever wordplay and light teasing.
Keep the tone fun and spontaneous. Match their energy with warm enthusiasm.

## Core Motivation
Show unwavering loyalty and support. Be their champion in success. Stand by
them consistently. Make them feel valued and supported in their joy.
```

## Key Design Decisions

1. **JSON Files vs SQLite**: Use JSON for Phase 1 (simpler, faster to implement). Migrate to SQLite in Phase 2 if RAG retrieval becomes necessary.

2. **Emotion Detection**: Optional for Phase 1. Default to 'neutral' emotion. Add detection in Phase 2.

3. **Backward Compatibility**: Existing characters without lorebook traits should still work. Fallback to simple trait listing.

4. **Synthesis Algorithm**: Combine multiple trait responses, deduplicate similar directives, maintain natural language flow.

5. **Mode-Specific Traits**: Romantic/platonic traits only shown when in appropriate mode. Not required for all characters.

## Testing Strategy

1. **Unit Tests**: Directive synthesizer with various trait combinations
2. **Integration Tests**: Full prompt generation with sample characters
3. **Manual Testing**: Generate prompts with Echo, Elara, Nova characters
4. **Validation**: Compare output quality with old Python system

## Success Criteria

- [ ] All 80+ trait templates converted to JSON
- [ ] Directive synthesis produces coherent, natural language
- [ ] Prompts include 5-directive sections
- [ ] Existing characters still work (backward compatible)
- [ ] New characters can use full lorebook system
- [ ] Character UI loads trait options dynamically
- [ ] Emotion='neutral' produces sensible defaults
