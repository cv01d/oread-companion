/**
 * Cross-session world persistence.
 * Creates snapshots when sessions are archived, seeds new sessions from them.
 */

import { v4 as uuidv4 } from 'uuid';
import database from './database.js';

/**
 * Create a world snapshot from a session's world state.
 *
 * @param {string} sessionId - Source session ID
 * @param {Object} worldState - The session's world state
 * @param {Array} worldStateHistory - The session's world state history
 * @param {Object} settings - The session's settings (for template/character info)
 */
export async function createWorldSnapshot(sessionId, worldState, worldStateHistory, settings) {
  if (!worldState || Object.keys(worldState).length === 0) return null;

  const templateId = settings?.meta?.templateId || 'default';
  const characterName = settings?.roleplay?.character?.name || null;

  // Compress world state + history into a compact summary
  const summaryParts = [];

  if (worldState.currentLocation) {
    summaryParts.push(`Last known location: ${worldState.currentLocation}`);
  }
  if (worldState.currentTime) {
    summaryParts.push(`Last known time: ${worldState.currentTime}`);
  }
  if (worldState.mood) {
    summaryParts.push(`Atmosphere: ${worldState.mood}`);
  }

  // Collect key locations from trail + current
  const keyLocations = [];
  if (worldState.locationTrail) {
    for (const loc of worldState.locationTrail) {
      if (!keyLocations.includes(loc.location)) {
        keyLocations.push(loc.location);
      }
    }
  }
  if (worldState.currentLocation && !keyLocations.includes(worldState.currentLocation)) {
    keyLocations.push(worldState.currentLocation);
  }

  // Collect key characters
  const keyCharacters = [];
  if (worldState.knownCharacters) {
    for (const [name, data] of Object.entries(worldState.knownCharacters)) {
      keyCharacters.push({
        name,
        disposition: data.disposition || 'neutral',
        lastLocation: data.lastLocation || ''
      });
    }
  }

  // Collect key events (active + fading, not resolved) — from both modes
  const keyEvents = [];
  if (worldState.ongoingEvents) {
    for (const event of worldState.ongoingEvents) {
      const text = typeof event === 'string' ? event : event.text;
      const state = typeof event === 'object' ? event.state : 'active';
      if (state !== 'resolved') {
        keyEvents.push(text);
      }
    }
  }

  // Utility mode: include open questions and decisions
  if (worldState.openQuestions) {
    for (const q of worldState.openQuestions) {
      if (q.state !== 'resolved') keyEvents.push(`[Q] ${q.text}`);
    }
  }
  if (worldState.decisions) {
    for (const d of worldState.decisions) {
      if (d.state !== 'resolved') keyEvents.push(`[D] ${d.text}`);
    }
  }

  // Utility mode summary
  if (worldState.currentFocus) {
    summaryParts.push(`Focus topic: ${worldState.currentFocus}`);
  }
  if (worldState.knownEntities) {
    const entityNames = Object.keys(worldState.knownEntities).slice(0, 10);
    if (entityNames.length > 0) {
      summaryParts.push(`Key entities: ${entityNames.join(', ')}`);
    }
  }

  // Add debate info to summary
  if (worldState.debates?.length > 0) {
    const activeDebates = worldState.debates.filter(d => d.state !== 'resolved');
    if (activeDebates.length > 0) {
      summaryParts.push(`Unresolved debates: ${activeDebates.map(d => d.topic).join(', ')}`);
    }
  }

  // Add notable history events to summary
  if (worldStateHistory?.length > 0) {
    const locationChanges = worldStateHistory.filter(h => h.field === 'currentLocation');
    if (locationChanges.length > 0) {
      summaryParts.push(`Visited ${locationChanges.length + 1} locations during this session`);
    }
  }

  const worldStateSummary = summaryParts.join('. ') || 'No significant world state recorded.';

  const id = uuidv4();
  await database.run(
    `INSERT OR REPLACE INTO world_snapshots (id, template_id, character_name, world_state_summary, key_locations, key_characters, key_events, source_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      templateId,
      characterName,
      worldStateSummary,
      JSON.stringify(keyLocations),
      JSON.stringify(keyCharacters),
      JSON.stringify(keyEvents),
      sessionId
    ]
  );

  return id;
}

/**
 * Get the most recent world snapshot for a template/character combination.
 *
 * @param {string} templateId - The template ID
 * @param {string} characterName - The character name (nullable)
 * @returns {Object|null} The snapshot, or null
 */
export async function getWorldSnapshot(templateId, characterName) {
  const query = characterName
    ? `SELECT * FROM world_snapshots WHERE template_id = ? AND character_name = ? ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM world_snapshots WHERE template_id = ? AND character_name IS NULL ORDER BY created_at DESC LIMIT 1`;

  const params = characterName ? [templateId, characterName] : [templateId];
  const snapshot = await database.get(query, params);

  if (!snapshot) return null;

  return {
    ...snapshot,
    key_locations: JSON.parse(snapshot.key_locations || '[]'),
    key_characters: JSON.parse(snapshot.key_characters || '[]'),
    key_events: JSON.parse(snapshot.key_events || '[]')
  };
}

/**
 * Convert a snapshot back into an initial world state for a new session.
 *
 * @param {Object} snapshot - A world snapshot
 * @returns {Object} Initial world state fields
 */
export function seedWorldState(snapshot) {
  if (!snapshot) return {};

  const worldState = {};

  // Restore last location
  if (snapshot.key_locations?.length > 0) {
    worldState.currentLocation = snapshot.key_locations[snapshot.key_locations.length - 1];
    // Build trail from previous locations
    if (snapshot.key_locations.length > 1) {
      worldState.locationTrail = snapshot.key_locations.slice(0, -1).map(loc => ({
        location: loc,
        arrivedTurn: 0,
        departedTurn: 0
      }));
    }
  }

  // Restore known characters
  if (snapshot.key_characters?.length > 0) {
    worldState.knownCharacters = {};
    for (const char of snapshot.key_characters) {
      worldState.knownCharacters[char.name] = {
        firstSeen: 0,
        lastSeen: 0,
        lastLocation: char.lastLocation || '',
        disposition: char.disposition || 'neutral'
      };
    }
  }

  // Restore events as fading (from previous session)
  if (snapshot.key_events?.length > 0) {
    worldState.ongoingEvents = snapshot.key_events.slice(0, 5).map(text => ({
      text,
      firstDetected: 0,
      lastConfirmed: 0,
      state: 'fading'
    }));
  }

  return worldState;
}
