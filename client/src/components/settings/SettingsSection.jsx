import { useState } from 'react';

export default function SettingsSection({
  title,
  description = '',
  children,
  collapsible = false,
  defaultExpanded = true
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="settings-section">
      <div
        className={`settings-section__header ${
          collapsible ? 'settings-section__header--collapsible' : ''
        }`}
        onClick={handleToggle}
      >
        <div>
          <h3 className="settings-section__title">{title}</h3>
          {description && (
            <p className="settings-section__description">{description}</p>
          )}
        </div>
        {collapsible && (
          <span className="settings-section__toggle">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="settings-section__content">{children}</div>
      )}
    </div>
  );
}
