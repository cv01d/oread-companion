import { useState } from 'react';
import TextField from '../ui/TextField';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';

export default function ModelDownloader({
  onDownloadModel,
  isDownloading = false,
  downloadProgress = { progress: 0, status: '' }
}) {
  const [modelName, setModelName] = useState('');

  const handleDownload = () => {
    if (modelName.trim() && !isDownloading) {
      onDownloadModel(modelName.trim());
      setModelName('');
    }
  };

  return (
    <div className="model-downloader">
      <div className="model-downloader__controls">
        <TextField
          value={modelName}
          onChange={setModelName}
          placeholder="llama2 or hf.co/..."
          disabled={isDownloading}
        />
        <Button
          onClick={handleDownload}
          disabled={isDownloading || !modelName.trim()}
        >
          {isDownloading ? 'Downloading...' : 'Download'}
        </Button>
      </div>
      {isDownloading && (
        <ProgressBar
          progress={downloadProgress.progress || 0}
          status={downloadProgress.status || 'Downloading...'}
          message={downloadProgress.message}
        />
      )}
    </div>
  );
}
