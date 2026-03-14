// Character API client for loading and saving character files
// NEW: Support for defaults folder and copying/resetting

/**
 * Get all user characters (not including defaults)
 */
export async function getAllCharacters() {
  try {
    const response = await fetch('/api/characters');
    const data = await response.json();

    if (data.success) {
      console.log('✅ Characters loaded:', data.characters.length);
      return data.characters;
    } else {
      console.error('❌ Failed to load characters:', data.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading characters:', error);
    return [];
  }
}

/**
 * Get all default characters
 */
export async function getAllDefaultCharacters() {
  try {
    const response = await fetch('/api/characters/defaults/all');
    const data = await response.json();

    if (data.success) {
      console.log('✅ Default characters loaded:', data.characters.length);
      return data.characters;
    } else {
      console.error('❌ Failed to load default characters:', data.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading default characters:', error);
    return [];
  }
}

/**
 * Get a specific character by ID (checks user folder first, then defaults)
 */
export async function getCharacter(characterId) {
  try {
    const response = await fetch(`/api/characters/${characterId}`);
    const data = await response.json();

    if (data.success) {
      console.log(`✅ Character "${characterId}" loaded`);
      return data.character;
    } else {
      console.error(`❌ Failed to load character "${characterId}":`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading character "${characterId}":`, error);
    return null;
  }
}

/**
 * Get a default character by ID (from defaults folder only)
 */
export async function getDefaultCharacter(characterId) {
  try {
    const response = await fetch(`/api/characters/defaults/${characterId}`);
    const data = await response.json();

    if (data.success) {
      console.log(`✅ Default character "${characterId}" loaded`);
      return data.character;
    } else {
      console.error(`❌ Failed to load default character "${characterId}":`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading default character "${characterId}":`, error);
    return null;
  }
}

/**
 * Copy a default character to user characters folder
 * Used when applying templates
 */
export async function copyDefaultCharacterToUser(characterId) {
  try {
    const response = await fetch(`/api/characters/copy/${characterId}`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Copied default character "${characterId}" to user folder`);
      return data.character;
    } else {
      console.error(`❌ Failed to copy character "${characterId}":`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error copying character "${characterId}":`, error);
    return null;
  }
}

/**
 * Reset a user character to its default version
 */
export async function resetCharacterToDefault(characterId) {
  try {
    const response = await fetch(`/api/characters/reset/${characterId}`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Reset character "${characterId}" to default`);
      return data.character;
    } else {
      console.error(`❌ Failed to reset character "${characterId}":`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error resetting character "${characterId}":`, error);
    return null;
  }
}

/**
 * Save a character (user folder only)
 */
export async function saveCharacter(characterId, characterData) {
  try {
    const response = await fetch(`/api/characters/${characterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: characterData })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Character "${characterId}" saved`);
      return data.character;
    } else {
      console.error(`❌ Failed to save character "${characterId}":`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error saving character "${characterId}":`, error);
    return null;
  }
}

/**
 * Delete a character (user folder only, never deletes defaults)
 */
export async function deleteCharacter(characterId) {
  try {
    const response = await fetch(`/api/characters/${characterId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Character "${characterId}" deleted`);
      return true;
    } else {
      console.error(`❌ Failed to delete character "${characterId}":`, data.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting character "${characterId}":`, error);
    return false;
  }
}
