import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deduplicateAndCap } from '../../services/factExtractor.js';

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

import { extractFacts } from '../../services/factExtractor.js';
import ollamaService from '../../services/ollama.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractFacts', () => {
  describe('LLM-based extraction', () => {
    it('extracts people, places, events, and facts from LLM response', async () => {
      ollamaService.extract.mockResolvedValue({
        people: ['Mr. Varen', 'Dr. Elara'],
        places: ['London'],
        events: ['Mr. Varen drew his sword at the bridge'],
        facts: ['The army of 5000 soldiers marched toward the capital']
      });

      const results = await extractFacts(
        'Mr. Varen drew his sword at the bridge.',
        'Dr. Elara watched from London.',
        1
      );

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results.filter(r => r.type === 'person').length).toBeGreaterThanOrEqual(2);
      expect(results.filter(r => r.type === 'place').length).toBeGreaterThanOrEqual(1);
      expect(results.filter(r => r.type === 'event').length).toBeGreaterThanOrEqual(1);
      expect(results.filter(r => r.type === 'fact').length).toBeGreaterThanOrEqual(1);
    });

    it('sets turn number on all results', async () => {
      ollamaService.extract.mockResolvedValue({
        people: ['Smith'],
        places: [],
        events: [],
        facts: []
      });

      const results = await extractFacts('Mr. Smith arrived.', '', 42);
      expect(results.every(r => r.turn === 42)).toBe(true);
    });

    it('deduplicates entries from LLM response', async () => {
      ollamaService.extract.mockResolvedValue({
        people: ['Smith', 'Smith', 'smith'],
        places: [],
        events: [],
        facts: []
      });

      const results = await extractFacts('Smith and Smith.', '', 1);
      const smithEntries = results.filter(r => r.type === 'person');
      // Case-insensitive dedup should keep only one
      expect(smithEntries.length).toBe(1);
    });

    it('returns empty array when extraction model is not ready', async () => {
      // Temporarily override mock
      const { default: manager } = await import('../../services/extractionModelManager.js');
      const origReady = manager.isReady;
      manager.isReady = () => false;

      const results = await extractFacts('Hello world.', '', 1);
      expect(results).toEqual([]);

      manager.isReady = origReady;
    });

    it('returns empty array when LLM call fails', async () => {
      ollamaService.extract.mockRejectedValue(new Error('Connection refused'));

      const results = await extractFacts('Hello world.', '', 1);
      expect(results).toEqual([]);
    });

    it('handles malformed LLM response gracefully', async () => {
      ollamaService.extract.mockResolvedValue({
        people: 'not-an-array',
        events: null
      });

      const results = await extractFacts('Hello world.', '', 1);
      expect(Array.isArray(results)).toBe(true);
    });

    it('filters out entries shorter than 2 chars', async () => {
      ollamaService.extract.mockResolvedValue({
        people: ['A', 'Mr. Smith'],
        places: [],
        events: [],
        facts: []
      });

      const results = await extractFacts('Test.', '', 1);
      for (const result of results) {
        expect(result.text.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('returns objects with type, text, and turn properties', async () => {
      ollamaService.extract.mockResolvedValue({
        people: ['Varen'],
        places: ['London'],
        events: ['Varen drew his sword'],
        facts: ['5000 soldiers marched']
      });

      const results = await extractFacts('Test.', 'Test.', 5);
      for (const result of results) {
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('turn');
        expect(['person', 'place', 'event', 'fact']).toContain(result.type);
      }
    });
  });
});

describe('deduplicateAndCap', () => {
  it('deduplicates identical facts', () => {
    const existing = [{ type: 'person', text: 'Smith', turn: 1 }];
    const newFacts = [{ type: 'person', text: 'Smith', turn: 2 }];
    const result = deduplicateAndCap(existing, newFacts);
    expect(result.length).toBe(1);
    expect(result[0].turn).toBe(2); // Newer wins
  });

  it('deduplicates case-insensitively', () => {
    const existing = [{ type: 'person', text: 'SMITH', turn: 1 }];
    const newFacts = [{ type: 'person', text: 'smith', turn: 2 }];
    const result = deduplicateAndCap(existing, newFacts);
    expect(result.length).toBe(1);
  });

  it('caps at maxFacts', () => {
    // All facts at same turn so age filter doesn't remove any
    const existing = Array.from({ length: 100 }, (_, i) => ({
      type: 'fact', text: `fact-${i}`, turn: 50
    }));
    const result = deduplicateAndCap(existing, [], { maxFacts: 80 });
    expect(result.length).toBe(80);
  });

  it('drops facts older than maxTurnAge', () => {
    const existing = [
      { type: 'fact', text: 'old-fact', turn: 1 },
      { type: 'fact', text: 'recent-fact', turn: 45 }
    ];
    // currentTurn is derived from newFacts[0].turn = 50; age of old-fact = 50-1 = 49 >= 40
    const newFacts = [{ type: 'fact', text: 'new-fact', turn: 50 }];
    const result = deduplicateAndCap(existing, newFacts, { maxTurnAge: 40 });
    expect(result.some(f => f.text === 'old-fact')).toBe(false);
    expect(result.some(f => f.text === 'recent-fact')).toBe(true);
    expect(result.some(f => f.text === 'new-fact')).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(deduplicateAndCap([], [])).toEqual([]);
  });
});
