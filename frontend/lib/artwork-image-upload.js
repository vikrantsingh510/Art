import { ARTWORK_IMAGES_BUCKET } from './artwork-image-constraints.js';

function encodeObjectPath(path) {
  return String(path)
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function artworkImagesUploadUrl(supabaseUrl, path) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/${ARTWORK_IMAGES_BUCKET}/${encodeObjectPath(path)}`;
}

export function uploadArtworkImageFile({
  supabaseUrl,
  publishableKey,
  accessToken,
  path,
  file,
  onProgress,
  xhrFactory = () => new XMLHttpRequest(),
} = {}) {
  return new Promise((resolve, reject) => {
    if (!supabaseUrl || !publishableKey || !accessToken) {
      reject(new Error('A signed-in Storage session is required to upload.'));
      return;
    }

    const xhr = xhrFactory();
    xhr.open('POST', artworkImagesUploadUrl(supabaseUrl, path));
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', publishableKey);
    xhr.setRequestHeader('x-upsert', 'false');
    if (file?.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof onProgress === 'function') {
          onProgress(100);
        }
        resolve({ status: xhr.status });
        return;
      }
      let message = `Storage upload failed (${xhr.status})`;
      try {
        const payload = JSON.parse(xhr.responseText);
        message = payload?.message || payload?.error || message;
      } catch {
        if (xhr.responseText) {
          message = xhr.responseText.slice(0, 280);
        }
      }
      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(new Error('Storage upload could not be completed.'));
    };

    xhr.send(file);
  });
}

export default {
  artworkImagesUploadUrl,
  uploadArtworkImageFile,
};
