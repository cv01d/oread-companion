import { useState, useRef } from 'react';
import { fileToBase64, urlToBase64, validateImageFile, getBase64Size } from '../../utils/imageProcessor';
import Button from './Button';

export default function ImageUpload({
  value = '',
  onChange,
  onRemove,
  maxSizeKB = 500,
  className = ''
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setError(null);
    setIsLoading(true);

    try {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setIsLoading(false);
        return;
      }

      const base64 = await fileToBase64(file);
      const sizeKB = getBase64Size(base64);

      if (sizeKB > maxSizeKB) {
        console.warn(`Image size (${sizeKB}KB) exceeds recommended ${maxSizeKB}KB but was resized`);
      }

      if (onChange) {
        onChange(base64);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const base64 = await urlToBase64(urlInput.trim());
      const sizeKB = getBase64Size(base64);

      if (sizeKB > maxSizeKB) {
        console.warn(`Image size (${sizeKB}KB) exceeds recommended ${maxSizeKB}KB but was resized`);
      }

      if (onChange) {
        onChange(base64);
      }
      setUrlInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
    setError(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`image-upload ${className}`}>
      {value ? (
        <div className="image-upload__preview">
          <img src={value} alt="Preview" className="image-upload__thumbnail" />
          <Button
            onClick={handleRemove}
            variant="secondary"
            className="image-upload__remove"
          >
            Remove
          </Button>
        </div>
      ) : (
        <>
          <div
            className={`image-upload__dropzone ${isDragging ? 'image-upload__dropzone--dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={triggerFileInput}
          >
            {isLoading ? (
              <div className="image-upload__loading">Uploading...</div>
            ) : (
              <>
                <div className="image-upload__text">
                  Drag & drop an image or click to browse
                </div>
                <div className="image-upload__hint">
                  Max size: {maxSizeKB}KB • Recommended: 512x512px
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="image-upload__input"
          />

          <div className="image-upload__url-section">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Or paste image URL..."
              className="image-upload__url-input"
              disabled={isLoading}
            />
            <Button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || isLoading}
              variant="secondary"
            >
              Load URL
            </Button>
          </div>
        </>
      )}

      {error && (
        <div className="image-upload__error">{error}</div>
      )}
    </div>
  );
}
