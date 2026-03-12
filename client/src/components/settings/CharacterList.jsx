import { useState } from 'react';
import Button from '../ui/Button';
import CharacterEditor from './CharacterEditor';

// Empty character template for multi-character mode
const createEmptyCharacter = () => ({
  identity: {
    name: '',
    age: '',
    gender: '',
    species: '',
    profession: ''
  },
  core: {
    personality: '',
    backstory: '',
    knowledge: ''
  },
  dynamics: {
    relationshipToUser: '',
    currentLocation: ''
  },
  vocalProfile: '',
  avatarImage: '',
  motivation: '',
  secrets: ''
});

export default function CharacterList({ characters, onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddCharacter = () => {
    const newCharacter = createEmptyCharacter();
    onChange([...characters, newCharacter]);
    setEditingIndex(characters.length); // Edit the newly added character
  };

  const handleEditCharacter = (index) => {
    setEditingIndex(index);
  };

  const handleUpdateCharacter = (updatedCharacter) => {
    const updatedCharacters = [...characters];
    updatedCharacters[editingIndex] = updatedCharacter;
    onChange(updatedCharacters);
  };

  const handleDeleteCharacter = (index) => {
    if (confirm('Are you sure you want to delete this character?')) {
      const updatedCharacters = characters.filter((_, i) => i !== index);
      onChange(updatedCharacters);
      if (editingIndex === index) {
        setEditingIndex(null);
      }
    }
  };

  const handleCloseEditor = () => {
    setEditingIndex(null);
  };

  return (
    <div className="character-list">
      <div className="character-list__header">
        <h3 className="character-list__title">Characters ({characters.length})</h3>
        <Button onClick={handleAddCharacter} variant="primary">
          Add Character
        </Button>
      </div>

      {characters.length === 0 && (
        <div className="character-list__empty">
          <p>No characters created yet. Click "Add Character" to create one.</p>
        </div>
      )}

      {/* Character Cards */}
      {editingIndex === null && characters.length > 0 && (
        <div className="character-list__grid">
          {characters.map((character, index) => (
            <div key={index} className="character-card">
              {character.avatarImage && (
                <div className="character-card__avatar">
                  <img src={character.avatarImage} alt={character.identity.name || 'Character'} />
                </div>
              )}
              <div className="character-card__content">
                <h4 className="character-card__name">
                  {character.identity.name || `Character ${index + 1}`}
                </h4>
                <p className="character-card__info">
                  {character.identity.species && `${character.identity.species}`}
                  {character.identity.species && character.identity.profession && ' • '}
                  {character.identity.profession}
                </p>
                {character.core.personality && (
                  <p className="character-card__personality">
                    {character.core.personality.substring(0, 100)}
                    {character.core.personality.length > 100 ? '...' : ''}
                  </p>
                )}
              </div>
              <div className="character-card__actions">
                <Button onClick={() => handleEditCharacter(index)} variant="secondary">
                  Edit
                </Button>
                <Button onClick={() => handleDeleteCharacter(index)} variant="secondary">
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Character Editor */}
      {editingIndex !== null && (
        <CharacterEditor
          character={characters[editingIndex]}
          onChange={handleUpdateCharacter}
          onClose={handleCloseEditor}
          mode="multi"
        />
      )}
    </div>
  );
}
