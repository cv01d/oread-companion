import { useState } from 'react';

export default function MultiSelect({
  label,
  options,
  selected = [],
  onChange,
  allowCustom = true,
  placeholder = 'Add custom option...'
}) {
  const [customValue, setCustomValue] = useState('');

  const handleToggle = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleAddCustom = () => {
    if (customValue.trim() && !selected.includes(customValue.trim())) {
      onChange([...selected, customValue.trim()]);
      setCustomValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const handleRemove = (option) => {
    onChange(selected.filter(item => item !== option));
  };

  return (
    <div className="multi-select">
      {label && <label className="multi-select__label">{label}</label>}

      <div className="multi-select__options">
        {options.map(option => (
          <button
            key={option}
            type="button"
            className={`multi-select__option ${selected.includes(option) ? 'multi-select__option--selected' : ''}`}
            onClick={() => handleToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {allowCustom && (
        <div className="multi-select__custom">
          <input
            type="text"
            className="multi-select__custom-input"
            placeholder={placeholder}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            type="button"
            className="multi-select__custom-btn"
            onClick={handleAddCustom}
            disabled={!customValue.trim()}
          >
            Add
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="multi-select__selected">
          {selected.map(option => (
            <span key={option} className="multi-select__tag">
              {option}
              <button
                type="button"
                className="multi-select__tag-remove"
                onClick={() => handleRemove(option)}
                aria-label={`Remove ${option}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
