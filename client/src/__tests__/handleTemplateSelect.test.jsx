// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

// Mock heavy child components so Settings can render without their full dependency trees
vi.mock('../components/model/ModelSelector', () => ({ default: () => <div data-testid="model-selector" /> }));
vi.mock('../components/model/ModelDownloader', () => ({ default: () => <div data-testid="model-downloader" /> }));
vi.mock('../components/settings/ModeSelector', () => ({ default: () => <div data-testid="mode-selector" /> }));
vi.mock('../components/settings/SettingsSection', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/settings/CollapsibleSection', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../components/settings/WorldSettingsPanel', () => ({ default: () => <div /> }));
vi.mock('../components/settings/NarrativeSettingsPanel', () => ({ default: () => <div /> }));
vi.mock('../components/settings/CharacterEditor', () => ({ default: () => <div /> }));
vi.mock('../components/settings/CharacterList', () => ({ default: () => <div /> }));
vi.mock('../components/settings/UtilitySettingsPanel', () => ({ default: () => <div /> }));
vi.mock('../components/settings/UserPersonaPanel', () => ({ default: () => <div /> }));
vi.mock('../components/settings/GeneralSettingsPanel', () => ({ default: () => <div /> }));
vi.mock('../components/session/SessionManager', () => ({ default: () => <div /> }));
vi.mock('../components/ui/Button', () => ({ default: ({ children, onClick }) => <button onClick={onClick}>{children}</button> }));
vi.mock('../components/ui/Dropdown', () => ({ default: () => <div /> }));
vi.mock('../utils/settingsImportExport', () => ({
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  copySettingsToClipboard: vi.fn(),
}));
vi.mock('../data/defaultSettings', () => ({ DEFAULT_SETTINGS: {} }));

// Capture the onSelect callback from TemplateSelector
let capturedOnSelect = null;
vi.mock('../components/settings/TemplateSelector', () => ({
  default: ({ onSelect }) => {
    capturedOnSelect = onSelect;
    return <div data-testid="template-selector" />;
  },
}));

// Mock useStore — handle selector-based usage
const mockSetSettings = vi.fn();
const mockSettings = {
  mode: 'normal',
  roleplay: { characterMode: 'single', character: null, characters: [] },
  utility: {},
  userPersona: {},
  general: {},
  meta: { templateId: null, lastModified: null, version: '1.0' },
};

vi.mock('../store/useStore', () => ({
  default: vi.fn((selector) => {
    const state = {
      settings: mockSettings,
      setSettings: mockSetSettings,
      isSavingSettings: false,
      lastSaved: null,
      models: [],
      selectedModel: 'llama2',
      setSelectedModel: vi.fn(),
      fetchModels: vi.fn(),
      downloadModel: vi.fn(),
      isDownloading: false,
      downloadProgress: 0,
      templates: [],
      fetchTemplates: vi.fn(),
    };
    return selector(state);
  }),
}));

import Settings from '../pages/Settings';

describe('handleTemplateSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSelect = null;
  });

  it('applies full template settings including inline character when selecting a roleplay template', async () => {
    render(<Settings />);

    const roleplayTemplate = {
      id: 'echo-roleplay',
      settings: {
        mode: 'roleplay',
        roleplay: {
          characterMode: 'single',
          character: { name: 'Echo', role: 'Companion' },
          characters: [],
        },
        meta: { templateId: 'echo-roleplay', lastModified: null, version: '1.0' },
      },
    };

    await act(async () => {
      await capturedOnSelect(roleplayTemplate);
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    const calledWith = mockSetSettings.mock.calls[0][0];
    expect(calledWith.meta.templateId).toBe('echo-roleplay');
    expect(calledWith.mode).toBe('roleplay');
    expect(calledWith.roleplay.character.name).toBe('Echo');
  });

  it('applies template settings for a non-roleplay template', async () => {
    render(<Settings />);

    const normalTemplate = {
      id: 'utility-default',
      settings: {
        mode: 'normal',
        roleplay: { characterMode: 'single', character: null, characters: [] },
        meta: { templateId: 'utility-default', lastModified: null, version: '1.0' },
      },
    };

    await act(async () => {
      await capturedOnSelect(normalTemplate);
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    const calledWith = mockSetSettings.mock.calls[0][0];
    expect(calledWith.meta.templateId).toBe('utility-default');
  });

  it('calls setSettings clearing templateId when null template is passed', async () => {
    render(<Settings />);

    await act(async () => {
      await capturedOnSelect(null);
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    const calledWith = mockSetSettings.mock.calls[0][0];
    expect(calledWith.meta.templateId).toBeNull();
  });
});
