import { create } from 'zustand';
import { createSettingsSlice } from './slices/settingsSlice';
import { createChatSlice } from './slices/chatSlice';
import { createModelSlice } from './slices/modelSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createMemorySlice } from './slices/memorySlice';
import { createTemplateSlice } from './slices/templateSlice';
import { createUISlice } from './slices/uiSlice';

const useStore = create((...a) => ({
  ...createSettingsSlice(...a),
  ...createChatSlice(...a),
  ...createModelSlice(...a),
  ...createSessionSlice(...a),
  ...createMemorySlice(...a),
  ...createTemplateSlice(...a),
  ...createUISlice(...a),

  initialize: async () => {
    const get = a[1];
    const store = get();
    await store.loadSettings();
    await store.fetchTemplates();
    await store.checkHealth();
    await store.fetchModels();
    await store.loadSessions();
  }
}));

export default useStore;
