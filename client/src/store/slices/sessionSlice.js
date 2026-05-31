import { apiFetch } from '../../utils/apiClient';

export const createSessionSlice = (set, get) => ({
  currentSessionId: null,
  currentSession: null,
  chatSessions: [],
  sessionsLoading: false,

  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setSessionsLoading: (loading) => set({ sessionsLoading: loading }),

  createSession: async (name, settings) => {
    try {
      const response = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          mode: settings?.mode || 'roleplay',
          character_name: settings?.roleplay?.character?.name || null,
          character_mode: settings?.roleplay?.characterMode || 'single',
          settings_snapshot: settings || null
        })
      });

      const data = await response.json();
      if (data.success) {
        set({
          currentSessionId: data.session.id,
          currentSession: data.session
        });

        await get().loadSessions();

        return data.session;
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  },

  loadSessions: async (options = {}) => {
    set({ sessionsLoading: true });
    try {
      const { archived = false, limit = 50, offset = 0 } = options;
      const params = new URLSearchParams({ archived, limit, offset });

      const response = await fetch(`/api/sessions?${params}`);
      const data = await response.json();

      if (data.success) {
        set({ chatSessions: data.sessions, sessionsLoading: false });
        return data;
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ sessionsLoading: false });
    }
  },

  selectSession: async (sessionId) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        set({
          currentSessionId: sessionId,
          currentSession: data.session,
          messages: []
        });

        await get().loadMessageHistory(sessionId);
        await get().loadStoryNotes(sessionId);
      }
    } catch (error) {
      console.error('Failed to select session:', error);
    }
  },

  deleteSession: async (sessionId) => {
    try {
      const response = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        set((state) => ({
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          currentSession: state.currentSessionId === sessionId ? null : state.currentSession
        }));

        await get().loadSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  messageHistory: [],
  historyLoading: false,
  historyHasMore: true,
  historyOffset: 0,

  setMessageHistory: (history) => set({ messageHistory: history }),
  setHistoryLoading: (loading) => set({ historyLoading: loading }),
  setHistoryHasMore: (hasMore) => set({ historyHasMore: hasMore }),
  setHistoryOffset: (offset) => set({ historyOffset: offset }),

  loadMessageHistory: async (sessionId, loadMore = false) => {
    const state = get();
    if (state.historyLoading) return;

    set({ historyLoading: true });

    try {
      const offset = loadMore ? state.historyOffset : 0;
      const limit = 50;

      const params = new URLSearchParams({ limit, offset });
      const response = await fetch(`/api/sessions/${sessionId}/messages?${params}`);
      const data = await response.json();

      if (data.success) {
        const messages = data.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          pinned: !!m.pinned,
          timestamp: new Date(m.timestamp)
        }));

        set({
          messageHistory: loadMore ? [...messages, ...state.messageHistory] : messages,
          messages: loadMore ? state.messages : messages,
          historyLoading: false,
          historyHasMore: data.has_more,
          historyOffset: offset + messages.length
        });
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
      set({ historyLoading: false });
    }
  },
});
