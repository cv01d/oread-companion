import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';

export default function ModelSelector({
  models = [],
  selectedModel = null,
  onSelectModel,
  onRefreshModels
}) {
  const modelOptions = models.map(model => ({
    value: model.name,
    label: model.name
  }));

  return (
    <div className="model-selector">
      <div className="model-selector__controls">
        <Dropdown
          options={modelOptions}
          value={selectedModel || ''}
          onChange={onSelectModel}
          placeholder="Choose a model..."
        />
        <Button onClick={onRefreshModels} variant="secondary">
          Refresh
        </Button>
      </div>
    </div>
  );
}
