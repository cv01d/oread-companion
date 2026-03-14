// Utility to convert between character formats

/**
 * Convert character data from settings format to character file format
 */
export function settingsToCharacterFile(settingsCharacter) {
  return {
    name: settingsCharacter.name || '',
    gender: settingsCharacter.gender || '',
    species: settingsCharacter.species || '',
    age: settingsCharacter.age || '',
    role: settingsCharacter.role || '',
    avatarImage: settingsCharacter.avatarImage || '',
    knowledgeSkills: settingsCharacter.knowledgeSkills || '',
    hobbiesInterests: settingsCharacter.hobbiesInterests || '',
    thingsToAvoid: settingsCharacter.thingsToAvoid || '',
    backstory: settingsCharacter.backstory || '',
    inventory: settingsCharacter.inventory || '',
    traits: {
      emotionalExpression: settingsCharacter.traits?.emotionalExpression || [],
      socialEnergy: settingsCharacter.traits?.socialEnergy || [],
      thinkingStyle: settingsCharacter.traits?.thinkingStyle || [],
      humorPersonality: settingsCharacter.traits?.humorPersonality || [],
      coreValues: settingsCharacter.traits?.coreValues || [],
      howTheyCare: settingsCharacter.traits?.howTheyCare || [],
      energyPresence: settingsCharacter.traits?.energyPresence || [],
      lifestyleInterests: settingsCharacter.traits?.lifestyleInterests || []
    }
  };
}

/**
 * Convert character file data to settings format
 * Supports both old format (knowledgeSkills, hobbiesInterests, traits object)
 * and new format (appearance, interests, boundaries, tagSelections)
 */
export function characterFileToSettings(characterFile) {
  const character = characterFile.character || characterFile;

  // Detect format based on presence of new fields
  const isNewFormat = character.appearance || character.tagSelections || character.boundaries;

  if (isNewFormat) {
    // New format conversion (Echo/Kairos style)
    return {
      name: character.name || '',
      gender: character.gender || '',
      species: character.species || '',
      age: character.age || '',
      role: character.role || '',
      avatarImage: character.avatarImage || '',
      // Map new fields to old structure
      knowledgeSkills: character.interests || '',
      hobbiesInterests: character.interests || '',
      thingsToAvoid: character.avoidWords || '',
      backstory: character.backstory || '',
      inventory: character.inventory || '',
      // Convert tagSelections to traits object structure
      traits: convertTagSelectionsToTraits(character.tagSelections || {})
    };
  } else {
    // Old format conversion (backward compatibility)
    return {
      name: character.name || '',
      gender: character.gender || '',
      species: character.species || '',
      age: character.age || '',
      role: character.role || '',
      avatarImage: character.avatarImage || '',
      knowledgeSkills: character.knowledgeSkills || '',
      hobbiesInterests: character.hobbiesInterests || '',
      thingsToAvoid: character.thingsToAvoid || '',
      backstory: character.backstory || '',
      inventory: character.inventory || '',
      traits: {
        emotionalExpression: character.traits?.emotionalExpression || [],
        socialEnergy: character.traits?.socialEnergy || [],
        thinkingStyle: character.traits?.thinkingStyle || [],
        humorPersonality: character.traits?.humorPersonality || [],
        coreValues: character.traits?.coreValues || [],
        howTheyCare: character.traits?.howTheyCare || [],
        energyPresence: character.traits?.energyPresence || [],
        lifestyleInterests: character.traits?.lifestyleInterests || []
      }
    };
  }
}

/**
 * Convert tagSelections (new format) to traits object (old format)
 * Maps category display names to internal property names
 */
function convertTagSelectionsToTraits(tagSelections) {
  const categoryMap = {
    'Emotional Expression': 'emotionalExpression',
    'Social Energy': 'socialEnergy',
    'Communication Style': 'communicationStyle',
    'Thinking Style': 'thinkingStyle',
    'Humor & Edge': 'humorPersonality',
    'Core Values': 'coreValues',
    'How They Care': 'howTheyCare',
    'Temperament': 'temperament',
    'Energy & Presence': 'energyPresence',
    'Lifestyle': 'lifestyleInterests',
    'Platonic Touch': 'platonicTouch'
  };

  const traits = {
    emotionalExpression: [],
    socialEnergy: [],
    thinkingStyle: [],
    humorPersonality: [],
    coreValues: [],
    howTheyCare: [],
    energyPresence: [],
    lifestyleInterests: []
  };

  // Map tagSelections to traits
  for (const [displayName, values] of Object.entries(tagSelections)) {
    const propertyName = categoryMap[displayName];
    if (propertyName && traits.hasOwnProperty(propertyName)) {
      traits[propertyName] = values;
    }
  }

  return traits;
}

/**
 * Generate a character ID from a character name
 */
export function generateCharacterId(characterName) {
  return characterName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
