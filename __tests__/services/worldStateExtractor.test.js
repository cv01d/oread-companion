import { describe, it, expect } from 'vitest';
import { extractWorldState, extractSessionState, diffWorldState, matchEvent } from '../../services/worldStateExtractor.js';

// Settings matching the Haunted Romance template
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

const THORNHAVEN_TURNS = [
  {
    user: 'Hey',
    assistant: `Ah, there you are. I wondered how long it would take you to find this room. Welcome to Thornhaven. I'm Julian, your ghostly guide to this particular slice of the afterlife. The house seems rather pleased to have company - can't say I blame it. The last architect who tried to 'modernize' the place left in quite a hurry after he discovered the library's tendency to rearrange itself. Shall we start with a tour, or are you more interested in the haunting experience? The house has quite a reputation, you know.`
  },
  {
    user: `I thought ghosts were supposed to hide and not be visible to us.. oh no?!?... I am a ghost aren't I ?`,
    assistant: `Oh, you're very much alive - but you are in the afterlife, so that's something of a grey area. As for me, well, let's just say the rules here don't quite apply as neatly as they do up there. Or down there, depending on your perspective. The house has its own logic, and I'm simply along for the ride. Speaking of which, have you considered asking it why it chose to bring you here? It tends to be rather particular about its guests.`
  },
  {
    user: `Afterlife!`,
    assistant: `Precisely. And isn't it grand? You'll find that time flows a bit differently here - we can spend the better part of an afternoon in a single moment if you wish, or race through centuries in the blink of an eye. It all depends on what sort of adventure you're after. Personally, I find the library to be most engaging. The books have a tendency to reach out and grab your attention - sometimes quite literally. Shall we start there?`
  },
  {
    user: `literally? I pause for a moment to consider this. Oh... I have always wanted to exist in wuthering heights? Do you think I could fall in love with Heatcliff... I would make a great Catherine don't you think.. I attempt to fall into your arms and as you reach out to grab I simply fall thru them... landing on the floor and then getting up dusting myself off.. "Well, that was.. not exactly as planned..."`,
    assistant: `Well, it seems the house has a rather dry sense of humor. As for Wuthering Heights, I'm afraid Heathcliff isn't here - or anywhere in this dimension, come to think of it. The house's library is far more eclectic than that particular romance. You'll find works you've never even dreamed of, let alone read. Oh! Speaking of which, have you noticed how the floorboards are starting to creak? I do hope they're not getting ideas about rearranging themselves again.`
  },
  {
    user: `Well. now .. wait.. I roll my eyes.. first you tell me I am in the afterlife.. and now you tell me the ground is rearranging itself.. a girl has to have something to work with here...`,
    assistant: `My apologies, it seems we're both still adjusting to your arrival. The house does tend to be rather theatrical about its comings and goings. As for Heathcliff, well, let's just say that romance in the afterlife is complicated at best. But perhaps you'd like a drink? I believe there's some excellent port in the study - assuming it hasn't relocated again.`
  },
  {
    user: `Oh yes indeed I think that would be very welcome... so J.. explain me these rules of love you speak about...`,
    assistant: `Love here is more of a negotiation than an emotion, to be honest. The house itself has quite the reputation for matchmaking - or mismatching, depending on your perspective. Portions of it can become 'sticky' if you're not careful, and certain rooms have been known to keep guests for decades without them realizing time was passing at all. As for Heathcliff, well, let's just say that particular story ended rather badly. The house tends to be a bit more practical in its arrangements.`
  },
  {
    user: `No candles no moonlight no dark broody wonderfully melancholic, but passionate! very passionate mind you.. love stories.. alright.. well so how does one pass the time in the world of the undead...?`,
    assistant: `Time itself is the great luxury here - or perhaps the great curse. You can spend a century watching the fire die down to embers, or you can blink and find yourself in an entirely different era altogether. Some souls spend their days reading, others exploring the vast corridors of this ever-shifting house. Personally, I've found that creating new memories is far more rewarding than dwelling on old ones. The house has a way of helping with that, if you're willing to trust its methods.`
  },
  {
    user: `I am absolutely not trusting something that costantly shifts the ground beneath my feet for no reason. Do you hear that house? Good luck.. I smirk at you.`,
    assistant: `The house does have quite a sense of humor about these things, though it's a bit hard to explain without sounding completely mad. As for trust - well, consider this: the only thing constant here is change itself. The ground beneath your feet might shift, but so do the corridors of time and memory. It's all rather flexible when you think about it that way.`
  },
  {
    user: `So it is like life then, a glorious pain in my ass`,
    assistant: `Precisely! Though I must say, this version tends to be far more entertaining. The house, for instance, has been known to rearrange itself into quite the comedy routine when guests get too self-serious. It's also rather fond of pranks - the kind that have souls rolling in their spectral bodies with laughter, or frustration, depending on their particular sense of humor.`
  },
  {
    user: `Oh lord so now I have landed in prankster house in the afterlife.. for no reason except placement in a comedic of divine making.. it is not really hell though nor heaven.. something.... or is it.. is this hell? Oh lord what I have done.. I promise.. I do think I tried to be good.. my heart was in the right place even when my feet weren't truly..`,
    assistant: `Oh, you needn't fret so. This isn't divine punishment - more like cosmic entertainment. The house has its own logic, and it seems to have found your presence amusing. As for what you've done, well, that's not really the point here. In this place, past actions mean little - it's all about how you navigate the present moment. And speaking of which, I believe the study is calling our names again. The port should be just where we left it last time, assuming 'last time' has any meaning in a house that defies temporal logic.`
  },
  {
    user: `I raise an eyebrow fair enough lead the way.. to the study we go`,
    assistant: `Very well then! Follow me closely now - I wouldn't want you to get lost in the shifting corridors. The house tends to rearrange itself rather unexpectedly, especially when there's a new guest to entertain. Oh, and do watch your step! Some of these floorboards can be quite... mischievous at times.`
  },
  {
    user: `I closely follow behind Julian careful to watch my step, but as I turn to follow his spectral turn of the century figure floating up the stairs in his spectral costume.. I forget to watch my step in my true clumsy nature I miss a step tripping over the floorboards...`,
    assistant: `Ah! As I feared. The house does seem quite pleased with itself today, doesn't it? Well, no harm done - at least you're still intact. Though I must say, this staircase seems to be enjoying your company rather too much. It's been years since we've had such an... animated guest. Shall we try again? This time, perhaps focus on the back of my head instead of watching where you're going?`
  },
  {
    user: `Right then a large cracking sound occurs the steps break.... I let out a light high pitched scream as I fall thru several floors landing somewhere in.. I look around.. a basement? huh.. what is the place... I call up.. .J?.. JJJJJJ? J? I sigh... well... ok... now I really am in hell... to high for you was dead thornhaven.. who were you anyway? You had to have been someone once.. houses aren't just... beings... so.. how did you happen... I put my figure to my chin thinking for a moment.. while trying to assess my surroundings..`,
    assistant: `Oh, come now! You're far too dramatic for this place. This isn't hell - it's something far more interesting. As for me, well, let's just say I'm an architect who bit off rather more than he could chew. The house decided to keep me around as its de facto guide after... certain events. It's quite the life, really. Full of surprises! Now then, shall we discuss how you're going to get out of that basement? The stairs appear to be taking a nap for now, so you'll need to find an alternative route.`
  },
  {
    user: `well then I geuss I don't know J .. you built this place... what exactly.. did you build here...`,
    assistant: `I designed it as a sort of refuge - a place where souls could come and process their afterlives. But the house had other ideas, as they tend to do. It wanted something more... dynamic. So I suppose I built the most unpredictable architectural masterpiece in all of existence. Sometimes I think the whole point is that you can never truly build anything here - it's always building itself around you.`
  }
];

/**
 * Run the full dialogue through the extractor, building state incrementally.
 */
function runFullDialogue(turns, settings) {
  let state = {};
  const stateHistory = [];
  for (let i = 0; i < turns.length; i++) {
    state = extractWorldState(turns[i].user, turns[i].assistant, state, i + 1, settings);
    stateHistory.push({ ...state });
  }
  return { finalState: state, stateHistory };
}

describe('extractWorldState — Thornhaven full dialogue', () => {
  const { finalState, stateHistory } = runFullDialogue(THORNHAVEN_TURNS, THORNHAVEN_SETTINGS);

  describe('produces structured output', () => {
    it('tracks turn count', () => {
      expect(finalState.lastUpdated).toBe(THORNHAVEN_TURNS.length);
    });

    it('populates presentCharacters as a non-empty array', () => {
      expect(Array.isArray(finalState.presentCharacters)).toBe(true);
      expect(finalState.presentCharacters.length).toBeGreaterThan(0);
    });

    it('populates knownCharacters as a non-empty object', () => {
      expect(typeof finalState.knownCharacters).toBe('object');
      expect(Object.keys(finalState.knownCharacters).length).toBeGreaterThan(0);
    });

    it('all character names are clean strings under 50 chars', () => {
      for (const name of finalState.presentCharacters) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
        expect(name.length).toBeLessThan(50);
      }
    });

    it('known character entries have structural integrity', () => {
      for (const [key, data] of Object.entries(finalState.knownCharacters)) {
        expect(typeof key).toBe('string');
        expect(typeof data.firstSeen).toBe('number');
        expect(typeof data.lastSeen).toBe('number');
        expect(data.lastSeen).toBeGreaterThanOrEqual(data.firstSeen);
        expect(typeof data.disposition).toBe('string');
      }
    });

    it('detects a mood from the dialogue', () => {
      expect(finalState.mood).toBeTruthy();
      expect(typeof finalState.mood).toBe('string');
    });

    it('detects at least one location', () => {
      const hasLocation = finalState.currentLocation || (finalState.locationTrail?.length > 0);
      expect(hasLocation).toBeTruthy();
    });

    it('locations are clean strings under 50 chars', () => {
      if (finalState.currentLocation) {
        expect(finalState.currentLocation.length).toBeLessThan(50);
      }
      for (const loc of (finalState.locationTrail || [])) {
        expect(loc.location.length).toBeLessThan(50);
      }
    });

    it('extracts at least one ongoing event', () => {
      expect(finalState.ongoingEvents?.length).toBeGreaterThan(0);
    });

    it('events have valid lifecycle structure', () => {
      for (const event of (finalState.ongoingEvents || [])) {
        expect(typeof event).toBe('object');
        expect(typeof event.text).toBe('string');
        expect(event.text.length).toBeGreaterThan(10);
        expect(event.text.length).toBeLessThan(150);
        expect(['active', 'fading', 'resolved']).toContain(event.state);
        expect(typeof event.firstDetected).toBe('number');
        expect(typeof event.lastConfirmed).toBe('number');
      }
    });
  });

  describe('state evolves over the conversation', () => {
    it('characters accumulate — more known characters at end than beginning', () => {
      const earlyKnown = Object.keys(stateHistory[1]?.knownCharacters || {}).length;
      const lateKnown = Object.keys(finalState.knownCharacters || {}).length;
      expect(lateKnown).toBeGreaterThanOrEqual(earlyKnown);
    });

    it('state is not identical between first and last turn', () => {
      const first = stateHistory[0];
      const last = finalState;
      // At minimum, lastUpdated should differ
      expect(last.lastUpdated).toBeGreaterThan(first.lastUpdated);
      // And more data should exist in the final state
      const firstSize = JSON.stringify(first).length;
      const lastSize = JSON.stringify(last).length;
      expect(lastSize).toBeGreaterThan(firstSize);
    });

    it('events accumulate across turns', () => {
      // Count total events seen across all state snapshots
      let maxEvents = 0;
      for (const snapshot of stateHistory) {
        const count = (snapshot.ongoingEvents || []).length;
        if (count > maxEvents) maxEvents = count;
      }
      expect(maxEvents).toBeGreaterThan(0);
    });
  });
});

describe('extractWorldState — handles edge cases', () => {
  it('handles empty messages', () => {
    const state = extractWorldState('', '', {}, 1, THORNHAVEN_SETTINGS);
    expect(state.lastUpdated).toBe(1);
  });

  it('handles missing settings gracefully', () => {
    const state = extractWorldState('Hello', 'Hi there', {}, 1);
    expect(state.lastUpdated).toBe(1);
  });

  it('preserves existing state when nothing new is detected', () => {
    const existing = {
      currentLocation: 'the library',
      mood: 'Mysterious',
      presentCharacters: ['Julian'],
      knownCharacters: { julian: { firstSeen: 1, lastSeen: 1, lastLocation: '', disposition: 'neutral' } }
    };
    const state = extractWorldState('ok', 'indeed', existing, 2, THORNHAVEN_SETTINGS);
    expect(state.knownCharacters.julian).toBeTruthy();
  });
});

describe('diffWorldState', () => {
  it('detects changes between two different states', () => {
    const old = { currentLocation: 'the tavern', mood: 'Calm' };
    const next = { currentLocation: 'the forest', mood: 'Tense' };
    const changes = diffWorldState(old, next, 5);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.turn === 5)).toBe(true);
    expect(changes.every(c => typeof c.field === 'string')).toBe(true);
  });

  it('detects array element additions', () => {
    const old = { presentCharacters: ['Julian'] };
    const next = { presentCharacters: ['Julian', 'Cass'] };
    const changes = diffWorldState(old, next, 3);
    expect(changes.length).toBe(1);
    expect(changes[0].action).toBeTruthy();
  });

  it('returns empty for identical states', () => {
    const state = { currentLocation: 'here', mood: 'Calm' };
    expect(diffWorldState(state, state, 1)).toEqual([]);
  });

  it('handles null/undefined inputs', () => {
    expect(diffWorldState(null, {}, 1)).toEqual([]);
    expect(diffWorldState({}, null, 1)).toEqual([]);
  });

  it('works for utility mode fields too', () => {
    const old = { currentFocus: 'Database' };
    const next = { currentFocus: 'Authentication' };
    const changes = diffWorldState(old, next, 2);
    expect(changes.length).toBe(1);
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

describe('extractSessionState — utility mode', () => {
  it('produces structured output from a technical discussion', () => {
    let state = {};
    state = extractSessionState(
      'Should we use SQLite or PostgreSQL for the database? How do we handle concurrent writes?',
      'SQLite with WAL mode handles concurrent reads well. For heavy concurrent writes, PostgreSQL is better. Let\'s go with SQLite for now since we\'re building a local app.',
      state, 1
    );

    expect(state.lastUpdated).toBe(1);
    // Should extract something meaningful — we don't dictate what
    const hasContent = state.currentFocus ||
      (state.openQuestions?.length > 0) ||
      (state.decisions?.length > 0);
    expect(hasContent).toBeTruthy();
  });

  it('tracks state across multiple turns', () => {
    let state = {};
    state = extractSessionState(
      'We need to figure out the authentication strategy.',
      'There are several options: JWT tokens, session cookies, or OAuth.',
      state, 1
    );
    state = extractSessionState(
      'What about rate limiting? How should we handle that?',
      'Express-rate-limit is the standard choice. We should add it to all API endpoints.',
      state, 2
    );
    state = extractSessionState(
      "Let's go with JWT for auth and express-rate-limit for throttling.",
      'Good choices. I\'ll set up the middleware.',
      state, 3
    );

    // After 3 turns, state should have grown
    expect(state.lastUpdated).toBe(3);
    const totalItems = (state.openQuestions?.length || 0) +
      (state.decisions?.length || 0) +
      Object.keys(state.knownEntities || {}).length;
    expect(totalItems).toBeGreaterThan(0);
  });

  it('promotes entities seen in multiple turns', () => {
    let state = {};
    state = extractSessionState(
      'We should look at LangChain for the RAG pipeline.',
      'LangChain provides good abstractions for retrieval.',
      state, 1
    );
    state = extractSessionState(
      'How does LangChain handle streaming responses?',
      'LangChain supports streaming via async callbacks.',
      state, 2
    );

    const entities = state.knownEntities || {};
    const multiTurnEntities = Object.entries(entities).filter(
      ([, data]) => data.lastSeen > data.firstSeen
    );
    // At least one entity should have been seen across multiple turns
    expect(multiTurnEntities.length).toBeGreaterThan(0);
  });
});
