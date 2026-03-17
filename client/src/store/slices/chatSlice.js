import { buildSystemPrompt, detectModeToggle } from '../../utils/promptBuilder';
import { apiFetch } from '../../utils/apiClient';

export const createChatSlice = (set, get) => ({
  messages: [],
  isSending: false,
  activeMode: null,

  setMessages: (messages) => set({ messages }),
  setIsSending: (isSending) => set({ isSending }),
  setActiveMode: (mode) => set({ activeMode: mode }),

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

  sendMessage: async (content, selectedModel) => {
    const state = get();
    if (!selectedModel || state.isSending) return;

    const { command, cleanMessage, targetMode } = detectModeToggle(content);

    let modeForThisMessage = state.activeMode || state.settings.mode;
    if (targetMode) {
      modeForThisMessage = targetMode;
      set({ activeMode: targetMode });
    }

    const actualMessage = cleanMessage || content;

    const userMessage = { role: 'user', content: actualMessage, timestamp: new Date() };
    set((state) => ({
      messages: [...state.messages, userMessage],
      isSending: true
    }));

    const conversationHistory = [...state.messages, userMessage];

    const settingsWithCharacters = await state.loadCharactersForPrompt(state.settings);

    const isFirstMessage = state.messages.length === 0;
    const systemPrompt = buildSystemPrompt(settingsWithCharacters, modeForThisMessage, isFirstMessage);

    const modelToUse = selectedModel || state.settings.general.selectedModel;

    try {
      const chatPayload = {
        model: modelToUse,
        messages: conversationHistory
          .map(m => ({ role: m.role, content: m.content }))
          .filter(m => m.content !== ''),
        systemPrompt: systemPrompt,
        temperature: state.settings.general.temperature,
        topP: state.settings.general.topP,
        frequencyPenalty: state.settings.general.frequencyPenalty,
        maxTokens: state.settings.general.maxTokens,
        sessionId: state.currentSessionId,
        settings: state.settings
      };
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify(chatPayload)
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              alert(`Chat error: ${data.error}`);
              break;
            }

            if (data.meta === 'user_saved') {
              set((state) => {
                const newMessages = [...state.messages];
                for (let i = newMessages.length - 1; i >= 0; i--) {
                  if (newMessages[i].role === 'user' && !newMessages[i].id) {
                    newMessages[i] = { ...newMessages[i], id: data.messageId };
                    break;
                  }
                }
                return { messages: newMessages };
              });
              continue;
            }

            if (data.meta === 'assistant_saved') {
              set((state) => {
                const newMessages = [...state.messages];
                const lastIdx = newMessages.length - 1;
                if (lastIdx >= 0 && newMessages[lastIdx].role === 'assistant') {
                  newMessages[lastIdx] = { ...newMessages[lastIdx], id: data.messageId };
                }
                return { messages: newMessages };
              });
              continue;
            }

            if (data.message && data.message.content) {
              assistantMessage.content += data.message.content;
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
          }
        }
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter(m => m.content !== '')
      }));
      alert(`Chat failed: ${error.message}`);
    } finally {
      set({ isSending: false });

      // Reload world/session state after message — postChatProcessor extracts
      // state synchronously before res.end(), so it's in the DB by now.
      // Debate extraction runs in setImmediate() and will be picked up next reload.
      const sessionId = get().currentSessionId;
      if (sessionId) {
        get().loadWorldState(sessionId);
      }
    }
  },
});
