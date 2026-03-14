// Personality System Loader for Frontend
// Loads personality trait definitions from JSON files

import emotionalExpressionData from '../data/personality-system/emotional-expression.json';
import socialEnergyData from '../data/personality-system/social-energy.json';
import thinkingStyleData from '../data/personality-system/thinking-style.json';
import humorEdgeData from '../data/personality-system/humor-edge.json';
import coreValuesData from '../data/personality-system/core-values.json';
import howTheyCareData from '../data/personality-system/how-they-care.json';
import energyPresenceData from '../data/personality-system/energy-presence.json';
import lifestyleInterestsData from '../data/personality-system/lifestyle-interests.json';

// Organized personality system data
const personalitySystem = {
  emotional_expression: emotionalExpressionData,
  social_energy: socialEnergyData,
  thinking_style: thinkingStyleData,
  humor_edge: humorEdgeData,
  core_values: coreValuesData,
  how_they_care: howTheyCareData,
  energy_presence: energyPresenceData,
  lifestyle_interests: lifestyleInterestsData
};

/**
 * Get all trait definitions for a character's selected traits
 * @param {Object} characterTraits - Character traits object with arrays per category
 * @returns {Object} - Organized trait definitions by category
 */
export function getCharacterTraitDefinitions(characterTraits) {
  if (!characterTraits) {
    return {};
  }

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
export function buildPersonalityGuidance(traitDefinitions) {
  if (!traitDefinitions || Object.keys(traitDefinitions).length === 0) {
    return '';
  }

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
