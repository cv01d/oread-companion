export default function ModeSelector({ currentMode, onChange }) {
  return (
    <div className="mode-selector">
      <h3 className="mode-selector__title">Mode</h3>
      <div className="mode-selector__options">
        <button
          className={`mode-selector__option ${
            currentMode === 'roleplay' ? 'mode-selector__option--active' : ''
          }`}
          onClick={() => onChange('roleplay')}
        >
          <div>
            <div className="mode-selector__option-title">Roleplay Mode</div>
            <div className="mode-selector__option-desc">
              Creative storytelling with characters and worlds
            </div>
          </div>
        </button>

        <button
          className={`mode-selector__option ${
            currentMode === 'normal' ? 'mode-selector__option--active' : ''
          }`}
          onClick={() => onChange('normal')}
        >
          <div>
            <div className="mode-selector__option-title">Assistant Mode</div>
            <div className="mode-selector__option-desc">
              Assistant mode for tasks and information
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
