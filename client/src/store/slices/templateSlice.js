import { loadTemplates } from '../../data/templates';
import { saveUserTemplate as saveUserTemplateAPI, deleteUserTemplate as deleteUserTemplateAPI } from '../../utils/templateAPI';

export const createTemplateSlice = (set, get) => ({
  templates: [],

  saveAsTemplate: async (name, description) => {
    try {
      const settings = get().settings;
      const result = await saveUserTemplateAPI(name, description, settings);
      await get().fetchTemplates();

      if (result.template?.id) {
        get().setSettings({
          ...get().settings,
          meta: {
            ...get().settings.meta,
            templateId: result.template.id,
            isUserTemplate: true,
            lastModified: new Date().toISOString()
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to save template:', error);
      return { success: false, error: error.message };
    }
  },

  deleteTemplate: async (id) => {
    try {
      await deleteUserTemplateAPI(id);
      await get().fetchTemplates();
      return { success: true };
    } catch (error) {
      console.error('Failed to delete template:', error);
      return { success: false, error: error.message };
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await loadTemplates();
      set({ templates });

      if (!get().settings.meta?.templateId && get().settings.mode === 'normal') {
        const assistantTemplate = templates.find(t => t.id === 'expert-tutor');
        if (assistantTemplate) {
          get().setSettings({
            ...assistantTemplate.settings,
            meta: {
              ...assistantTemplate.settings.meta,
              templateId: assistantTemplate.id,
              lastModified: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  },
});
