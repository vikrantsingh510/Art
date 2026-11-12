import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { evaluateArReadiness } from '../lib/ar-assets/eligibility.js';
import { statusBlockReason } from '../lib/ar-assets/eligibility-status.js';
import { contentHash } from '../lib/ar-assets/hash.js';
import { parsePhysicalDimensions } from '../lib/ar-assets/physical.js';
import { resolveCurrentArAssets, writeArAssetBundle } from '../lib/ar-assets/persist.js';
import { inspectRemoteVersion, publishCoordinatedArAssets } from '../lib/ar-assets/publish.js';
import { createSupabaseArStorage } from '../lib/ar-assets/storage-client.js';
import {
  AR_ASSETS_BUCKET,
  AR_ASSETS_STAGING_BUCKET,
} from '../lib/ar-assets/storage-paths.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

applyEnvFile(path.join(root, '.env'));
applyEnvFile(path.join(root, '.env.local'));
applyEnvFile(path.join(repoRoot, 'backend', '.env'));

const args = parseArgs(process.argv.slice(2));
const fromPoc = Boolean(args['from-poc']);
const publish = Boolean(args.publish);

const pocDir = path.join(root, 'public/dev/ar-poc');
const artworkId = args['artwork-id']
  || (fromPoc ? '506b0baa-f6e2-4d19-9922-7979b314fa69' : null);
const imagePath = args.image || (fromPoc ? path.join(pocDir, 'source.jpg') : null);
const width = args.width || (fromPoc ? '90' : null);
const height = args.height || (fromPoc ? '120' : null);
const depth = args.depth || (fromPoc ? '4' : null);
const unit = args.unit || (fromPoc ? 'cm' : null);
const status = args.status || (fromPoc ? 'published' : args.status);
const title = args.title || (fromPoc ? 'A Moment of Innocence' : null);
const writeLocal = Boolean(args.out) || !publish;
const outDir = path.resolve(
  args.out
    || path.join(root, 'public/ar-assets', artworkId || 'unknown'),
);

if (!artworkId || !imagePath || !width || !height || !unit) {
  process.stderr.write('Required: --artwork-id --image --width --height --unit (or --from-poc)\n');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  process.stderr.write(`Image not found: ${imagePath}\n`);
  process.exit(1);
}

function createOperatorStorage(bucket) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    process.stderr.write('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required for --publish.\n');
    process.exit(1);
  }
  if (!serviceRoleKey) {
    process.stderr.write(
      'SUPABASE_SERVICE_ROLE_KEY is required for --publish. Use a server-side secret; never NEXT_PUBLIC_.\n',
    );
    process.exit(1);
  }
  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.startsWith('NEXT_PUBLIC_')) {
    process.stderr.write('Refusing to publish with a publishable browser key.\n');
    process.exit(1);
  }
  return createSupabaseArStorage({
    supabaseUrl,
    serviceRoleKey,
    bucket,
  });
}

const imageBuffer = fs.readFileSync(imagePath);
const physical = parsePhysicalDimensions({
  width,
  height,
  depth,
  unit,
});
const expectedHash = physical.ok
  ? contentHash({
    imageBuffer,
    width: physical.width,
    height: physical.height,
    depth: physical.depth,
    unit: physical.unit,
  })
  : null;

let storage = null;
let lockStorage = null;
if (publish) {
  storage = createOperatorStorage(process.env.AR_ASSETS_BUCKET || AR_ASSETS_BUCKET);
  lockStorage = createOperatorStorage(process.env.AR_ASSETS_STAGING_BUCKET || AR_ASSETS_STAGING_BUCKET);
  const bucket = await storage.getBucket();
  if (!bucket) {
    process.stderr.write(
      `Bucket ${storage.bucket} does not exist. Storage configuration is waiting for explicit approval; this script will not create it.\n`,
    );
    process.exit(1);
  }
  const stagingBucket = await lockStorage.getBucket();
  if (!stagingBucket) {
    process.stderr.write(
      `Bucket ${lockStorage.bucket} does not exist. Epoch publish locks require private ar-assets-staging.\n`,
    );
    process.exit(1);
  }
}

let result = null;
let reusedRemote = false;
if (publish && expectedHash && physical.ok) {
  const remote = await inspectRemoteVersion(storage, artworkId, expectedHash, physical);
  if (remote.valid) {
    reusedRemote = true;
    result = {
      ready: remote.manifest.ready === true,
      generated: true,
      assetsValid: true,
      reasons: remote.manifest.reasons || [],
      physical,
      aspect: remote.manifest.aspect,
      pixels: remote.manifest.pixels,
      physicalLabel: remote.manifest.physicalLabel,
      files: remote.files,
      plane: remote.plane,
      manifest: remote.manifest,
    };
  }
}

if (!result) {
  result = await generateArAssets({
    artworkId,
    status,
    width,
    height,
    depth,
    unit,
    imageBuffer,
    title,
    textureMaxEdge: args['max-edge'] ? Number(args['max-edge']) : undefined,
  });
}

let written = null;
let current = { current: null, assetsValid: false };
if (writeLocal) {
  written = writeArAssetBundle(result, outDir);
  current = resolveCurrentArAssets(outDir, {
    expectedHash: result.manifest.contentHash,
    physical: result.physical.ok ? result.physical : null,
  });
}

const eligibility = evaluateArReadiness({
  artwork: {
    status,
    width,
    height,
    depth,
    dimensionUnit: unit,
    expectedHash: result.manifest.contentHash,
  },
  imageBuffer,
  manifest: result.manifest,
  assetsPresent: Boolean(result.assetsValid && result.files?.glb && result.files?.usdz),
  current: current.current,
});

if (written) {
  const rootManifest = JSON.parse(fs.readFileSync(written.manifestPath, 'utf8'));
  rootManifest.eligibility = {
    ready: eligibility.ready,
    reasons: eligibility.reasons,
  };
  fs.writeFileSync(written.manifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`);
}

let published = null;
if (publish) {
  const blocked = statusBlockReason(status) || (eligibility.ready ? null : 'not-customer-ready');
  if (blocked) {
    published = {
      ok: false,
      published: false,
      skipped: true,
      step: 'eligibility',
      error: `Not publishing to customer Storage (${blocked}).`,
      current: null,
    };
    process.stderr.write(`${published.error}\n`);
  } else {
    published = await publishCoordinatedArAssets({
      artwork: {
        id: artworkId,
        status,
        width,
        height,
        depth,
        dimensionUnit: unit,
      },
      generated: result,
      publishStorage: storage,
      lockStorage,
    });
    if (!published.ok) {
      process.stderr.write(`Publication failed at ${published.step}: ${published.error}\n`);
    }
  }
}

const summary = {
  artworkId,
  physicalLabel: result.physicalLabel,
  widthM: result.physical.widthM,
  heightM: result.physical.heightM,
  aspectDeltaPct: result.aspect.deltaPct,
  aspectMatches: result.aspect.matches,
  generated: result.generated,
  reusedRemote,
  assetsValid: result.assetsValid,
  arReady: eligibility.ready,
  reasons: eligibility.reasons,
  measuredGlb: result.plane || null,
  glbBytes: result.files?.glb?.length || null,
  usdzBytes: result.files?.usdz?.length || null,
  textureBytes: result.files?.texture?.length || null,
  contentHash: result.manifest.contentHash,
  current: published?.current || current.current,
  outDir: written?.outDir || null,
  published,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (publish && published && !published.ok && !published.skipped) {
  process.exit(1);
}
process.exit(eligibility.ready ? 0 : 2);
