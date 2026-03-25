import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diffWorldState, matchEvent } from '../../services/worldStateExtractor.js';

// Mock the extraction model manager as ready
vi.mock('../../services/extractionModelManager.js', () => ({
  default: {
    isReady: () => true,
    modelName: 'phi4-mini'
  }
}));

// Mock ollamaService.extract to return controlled results
vi.mock('../../services/ollama.js', () => ({
  default: {
    extract: vi.fn()
  }
}));

import { extractWorldState, extractSessionState } from '../../services/worldStateExtractor.js';
import ollamaService from '../../services/ollama.js';

const THORNHAVEN_SETTINGS = {
  mode: 'roleplay',
  roleplay: {
    character: { name: 'Julian Ashworth' },
    characters: [
      { name: 'Julian Ashworth' },
      { name: 'Marguerite Delacroix' },
      { name: 'Cass Holloway' }
    ],
    characterMode: 'multi'
  },
  userPersona: { name: 'Aria' }
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ========================================================================
// Single-turn extraction tests
// ========================================================================

describe('extractWorldState — single turn', () => {
  it('produces structured output from LLM extraction', async () => {
    ollamaService.extract.mockResolvedValue({
      currentLocation: 'the library',
      currentTime: 'evening',
      presentCharacters: ['Julian Ashworth', 'Aria'],
      newEvents: ['The stairs collapsed beneath Aria'],
      mood: 'mysterious'
    });

    const state = await extractWorldState(
      'I walk into the library.',
      'Julian greets you from the shadows.',
      {}, 1, THORNHAVEN_SETTINGS
    );

    expect(state.lastUpdated).toBe(1);
    expect(state.currentLocation).toBe('the library');
    expect(state.currentTime).toBe('evening');
    expect(state.presentCharacters.length).toBeGreaterThan(0);
    expect(state.ongoingEvents.length).toBe(1);
    expect(state.mood).toBe('Mysterious');
  });

  it('updates location trail when location changes', async () => {
    ollamaService.extract.mockResolvedValue({
      currentLocation: 'the basement',
      presentCharacters: ['Julian Ashworth'],
      newEvents: [],
      mood: null
    });

    const existing = {
      currentLocation: 'the library',
      locationArrivedTurn: 1,
      locationTrail: [],
      presentCharacters: ['Julian Ashworth'],
      knownCharacters: {}
    };

    const state = await extractWorldState('I go down.', 'You descend.', existing, 3, THORNHAVEN_SETTINGS);
    expect(state.currentLocation).toBe('the basement');
    expect(state.locationTrail.length).toBe(1);
    expect(state.locationTrail[0].location).toBe('the library');
  });

  it('applies event lifecycle — aging events', async () => {
    ollamaService.extract.mockResolvedValue({
      newEvents: [],
      presentCharacters: []
    });

    const existing = {
      ongoingEvents: [
        { text: 'Old event from long ago', firstDetected: 1, lastConfirmed: 1, state: 'active' }
      ],
      knownCharacters: {}
    };

    const state = await extractWorldState('ok', 'indeed', existing, 25, THORNHAVEN_SETTINGS);
    expect(state._resolvedEvents?.length).toBeGreaterThan(0);
  });

  it('validates mood against allowed values', async () => {
    ollamaService.extract.mockResolvedValue({
      mood: 'INVALID_MOOD',
      presentCharacters: [],
      newEvents: []
    });

    const state = await extractWorldState('test', 'test', {}, 1, THORNHAVEN_SETTINGS);
    expect(state.mood).toBeUndefined();
  });

  it('returns base state when extraction model is not ready', async () => {
    const { default: manager } = await import('../../services/extractionModelManager.js');
    const origReady = manager.isReady;
    manager.isReady = () => false;

    const state = await extractWorldState('test', 'test', { mood: 'Calm' }, 1, THORNHAVEN_SETTINGS);
    expect(state.lastUpdated).toBe(1);
    expect(state.mood).toBe('Calm');

    manager.isReady = origReady;
  });

  it('handles LLM error gracefully', async () => {
    ollamaService.extract.mockRejectedValue(new Error('timeout'));

    const state = await extractWorldState('test', 'test', {}, 1, THORNHAVEN_SETTINGS);
    expect(state.lastUpdated).toBe(1);
  });

  it('caps knownCharacters at 20', async () => {
    const knownCharacters = {};
    for (let i = 0; i < 25; i++) {
      knownCharacters[`char${i}`] = { firstSeen: i, lastSeen: i, lastLocation: '', disposition: 'neutral' };
    }

    ollamaService.extract.mockResolvedValue({
      presentCharacters: ['New Character'],
      newEvents: []
    });

    const state = await extractWorldState('test', 'test', { knownCharacters }, 30, THORNHAVEN_SETTINGS);
    expect(Object.keys(state.knownCharacters).length).toBeLessThanOrEqual(21);
  });

  it('preserves debates from existing state', async () => {
    ollamaService.extract.mockResolvedValue({
      presentCharacters: [],
      newEvents: []
    });

    const existing = {
      debates: [{ topic: 'trust', participants: ['Julian', 'Aria'] }],
      knownCharacters: {}
    };

    const state = await extractWorldState('test', 'test', existing, 1, THORNHAVEN_SETTINGS);
    expect(state.debates).toEqual(existing.debates);
  });

  it('extracts discoveries from LLM response', async () => {
    ollamaService.extract.mockResolvedValue({
      presentCharacters: ['Julian Ashworth'],
      newEvents: [],
      newDiscoveries: ['The signal was first detected two weeks ago', 'Over 200 unique sequences received']
    });

    const state = await extractWorldState('test', 'test', { knownCharacters: {} }, 1, THORNHAVEN_SETTINGS);
    expect(state.discoveries.length).toBe(2);
    expect(state.discoveries[0].text).toContain('signal');
    expect(state.discoveries[0].state).toBe('active');
  });

  it('handles departedCharacters — removes them from present', async () => {
    ollamaService.extract.mockResolvedValue({
      presentCharacters: ['Aria'],
      departedCharacters: ['Julian Ashworth'],
      newEvents: []
    });

    const existing = {
      presentCharacters: ['Julian Ashworth', 'Aria'],
      knownCharacters: {
        'julian ashworth': { firstSeen: 1, lastSeen: 1, lastLocation: '', disposition: 'neutral' }
      }
    };

    const state = await extractWorldState('I go alone.', 'Julian stays behind.', existing, 2, THORNHAVEN_SETTINGS);
    expect(state.presentCharacters).toContain('Aria');
    expect(state.presentCharacters).not.toContain('Julian Ashworth');
  });

  it('ages discoveries slower than events', async () => {
    ollamaService.extract.mockResolvedValue({
      presentCharacters: [],
      newEvents: [],
      newDiscoveries: []
    });

    const existing = {
      ongoingEvents: [{ text: 'An event', firstDetected: 1, lastConfirmed: 1, state: 'active' }],
      discoveries: [{ text: 'A discovery', firstDetected: 1, lastConfirmed: 1, state: 'active' }],
      knownCharacters: {}
    };

    // At turn 12: event age = 11 (> 10 → fading), discovery age = 11 (< 15 → still active)
    const state = await extractWorldState('test', 'test', existing, 12, THORNHAVEN_SETTINGS);
    expect(state.ongoingEvents[0].state).toBe('fading');
    expect(state.discoveries[0].state).toBe('active');
  });
});

// ========================================================================
// Multi-turn extraction tests (roleplay)
// ========================================================================

describe('extractWorldState — multi-turn incremental extraction', () => {
  // Simulate a multi-turn roleplay conversation where state builds up
  const TURNS = [
    {
      user: 'I enter the grand library cautiously.',
      assistant: 'Julian Ashworth floats into view, his spectral form shimmering. "Welcome to Thornhaven," he says.',
      llmResponse: {
        currentLocation: 'the grand library',
        currentTime: 'evening',
        presentCharacters: ['Julian Ashworth', 'Aria'],
        newEvents: ['Aria entered the grand library'],
        mood: 'mysterious'
      }
    },
    {
      user: 'I reach for one of the old books on the shelf.',
      assistant: 'The book snaps shut and flies to the top shelf. Julian chuckles. "The library has a mind of its own."',
      llmResponse: {
        currentLocation: null,
        currentTime: null,
        presentCharacters: ['Julian Ashworth', 'Aria'],
        newEvents: ['A book flew to the top shelf on its own'],
        mood: 'playful'
      }
    },
    {
      user: 'I follow Julian through the corridor to the study.',
      assistant: 'The study is dimly lit with a fire crackling. Marguerite Delacroix sits by the window, reading.',
      llmResponse: {
        currentLocation: 'the study',
        currentTime: null,
        presentCharacters: ['Julian Ashworth', 'Aria', 'Marguerite Delacroix'],
        newEvents: ['Marguerite Delacroix was found reading in the study'],
        mood: 'calm'
      }
    },
    {
      user: 'I ask Marguerite about the house.',
      assistant: 'Marguerite looks up. "This house devours the unwary." A loud crash echoes from below.',
      llmResponse: {
        currentLocation: null,
        currentTime: null,
        presentCharacters: ['Julian Ashworth', 'Aria', 'Marguerite Delacroix'],
        newEvents: ['A loud crash echoed from below the study'],
        mood: 'tense'
      }
    },
    {
      user: 'I rush to the basement to investigate the crash.',
      assistant: 'You descend the stairs alone. The basement is cold and dark. Julian and Marguerite remain upstairs.',
      llmResponse: {
        currentLocation: 'the basement',
        currentTime: null,
        presentCharacters: ['Aria'],
        newEvents: ['Aria descended to the basement alone'],
        mood: 'eerie'
      }
    }
  ];

  it('builds state incrementally across 5 turns', async () => {
    let state = {};
    const snapshots = [];

    for (let i = 0; i < TURNS.length; i++) {
      ollamaService.extract.mockResolvedValueOnce(TURNS[i].llmResponse);
      state = await extractWorldState(TURNS[i].user, TURNS[i].assistant, state, i + 1, THORNHAVEN_SETTINGS);
      snapshots.push({ ...state });
    }

    // Called once per turn
    expect(ollamaService.extract).toHaveBeenCalledTimes(5);

    // Final state reflects turn 5
    expect(state.lastUpdated).toBe(5);

    // Location should be basement (last move)
    expect(state.currentLocation).toBe('the basement');

    // Location trail should have prior locations
    expect(state.locationTrail.length).toBeGreaterThanOrEqual(2);
    const trailLocations = state.locationTrail.map(l => l.location);
    expect(trailLocations).toContain('the grand library');
    expect(trailLocations).toContain('the study');

    // Known characters should include all three + Aria
    const knownKeys = Object.keys(state.knownCharacters).map(k => k.toLowerCase());
    expect(knownKeys).toContain('julian ashworth');
    expect(knownKeys).toContain('aria');
    expect(knownKeys).toContain('marguerite delacroix');

    // Events should have accumulated (at least the recent ones)
    expect(state.ongoingEvents.length).toBeGreaterThan(0);

    // Mood should be last extracted mood
    expect(state.mood).toBe('Eerie');
  });

  it('accumulates more data over time — final state is richer than initial', async () => {
    let state = {};
    const snapshots = [];

    for (let i = 0; i < TURNS.length; i++) {
      ollamaService.extract.mockResolvedValueOnce(TURNS[i].llmResponse);
      state = await extractWorldState(TURNS[i].user, TURNS[i].assistant, state, i + 1, THORNHAVEN_SETTINGS);
      snapshots.push(JSON.stringify(state));
    }

    expect(snapshots[4].length).toBeGreaterThan(snapshots[0].length);
  });

  it('characters depart when no longer mentioned', async () => {
    let state = {};

    // Turn 1: Julian + Aria present
    ollamaService.extract.mockResolvedValueOnce({
      currentLocation: 'the library',
      presentCharacters: ['Julian Ashworth', 'Aria'],
      newEvents: [],
    });
    state = await extractWorldState('Hello.', 'Welcome.', state, 1, THORNHAVEN_SETTINGS);
    expect(state.presentCharacters).toContain('Julian Ashworth');
    expect(state.presentCharacters).toContain('Aria');

    // Turn 2: Only Aria mentioned — Julian departed
    ollamaService.extract.mockResolvedValueOnce({
      presentCharacters: ['Aria'],
      newEvents: [],
    });
    state = await extractWorldState('I go alone.', 'You walk on.', state, 2, THORNHAVEN_SETTINGS);
    expect(state.presentCharacters).toContain('Aria');
    expect(state.presentCharacters).not.toContain('Julian Ashworth');
  });

  it('generates diff history across turns', async () => {
    let state = {};
    const allChanges = [];

    for (let i = 0; i < TURNS.length; i++) {
      const oldState = { ...state };
      ollamaService.extract.mockResolvedValueOnce(TURNS[i].llmResponse);
      state = await extractWorldState(TURNS[i].user, TURNS[i].assistant, state, i + 1, THORNHAVEN_SETTINGS);

      const changes = diffWorldState(oldState, state, i + 1);
      allChanges.push(...changes);
    }

    // Should detect location changes, character arrivals, mood changes, etc.
    expect(allChanges.length).toBeGreaterThan(0);
    const fields = allChanges.map(c => c.field);
    expect(fields).toContain('currentLocation');
    expect(fields).toContain('mood');
  });
});

// ========================================================================
// Re-extraction tests (full replay)
// ========================================================================

describe('extractWorldState — full re-extraction (replay all turns)', () => {
  // Simulates the reextract-state endpoint: replay ALL message pairs from scratch
  const FULL_DIALOGUE = [
    { user: 'I step into the courtyard.', assistant: 'Julian appears beside the fountain.' },
    { user: 'We walk to the east wing.', assistant: 'Cass Holloway is waiting at the door of the east wing.' },
    { user: 'Cass leads us inside the gallery.', assistant: 'Paintings line the walls. The mood is somber.' },
    { user: 'I notice a hidden door behind one of the paintings.', assistant: 'Julian examines it. "This wasn\'t here before," he says.' },
    { user: 'We open the hidden door and go through.', assistant: 'A narrow tunnel leads down to a crypt.' },
    { user: 'I investigate the crypt alone.', assistant: 'Cass and Julian stay behind. You find an old journal.' },
  ];

  const LLM_RESPONSES = [
    { currentLocation: 'the courtyard', presentCharacters: ['Julian Ashworth', 'Aria'], newEvents: ['Aria entered the courtyard'], mood: 'calm' },
    { currentLocation: 'the east wing', presentCharacters: ['Julian Ashworth', 'Aria', 'Cass Holloway'], newEvents: ['Cass Holloway was waiting at the east wing'], mood: null },
    { currentLocation: 'the gallery', presentCharacters: ['Julian Ashworth', 'Aria', 'Cass Holloway'], newEvents: [], mood: 'somber' },
    { currentLocation: null, presentCharacters: ['Julian Ashworth', 'Aria', 'Cass Holloway'], newEvents: ['A hidden door was discovered behind a painting'], mood: 'mysterious' },
    { currentLocation: 'the crypt', presentCharacters: ['Julian Ashworth', 'Aria', 'Cass Holloway'], newEvents: ['The group passed through a hidden tunnel'], mood: 'eerie' },
    { currentLocation: null, presentCharacters: ['Aria'], newEvents: ['Aria found an old journal in the crypt'], mood: null },
  ];

  async function reextractAllTurns(messages, llmResponses, settings) {
    let state = {};
    const history = [];

    for (let i = 0; i < messages.length; i++) {
      const oldState = { ...state };
      ollamaService.extract.mockResolvedValueOnce(llmResponses[i]);
      state = await extractWorldState(messages[i].user, messages[i].assistant, state, i + 1, settings);

      const changes = diffWorldState(oldState, state, i + 1);
      if (state._resolvedEvents?.length > 0) {
        for (const event of state._resolvedEvents) {
          changes.push({ turn: i + 1, field: 'ongoingEvents', from: event.text, action: 'resolved' });
        }
      }
      delete state._resolvedEvents;
      history.push(...changes);
    }

    return { finalState: state, history };
  }

  it('processes ALL message pairs, not just the last one', async () => {
    const { finalState } = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    // Should have called extract once per turn (6 turns)
    expect(ollamaService.extract).toHaveBeenCalledTimes(6);

    // Each call should have received the user and assistant messages from that turn
    for (let i = 0; i < FULL_DIALOGUE.length; i++) {
      const callArgs = ollamaService.extract.mock.calls[i];
      const prompt = callArgs[1]; // second arg is the prompt string
      expect(prompt).toContain(FULL_DIALOGUE[i].user);
      expect(prompt).toContain(FULL_DIALOGUE[i].assistant);
    }
  });

  it('re-extraction produces complete location trail', async () => {
    const { finalState } = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    // Should have tracked the journey: courtyard → east wing → gallery → crypt
    const trailLocations = (finalState.locationTrail || []).map(l => l.location);

    expect(trailLocations).toContain('the courtyard');
    expect(trailLocations).toContain('the east wing');
    expect(trailLocations).toContain('the gallery');
    // crypt is the current location, not in trail
    expect(finalState.currentLocation).toBe('the crypt');
  });

  it('re-extraction discovers all characters from full history', async () => {
    const { finalState } = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    const knownKeys = Object.keys(finalState.knownCharacters).map(k => k.toLowerCase());
    expect(knownKeys).toContain('julian ashworth');
    expect(knownKeys).toContain('aria');
    expect(knownKeys).toContain('cass holloway');
  });

  it('re-extraction generates complete diff history', async () => {
    const { history } = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    expect(history.length).toBeGreaterThan(0);

    // Should have changes from multiple turns
    const turns = [...new Set(history.map(h => h.turn))];
    expect(turns.length).toBeGreaterThan(1);

    // Should track location changes
    const locationChanges = history.filter(h => h.field === 'currentLocation');
    expect(locationChanges.length).toBeGreaterThanOrEqual(3);
  });

  it('re-extraction accumulates events across all turns', async () => {
    const { finalState } = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    // Should have multiple events from across the dialogue
    expect(finalState.ongoingEvents.length).toBeGreaterThan(1);

    // Events should have lifecycle fields
    for (const event of finalState.ongoingEvents) {
      expect(event).toHaveProperty('text');
      expect(event).toHaveProperty('firstDetected');
      expect(event).toHaveProperty('lastConfirmed');
      expect(event).toHaveProperty('state');
    }
  });

  it('re-extraction produces same result when run twice on same data', async () => {
    const result1 = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    // Reset mock call count and re-run
    vi.clearAllMocks();
    const result2 = await reextractAllTurns(FULL_DIALOGUE, LLM_RESPONSES, THORNHAVEN_SETTINGS);

    // Same final state
    expect(result1.finalState.currentLocation).toBe(result2.finalState.currentLocation);
    expect(result1.finalState.mood).toBe(result2.finalState.mood);
    expect(Object.keys(result1.finalState.knownCharacters).sort())
      .toEqual(Object.keys(result2.finalState.knownCharacters).sort());
    expect(result1.history.length).toBe(result2.history.length);
  });

  it('re-extraction handles empty message list', async () => {
    const { finalState, history } = await reextractAllTurns([], [], THORNHAVEN_SETTINGS);

    expect(finalState).toEqual({});
    expect(history).toEqual([]);
    expect(ollamaService.extract).not.toHaveBeenCalled();
  });

  it('re-extraction handles single turn', async () => {
    const { finalState } = await reextractAllTurns(
      [FULL_DIALOGUE[0]],
      [LLM_RESPONSES[0]],
      THORNHAVEN_SETTINGS
    );

    expect(ollamaService.extract).toHaveBeenCalledTimes(1);
    expect(finalState.currentLocation).toBe('the courtyard');
    expect(finalState.lastUpdated).toBe(1);
  });
});

// ========================================================================
// Re-extraction for utility/session state
// ========================================================================

describe('extractSessionState — full re-extraction (utility mode)', () => {
  const UTILITY_DIALOGUE = [
    { user: 'Should we use SQLite or PostgreSQL?', assistant: 'For a local app, SQLite with WAL mode is ideal.' },
    { user: "Let's go with SQLite then.", assistant: 'Good choice. I\'ll set up the schema.' },
    { user: 'What about caching? Should we add Redis?', assistant: 'Redis adds complexity. Let\'s table that for now.' },
    { user: 'How do we handle authentication?', assistant: 'JWT tokens are the standard approach for APIs.' },
    { user: "Let's use JWT for auth. Also park the Redis discussion.", assistant: 'Agreed. JWT for auth, Redis parked for later.' },
  ];

  const UTILITY_LLM_RESPONSES = [
    { currentFocus: 'Database Selection', newQuestions: ['Should we use SQLite or PostgreSQL?'], newDecisions: [], newParkedItems: [], newEntities: ['SQLite', 'PostgreSQL'] },
    { currentFocus: 'Database Setup', newQuestions: [], newDecisions: ['Use SQLite with WAL mode'], newParkedItems: [], newEntities: ['SQLite'] },
    { currentFocus: 'Caching Strategy', newQuestions: ['Should we add Redis?'], newDecisions: [], newParkedItems: [], newEntities: ['Redis'] },
    { currentFocus: 'Authentication', newQuestions: ['How do we handle authentication?'], newDecisions: [], newParkedItems: [], newEntities: ['JWT'] },
    { currentFocus: 'Authentication', newQuestions: [], newDecisions: ['Use JWT for auth'], newParkedItems: ['Redis discussion'], newEntities: ['JWT'] },
  ];

  async function reextractSessionTurns(messages, llmResponses) {
    let state = {};
    const history = [];

    for (let i = 0; i < messages.length; i++) {
      const oldState = { ...state };
      ollamaService.extract.mockResolvedValueOnce(llmResponses[i]);
      state = await extractSessionState(messages[i].user, messages[i].assistant, state, i + 1);

      const changes = diffWorldState(oldState, state, i + 1);
      if (state._resolvedEvents?.length > 0) {
        for (const event of state._resolvedEvents) {
          changes.push({ turn: i + 1, field: 'openQuestions', from: event.text, action: 'resolved' });
        }
      }
      delete state._resolvedEvents;
      history.push(...changes);
    }

    return { finalState: state, history };
  }

  it('processes ALL turns and accumulates state', async () => {
    const { finalState } = await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    expect(ollamaService.extract).toHaveBeenCalledTimes(5);
    expect(finalState.lastUpdated).toBe(5);
    expect(finalState.currentFocus).toBe('Authentication');
  });

  it('accumulates entities across turns', async () => {
    const { finalState } = await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    const entityKeys = Object.keys(finalState.knownEntities).map(k => k.toLowerCase());
    expect(entityKeys).toContain('sqlite');
    expect(entityKeys).toContain('postgresql');
    expect(entityKeys).toContain('redis');
    expect(entityKeys).toContain('jwt');
  });

  it('tracks decisions from across the conversation', async () => {
    const { finalState } = await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    expect(finalState.decisions.length).toBeGreaterThanOrEqual(2);
    const decisionTexts = finalState.decisions.map(d => d.text);
    expect(decisionTexts.some(t => t.includes('SQLite'))).toBe(true);
    expect(decisionTexts.some(t => t.includes('JWT'))).toBe(true);
  });

  it('tracks parked items', async () => {
    const { finalState } = await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    expect(finalState.parkedItems.length).toBeGreaterThanOrEqual(1);
    expect(finalState.parkedItems.some(p => p.text.includes('Redis'))).toBe(true);
  });

  it('generates history entries from all turns', async () => {
    const { history } = await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    expect(history.length).toBeGreaterThan(0);
    const turns = [...new Set(history.map(h => h.turn))];
    expect(turns.length).toBeGreaterThan(1);
  });

  it('each call receives the correct turn text', async () => {
    await reextractSessionTurns(UTILITY_DIALOGUE, UTILITY_LLM_RESPONSES);

    for (let i = 0; i < UTILITY_DIALOGUE.length; i++) {
      const prompt = ollamaService.extract.mock.calls[i][1];
      expect(prompt).toContain(UTILITY_DIALOGUE[i].user);
      expect(prompt).toContain(UTILITY_DIALOGUE[i].assistant);
    }
  });
});

// ========================================================================
// Performance / timing tests
// ========================================================================

describe('extraction performance', () => {
  it('single roleplay turn extraction completes quickly with mocked LLM', async () => {
    ollamaService.extract.mockResolvedValue({
      currentLocation: 'the library',
      presentCharacters: ['Julian'],
      newEvents: ['Something happened'],
      mood: 'calm'
    });

    const start = performance.now();
    await extractWorldState('test', 'test', {}, 1, THORNHAVEN_SETTINGS);
    const elapsed = performance.now() - start;

    // With mocked LLM, pure JS logic should be < 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it('single session state extraction completes quickly with mocked LLM', async () => {
    ollamaService.extract.mockResolvedValue({
      currentFocus: 'Testing',
      newQuestions: ['Is it fast?'],
      newDecisions: ['Yes it is'],
      newParkedItems: [],
      newEntities: ['Vitest']
    });

    const start = performance.now();
    await extractSessionState('test', 'test', {}, 1);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('20-turn re-extraction completes quickly with mocked LLM', async () => {
    const turns = 20;

    for (let i = 0; i < turns; i++) {
      ollamaService.extract.mockResolvedValueOnce({
        currentLocation: i % 3 === 0 ? `room-${i}` : null,
        presentCharacters: ['Julian', 'Aria'],
        newEvents: i % 2 === 0 ? [`Event at turn ${i}`] : [],
        mood: i % 4 === 0 ? 'calm' : null
      });
    }

    const start = performance.now();
    let state = {};
    for (let i = 0; i < turns; i++) {
      state = await extractWorldState(`msg ${i}`, `reply ${i}`, state, i + 1, THORNHAVEN_SETTINGS);
    }
    const elapsed = performance.now() - start;

    // 20 turns of pure JS lifecycle logic should finish well under 200ms
    expect(elapsed).toBeLessThan(200);
    expect(state.lastUpdated).toBe(20);
    expect(ollamaService.extract).toHaveBeenCalledTimes(20);
  });

  it('extraction with heavy existing state does not degrade significantly', async () => {
    // Build a large existing state
    const knownCharacters = {};
    for (let i = 0; i < 20; i++) {
      knownCharacters[`char${i}`] = { firstSeen: i, lastSeen: i + 5, lastLocation: `room-${i}`, disposition: 'neutral' };
    }
    const ongoingEvents = [];
    for (let i = 0; i < 8; i++) {
      ongoingEvents.push({ text: `Ongoing event number ${i} with details`, firstDetected: i, lastConfirmed: i + 2, state: 'active' });
    }
    const locationTrail = [];
    for (let i = 0; i < 10; i++) {
      locationTrail.push({ location: `location-${i}`, arrivedTurn: i, departedTurn: i + 1 });
    }

    const heavyState = {
      currentLocation: 'the throne room',
      locationTrail,
      locationArrivedTurn: 10,
      currentTime: 'midnight',
      presentCharacters: ['Julian', 'Aria', 'Cass', 'Marguerite'],
      knownCharacters,
      ongoingEvents,
      mood: 'Tense',
      debates: [{ topic: 'trust' }, { topic: 'escape' }]
    };

    ollamaService.extract.mockResolvedValue({
      currentLocation: 'the dungeon',
      presentCharacters: ['Aria'],
      newEvents: ['Aria fell through a trap door'],
      mood: 'eerie'
    });

    const start = performance.now();
    const state = await extractWorldState('I fall!', 'You plunge into darkness.', heavyState, 50, THORNHAVEN_SETTINGS);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(state.currentLocation).toBe('the dungeon');
    // The heavy existing state should be preserved/merged
    expect(state.locationTrail.length).toBeGreaterThanOrEqual(10);
    expect(state.debates.length).toBe(2);
  });
});

// ========================================================================
// Prompt content verification
// ========================================================================

describe('extraction prompt content', () => {
  it('roleplay prompt includes character names from settings', async () => {
    ollamaService.extract.mockResolvedValue({ presentCharacters: [], newEvents: [] });

    await extractWorldState('test', 'test', {}, 1, THORNHAVEN_SETTINGS);

    const prompt = ollamaService.extract.mock.calls[0][1];
    expect(prompt).toContain('Julian Ashworth');
    expect(prompt).toContain('Marguerite Delacroix');
    expect(prompt).toContain('Cass Holloway');
    expect(prompt).toContain('Aria');
  });

  it('roleplay prompt includes current state context', async () => {
    ollamaService.extract.mockResolvedValue({ presentCharacters: [], newEvents: [] });

    const existing = { currentLocation: 'the library', mood: 'Mysterious' };
    await extractWorldState('test', 'test', existing, 2, THORNHAVEN_SETTINGS);

    const prompt = ollamaService.extract.mock.calls[0][1];
    expect(prompt).toContain('the library');
  });

  it('session state prompt includes current state context', async () => {
    ollamaService.extract.mockResolvedValue({ newQuestions: [], newDecisions: [], newParkedItems: [], newEntities: [] });

    const existing = { currentFocus: 'Database Migration' };
    await extractSessionState('test', 'test', existing, 2);

    const prompt = ollamaService.extract.mock.calls[0][1];
    expect(prompt).toContain('Database Migration');
  });

  it('uses correct model name for extraction', async () => {
    ollamaService.extract.mockResolvedValue({ presentCharacters: [], newEvents: [] });

    await extractWorldState('test', 'test', {}, 1, THORNHAVEN_SETTINGS);

    expect(ollamaService.extract.mock.calls[0][0]).toBe('phi4-mini');
  });
});

// ========================================================================
// Original diffWorldState and matchEvent tests
// ========================================================================

describe('diffWorldState', () => {
  it('detects scalar changes', () => {
    const old = { currentLocation: 'the tavern', mood: 'Calm' };
    const next = { currentLocation: 'the forest', mood: 'Tense' };
    const changes = diffWorldState(old, next, 5);
    expect(changes.length).toBe(2);
    expect(changes.every(c => c.turn === 5)).toBe(true);
  });

  it('detects array element additions', () => {
    const old = { presentCharacters: ['Julian'] };
    const next = { presentCharacters: ['Julian', 'Cass'] };
    const changes = diffWorldState(old, next, 3);
    expect(changes.length).toBe(1);
    expect(changes[0].action).toBe('arrived');
  });

  it('detects array element removals', () => {
    const old = { presentCharacters: ['Julian', 'Cass'] };
    const next = { presentCharacters: ['Julian'] };
    const changes = diffWorldState(old, next, 4);
    expect(changes.length).toBe(1);
    expect(changes[0].action).toBe('departed');
  });

  it('returns empty for identical states', () => {
    const state = { currentLocation: 'here', mood: 'Calm' };
    expect(diffWorldState(state, state, 1)).toEqual([]);
  });

  it('handles null/undefined inputs', () => {
    expect(diffWorldState(null, {}, 1)).toEqual([]);
    expect(diffWorldState({}, null, 1)).toEqual([]);
  });

  it('works for utility mode fields', () => {
    const old = { currentFocus: 'Database' };
    const next = { currentFocus: 'Authentication' };
    const changes = diffWorldState(old, next, 2);
    expect(changes.length).toBe(1);
    expect(changes[0].field).toBe('currentFocus');
  });
});

describe('matchEvent', () => {
  it('finds matching event with high token overlap', () => {
    const events = [
      { text: 'The stairs collapsed and broke apart completely' },
      { text: 'Julian offered a glass of port in the study' }
    ];
    const idx = matchEvent('The stairs collapsed and broke beneath her', events);
    expect(idx).toBe(0);
  });

  it('returns -1 for completely unrelated text', () => {
    const events = [{ text: 'The dragon attacked the village at dawn' }];
    expect(matchEvent('She found a quiet book in the library', events)).toBe(-1);
  });

  it('handles string events for backward compatibility', () => {
    const events = ['The house rearranged its corridors and shifted rooms'];
    const idx = matchEvent('The house rearranged its corridors once more', events);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it('returns -1 for empty events list', () => {
    expect(matchEvent('anything', [])).toBe(-1);
  });
});
