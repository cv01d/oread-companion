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
 */
export function characterFileToSettings(characterFile) {
  const character = characterFile.character || characterFile;

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
