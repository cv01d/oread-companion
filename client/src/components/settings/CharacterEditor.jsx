import TextField from '../ui/TextField';
import TextArea from '../ui/TextArea';
import ImageUpload from '../ui/ImageUpload';
import Button from '../ui/Button';

export default function CharacterEditor({ character, onChange, onClose, mode = 'single' }) {
  const handleIdentityChange = (field, value) => {
    onChange({
      ...character,
      identity: {
        ...character.identity,
        [field]: value
      }
    });
  };

  const handleCoreChange = (field, value) => {
    onChange({
      ...character,
      core: {
        ...character.core,
        [field]: value
      }
    });
  };

  const handleDynamicsChange = (field, value) => {
    onChange({
      ...character,
      dynamics: {
        ...character.dynamics,
        [field]: value
      }
    });
  };

  const handleFieldChange = (field, value) => {
    onChange({
      ...character,
      [field]: value
    });
  };

  return (
    <div className="character-editor">
      <div className="character-editor__header">
        <h3 className="character-editor__title">
          {mode === 'single' ? 'Edit Character' : 'Edit Character'}
        </h3>
        {onClose && (
          <Button onClick={onClose} variant="secondary" className="character-editor__close">
            Close
          </Button>
        )}
      </div>

      <div className="character-editor__content">
        {/* Avatar Image */}
        <div className="character-editor__field">
          <label className="character-editor__label">Avatar Image</label>
          <ImageUpload
            imageData={character.avatarImage}
            onChange={(imageData) => handleFieldChange('avatarImage', imageData)}
            maxSizeKB={500}
          />
          <p className="character-editor__hint">
            Upload a character avatar (max 500KB). Supports JPG, PNG, WebP.
          </p>
        </div>

        {/* Identity Section */}
        <div className="character-editor__section">
          <h4 className="character-editor__section-title">Identity</h4>

          <div className="character-editor__field">
            <label className="character-editor__label">Name</label>
            <TextField
              value={character.identity.name}
              onChange={(value) => handleIdentityChange('name', value)}
              placeholder="Character name"
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Age</label>
            <TextField
              value={character.identity.age}
              onChange={(value) => handleIdentityChange('age', value)}
              placeholder="Age or age range"
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Gender</label>
            <TextField
              value={character.identity.gender}
              onChange={(value) => handleIdentityChange('gender', value)}
              placeholder="Gender identity"
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Species</label>
            <TextField
              value={character.identity.species}
              onChange={(value) => handleIdentityChange('species', value)}
              placeholder="Human, Elf, Android, etc."
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Profession</label>
            <TextField
              value={character.identity.profession}
              onChange={(value) => handleIdentityChange('profession', value)}
              placeholder="Occupation or role"
            />
          </div>
        </div>

        {/* Core Traits Section */}
        <div className="character-editor__section">
          <h4 className="character-editor__section-title">Core Traits</h4>

          <div className="character-editor__field">
            <label className="character-editor__label">Personality</label>
            <TextArea
              value={character.core.personality}
              onChange={(value) => handleCoreChange('personality', value)}
              placeholder="Describe personality traits, demeanor, and typical behavior"
              rows={4}
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Backstory</label>
            <TextArea
              value={character.core.backstory}
              onChange={(value) => handleCoreChange('backstory', value)}
              placeholder="Character history, origin, and formative experiences"
              rows={4}
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Knowledge & Skills</label>
            <TextArea
              value={character.core.knowledge}
              onChange={(value) => handleCoreChange('knowledge', value)}
              placeholder="What they know, what they're good at, areas of expertise"
              rows={3}
            />
          </div>
        </div>

        {/* Dynamics Section */}
        <div className="character-editor__section">
          <h4 className="character-editor__section-title">Dynamics</h4>

          <div className="character-editor__field">
            <label className="character-editor__label">Relationship to User</label>
            <TextArea
              value={character.dynamics.relationshipToUser}
              onChange={(value) => handleDynamicsChange('relationshipToUser', value)}
              placeholder="How does this character know the user? What's their relationship?"
              rows={3}
            />
          </div>

          <div className="character-editor__field">
            <label className="character-editor__label">Current Location</label>
            <TextField
              value={character.dynamics.currentLocation}
              onChange={(value) => handleDynamicsChange('currentLocation', value)}
              placeholder="Where is the character right now?"
            />
          </div>
        </div>

        {/* Vocal Profile Section */}
        <div className="character-editor__section">
          <h4 className="character-editor__section-title">Vocal Profile</h4>

          <div className="character-editor__field">
            <label className="character-editor__label">Speech Style & Patterns</label>
            <TextArea
              value={character.vocalProfile}
              onChange={(value) => handleFieldChange('vocalProfile', value)}
              placeholder="How does this character speak? Tone, vocabulary, speech patterns, catchphrases"
              rows={3}
            />
            <p className="character-editor__hint">
              Describe their unique way of speaking, word choices, and mannerisms.
            </p>
          </div>
        </div>

        {/* Multi-character specific fields */}
        {mode === 'multi' && (
          <>
            <div className="character-editor__section">
              <h4 className="character-editor__section-title">Multi-Character Fields</h4>

              <div className="character-editor__field">
                <label className="character-editor__label">Motivation</label>
                <TextArea
                  value={character.motivation || ''}
                  onChange={(value) => handleFieldChange('motivation', value)}
                  placeholder="What drives this character? What are their goals?"
                  rows={3}
                />
              </div>

              <div className="character-editor__field">
                <label className="character-editor__label">Secrets</label>
                <TextArea
                  value={character.secrets || ''}
                  onChange={(value) => handleFieldChange('secrets', value)}
                  placeholder="Hidden information the character knows but won't reveal easily"
                  rows={3}
                />
                <p className="character-editor__hint">
                  Information the AI knows but the character keeps hidden from the user.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
