import { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import styles from './ModelDrawer.module.scss';

export default function ModelDrawer({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);
  const searchRef = useRef(null);

  const models = useStore((s) => s.models);
  const selectedModel = useStore((s) => s.selectedModel);
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const fetchModels = useStore((s) => s.fetchModels);

  // Measure header height and refresh models when drawer opens
  useEffect(() => {
    if (isOpen) {
      const headerEl = document.querySelector('.header');
      if (headerEl) {
        setHeaderHeight(headerEl.offsetHeight);
      }
      fetchModels();
    }
  }, [isOpen, fetchModels]);

  // Auto-focus search and handle Escape
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 100);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredModels = models.filter((model) => {
    if (!searchQuery.trim()) return true;
    return model.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleModelClick = (modelName) => {
    setSelectedModel(modelName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.open : ''}`}
        style={{ '--header-height': `${headerHeight}px` }}
        onClick={onClose}
      />
      <div
        className={`${styles.drawer} ${isOpen ? styles.open : ''}`}
        style={{ '--header-height': `${headerHeight}px` }}
      >
        <div className={styles.header}>
          <h3>Models</h3>
          <div className={styles.headerActions}>
            <button
              className={styles.refreshButton}
              onClick={fetchModels}
              title="Refresh models"
            >
              ↻
            </button>
            <button className={styles.closeButton} onClick={onClose} title="Close">
              ×
            </button>
          </div>
        </div>

        <div className={styles.search}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.modelList}>
          {filteredModels.length === 0 ? (
            <div className={styles.empty}>
              {searchQuery
                ? 'No models match your search.'
                : 'No models available. Make sure Ollama is running.'}
            </div>
          ) : (
            filteredModels.map((model) => (
              <div
                key={model.name}
                className={`${styles.modelCard} ${
                  selectedModel === model.name ? styles.active : ''
                }`}
                onClick={() => handleModelClick(model.name)}
              >
                <span className={styles.modelName}>{model.name}</span>
                {selectedModel === model.name && (
                  <span className={styles.activeLabel}>Active</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
