import ModelSelector from '../model/ModelSelector';
import ModelDownloader from '../model/ModelDownloader';

export default function Sidebar({
  models,
  selectedModel,
  onSelectModel,
  onRefreshModels,
  onDownloadModel,
  isDownloading,
  downloadProgress
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          onRefreshModels={onRefreshModels}
        />
      </div>
      <div className="sidebar-section">
        <ModelDownloader
          onDownloadModel={onDownloadModel}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
        />
      </div>
    </aside>
  );
}
