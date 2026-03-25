import { apiFetch } from '../../utils/apiClient';

export const createMemorySlice = (set, get) => ({
  // Pin message
  togglePinMessage: async (messageId) => {
    const state = get();
    const sessionId = state.currentSessionId;
    if (!sessionId || !messageId) return;

    const msgIndex = state.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const newPinned = !state.messages[msgIndex].pinned;

    // Optimistic update
    set((s) => {
      const newMessages = [...s.messages];
      newMessages[msgIndex] = { ...newMessages[msgIndex], pinned: newPinned };
      return { messages: newMessages };
    });

    try {
      const response = await apiFetch(`/api/sessions/${sessionId}/messages/${messageId}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: newPinned })
      });
      const data = await response.json();
      if (!data.success) {
        // Revert on failure
        set((s) => {
          const newMessages = [...s.messages];
          newMessages[msgIndex] = { ...newMessages[msgIndex], pinned: !newPinned };
          return { messages: newMessages };
        });
      }
    } catch (error) {
      // Revert on failure
      set((s) => {
        const newMessages = [...s.messages];
        newMessages[msgIndex] = { ...newMessages[msgIndex], pinned: !newPinned };
        return { messages: newMessages };
      });
      console.error('Failed to toggle pin:', error);
    }
  },

  // Story notes
  storyNotes: '',

  loadStoryNotes: async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}/notes`);
      const data = await response.json();
      if (data.success) {
        set({ storyNotes: data.notes || '' });
      }
    } catch (error) {
      console.error('Failed to load story notes:', error);
    }
  },

  saveStoryNotes: async (sessionId, notes) => {
    if (!sessionId) return;
    set({ storyNotes: notes });
    try {
      await apiFetch(`/api/sessions/${sessionId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes })
      });
    } catch (error) {
      console.error('Failed to save story notes:', error);
    }
  },

  // World state
  worldState: {},
  worldStateHistory: [],

  loadWorldState: async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}/world-state`);
      const data = await response.json();
      if (data.success) {
        set({ worldState: data.worldState || {}, worldStateHistory: data.worldStateHistory || [] });
      }
    } catch (error) {
      console.error('Failed to load world state:', error);
    }
  },

  saveWorldState: async (sessionId, worldState) => {
    if (!sessionId) return;
    set({ worldState });
    try {
      await apiFetch(`/api/sessions/${sessionId}/world-state`, {
        method: 'PUT',
        body: JSON.stringify(worldState)
      });
    } catch (error) {
      console.error('Failed to save world state:', error);
    }
  },

  reextractWorldState: async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await apiFetch(`/api/sessions/${sessionId}/reextract-state`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        set({ worldState: data.worldState || {} });
      }
      return data;
    } catch (error) {
      console.error('Failed to re-extract world state:', error);
      return { success: false, error: error.message || 'Re-extraction failed' };
    }
  },

  // Global memory (cross-session)
  globalMemories: [],
  characterRelationships: [],

  loadGlobalMemories: async ({ type, limit = 20 } = {}) => {
    try {
      const params = new URLSearchParams({ limit });
      if (type) params.set('type', type);
      const response = await fetch(`/api/memory/global?${params}`);
      const data = await response.json();
      if (data.success) {
        set({ globalMemories: data.memories || [] });
      }
    } catch (error) {
      console.error('Failed to load global memories:', error);
    }
  },

  loadRelationships: async () => {
    try {
      const response = await fetch('/api/memory/relationships');
      const data = await response.json();
      if (data.success) {
        set({ characterRelationships: data.relationships || [] });
      }
    } catch (error) {
      console.error('Failed to load relationships:', error);
    }
  },

  searchGlobalMemory: async (query) => {
    try {
      const response = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.success ? data.results : [];
    } catch (error) {
      console.error('Failed to search global memory:', error);
      return [];
    }
  },
});
