import { useState } from 'react';
import Button from '../ui/Button';
import CharacterEditor from './CharacterEditor';
import { deleteCharacter as deleteCharacterFile } from '../../utils/characterAPI';
import { generateCharacterId } from '../../utils/characterConverter';

// Empty character template for multi-character mode
const createEmptyCharacter = () => ({
  name: '',
  age: '',
  gender: '',
  species: '',
  role: '',
  avatarImage: '',
  knowledgeSkills: '',
  hobbiesInterests: '',
  thingsToAvoid: '',
  backstory: '',
  inventory: '',
  traits: {
    emotionalExpression: [],
    socialEnergy: [],
    thinkingStyle: [],
    humorPersonality: [],
    coreValues: [],
    howTheyCare: [],
    energyPresence: [],
    lifestyleInterests: []
  }
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
    // Character saving to JSON is handled by CharacterEditor
  };

  const handleDeleteCharacter = async (index) => {
    if (confirm('Are you sure you want to delete this character?')) {
      const characterToDelete = characters[index];

      // Delete from JSON file if character has a name
      if (characterToDelete.name) {
        const characterId = generateCharacterId(characterToDelete.name);
        await deleteCharacterFile(characterId);
      }

      // Update settings
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

  // Get character trait summary
  const getTraitSummary = (character) => {
    const allTraits = [
      ...(character.traits?.emotionalExpression || []),
      ...(character.traits?.socialEnergy || []),
      ...(character.traits?.thinkingStyle || [])
    ];
    return allTraits.slice(0, 3).join(' • ');
  };

  return (
    <div className="character-list">
      <div className="character-list__header">
        <h3 className="character-list__title">Characters ({characters.length})</h3>
        <Button onClick={handleAddCharacter} variant="primary">
          + Add Character
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
            <div key={index} className="character-card-preview">
              {character.avatarImage && (
                <div className="character-card-preview__avatar">
                  <img src={character.avatarImage} alt={character.name || 'Character'} />
                </div>
              )}
              <div className="character-card-preview__content">
                <h4 className="character-card-preview__name">
                  {character.name || `Character ${index + 1}`}
                </h4>
                {(character.species || character.role) && (
                  <p className="character-card-preview__info">
                    {character.species}
                    {character.species && character.role && ' • '}
                    {character.role}
                  </p>
                )}
                {getTraitSummary(character) && (
                  <p className="character-card-preview__traits">
                    {getTraitSummary(character)}
                  </p>
                )}
              </div>
              <div className="character-card-preview__actions">
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
        <div className="character-list__editor">
          <div className="character-list__editor-header">
            <h3>Editing {characters[editingIndex].name || `Character ${editingIndex + 1}`}</h3>
            <Button onClick={handleCloseEditor} variant="secondary">
              Done
            </Button>
          </div>
          <CharacterEditor
            character={characters[editingIndex]}
            onChange={handleUpdateCharacter}
            mode="multi"
          />
        </div>
      )}
    </div>
  );
}
