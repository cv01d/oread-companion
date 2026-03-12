// Image processing utilities for avatar uploads

const MAX_SIZE = 512; // Max width/height in pixels
const MAX_FILE_SIZE_KB = 500; // Max file size in KB

/**
 * Resize image to max dimensions while maintaining aspect ratio
 * @param {File|Blob} file - Image file
 * @param {Number} maxSize - Maximum width/height
 * @returns {Promise<String>} Base64 encoded image
 */
export async function resizeImage(file, maxSize = MAX_SIZE) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        resolve(base64);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert image file to base64 with resizing
 * @param {File} file - Image file
 * @returns {Promise<String>} Base64 encoded image
 */
export async function fileToBase64(file) {
  // Check file size
  if (file.size > MAX_FILE_SIZE_KB * 1024) {
    console.warn(`File size (${Math.round(file.size / 1024)}KB) exceeds recommended limit (${MAX_FILE_SIZE_KB}KB). Resizing...`);
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  return await resizeImage(file);
}

/**
 * Convert image URL to base64
 * @param {String} url - Image URL
 * @returns {Promise<String>} Base64 encoded image
 */
export async function urlToBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;

      // Resize if needed
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      resolve(base64);
    };

    img.onerror = () => reject(new Error('Failed to load image from URL. Check CORS policy.'));
    img.src = url;
  });
}

/**
 * Validate image file
 * @param {File} file - Image file
 * @returns {Object} { valid: boolean, error: string | null }
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image (JPG, PNG, GIF, WebP)' };
  }

  const maxBytes = MAX_FILE_SIZE_KB * 1024 * 10; // Allow up to 10x for compression
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is ${Math.round(maxBytes / 1024 / 1024)}MB.`
    };
  }

  return { valid: true, error: null };
}

/**
 * Get image dimensions from base64 string
 * @param {String} base64 - Base64 encoded image
 * @returns {Promise<Object>} { width, height }
 */
export async function getImageDimensions(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => reject(new Error('Invalid image'));
    img.src = base64;
  });
}

/**
 * Calculate estimated size of base64 string in KB
 * @param {String} base64 - Base64 string
 * @returns {Number} Size in KB
 */
export function getBase64Size(base64) {
  if (!base64) return 0;
  // Remove data URL prefix if present
  const base64Data = base64.split(',')[1] || base64;
  // Calculate size (base64 is ~4/3 of original size)
  const bytes = (base64Data.length * 3) / 4;
  return Math.round(bytes / 1024);
}
