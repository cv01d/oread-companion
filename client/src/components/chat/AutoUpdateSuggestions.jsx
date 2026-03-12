import { useState } from 'react';
import useStore from '../../store/useStore';
import styles from './AutoUpdateSuggestions.module.scss';

export default function AutoUpdateSuggestions() {
  const [selectedUpdates, setSelectedUpdates] = useState(new Set());

  // Use individual selectors to avoid infinite loop
  const extractedSuggestions = useStore((state) => state.extractedSuggestions);
  const settings = useStore((state) => state.settings);
  const setExtractedSuggestions = useStore((state) => state.setExtractedSuggestions);
  const applyExtractedUpdates = useStore((state) => state.applyExtractedUpdates);

  if (!extractedSuggestions || extractedSuggestions.length === 0) {
    return null;
  }

  const toggleUpdate = (index) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedUpdates(newSelected);
  };

  const handleApply = () => {
    const updatesToApply = extractedSuggestions.filter((_, index) =>
      selectedUpdates.has(index)
    );

    if (updatesToApply.length > 0) {
      applyExtractedUpdates(updatesToApply);
    }

    setExtractedSuggestions(null);
    setSelectedUpdates(new Set());
  };

  const handleDismiss = () => {
    setExtractedSuggestions(null);
    setSelectedUpdates(new Set());
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'personality':
        return '🎭';
      case 'backstory':
        return '📖';
      case 'knowledge':
        return '🧠';
      case 'appearance':
        return '👤';
      case 'voice':
        return '🗣️';
      default:
        return '✨';
    }
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) {
      return { label: 'High', className: styles.high };
    } else if (confidence >= 0.5) {
      return { label: 'Medium', className: styles.medium };
    } else {
      return { label: 'Low', className: styles.low };
    }
  };

  const getCurrentValue = (category) => {
    const core = settings.roleplay?.singleCharacter?.core;
    if (!core) return 'Not set';

    switch (category) {
      case 'personality':
        return core.personality || 'Not set';
      case 'backstory':
        return core.backstory || 'Not set';
      case 'knowledge':
        return core.knowledge || 'Not set';
      default:
        return 'Not set';
    }
  };

  return (
    <div className={styles.overlay} onClick={handleDismiss}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>💡 Character Updates Detected</h3>
          <p>
            The AI noticed some new character details in your conversation.
            Review and select which updates to apply.
          </p>
        </div>

        <div className={styles.updatesList}>
          {extractedSuggestions.map((update, index) => {
            const badge = getConfidenceBadge(update.confidence);
            const currentValue = getCurrentValue(update.category);

            return (
              <div
                key={index}
                className={`${styles.updateCard} ${
                  selectedUpdates.has(index) ? styles.selected : ''
                }`}
                onClick={() => toggleUpdate(index)}
              >
                <div className={styles.updateHeader}>
                  <div className={styles.categoryInfo}>
                    <span className={styles.icon}>
                      {getCategoryIcon(update.category)}
                    </span>
                    <span className={styles.category}>
                      {update.category.charAt(0).toUpperCase() + update.category.slice(1)}
                    </span>
                  </div>
                  <div className={styles.badges}>
                    <span className={`${styles.confidenceBadge} ${badge.className}`}>
                      {badge.label}
                    </span>
                    <div className={styles.checkbox}>
                      {selectedUpdates.has(index) && '✓'}
                    </div>
                  </div>
                </div>

                <div className={styles.addition}>
                  <div className={styles.label}>New addition:</div>
                  <div className={styles.value}>{update.addition}</div>
                </div>

                {update.evidence && (
                  <div className={styles.evidence}>
                    <div className={styles.label}>Evidence:</div>
                    <div className={styles.value}>"{update.evidence}"</div>
                  </div>
                )}

                <div className={styles.current}>
                  <div className={styles.label}>Current value:</div>
                  <div className={styles.value}>
                    {currentValue.length > 150
                      ? currentValue.substring(0, 150) + '...'
                      : currentValue}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button className={styles.dismissButton} onClick={handleDismiss}>
            Dismiss All
          </button>
          <button
            className={styles.applyButton}
            onClick={handleApply}
            disabled={selectedUpdates.size === 0}
          >
            Apply {selectedUpdates.size > 0 ? `(${selectedUpdates.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
