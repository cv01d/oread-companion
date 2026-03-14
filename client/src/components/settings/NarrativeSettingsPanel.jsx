import TextArea from '../ui/TextArea';
import Dropdown from '../ui/Dropdown';
import TagInput from '../ui/TagInput';

export default function NarrativeSettingsPanel({ settings, onChange }) {
  const { world } = settings.roleplay;

  const handleFieldChange = (field, value) => {
    onChange({
      ...settings,
      roleplay: {
        ...settings.roleplay,
        world: {
          ...world,
          [field]: value
        }
      }
    });
  };

  const narratorOptions = [
    { value: '', label: 'None' },
    { value: 'Companion/Chat - Natural language with emotive actions in asterisks (*smiles warmly*)', label: 'Companion/Chat' },
    { value: 'Omniscient Narrator', label: 'Omniscient Narrator' },
    { value: 'Third-person limited perspective', label: 'Third-person Limited' },
    { value: 'First-person narrator', label: 'First-person Narrator' },
    { value: 'Second-person narrator', label: 'Second-person Narrator' },
    { value: 'Cinematic narrative style', label: 'Cinematic Style' },
    { value: 'Literary prose narrator', label: 'Literary Prose' }
  ];

  return (
    <div className="narrative-settings-panel">
      <div className="narrative-settings-panel__field">
        <label className="narrative-settings-panel__label">Narrator Voice</label>
        <p className="narrative-settings-panel__hint">
          The narrative perspective and style for scene descriptions and character actions.
        </p>
        <Dropdown
          options={narratorOptions}
          value={world.narratorVoice}
          onChange={(value) => handleFieldChange('narratorVoice', value)}
        />
      </div>

      <div className="narrative-settings-panel__field">
        <label className="narrative-settings-panel__label">Opening Scene</label>
        <p className="narrative-settings-panel__hint">
          Describe the initial scene and atmosphere to establish the starting point.
        </p>
        <TextArea
          value={world.openingScene}
          onChange={(value) => handleFieldChange('openingScene', value)}
          placeholder="Set the opening scene. Where does the story begin? What is happening?"
          rows={4}
        />
      </div>

      <div className="narrative-settings-panel__field">
        <label className="narrative-settings-panel__label">Pacing & Flow</label>
        <p className="narrative-settings-panel__hint">
          Define how quickly or slowly the narrative should progress.
        </p>
        <TextArea
          value={world.pacing}
          onChange={(value) => handleFieldChange('pacing', value)}
          placeholder="Describe the desired pacing. Should scenes move quickly, or take time for atmosphere?"
          rows={3}
        />
      </div>

      <div className="narrative-settings-panel__field">
        <label className="narrative-settings-panel__label">Hard Rules (Never Violate)</label>
        <p className="narrative-settings-panel__hint">
          Absolute constraints the AI must never break (e.g., "Never speak for the user").
        </p>
        <TagInput
          tags={world.hardRules}
          onChange={(tags) => handleFieldChange('hardRules', tags)}
          placeholder="Add a rule and press Enter"
        />
      </div>

      <div className="narrative-settings-panel__field">
        <label className="narrative-settings-panel__label">Turn Logic</label>
        <p className="narrative-settings-panel__hint">
          Instructions for when to end a response and wait for user action.
        </p>
        <TextArea
          value={world.turnLogic}
          onChange={(value) => handleFieldChange('turnLogic', value)}
          placeholder="Define when the AI should stop and wait for user input. E.g., 'Stop after character speaks'"
          rows={3}
        />
      </div>
    </div>
  );
}
