import { useState } from 'react';
import Button from './Button';

export default function TagInput({
  tags = [],
  onAdd,
  onRemove,
  onChange, // Alternative API: pass updated tags array
  placeholder = 'Add tag...',
  className = ''
}) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      // Support both onChange (array-based) and onAdd (individual item) APIs
      if (onChange) {
        onChange([...tags, trimmed]);
      } else if (onAdd) {
        onAdd(trimmed);
      }
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (tag) => {
    // Support both onChange (array-based) and onRemove (individual item) APIs
    if (onChange) {
      onChange(tags.filter(t => t !== tag));
    } else if (onRemove) {
      onRemove(tag);
    }
  };

  return (
    <div className={`tag-input ${className}`}>
      <div className="tag-input__controls">
        <input
          type="text"
          className="tag-input__field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
        />
        <Button
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          variant="secondary"
          className="tag-input__add-btn"
        >
          Add
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="tag-input__list">
          {tags.map((tag, index) => (
            <div key={index} className="tag-input__tag">
              <span className="tag-input__tag-text">{tag}</span>
              <button
                className="tag-input__remove"
                onClick={() => handleRemove(tag)}
                aria-label="Remove tag"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
