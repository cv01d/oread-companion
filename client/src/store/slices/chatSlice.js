import { apiFetch } from '../../utils/apiClient';

export const createChatSlice = (set, get) => ({
  messages: [],
  isSending: false,

  setMessages: (messages) => set({ messages }),
  setIsSending: (isSending) => set({ isSending }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateLastMessage: (content) => set((state) => {
    const newMessages = [...state.messages];
    if (newMessages.length > 0) {
      newMessages[newMessages.length - 1] = {
        ...newMessages[newMessages.length - 1],
        content
      };
    }
    return { messages: newMessages };
  }),

  clearMessages: () => set({ messages: [] }),

  // Thin client: the oread-cli backend builds the system prompt from its own settings
  // (synced via PUT /api/templates/active) and persists both messages itself.
  // We only send { message, sessionId } and render the streamed response.
  sendMessage: async (content) => {
    const state = get();
    if (state.isSending) return;

    const userMessage = { role: 'user', content, timestamp: new Date() };
    set((state) => ({
      messages: [...state.messages, userMessage],
      isSending: true
    }));

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: content,
          sessionId: state.currentSessionId
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error('/api/chat error:', JSON.stringify(errBody, null, 2));
        set({ isSending: false });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage = { role: 'assistant', content: '', timestamp: new Date() };
      let assistantMessageAdded = false;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (possibly partial) line in the buffer.
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (data.type === 'error') {
            alert(`Chat error: ${data.error}`);
            break;
          }

          if (data.type === 'chunk' && data.content) {
            assistantMessage.content += data.content;
            if (!assistantMessageAdded) {
              assistantMessageAdded = true;
              set((state) => ({
                messages: [...state.messages, { ...assistantMessage }]
              }));
            } else {
              set((state) => {
                const newMessages = [...state.messages];
                newMessages[newMessages.length - 1] = { ...assistantMessage };
                return { messages: newMessages };
              });
            }
          }

          // data.type === 'done' is handled implicitly — chunks already hold the full text.
        }
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter(m => m.content !== '')
      }));
      alert(`Chat failed: ${error.message}`);
    } finally {
      set({ isSending: false });

      const sessionId = get().currentSessionId;
      if (sessionId) {
        // Reload message history so messages get their real DB ids + pinned flags
        // (oread-cli's /api/chat does not emit per-message id events), then refresh
        // the world/session state panel.
        if (get().loadMessageHistory) {
          await get().loadMessageHistory(sessionId);
        }
        if (get().loadWorldState) {
          get().loadWorldState(sessionId);
        }
      }
    }
  },
});
