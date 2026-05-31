import { useState } from 'react';
import useStore from '../../store/useStore';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';

export default function TemplateSelector({ selectedTemplateId, onSelect }) {
  const templates = useStore((state) => state.templates);
  const deleteTemplate = useStore((state) => state.deleteTemplate);
  const [previewTemplateId, setPreviewTemplateId] = useState(selectedTemplateId || '');

  // Split templates into defaults and user
  const defaultTemplates = templates.filter(t => !t.isUserTemplate);
  const userTemplates = templates.filter(t => t.isUserTemplate);

  // Create grouped dropdown options — user worlds first
  const templateOptions = [
    { value: '', label: 'None (Custom Settings)' },
    ...(userTemplates.length > 0
      ? [
          { value: '', label: '── My Worlds ──', disabled: true },
          ...userTemplates.map(t => ({ value: t.id, label: t.name })),
          { value: '', label: '── Templates ──', disabled: true },
        ]
      : []),
    ...defaultTemplates.map(t => ({ value: t.id, label: t.name })),
  ];

  // Get the currently previewed template
  const previewTemplate = templates.find(t => t.id === previewTemplateId);

  const handleApply = () => {
    if (previewTemplateId) {
      const template = templates.find(t => t.id === previewTemplateId);
      onSelect(template);
    } else {
      onSelect(null);
    }
  };

  const handleDelete = async () => {
    if (!previewTemplate?.isUserTemplate) return;
    if (!window.confirm(`Delete "${previewTemplate.name}"? This cannot be undone.`)) return;
    await deleteTemplate(previewTemplate.id);
    setPreviewTemplateId('');
  };

  return (
    <div className="template-selector">
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
          Apply World
        </Button>
      </div>

      {/* Template Preview */}
      {previewTemplate && (
        <div className="template-selector__preview">
          <h4 className="template-selector__preview-title">
            {previewTemplate.name}
            <span className="template-selector__preview-badge">
              {previewTemplate.category === 'utility' ? 'Utility' : 'Roleplay'}
            </span>
            {previewTemplate.isUserTemplate && (
              <span className="template-selector__preview-badge template-selector__preview-badge--user">
                My World
              </span>
            )}
          </h4>
          <p className="template-selector__preview-description">
            {previewTemplate.description}
          </p>
          {previewTemplate.isUserTemplate && (
            <Button
              onClick={handleDelete}
              variant="danger"
              className="template-selector__delete"
            >
              Delete World
            </Button>
          )}
        </div>
      )}

    </div>
  );
}
