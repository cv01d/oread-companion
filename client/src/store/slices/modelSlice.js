import { apiFetch } from '../../utils/apiClient';

export const createModelSlice = (set, get) => ({
  models: [],
  selectedModel: null,
  isDownloading: false,
  downloadProgress: { progress: 0, status: '', message: '' },

  setModels: (models) => set({ models }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsDownloading: (isDownloading) => set({ isDownloading }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  fetchModels: async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();

      if (data.success) {
        // oread-cli returns models as { id, provider, size, modified }. The GUI
        // expects a `name` field, so normalize (keeping any existing name).
        const models = (data.models || []).map(m => ({
          ...m,
          name: m.name || m.id
        }));
        set({ models });

        const state = get();
        const firstModel = models.length > 0 ? models[0].name : null;
        if (!state.selectedModel && firstModel) {
          set({ selectedModel: firstModel });
        }
        if (!state.settings.general.selectedModel && firstModel) {
          state.setSettings({
            ...state.settings,
            general: { ...state.settings.general, selectedModel: firstModel }
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  },

  downloadModel: async (modelName) => {
    let normalizedName = modelName.trim();

    const resolveMatch = normalizedName.match(
      /(?:https?:\/\/)?(?:huggingface\.co|hf\.co)\/([^/]+)\/([^/]+)\/resolve\/[^/]+\/([^/?#]+\.gguf)/i
    );
    if (resolveMatch) {
      const [, user, repo, filename] = resolveMatch;
      const tag = filename.replace(/\.gguf$/i, '');
      normalizedName = `hf.co/${user}/${repo}:${tag}`;
    } else {
      normalizedName = normalizedName
        .replace(/^https?:\/\//, '')
        .replace(/^huggingface\.co\//, 'hf.co/');
    }

    set({
      isDownloading: true,
      downloadProgress: { progress: 0, status: 'Starting download...', message: '' }
    });

    try {
      const response = await apiFetch('/api/models/pull', {
        method: 'POST',
        body: JSON.stringify({ modelName: normalizedName })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error || err.details?.[0]?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              set({
                isDownloading: false,
                downloadProgress: { progress: 0, status: `Error: ${data.error}`, message: '' }
              });
              return;
            }

            if (data.completed) {
              set({ downloadProgress: { progress: 100, status: 'Complete!', message: '' } });
              get().fetchModels();
              setTimeout(() => {
                set({ isDownloading: false, downloadProgress: { progress: 0, status: '', message: '' } });
              }, 2000);
              return;
            }

            if (data.status) {
              const progress = data.total
                ? Math.round((data.completed / data.total) * 100)
                : 0;

              set({
                downloadProgress: {
                  progress,
                  status: data.status,
                  message: data.digest ? `Digest: ${data.digest.substring(0, 12)}...` : ''
                }
              });
            }
          }
        }
      }

      set({ isDownloading: false, downloadProgress: { progress: 0, status: '', message: '' } });
    } catch (error) {
      set({
        isDownloading: false,
        downloadProgress: { progress: 0, status: `Error: ${error.message}`, message: '' }
      });
    }
  },

  ollamaStatus: 'checking',

  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  checkHealth: async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      set({ ollamaStatus: data.status === 'ok' ? 'connected' : 'disconnected' });
    } catch (error) {
      set({ ollamaStatus: 'disconnected' });
    }
  },
});
