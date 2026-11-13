import { ARTWORK_IMAGES_BUCKET, explainStorageUploadError } from './artwork-image-constraints.js';
import { displayDerivativeStoragePath } from './media.js';

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

export async function deleteArtworkImageFile({
  supabaseUrl,
  publishableKey,
  accessToken,
  path,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!supabaseUrl || !publishableKey || !accessToken || !path) {
    throw new Error('A signed-in Storage session is required to remove an image.');
  }
  const response = await fetchImpl(artworkImagesUploadUrl(supabaseUrl, path), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
  });
  if (response.ok || response.status === 404) {
    return { status: response.status };
  }
  let message = `Storage delete failed (${response.status})`;
  try {
    const payload = await response.json();
    message = payload?.message || payload?.error || message;
  } catch {
    // Keep the status message when Storage does not return JSON.
  }
  throw new Error(message);
}

export async function purgeCatalogueImage({
  storagePath,
  deleteStorage = deleteArtworkImageFile,
  removeCatalogue,
  storageSession,
} = {}) {
  if (!storagePath) {
    throw new Error('A storage path is required to remove an image.');
  }
  if (typeof removeCatalogue !== 'function') {
    throw new Error('A catalogue delete function is required to remove an image.');
  }

  const derivativePath = displayDerivativeStoragePath(storagePath);
  if (derivativePath) {
    try {
      await deleteStorage({ ...storageSession, path: derivativePath });
    } catch (error) {
      const failure = new Error(
        `Storage still holds ${derivativePath}. The original ${storagePath} was not deleted. The catalogue was not changed. Retry after resolving: ${error.message}`,
      );
      failure.code = 'STORAGE_DELETE_FAILED';
      failure.cause = error;
      throw failure;
    }
  }

  try {
    await deleteStorage({ ...storageSession, path: storagePath });
  } catch (error) {
    const failure = new Error(
      `Storage still holds ${storagePath}. The catalogue was not changed. Retry after resolving: ${error.message}`,
    );
    failure.code = 'STORAGE_DELETE_FAILED';
    failure.cause = error;
    throw failure;
  }

  try {
    return await removeCatalogue();
  } catch (error) {
    const failure = new Error(
      `Storage object removed, but the catalogue row remains for ${storagePath}. Retry to finish catalogue cleanup: ${error.message}`,
    );
    failure.code = 'CATALOGUE_DELETE_FAILED';
    failure.storageDeleted = true;
    failure.cause = error;
    throw failure;
  }
}

export function classifyRegisterAfterUploadError({
  registerError,
  cleanupError = null,
  artworkId,
  storagePath,
} = {}) {
  const registerMessage = registerError?.message || String(registerError || 'Catalogue registration failed');
  const pathLabel = storagePath || 'unknown path';
  const artworkLabel = artworkId || 'unknown artwork';

  if (cleanupError) {
    const cleanupMessage = cleanupError?.message || String(cleanupError);
    const failure = new Error(
      `Catalogue registration failed and the uploaded Storage object could not be cleaned up. Manual retry or cleanup is required. Artwork ${artworkLabel}, path ${pathLabel}. ${registerMessage}. Cleanup: ${cleanupMessage}`,
    );
    failure.code = 'REGISTER_CLEANUP_FAILED';
    failure.cause = registerError;
    failure.cleanupError = cleanupError;
    failure.artworkId = artworkId;
    failure.storagePath = storagePath;
    failure.storageDeleted = false;
    return failure;
  }

  const failure = new Error(
    `Image uploaded, but catalogue registration failed. Cleanup was attempted. The uploaded object was cleaned up. Artwork ${artworkLabel}, path ${pathLabel}. ${registerMessage}`,
  );
  failure.code = 'REGISTER_AFTER_UPLOAD_FAILED';
  failure.cause = registerError;
  failure.artworkId = artworkId;
  failure.storagePath = storagePath;
  failure.storageDeleted = true;
  return failure;
}

export function explainImagePersistError(error) {
  if (
    error?.code === 'STORAGE_DELETE_FAILED'
    || error?.code === 'CATALOGUE_DELETE_FAILED'
    || error?.code === 'REGISTER_AFTER_UPLOAD_FAILED'
    || error?.code === 'REGISTER_CLEANUP_FAILED'
  ) {
    return error.message;
  }
  return explainStorageUploadError(error);
}

export async function persistPendingArtworkImage({
  uploadFile = uploadArtworkImageFile,
  registerCatalogue,
  deleteStorage = deleteArtworkImageFile,
  storageSession,
  artworkId,
  path,
  file,
  onProgress,
} = {}) {
  if (typeof registerCatalogue !== 'function') {
    throw new Error('A catalogue register function is required to persist an image.');
  }

  try {
    await uploadFile({
      ...storageSession,
      path,
      file,
      onProgress,
    });
  } catch (uploadError) {
    try {
      await deleteStorage({ ...storageSession, path });
    } catch {
      // Upload did not complete; leftover cleanup is best-effort.
    }
    if (uploadError && typeof uploadError === 'object' && !uploadError.code) {
      uploadError.code = 'STORAGE_UPLOAD_FAILED';
    }
    throw uploadError;
  }

  try {
    return await registerCatalogue();
  } catch (registerError) {
    let cleanupError = null;
    try {
      await deleteStorage({ ...storageSession, path });
    } catch (error) {
      cleanupError = error;
    }
    throw classifyRegisterAfterUploadError({
      registerError,
      cleanupError,
      artworkId,
      storagePath: path,
    });
  }
}

export async function persistArtworkDisplayDerivative({
  originalPath,
  file,
  storageSession,
  createDerivative,
  uploadFile = uploadArtworkImageFile,
} = {}) {
  const derivativePath = displayDerivativeStoragePath(originalPath);
  if (!derivativePath || !file || typeof createDerivative !== 'function') {
    return { ok: false, skipped: true };
  }

  try {
    const derivativeFile = await createDerivative(file);
    if (!derivativeFile) {
      return { ok: false, path: derivativePath };
    }
    await uploadFile({
      ...storageSession,
      path: derivativePath,
      file: derivativeFile,
    });
    return { ok: true, path: derivativePath };
  } catch {
    return { ok: false, path: derivativePath };
  }
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
  deleteArtworkImageFile,
  purgeCatalogueImage,
  persistPendingArtworkImage,
  persistArtworkDisplayDerivative,
  classifyRegisterAfterUploadError,
  explainImagePersistError,
};
