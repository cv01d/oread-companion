import { useState } from 'react';

export default function CollapsibleSection({ title, description, children, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-section">
      <button
        className="collapsible-section__header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="collapsible-section__header-content">
          <h3 className="collapsible-section__title">{title}</h3>
          {description && (
            <p className="collapsible-section__description">{description}</p>
          )}
        </div>
        <div className={`collapsible-section__icon ${isExpanded ? 'collapsible-section__icon--expanded' : ''}`}>
          ▼
        </div>
      </button>

      <div className={`collapsible-section__content ${isExpanded ? 'collapsible-section__content--expanded' : ''}`}>
        <div className="collapsible-section__inner">
          {children}
        </div>
      </div>
    </div>
  );
}
