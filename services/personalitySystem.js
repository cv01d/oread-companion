// Personality System Service - Load and query personality trait definitions
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded personality system data
let personalitySystemCache = null;

/**
 * Load all personality system JSON files
 */
async function loadPersonalitySystem() {
  if (personalitySystemCache) {
    return personalitySystemCache;
  }

  const personalityDir = path.join(__dirname, '..', 'data', 'personality-system');

  try {
    const categories = [
      'emotional-expression',
      'social-energy',
      'thinking-style',
      'humor-edge',
      'core-values',
      'how-they-care',
      'energy-presence',
      'lifestyle-interests'
    ];

    const personalitySystem = {};

    for (const category of categories) {
      const filePath = path.join(personalityDir, `${category}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      personalitySystem[data.category] = data;
    }

    personalitySystemCache = personalitySystem;
    console.log('✅ Personality system loaded:', Object.keys(personalitySystem).length, 'categories');
    return personalitySystem;
  } catch (error) {
    console.error('❌ Error loading personality system:', error);
    return {};
  }
}

/**
 * Get trait definition by category and trait name
 */
async function getTraitDefinition(categoryKey, traitName) {
  const personalitySystem = await loadPersonalitySystem();
  const category = personalitySystem[categoryKey];

  if (!category || !category.traits) {
    return null;
  }

  return category.traits[traitName] || null;
}

/**
 * Get all trait definitions for a character's selected traits
 * @param {Object} characterTraits - Character traits object with arrays per category
 * @returns {Object} - Organized trait definitions by category
 */
async function getCharacterTraitDefinitions(characterTraits) {
  const personalitySystem = await loadPersonalitySystem();

  // Map internal property names to personality system category keys
  const categoryMapping = {
    emotionalExpression: 'emotional_expression',
    socialEnergy: 'social_energy',
    thinkingStyle: 'thinking_style',
    humorPersonality: 'humor_edge',
    coreValues: 'core_values',
    howTheyCare: 'how_they_care',
    energyPresence: 'energy_presence',
    lifestyleInterests: 'lifestyle_interests'
  };

  const traitDefinitions = {};

  for (const [propName, categoryKey] of Object.entries(categoryMapping)) {
    const selectedTraits = characterTraits[propName];
    if (!selectedTraits || selectedTraits.length === 0) {
      continue;
    }

    const categoryData = personalitySystem[categoryKey];
    if (!categoryData) {
      continue;
    }

    traitDefinitions[propName] = {
      category: categoryData.category,
      directive: categoryData.directive,
      description: categoryData.description,
      traits: []
    };

    for (const traitName of selectedTraits) {
      const traitDef = categoryData.traits[traitName];
      if (traitDef) {
        traitDefinitions[propName].traits.push({
          name: traitName,
          ...traitDef
        });
      }
    }
  }

  return traitDefinitions;
}

/**
 * Build personality guidance text for system prompt
 * @param {Object} traitDefinitions - Output from getCharacterTraitDefinitions
 * @returns {String} - Formatted personality guidance text
 */
function buildPersonalityGuidance(traitDefinitions) {
  let guidance = '**PERSONALITY SYSTEM GUIDANCE:**\n\n';

  const categoryLabels = {
    emotionalExpression: 'Emotional Expression',
    socialEnergy: 'Social Energy',
    thinkingStyle: 'Thinking Style',
    humorPersonality: 'Humor & Edge',
    coreValues: 'Core Values',
    howTheyCare: 'How They Care',
    energyPresence: 'Energy & Presence',
    lifestyleInterests: 'Lifestyle & Interests'
  };

  for (const [propName, data] of Object.entries(traitDefinitions)) {
    if (data.traits.length === 0) continue;

    const categoryLabel = categoryLabels[propName] || propName;
    guidance += `**${categoryLabel}** (${data.directive}):\n`;
    guidance += `${data.description}\n\n`;

    for (const trait of data.traits) {
      guidance += `• **${trait.name}** (Priority: ${trait.priority})\n`;

      // Include emotion-specific guidance
      const defaultResponse = trait.emotion_responses?.default;
      if (defaultResponse) {
        guidance += `  - Tone: ${defaultResponse.tone}\n`;
        guidance += `  - Action: ${defaultResponse.action}\n`;
      }

      // Include key emotion-specific responses (limit to 2-3 most relevant)
      const emotionKeys = Object.keys(trait.emotion_responses || {})
        .filter(key => key !== 'default')
        .slice(0, 3);

      if (emotionKeys.length > 0) {
        guidance += `  - Emotional Context:\n`;
        for (const emotion of emotionKeys) {
          const response = trait.emotion_responses[emotion];
          guidance += `    * ${emotion}: ${response.tone} - ${response.action}\n`;
        }
      }

      guidance += `\n`;
    }

    guidance += `\n`;
  }
  return guidance;
}

export {
  loadPersonalitySystem,
  getTraitDefinition,
  getCharacterTraitDefinitions,
  buildPersonalityGuidance
};
