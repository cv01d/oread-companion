/**
 * Character stance extraction using regex pattern matching.
 * Zero inference — detects opinion markers, agreement/disagreement patterns.
 * Tracks character positions for dialectic enforcement.
 */

// Patterns indicating a character is taking a position
const OPINION_PATTERNS = [
  { pattern: /\bi (?:believe|think|feel|know|maintain|insist|argue|contend)\s+(?:that\s+)?(.{10,100})/gi, strength: 'strong' },
  { pattern: /\bi (?:disagree|don't agree|cannot agree|refuse to accept)\b.*?[.!]/gi, strength: 'opposition' },
  { pattern: /\bthat's not (?:how i see it|true|right|correct|accurate)\b/gi, strength: 'opposition' },
  { pattern: /\byou'?re (?:wrong|mistaken|missing the point)\b/gi, strength: 'opposition' },
  { pattern: /\bi (?:must|have to|need to) (?:say|point out|emphasize)\s+(.{10,100})/gi, strength: 'strong' },
  { pattern: /\bin my (?:view|opinion|experience|judgment)\b.*?[.!]/gi, strength: 'moderate' },
  { pattern: /\bthe truth is\b.*?[.!]/gi, strength: 'strong' },
  { pattern: /\bi (?:stand by|stand firm|won't budge on|hold to)\b.*?[.!]/gi, strength: 'firm' },
];

// Patterns indicating agreement/concession (signals position change)
const AGREEMENT_PATTERNS = [
  /\byou (?:make a good|have a|raise a valid) point\b/i,
  /\bi (?:hadn't considered|never thought of it) that way\b/i,
  /\bperhaps you'?re right\b/i,
  /\bi (?:concede|admit|grant|acknowledge) (?:that|your)\b/i,
  /\bi was wrong\b/i,
  /\bi'?ve changed my mind\b/i,
];

// Topic extraction: what are they talking about
const TOPIC_PATTERNS = [
  /\babout\s+(.{5,60}?)(?:\.|,|\?|!|$)/gi,
  /\bregarding\s+(.{5,60}?)(?:\.|,|\?|!|$)/gi,
  /\bthe (?:question|matter|issue|topic|problem) of\s+(.{5,60}?)(?:\.|,|\?|!|$)/gi,
  /\bwhether\s+(.{5,60}?)(?:\.|,|\?|!|$)/gi,
];

/**
 * Map character traits to a dialectic style.
 *
 * @param {Object} traits - Character trait selections (e.g. { Honest: true, Calm: true })
 * @returns {string} Dialectic mode
 */
function inferDialecticMode(traits) {
  if (!traits || Object.keys(traits).length === 0) return 'socratic';

  const traitNames = Object.keys(traits).map(t => t.toLowerCase());

  // Confrontational: assertive, honest, passionate, abrasive, intense
  const confrontational = ['assertive', 'honest', 'abrasive', 'passionate', 'intense', 'courageous'];
  const confrontScore = traitNames.filter(t => confrontational.includes(t)).length;

  // Socratic: wise, patient, principled, calm, steady
  const socratic = ['principled', 'calm', 'steady', 'reserved', 'humble', 'authentic'];
  const socraticScore = traitNames.filter(t => socratic.includes(t)).length;

  // Gentle challenge: warm, empathetic, gentle, sensitive, easygoing
  const gentle = ['warm', 'gentle', 'sensitive', 'easygoing', 'caring'];
  const gentleScore = traitNames.filter(t => gentle.includes(t)).length;

  if (confrontScore > socraticScore && confrontScore > gentleScore) return 'confrontational';
  if (gentleScore > socraticScore) return 'gentle-challenge';
  return 'socratic';
}

/**
 * Extract character stances from conversation.
 *
 * @param {string} assistantResponse - What the character said
 * @param {string} userMessage - What the user said
 * @param {Object} currentStances - Existing stance data for this character
 * @param {Object} characterTraits - The character's trait selections
 * @returns {Object} Updated stances
 */
export function extractStances(assistantResponse, userMessage, currentStances = {}, characterTraits = {}) {
  const charName = Object.keys(currentStances)[0] || 'Character';
  const stances = currentStances[charName] || {
    positions: [],
    dialecticMode: inferDialecticMode(characterTraits),
    currentEmotionalState: 'neutral',
    recentConflicts: []
  };

  // Detect positions from assistant response
  for (const { pattern, strength } of OPINION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(assistantResponse)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length < 15 || fullMatch.length > 200) continue;

      // Try to extract topic
      let topic = 'general';
      for (const topicPattern of TOPIC_PATTERNS) {
        const topicRegex = new RegExp(topicPattern.source, topicPattern.flags);
        const topicMatch = topicRegex.exec(userMessage + ' ' + assistantResponse);
        if (topicMatch) {
          topic = topicMatch[1].trim().replace(/[.!?,]$/, '');
          break;
        }
      }

      // Check if we already have a position on this topic
      const existingIdx = stances.positions.findIndex(p =>
        p.topic.toLowerCase() === topic.toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing position
        stances.positions[existingIdx].stance = fullMatch;
        stances.positions[existingIdx].strength = strength;
      } else {
        stances.positions.push({
          topic,
          stance: fullMatch,
          reasoning: match[1]?.trim() || '',
          strength
        });
      }
    }
  }

  // Cap positions at 10
  stances.positions = stances.positions.slice(-10);

  // Detect agreement/concession (potential position shift)
  for (const pattern of AGREEMENT_PATTERNS) {
    if (pattern.test(assistantResponse)) {
      stances.recentConflicts.push('Conceded a point');
      break;
    }
  }

  // Detect conflicts from user challenging
  const challengePatterns = [
    /\bbut (?:what about|don't you think|isn't it|wouldn't)\b/i,
    /\bi disagree\b/i,
    /\byou'?re (?:wrong|missing|ignoring)\b/i,
    /\bthat (?:doesn't make sense|can't be right)\b/i,
  ];
  for (const pattern of challengePatterns) {
    if (pattern.test(userMessage)) {
      stances.recentConflicts.push('User challenged position');
      break;
    }
  }

  // Cap recent conflicts
  stances.recentConflicts = stances.recentConflicts.slice(-5);

  // Detect emotional state from response patterns
  if (/\b(frustrated|annoyed|irritated)\b/i.test(assistantResponse)) {
    stances.currentEmotionalState = 'frustrated';
  } else if (/\b(determined|resolute|firm)\b/i.test(assistantResponse)) {
    stances.currentEmotionalState = 'determined';
  } else if (/\b(curious|intrigued|interested)\b/i.test(assistantResponse)) {
    stances.currentEmotionalState = 'curious';
  } else if (/\b(thoughtful|considering|reflecting)\b/i.test(assistantResponse)) {
    stances.currentEmotionalState = 'thoughtful';
  }

  // Update dialectic mode from traits
  stances.dialecticMode = inferDialecticMode(characterTraits);

  return { [charName]: stances };
}
