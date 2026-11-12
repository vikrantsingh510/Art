import fs from 'node:fs';
import path from 'node:path';
import { assertGlbMatchesPhysical, assertUsdzContainer } from './validate.js';

export const CURRENT_JSON = 'current.json';
export const MANIFEST_JSON = 'manifest.json';

function unlinkIfExists(file) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function rmDirIfExists(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function cleanLegacyRootModels(artworkDir) {
  unlinkIfExists(path.join(artworkDir, 'painting.glb'));
  unlinkIfExists(path.join(artworkDir, 'painting.usdz'));
  unlinkIfExists(path.join(artworkDir, 'texture.jpg'));
}

export function currentJsonPath(artworkDir) {
  return path.join(artworkDir, CURRENT_JSON);
}

export function readCurrentPointer(artworkDir) {
  const file = currentJsonPath(artworkDir);
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeCurrentPointer(artworkDir, pointer) {
  fs.mkdirSync(artworkDir, { recursive: true });
  const tmp = path.join(artworkDir, `${CURRENT_JSON}.tmp`);
  writeJson(tmp, pointer);
  fs.renameSync(tmp, currentJsonPath(artworkDir));
  return currentJsonPath(artworkDir);
}

/**
 * Readiness requires both GLB and USDZ to exist, be non-empty, and pass
 * validation. File existence alone is not enough.
 */
export function verifyVersionOutputs(versionDir, physical) {
  const glbPath = path.join(versionDir, 'painting.glb');
  const usdzPath = path.join(versionDir, 'painting.usdz');
  const texturePath = path.join(versionDir, 'texture.jpg');
  if (!fs.existsSync(glbPath) || !fs.existsSync(usdzPath)) {
    return { ok: false, reason: 'missing-assets' };
  }
  const glb = fs.readFileSync(glbPath);
  const usdz = fs.readFileSync(usdzPath);
  if (!glb.length || !usdz.length) {
    return { ok: false, reason: 'empty-assets' };
  }
  if (!physical || !(physical.widthM > 0) || !(physical.heightM > 0)) {
    return { ok: false, reason: 'missing-physical' };
  }
  try {
    const plane = assertGlbMatchesPhysical(glb, physical);
    assertUsdzContainer(usdz);
    return {
      ok: true,
      glbPath,
      usdzPath,
      texturePath: fs.existsSync(texturePath) ? texturePath : null,
      plane,
      glbBytes: glb.length,
      usdzBytes: usdz.length,
    };
  } catch (error) {
    return { ok: false, reason: 'invalid-assets', error: error.message };
  }
}

function physicalFromManifestFile(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!(manifest.widthM > 0) || !(manifest.heightM > 0)) {
      return null;
    }
    return {
      widthM: manifest.widthM,
      heightM: manifest.heightM,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the artwork's current pointer. Old hash directories on disk are
 * ignored unless current.json points at them AND both files validate.
 */
export function resolveCurrentArAssets(artworkDir, { expectedHash = null, physical = null } = {}) {
  const current = readCurrentPointer(artworkDir);
  if (!current) {
    return {
      current: null,
      ready: false,
      assetsValid: false,
      reasons: ['missing-current'],
      glbPath: null,
      usdzPath: null,
      versionDir: null,
    };
  }

  if (expectedHash && current.contentHash && current.contentHash !== expectedHash) {
    return {
      current,
      ready: false,
      assetsValid: false,
      reasons: ['stale-hash'],
      glbPath: null,
      usdzPath: null,
      versionDir: null,
    };
  }

  if (!current.versionDir || current.assetsValid !== true) {
    return {
      current,
      ready: false,
      assetsValid: false,
      reasons: current.reasons?.length ? current.reasons : ['generation-not-ready'],
      glbPath: null,
      usdzPath: null,
      versionDir: null,
    };
  }

  const versionDir = path.join(artworkDir, current.versionDir);
  const resolvedPhysical = physical
    || physicalFromManifestFile(path.join(versionDir, MANIFEST_JSON));
  const verified = verifyVersionOutputs(versionDir, resolvedPhysical);
  if (!verified.ok) {
    return {
      current,
      ready: false,
      assetsValid: false,
      reasons: [verified.reason || 'missing-assets'],
      glbPath: null,
      usdzPath: null,
      versionDir,
    };
  }

  return {
    current,
    ready: current.ready === true,
    assetsValid: true,
    reasons: current.ready === true ? [] : (current.reasons || []),
    glbPath: verified.glbPath,
    usdzPath: verified.usdzPath,
    versionDir,
  };
}

function failurePointer(result) {
  return {
    artworkId: result.manifest?.artworkId || null,
    contentHash: result.manifest?.contentHash || null,
    ready: false,
    assetsValid: false,
    versionDir: null,
    files: {
      glb: null,
      usdz: null,
      texture: null,
      manifest: MANIFEST_JSON,
    },
    reasons: result.manifest?.reasons || result.reasons || [],
    updatedAt: new Date().toISOString(),
  };
}

export function writeArAssetBundle(result, artworkDir) {
  fs.mkdirSync(artworkDir, { recursive: true });
  cleanLegacyRootModels(artworkDir);

  const hash = result.manifest?.contentHash || null;
  const evaluationManifest = {
    ...result.manifest,
    assetsValid: Boolean(result.assetsValid && result.files?.glb && result.files?.usdz),
  };
  writeJson(path.join(artworkDir, MANIFEST_JSON), evaluationManifest);

  const canPersistVersion = Boolean(
    result.assetsValid
    && result.files?.glb
    && result.files?.usdz
    && result.physical?.widthM
    && result.physical?.heightM
    && hash,
  );

  if (!canPersistVersion) {
    const pointer = failurePointer(result);
    writeCurrentPointer(artworkDir, pointer);
    return {
      outDir: artworkDir,
      manifestPath: path.join(artworkDir, MANIFEST_JSON),
      currentPath: currentJsonPath(artworkDir),
      glbPath: null,
      usdzPath: null,
      versionDir: null,
    };
  }

  const tmpDir = path.join(artworkDir, `${hash}.tmp`);
  const versionDir = path.join(artworkDir, hash);
  rmDirIfExists(tmpDir);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(tmpDir, 'painting.glb'), result.files.glb);
    fs.writeFileSync(path.join(tmpDir, 'painting.usdz'), result.files.usdz);
    if (result.files.texture) {
      fs.writeFileSync(path.join(tmpDir, 'texture.jpg'), result.files.texture);
    }

    const versionManifest = {
      ...evaluationManifest,
      files: {
        glb: `${hash}/painting.glb`,
        usdz: `${hash}/painting.usdz`,
        texture: result.files.texture ? `${hash}/texture.jpg` : null,
      },
    };
    writeJson(path.join(tmpDir, MANIFEST_JSON), versionManifest);

    const verified = verifyVersionOutputs(tmpDir, result.physical);
    if (!verified.ok) {
      throw new Error(verified.reason || 'invalid-assets');
    }

    rmDirIfExists(versionDir);
    fs.renameSync(tmpDir, versionDir);

    const pointer = {
      artworkId: result.manifest.artworkId,
      contentHash: hash,
      ready: Boolean(result.ready),
      assetsValid: true,
      versionDir: hash,
      files: {
        glb: `${hash}/painting.glb`,
        usdz: `${hash}/painting.usdz`,
        texture: result.files.texture ? `${hash}/texture.jpg` : null,
        manifest: `${hash}/manifest.json`,
      },
      updatedAt: new Date().toISOString(),
    };
    writeCurrentPointer(artworkDir, pointer);
    writeJson(path.join(artworkDir, MANIFEST_JSON), {
      ...versionManifest,
      current: pointer,
    });

    return {
      outDir: artworkDir,
      manifestPath: path.join(artworkDir, MANIFEST_JSON),
      currentPath: currentJsonPath(artworkDir),
      glbPath: path.join(versionDir, 'painting.glb'),
      usdzPath: path.join(versionDir, 'painting.usdz'),
      versionDir,
    };
  } catch (error) {
    rmDirIfExists(tmpDir);
    const pointer = failurePointer({
      ...result,
      manifest: {
        ...evaluationManifest,
        ready: false,
        assetsValid: false,
        reasons: [...new Set([...(evaluationManifest.reasons || []), 'generation-failed'])],
      },
    });
    writeJson(path.join(artworkDir, MANIFEST_JSON), {
      ...evaluationManifest,
      ready: false,
      assetsValid: false,
      reasons: pointer.reasons,
    });
    writeCurrentPointer(artworkDir, pointer);
    throw error;
  }
}
