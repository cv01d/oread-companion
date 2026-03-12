/**
 * Session API Client
 * Handles all session-related API calls
 */

/**
 * Create a new session
 */
export async function createSession(name, settings) {
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Create session error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load sessions list
 */
export async function loadSessions(options = {}) {
  try {
    const { archived = false, limit = 50, offset = 0 } = options;
    const params = new URLSearchParams({
      archived: archived.toString(),
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await fetch(`/api/sessions?${params}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Load sessions error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get session by ID
 */
export async function getSession(sessionId) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update session (rename or archive)
 */
export async function updateSession(sessionId, updates) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update session error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Delete session error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save message to session
 */
export async function saveMessage(sessionId, message) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Save message error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get messages for session
 */
export async function getMessages(sessionId, options = {}) {
  try {
    const { limit = 50, offset = 0 } = options;
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await fetch(`/api/sessions/${sessionId}/messages?${params}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get messages error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze session for setting updates
 */
export async function analyzeSession(sessionId, settings) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Analyze session error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply extracted updates
 */
export async function applyUpdates(sessionId, updates) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/apply-updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Apply updates error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search memory using vector similarity
 */
export async function searchMemory(sessionId, query, topK = 5) {
  try {
    const response = await fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, query, topK })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Search memory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get embedding status for session
 */
export async function getEmbeddingStatus(sessionId) {
  try {
    const response = await fetch(`/api/memory/status/${sessionId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get embedding status error:', error);
    return { success: false, error: error.message };
  }
}
