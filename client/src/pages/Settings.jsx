import { useState } from 'react';
import useStore from '../store/useStore';
import ModelSelector from '../components/model/ModelSelector';
import ModelDownloader from '../components/model/ModelDownloader';
import TemplateSelector from '../components/settings/TemplateSelector';
import ModeSelector from '../components/settings/ModeSelector';
import SettingsSection from '../components/settings/SettingsSection';
import WorldSettingsPanel from '../components/settings/WorldSettingsPanel';
import CharacterEditor from '../components/settings/CharacterEditor';
import CharacterList from '../components/settings/CharacterList';
import UtilitySettingsPanel from '../components/settings/UtilitySettingsPanel';
import UserPersonaPanel from '../components/settings/UserPersonaPanel';
import GeneralSettingsPanel from '../components/settings/GeneralSettingsPanel';
import SessionManager from '../components/session/SessionManager';
import Button from '../components/ui/Button';
import Dropdown from '../components/ui/Dropdown';
import { TEMPLATES } from '../data/templates';
import { exportSettings, importSettings, copySettingsToClipboard } from '../utils/settingsImportExport';
import { DEFAULT_SETTINGS } from '../data/defaultSettings';

export default function Settings() {
  // Get state and actions from Zustand store
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const isSavingSettings = useStore((state) => state.isSavingSettings);
  const lastSaved = useStore((state) => state.lastSaved);
  const models = useStore((state) => state.models);
  const selectedModel = useStore((state) => state.selectedModel);
  const setSelectedModel = useStore((state) => state.setSelectedModel);
  const fetchModels = useStore((state) => state.fetchModels);
  const downloadModel = useStore((state) => state.downloadModel);
  const isDownloading = useStore((state) => state.isDownloading);
  const downloadProgress = useStore((state) => state.downloadProgress);
  const [activeTab, setActiveTab] = useState('mode'); // 'mode', 'roleplay', 'utility', 'persona', 'general', 'models', 'sessions'

  // Format last saved time
  const getLastSavedText = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000); // seconds
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return lastSaved.toLocaleTimeString();
  };

  // Handle template selection
  const handleTemplateSelect = (template) => {
    if (template) {
      // Template is the full template object
      setSettings({
        ...template.settings,
        meta: {
          ...template.settings.meta,
          templateId: template.id,
          lastModified: new Date().toISOString()
        }
      });
    } else {
      // Clear template - reset to defaults but keep user's customizations
      setSettings({
        ...settings,
        meta: {
          ...settings.meta,
          templateId: null,
          lastModified: new Date().toISOString()
        }
      });
    }
  };

  // Handle mode toggle
  const handleModeChange = (mode) => {
    setSettings({
      ...settings,
      mode,
      meta: {
        ...settings.meta,
        lastModified: new Date().toISOString()
      }
    });
  };

  // Handle character mode toggle (single vs multi)
  const handleCharacterModeChange = (characterMode) => {
    setSettings({
      ...settings,
      roleplay: {
        ...settings.roleplay,
        characterMode
      },
      meta: {
        ...settings.meta,
        lastModified: new Date().toISOString()
      }
    });
  };

  // Handle export
  const handleExport = () => {
    const result = exportSettings(settings, 'ollama-chat-settings.json');
    if (result.success) {
      alert('Settings exported successfully!');
    } else {
      alert(`Export failed: ${result.error}`);
    }
  };

  // Handle import
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const result = await importSettings(file);
    if (result.success) {
      setSettings(result.settings);
      alert('Settings imported successfully!');
    } else {
      alert(`Import failed: ${result.error}`);
    }

    // Reset file input
    event.target.value = '';
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    const result = await copySettingsToClipboard(settings);
    if (result.success) {
      alert('Settings copied to clipboard!');
    } else {
      alert(`Copy failed: ${result.error}`);
    }
  };

  // Handle reset to defaults
  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
      alert('Settings reset to defaults');
    }
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <div>
          <h1 className="settings__title">Settings</h1>
          <p className="settings__subtitle">
            {isSavingSettings ? (
              <span className="settings__save-status settings__save-status--saving">
                💾 Saving changes...
              </span>
            ) : lastSaved ? (
              <span className="settings__save-status settings__save-status--saved">
                All changes saved {getLastSavedText()}
              </span>
            ) : (
              <span className="settings__save-status">
                Changes are saved automatically
              </span>
            )}
          </p>
        </div>
        <div className="settings__actions">
          <Button onClick={handleExport} variant="secondary">
            Export Settings
          </Button>
          <label className="btn btn--secondary">
            Import Settings
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <Button onClick={handleCopyToClipboard} variant="secondary">
            Copy to Clipboard
          </Button>
          <Button onClick={handleReset} variant="secondary">
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="settings__tabs">
        <button
          className={`settings__tab ${activeTab === 'mode' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('mode')}
        >
          Mode & Templates
        </button>
        <button
          className={`settings__tab ${activeTab === 'roleplay' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('roleplay')}
        >
          Roleplay Settings
        </button>
        <button
          className={`settings__tab ${activeTab === 'utility' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('utility')}
        >
          Utility Settings
        </button>
        <button
          className={`settings__tab ${activeTab === 'persona' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('persona')}
        >
          User Persona
        </button>
        <button
          className={`settings__tab ${activeTab === 'general' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`settings__tab ${activeTab === 'models' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('models')}
        >
          Models
        </button>
        <button
          className={`settings__tab ${activeTab === 'sessions' ? 'settings__tab--active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
      </div>

      {/* Tab Content */}
      <div className="settings__content">
        {/* Mode & Templates Tab */}
        {activeTab === 'mode' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="Select Template"
              description="Choose a preset template to quickly configure your settings"
            >
              <TemplateSelector
                selectedTemplateId={settings.meta.templateId}
                onSelect={handleTemplateSelect}
              />
            </SettingsSection>

            <SettingsSection
              title="Mode Selection"
              description="Choose between Roleplay mode (character-based interaction) or Normal/Utility mode (standard assistant)"
            >
              <ModeSelector
                currentMode={settings.mode}
                onChange={handleModeChange}
              />
            </SettingsSection>
          </div>
        )}

        {/* Roleplay Settings Tab */}
        {activeTab === 'roleplay' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="World & Narrative Settings"
              description="Configure the world, setting, and narrative style for roleplay"
            >
              <WorldSettingsPanel
                settings={settings}
                onChange={setSettings}
              />
            </SettingsSection>

            <SettingsSection
              title="Character Configuration"
              description="Configure characters for roleplay mode"
            >
              <div className="settings__character-mode">
                <label className="settings__label">Character Mode</label>
                <Dropdown
                  options={[
                    { value: 'single', label: 'Single Character (AI plays one character)' },
                    { value: 'multi', label: 'Multiple Characters (AI plays multiple characters)' }
                  ]}
                  value={settings.roleplay.characterMode}
                  onChange={handleCharacterModeChange}
                />
                <p className="settings__hint">
                  Single: AI embodies one specific character. Multi: AI can play multiple characters as needed.
                </p>
              </div>

              {settings.roleplay.characterMode === 'single' && (
                <div className="settings__single-character">
                  <CharacterEditor
                    character={settings.roleplay.singleCharacter}
                    onChange={(updatedCharacter) => {
                      setSettings({
                        ...settings,
                        roleplay: {
                          ...settings.roleplay,
                          singleCharacter: updatedCharacter
                        }
                      });
                    }}
                    mode="single"
                  />
                </div>
              )}

              {settings.roleplay.characterMode === 'multi' && (
                <div className="settings__multiple-characters">
                  <CharacterList
                    characters={settings.roleplay.multipleCharacters}
                    onChange={(updatedCharacters) => {
                      setSettings({
                        ...settings,
                        roleplay: {
                          ...settings.roleplay,
                          multipleCharacters: updatedCharacters
                        }
                      });
                    }}
                  />
                </div>
              )}
            </SettingsSection>
          </div>
        )}

        {/* Utility Settings Tab */}
        {activeTab === 'utility' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="Utility/Normal Mode Configuration"
              description="Configure how the assistant behaves in non-roleplay mode"
            >
              <UtilitySettingsPanel
                settings={settings}
                onChange={setSettings}
              />
            </SettingsSection>
          </div>
        )}

        {/* User Persona Tab */}
        {activeTab === 'persona' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="User Persona & Preferences"
              description="Help the AI understand you better across all modes"
            >
              <UserPersonaPanel
                settings={settings}
                onChange={setSettings}
              />
            </SettingsSection>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="General Settings"
              description="Model selection and generation parameters"
            >
              <GeneralSettingsPanel
                settings={settings}
                onChange={setSettings}
                models={models}
              />
            </SettingsSection>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="Model Selection"
              description="Select the currently active model for chat"
            >
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                onRefreshModels={fetchModels}
              />
            </SettingsSection>

            <SettingsSection
              title="Download Models"
              description="Download new models from Ollama library or HuggingFace"
            >
              <ModelDownloader
                onDownloadModel={downloadModel}
                isDownloading={isDownloading}
                downloadProgress={downloadProgress}
              />
              <div className="settings__info">
                <p><strong>Ollama Library:</strong> llama2, mistral, codellama, etc.</p>
                <p><strong>HuggingFace:</strong> hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF</p>
              </div>
            </SettingsSection>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="settings__tab-content">
            <SettingsSection
              title="Session Management"
              description="Create, manage, and switch between conversation sessions"
            >
              <SessionManager />
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}
