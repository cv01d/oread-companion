/**
 * Token-budgeted context window selection.
 * Pure function — no dependencies on Ollama or DB.
 */


/**
 * Estimate token count from text (rough: ~4 chars per token)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Tokenize text into lowercase words, stripping stopwords.
 */
const STOPWORDS = new Set(['the','a','an','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','that','this','it','i','me','my','we','our','you','your','he','she','they','them','what','which','who','whom']);

function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Format a history entry as a human-readable line.
 */
function formatHistoryEntry(entry, currentTurn) {
  const ago = currentTurn ? `${currentTurn - entry.turn} turns ago` : `turn ${entry.turn}`;
  if (entry.from && entry.to) {
    return `${ago}: ${entry.field} changed from "${entry.from}" to "${entry.to}"`;
  } else if (entry.action && entry.to) {
    return `${ago}: ${entry.field} — ${entry.action}: ${entry.to}`;
  } else if (entry.action && entry.from) {
    return `${ago}: ${entry.field} — ${entry.action}: ${entry.from}`;
  }
  return `${ago}: ${entry.field} changed`;
}

/**
 * Select relevant history entries: always the most recent N, plus keyword-matched older ones.
 */
function selectRelevantHistory(history, userMessage, currentTurn) {
  if (!history || history.length === 0) return [];

  const RECENT_COUNT = 3;
  const MAX_TOTAL = 8;

  // Always include the most recent entries
  const recent = history.slice(-RECENT_COUNT);
  const recentTurns = new Set(recent.map(e => `${e.turn}:${e.field}:${e.from}:${e.to}`));

  // Keyword-match older entries against user message
  const userTokens = tokenize(userMessage);
  if (userTokens.size === 0) return recent;

  const older = history.slice(0, -RECENT_COUNT);
  const scored = [];

  for (const entry of older) {
    const entryText = [entry.field, entry.from, entry.to, entry.action].filter(Boolean).join(' ');
    const entryTokens = tokenize(entryText);
    if (entryTokens.size === 0) continue;

    // Jaccard-like: count overlapping tokens
    let overlap = 0;
    for (const token of userTokens) {
      if (entryTokens.has(token)) overlap++;
    }
    const score = overlap / Math.min(userTokens.size, entryTokens.size);

    if (score >= 0.2) {
      const key = `${entry.turn}:${entry.field}:${entry.from}:${entry.to}`;
      if (!recentTurns.has(key)) {
        scored.push({ entry, score });
      }
    }
  }

  // Sort by relevance, take top entries up to cap
  scored.sort((a, b) => b.score - a.score);
  const matched = scored.slice(0, MAX_TOTAL - recent.length).map(s => s.entry);

  // Combine and sort chronologically
  const combined = [...matched, ...recent];
  combined.sort((a, b) => a.turn - b.turn);
  return combined;
}

/**
 * Detect and collapse repetition loops in message history.
 * When consecutive assistant responses are identical (or near-identical),
 * collapse them to a single instance and flag the repetition.
 * Returns { messages, repetitionDetected }.
 */
function deduplicateRepetitions(messages) {
  if (messages.length < 4) return { messages, repetitionDetected: false };

  const result = [];
  let repetitionDetected = false;
  let lastAssistantContent = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === 'assistant') {
      const content = msg.content?.trim() || '';
      // Check for near-identical: same first 200 chars (handles minor trailing differences)
      const signature = content.substring(0, 200);

      if (lastAssistantContent && lastAssistantContent === signature) {
        // This is a repeated assistant response — skip it
        repetitionDetected = true;
        // Also skip the user message immediately before this repeated response
        // (it was a retry that got the same answer)
        if (result.length > 0 && result[result.length - 1].role === 'user') {
          result.pop();
        }
        continue;
      }

      lastAssistantContent = signature;
    } else {
      // Reset tracking when we see a non-duplicate flow
    }

    result.push(msg);
  }

  if (repetitionDetected) {
    console.warn(`⚠️ Repetition loop detected: collapsed ${messages.length - result.length} duplicate messages`);
  }

  return { messages: result, repetitionDetected };
}

/**
 * Build a compact context block from story notes, rolling summary, and extracted facts.
 */
function buildContextBlock(storyNotes, extractedFacts, rollingSummary, worldState, characterStances, globalContext, mode, worldStateHistory, lastUserMessage) {
  const parts = [];

  if (storyNotes && storyNotes.trim()) {
    parts.push(`[Story Notes]\n${storyNotes.trim()}`);
  }

  if (rollingSummary && rollingSummary.trim()) {
    parts.push(`[Conversation Summary]\n${rollingSummary.trim()}`);
  }

  if (extractedFacts && extractedFacts.length > 0) {
    const people = extractedFacts.filter(f => f.type === 'person');
    const places = extractedFacts.filter(f => f.type === 'place');
    const events = extractedFacts.filter(f => f.type === 'event');
    const facts = extractedFacts.filter(f => f.type === 'fact');

    const lines = [];
    if (people.length > 0) {
      lines.push(`People: ${people.map(f => f.text).join(', ')}`);
    }
    if (places.length > 0) {
      lines.push(`Places: ${places.map(f => f.text).join(', ')}`);
    }
    if (events.length > 0) {
      lines.push(`Events: ${events.map(f => f.text).join(', ')}`);
    }
    if (facts.length > 0) {
      lines.push(`Facts: ${facts.map(f => f.text).join(', ')}`);
    }

    if (lines.length > 0) {
      parts.push(`[Session Memory]\n${lines.join('\n')}`);
    }
  }

  if (worldState && Object.keys(worldState).length > 0) {
    if (mode === 'roleplay') {
      // === Roleplay: [World State] ===
      const wsLines = [];
      if (worldState.currentTime) wsLines.push(`Time: ${worldState.currentTime}`);
      if (worldState.currentLocation) wsLines.push(`Location: ${worldState.currentLocation}`);

      if (worldState.locationTrail?.length > 0) {
        const recent = worldState.locationTrail.slice(-3);
        const crumbs = recent.map(loc => {
          const turnsAgo = (worldState.lastUpdated || 0) - (loc.departedTurn || 0);
          return `${loc.location} (left ${turnsAgo} turns ago)`;
        });
        wsLines.push(`Previously: ${crumbs.join(', ')}`);
      }

      if (worldState.presentCharacters?.length) wsLines.push(`Present: ${worldState.presentCharacters.join(', ')}`);

      if (worldState.knownCharacters) {
        const presentSet = new Set((worldState.presentCharacters || []).map(c => c.toLowerCase()));
        const lastSeen = [];
        for (const [key, data] of Object.entries(worldState.knownCharacters)) {
          if (!presentSet.has(key)) {
            const turnsAgo = (worldState.lastUpdated || 0) - (data.lastSeen || 0);
            if (turnsAgo <= 30) {
              const name = key.charAt(0).toUpperCase() + key.slice(1);
              lastSeen.push(`${name} (${turnsAgo} turns ago${data.lastLocation ? ', at ' + data.lastLocation : ''})`);
            }
          }
        }
        if (lastSeen.length > 0) wsLines.push(`Last seen: ${lastSeen.join(', ')}`);
      }

      if (worldState.ongoingEvents?.length) {
        const active = [];
        const fading = [];
        for (const event of worldState.ongoingEvents) {
          if (typeof event === 'string') {
            active.push(event);
          } else if (event.state === 'fading') {
            const age = (worldState.lastUpdated || 0) - (event.firstDetected || 0);
            fading.push(`${event.text} (first noted ${age} turns ago)`);
          } else {
            active.push(event.text);
          }
        }
        if (active.length > 0) wsLines.push(`Ongoing: ${active.join('; ')}`);
        if (fading.length > 0) wsLines.push(`Fading: ${fading.join('; ')}`);
      }

      if (worldState.discoveries?.length) {
        const activeDisc = worldState.discoveries
          .filter(d => typeof d === 'object' ? d.state !== 'resolved' : true)
          .map(d => typeof d === 'string' ? d : d.text);
        if (activeDisc.length > 0) wsLines.push(`Key discoveries: ${activeDisc.join('; ')}`);
      }

      if (worldState.mood) wsLines.push(`Atmosphere: ${worldState.mood}`);

      if (wsLines.length > 0) {
        parts.push(`[World State]\n${wsLines.join('\n')}`);
      }
    } else {
      // === Utility: [Session State] ===
      const ssLines = [];
      if (worldState.currentFocus) ssLines.push(`Focus: ${worldState.currentFocus}`);

      if (worldState.openQuestions?.length > 0) {
        for (const q of worldState.openQuestions) {
          if (q.state === 'active') ssLines.push(`Open: ${q.text}`);
          else if (q.state === 'fading') ssLines.push(`Fading: ${q.text}`);
        }
      }

      if (worldState.parkedItems?.length > 0) {
        for (const p of worldState.parkedItems) {
          ssLines.push(`Parked: ${typeof p === 'string' ? p : p.text}`);
        }
      }

      if (worldState.decisions?.length > 0) {
        for (const d of worldState.decisions) {
          if (d.state === 'active') ssLines.push(`Decided: ${d.text}`);
          else if (d.state === 'fading') {
            const age = (worldState.lastUpdated || 0) - (d.firstDetected || 0);
            ssLines.push(`Decided (${age} turns ago): ${d.text}`);
          }
        }
      }

      if (worldState.knownEntities) {
        const referenced = [];
        for (const [key, data] of Object.entries(worldState.knownEntities)) {
          const turnsAgo = (worldState.lastUpdated || 0) - (data.lastSeen || 0);
          // Only show promoted entities (seen in multiple turns), not single-mention candidates
          const isPromoted = data.firstSeen < data.lastSeen;
          if (turnsAgo <= 30 && isPromoted) {
            referenced.push(`${key}${data.context ? ' (' + data.context + ')' : ''}`);
          }
        }
        if (referenced.length > 0) ssLines.push(`Referenced: ${referenced.join(', ')}`);
      }

      if (worldState.discoveries?.length) {
        const activeDisc = worldState.discoveries
          .filter(d => typeof d === 'object' ? d.state !== 'resolved' : true)
          .map(d => typeof d === 'string' ? d : d.text);
        if (activeDisc.length > 0) ssLines.push(`Key insights: ${activeDisc.join('; ')}`);
      }

      if (ssLines.length > 0) {
        parts.push(`[Session State]\n${ssLines.join('\n')}`);
      }
    }

    // Active debates (both modes — already uses generic language)
    if (worldState.debates?.length > 0) {
      const activeDebates = worldState.debates
        .filter(d => d.state === 'active' || d.state === 'unresolved')
        .slice(-2);
      if (activeDebates.length > 0) {
        const debateLines = activeDebates.map(d => {
          const positions = d.positions
            ? Object.entries(d.positions).map(([name, stance]) => `${name} believes ${stance}`).join('; ')
            : '';
          const stateLabel = d.state === 'unresolved' ? 'Unresolved' : 'Active';
          return `${stateLabel}: ${d.topic}${positions ? ' — ' + positions : ''}${d.summary ? '. ' + d.summary : ''}`;
        });
        parts.push(`[Active Debates]\n${debateLines.join('\n')}`);
      }
    }

  }

  // Inject relevant world/session state history
  if (worldStateHistory && worldStateHistory.length > 0) {
    const currentTurn = worldState?.lastUpdated || 0;
    const relevant = selectRelevantHistory(worldStateHistory, lastUserMessage || '', currentTurn);
    if (relevant.length > 0) {
      const historyLines = relevant.map(e => formatHistoryEntry(e, currentTurn));
      parts.push(`[Recent Changes]\n${historyLines.join('\n')}`);
    }
  }

  if (characterStances && Object.keys(characterStances).length > 0) {
    const stanceLines = [];
    for (const [charName, data] of Object.entries(characterStances)) {
      if (data.positions?.length > 0) {
        for (const pos of data.positions) {
          stanceLines.push(`${charName} ${pos.stance || pos.topic}${pos.reasoning ? ` (because: ${pos.reasoning})` : ''}`);
        }
      }
      if (data.dialecticMode) {
        stanceLines.push(`Dialectic approach: ${data.dialecticMode} — defend positions through reasoning, don't simply agree`);
      }
    }
    if (stanceLines.length > 0) {
      parts.push(`[Character Positions]\n${stanceLines.join('\n')}`);
    }
  }

  if (globalContext) {
    if (globalContext.relationship) {
      const rel = globalContext.relationship;
      const relLines = [];
      relLines.push(`You have met ${globalContext.userName || 'this person'} ${rel.interaction_count} times before.`);
      if (rel.relationship_summary) relLines.push(`Relationship: ${rel.relationship_summary}`);
      if (rel.trust_level !== undefined) {
        const level = rel.trust_level > 0.7 ? 'high' : rel.trust_level > 0.4 ? 'moderate' : 'low';
        relLines.push(`Trust level: ${level}`);
      }
      let moments = [];
      try { moments = JSON.parse(rel.key_moments || '[]'); } catch (e) { /* */ }
      if (moments.length > 0) {
        relLines.push(`Key shared moments: ${moments.slice(-3).join('; ')}`);
      }
      parts.push(`[Relationship History]\n${relLines.join('\n')}`);
    }

    if (globalContext.memories?.length > 0) {
      const memLines = globalContext.memories.map(m => `- ${m.content}`);
      parts.push(`[Long-term Memory]\n${memLines.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Select messages that fit within a token budget.
 *
 * @param {Object} params
 * @param {Array} params.messages - All messages [{role, content, pinned}]
 * @param {string} params.systemPrompt - The system prompt text
 * @param {string} params.storyNotes - Free-text story notes
 * @param {Array} params.extractedFacts - Array of {type, text, turn}
 * @param {number} params.contextBudget - Total token budget
 * @returns {{ messages: Array, contextBlock: string }}
 */
export function selectMessages({ messages, systemPrompt, storyNotes, extractedFacts, contextBudget, rollingSummary, worldState, worldStateHistory, characterStances, recalledMessages, globalContext, mode }) {
  if (!messages || messages.length === 0) {
    return { messages: [], contextBlock: '' };
  }

  // Detect and collapse repetition loops — consecutive identical assistant responses
  const { messages: dedupedMessages, repetitionDetected } = deduplicateRepetitions(messages);

  let budget = contextBudget;

  // Deduct system prompt
  const systemTokens = estimateTokens(systemPrompt);
  budget -= systemTokens;

  // Build context block from story notes + extracted facts
  const lastUserMessage = dedupedMessages.length > 0 ? dedupedMessages[dedupedMessages.length - 1]?.content || '' : '';
  let contextBlock = buildContextBlock(storyNotes, extractedFacts, rollingSummary || '', worldState, characterStances, globalContext, mode, worldStateHistory, lastUserMessage);

  // When a repetition loop was detected, inject an anti-repetition instruction
  if (repetitionDetected) {
    contextBlock += '\n\n[IMPORTANT: Your previous response was repeated verbatim. You MUST generate a fresh, original response that advances the conversation. Do NOT repeat or paraphrase your earlier reply. Respond to what the user just said and move the scene/conversation forward.]';
  }

  const contextTokens = estimateTokens(contextBlock);
  budget -= contextTokens;

  // System prompt alone exceeds budget — send last 2 messages only
  if (budget <= 0) {
    console.warn('Context budget exceeded by system prompt + context block. Sending last 2 messages only.');
    const last2 = dedupedMessages.slice(-2).map((m, i) => ({
      ...m,
      _originalIndex: dedupedMessages.length - 2 + i
    }));
    return { messages: last2, contextBlock };
  }

  // Identify anchors: first user message + first assistant reply
  const anchors = new Set();
  const firstUserIdx = dedupedMessages.findIndex(m => m.role === 'user');
  if (firstUserIdx >= 0) {
    anchors.add(firstUserIdx);
    const firstAssistantIdx = dedupedMessages.findIndex((m, i) => i > firstUserIdx && m.role === 'assistant');
    if (firstAssistantIdx >= 0) {
      anchors.add(firstAssistantIdx);
    }
  }

  // Identify pinned messages (excluding anchors — deduplicate)
  const pinnedIndices = [];
  for (let i = 0; i < dedupedMessages.length; i++) {
    if (dedupedMessages[i].pinned && !anchors.has(i)) {
      pinnedIndices.push(i);
    }
  }

  // Deduct anchor token costs
  let anchorTokens = 0;
  for (const idx of anchors) {
    anchorTokens += estimateTokens(dedupedMessages[idx].content);
  }

  // Always include the latest user message
  const lastMsgIdx = dedupedMessages.length - 1;
  const lastMsgInAnchorsOrPins = anchors.has(lastMsgIdx) || pinnedIndices.includes(lastMsgIdx);
  const lastMsgTokens = lastMsgInAnchorsOrPins ? 0 : estimateTokens(dedupedMessages[lastMsgIdx].content);

  budget -= anchorTokens;
  budget -= lastMsgTokens;

  // Deduct pinned token costs (newest first, drop if over budget)
  const includedPinned = [];
  // Sort pinned by index descending (newest first)
  const sortedPinned = [...pinnedIndices].sort((a, b) => b - a);
  for (const idx of sortedPinned) {
    const tokens = estimateTokens(dedupedMessages[idx].content);
    if (budget - tokens >= 0) {
      budget -= tokens;
      includedPinned.push(idx);
    }
  }

  // Fill remaining budget with recent messages (newest→oldest, skip anchors/pins/last)
  const selectedRecent = [];
  const alreadySelected = new Set([...anchors, ...includedPinned]);
  if (!lastMsgInAnchorsOrPins) alreadySelected.add(lastMsgIdx);

  for (let i = dedupedMessages.length - 2; i >= 0; i--) {
    if (alreadySelected.has(i)) continue;
    const tokens = estimateTokens(dedupedMessages[i].content);
    if (budget - tokens >= 0) {
      budget -= tokens;
      selectedRecent.push(i);
    } else {
      break; // Stop filling once we can't fit the next message
    }
  }

  // Merge all selected indices
  const allSelected = new Set([
    ...anchors,
    ...includedPinned,
    ...selectedRecent
  ]);
  if (!lastMsgInAnchorsOrPins) allSelected.add(lastMsgIdx);

  // Sort by original index to preserve conversation order
  const sortedIndices = [...allSelected].sort((a, b) => a - b);

  // Build result with gap markers
  const result = [];
  for (let i = 0; i < sortedIndices.length; i++) {
    const idx = sortedIndices[i];
    const prevIdx = i > 0 ? sortedIndices[i - 1] : idx - 1;

    // Insert gap marker if messages are non-consecutive
    if (i > 0 && idx - prevIdx > 1) {
      result.push({ role: 'system', content: '[...earlier messages omitted...]' });
    }

    result.push({
      role: dedupedMessages[idx].role,
      content: dedupedMessages[idx].content
    });
  }

  // Append recalled messages to context block if present
  let finalContextBlock = contextBlock;
  if (recalledMessages && recalledMessages.length > 0) {
    const recalledLines = recalledMessages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}${m.content.length > 300 ? '...' : ''}`
    );
    const recalledBlock = `[Recalled from Archive]\n${recalledLines.join('\n')}`;
    const recalledTokens = estimateTokens(recalledBlock);
    // Only include if we have budget remaining
    if (budget - recalledTokens >= 0) {
      finalContextBlock = finalContextBlock
        ? finalContextBlock + '\n\n' + recalledBlock
        : recalledBlock;
    }
  }

  return { messages: result, contextBlock: finalContextBlock };
}
