import { useState } from 'react';
import Button from '../ui/Button';
import CharacterEditor from './CharacterEditor';

export default function CharacterList({ characters = [], onCharactersChange, activeCharacterIndex = 0, onActiveCharacterChange }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddCharacter = () => {
    onCharactersChange([...characters, null]);
    setEditingIndex(characters.length);
  };

  const handleEditCharacter = (index) => {
    setEditingIndex(index);
  };

  const handleDeleteCharacter = (index) => {
    const charName = characters[index]?.name || 'Unnamed';
    if (window.confirm(`Remove character "${charName}" from this template?`)) {
      const updated = characters.filter((_, i) => i !== index);
      onCharactersChange(updated);
      if (editingIndex === index) setEditingIndex(null);
      // Adjust active index if needed
      if (index < activeCharacterIndex) {
        onActiveCharacterChange(activeCharacterIndex - 1);
      } else if (index === activeCharacterIndex && activeCharacterIndex >= updated.length) {
        onActiveCharacterChange(Math.max(0, updated.length - 1));
      }
    }
  };

  const handleCharacterChange = (updatedCharacter) => {
    const updated = [...characters];
    updated[editingIndex] = updatedCharacter;
    onCharactersChange(updated);
  };

  const handleFinishEditing = () => {
    setEditingIndex(null);
  };

  return (
    <div className="character-list">
      <div className="character-list__header">
        <h3 className="character-list__title">
          Characters ({characters.length})
        </h3>
        <Button onClick={handleAddCharacter} variant="primary">
          + Add Character
        </Button>
      </div>

      {characters.length === 0 && (
        <div className="character-list__empty">
          <p>No characters added yet. Click "Add Character" to create one.</p>
        </div>
      )}

      {/* Editing Mode */}
      {editingIndex !== null && (
        <div className="character-list__editor">
          <div className="character-list__editor-header">
            <h4>Editing Character</h4>
            <Button onClick={handleFinishEditing} variant="secondary">
              Done Editing
            </Button>
          </div>
          <CharacterEditor
            inlineCharacter={characters[editingIndex]}
            onCharacterChange={handleCharacterChange}
            mode="multi"
          />
        </div>
      )}

      {/* Character List View */}
      {editingIndex === null && characters.length > 0 && (
        <div className="character-list__grid">
          {characters.map((char, index) => (
            <div key={index} className="character-card-preview">
              {char?.avatarImage && (
                <div className="character-card-preview__avatar">
                  <img
                    src={char.avatarImage}
                    alt={char?.name || 'Unnamed'}
                  />
                </div>
              )}

              <div className="character-card-preview__info">
                <h4 className="character-card-preview__name">
                  {char?.name || 'Unnamed'}
                </h4>

                {char?.role && (
                  <p className="character-card-preview__role">
                    {char.role}
                  </p>
                )}

                {char?.traits && (
                  <div className="character-card-preview__traits">
                    {[
                      ...(char.traits.emotionalExpression || []),
                      ...(char.traits.socialEnergy || []),
                      ...(char.traits.thinkingStyle || [])
                    ].slice(0, 3).map((trait, i) => (
                      <span key={i} className="character-card-preview__trait">
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="character-card-preview__actions">
                {index === activeCharacterIndex ? (
                  <Button variant="primary" disabled className="character-card-preview__active-btn">
                    Active Character
                  </Button>
                ) : (
                  <Button
                    onClick={() => onActiveCharacterChange(index)}
                    variant="secondary"
                    className="character-card-preview__active-btn"
                  >
                    Make Active
                  </Button>
                )}
                <Button
                  onClick={() => handleEditCharacter(index)}
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDeleteCharacter(index)}
                  variant="secondary"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
