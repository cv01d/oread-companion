import { useState } from 'react';
import { TEMPLATES } from '../../data/templates';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';

export default function TemplateSelector({ selectedTemplateId, onSelect }) {
  const [previewTemplateId, setPreviewTemplateId] = useState(selectedTemplateId || '');

  // Create dropdown options
  const templateOptions = [
    { value: '', label: 'None (Custom Settings)' },
    ...TEMPLATES.map(t => ({
      value: t.id,
      label: t.name
    }))
  ];

  // Get the currently previewed template
  const previewTemplate = TEMPLATES.find(t => t.id === previewTemplateId);

  const handleApply = () => {
    if (previewTemplateId) {
      const template = TEMPLATES.find(t => t.id === previewTemplateId);
      onSelect(template);
    } else {
      onSelect(null);
    }
  };

  return (
    <div className="template-selector">
      <h3 className="template-selector__title">Choose a Template</h3>
      <p className="template-selector__description">
        Start with a preset or customize your own settings
      </p>

      <div className="template-selector__controls">
        <Dropdown
          options={templateOptions}
          value={previewTemplateId}
          onChange={setPreviewTemplateId}
          placeholder="Select a template..."
          className="template-selector__dropdown"
        />
        <Button
          onClick={handleApply}
          variant="primary"
          className="template-selector__apply"
        >
          Apply Template
        </Button>
      </div>

      {/* Template Preview */}
      {previewTemplate && (
        <div className="template-selector__preview">
          <h4 className="template-selector__preview-title">
            {previewTemplate.name}
            <span className="template-selector__preview-badge">
              {previewTemplate.category === 'roleplay' ? 'Roleplay' : 'Utility'}
            </span>
          </h4>
          <p className="template-selector__preview-description">
            {previewTemplate.description}
          </p>
        </div>
      )}

      {/* Currently Applied Template */}
      {selectedTemplateId && (
        <div className="template-selector__current">
          <strong>Currently Applied:</strong> {TEMPLATES.find(t => t.id === selectedTemplateId)?.name || 'Unknown'}
        </div>
      )}
    </div>
  );
}
