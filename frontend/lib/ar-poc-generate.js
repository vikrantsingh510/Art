/**
 * Isolated AR POC asset builders. Not used by production ArViewer.
 * GLB and USDZ are generated in-process with no extra packages.
 */

export function padTo(buffer, size, fill = 0) {
  const extra = (size - (buffer.length % size)) % size;
  if (extra === 0) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(extra, fill)]);
}

export function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }
    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + size;
  }
  return null;
}

export function planeSizeMetres({
  width,
  height,
  unit,
  pixelWidth,
  pixelHeight,
}) {
  const UNIT_TO_METRES = { mm: 0.001, cm: 0.01, in: 0.0254 };
  const amountW = Number(width);
  const amountH = Number(height);
  const metres = UNIT_TO_METRES[unit];
  if (!metres || !(amountW > 0) || !(amountH > 0)) {
    throw new Error('Explicit positive width, height and unit are required.');
  }

  const catalogueWidthM = amountW * metres;
  const catalogueHeightM = amountH * metres;
  const physicalAspect = catalogueWidthM / catalogueHeightM;
  const imageAspect = pixelWidth / pixelHeight;
  const deltaPct = Math.abs(physicalAspect - imageAspect) / physicalAspect * 100;

  // Phase 1 POC only: unstretched plane from image aspect. Production Phase 2
  // uses admin width × height exactly and refuses ready assets on mismatch
  // (see lib/ar-assets). Do not use this helper for AR-ready meshes.
  const heightM = catalogueHeightM;
  const widthM = heightM * imageAspect;

  return {
    widthM,
    heightM,
    depthM: 0.008,
    catalogueWidthM,
    catalogueHeightM,
    physicalAspect,
    imageAspect,
    deltaPct,
    stretched: false,
  };
}

/**
 * Vertex order is bottom-left, bottom-right, top-right, top-left.
 * glTF UV origin is the upper-left of the image, so v=0 is the top of the
 * painting. USD st origin is the lower-left, so the arrays differ.
 * Using OpenGL-style UVs in the GLB hung the painting upside-down in WebXR.
 */
export function paintingTexcoords(spec) {
  if (spec === 'usd') {
    return new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]);
  }
  return new Float32Array([
    0, 1,
    1, 1,
    1, 0,
    0, 0,
  ]);
}

function buildPlaneGeometry(widthM, heightM) {
  const hw = widthM / 2;
  const hh = heightM / 2;
  const positions = new Float32Array([
    -hw, -hh, 0,
    hw, -hh, 0,
    hw, hh, 0,
    -hw, hh, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const uvs = paintingTexcoords('gltf');
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { positions, normals, uvs, indices };
}

export function buildGlb({ imageBuffer, mimeType = 'image/jpeg', widthM, heightM }) {
  const { positions, normals, uvs, indices } = buildPlaneGeometry(widthM, heightM);
  const positionBytes = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normalBytes = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
  const uvBytes = Buffer.from(uvs.buffer, uvs.byteOffset, uvs.byteLength);
  const indexBytes = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);

  const chunks = [];
  function pushAligned(bytes) {
    const start = chunks.reduce((sum, part) => sum + part.length, 0);
    const pad = (4 - (start % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
    }
    const offset = chunks.reduce((sum, part) => sum + part.length, 0);
    chunks.push(bytes);
    return { byteOffset: offset, byteLength: bytes.length };
  }

  const positionView = pushAligned(positionBytes);
  const normalView = pushAligned(normalBytes);
  const uvView = pushAligned(uvBytes);
  const indexView = pushAligned(indexBytes);
  const imageView = pushAligned(imageBuffer);
  const bin = padTo(Buffer.concat(chunks), 4, 0);

  const json = {
    asset: { version: '2.0', generator: 'art-ar-poc' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Painting' }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: positionView.byteOffset, byteLength: positionView.byteLength, target: 34962 },
      { buffer: 0, byteOffset: normalView.byteOffset, byteLength: normalView.byteLength, target: 34962 },
      { buffer: 0, byteOffset: uvView.byteOffset, byteLength: uvView.byteLength, target: 34962 },
      { buffer: 0, byteOffset: indexView.byteOffset, byteLength: indexView.byteLength, target: 34963 },
      { buffer: 0, byteOffset: imageView.byteOffset, byteLength: imageView.byteLength },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [-widthM / 2, -heightM / 2, 0],
        max: [widthM / 2, heightM / 2, 0],
      },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    images: [{ mimeType, bufferView: 4 }],
    textures: [{ source: 0 }],
    materials: [{
      name: 'Artwork',
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
      doubleSided: true,
    }],
  };

  const jsonChunk = padTo(Buffer.from(JSON.stringify(json), 'utf8'), 4, 0x20);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4);
  const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      const lsb = crc & 1;
      crc >>>= 1;
      if (lsb) {
        crc ^= 0xedb88320;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function formatUsdVec2Array(coords) {
  const pairs = [];
  for (let index = 0; index < coords.length; index += 2) {
    pairs.push(`(${coords[index]}, ${coords[index + 1]})`);
  }
  return pairs.join(', ');
}

export function buildUsdz({ imageBuffer, imageName = 'texture.jpg', widthM, heightM }) {
  const hw = widthM / 2;
  const hh = heightM / 2;
  const usdSt = formatUsdVec2Array(paintingTexcoords('usd'));
  const usda = `#usda 1.0
(
    defaultPrim = "Artwork"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Artwork" (
    kind = "component"
)
{
    def Mesh "Canvas" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        uniform bool doubleSided = 1
        float3[] extent = [(${-hw}, ${-hh}, -0.004), (${hw}, ${hh}, 0.004)]
        int[] faceVertexCounts = [4]
        int[] faceVertexIndices = [0, 1, 2, 3]
        rel material:binding = </Artwork/Material>
        normal3f[] normals = [(0, 0, 1), (0, 0, 1), (0, 0, 1), (0, 0, 1)] (
            interpolation = "vertex"
        )
        point3f[] points = [(${-hw}, ${-hh}, 0), (${hw}, ${-hh}, 0), (${hw}, ${hh}, 0), (${-hw}, ${hh}, 0)]
        texCoord2f[] primvars:st = [${usdSt}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
    }

    def Material "Material"
    {
        token outputs:surface.connect = </Artwork/Material/Preview.outputs:surface>
        def Shader "Preview"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor.connect = </Artwork/Material/Texture.outputs:rgb>
            float inputs:metallic = 0
            float inputs:roughness = 0.8
            token outputs:surface
        }
        def Shader "Texture"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @${imageName}@
            float2 inputs:st.connect = </Artwork/Material/UvReader.outputs:result>
            token inputs:wrapS = "clamp"
            token inputs:wrapT = "clamp"
            float3 outputs:rgb
        }
        def Shader "UvReader"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 outputs:result
        }
    }
}
`;

  const files = [
    { name: 'model.usda', data: Buffer.from(usda, 'utf8') },
    { name: imageName, data: imageBuffer },
  ];
  return zipStoreAligned(files, 64);
}

function zipStoreAligned(files, alignment) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  files.forEach((file) => {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const headerWithoutExtra = 30 + name.length;
    const dataStartUnpadded = offset + headerWithoutExtra;
    const extraNeed = (alignment - (dataStartUnpadded % alignment)) % alignment;
    const extra = Buffer.alloc(extraNeed);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    locals.push(Buffer.concat([local, name, extra, data]));
    centrals.push(Buffer.concat([central, name, extra]));
    offset += 30 + name.length + extra.length + data.length;
  });

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralDir, end]);
}

export function validateGlb(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('GLB magic is missing.');
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error('GLB version must be 2.');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error('GLB length does not match file size.');
  }
  return true;
}

export function validateUsdz(buffer) {
  if (buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('USDZ is not a ZIP archive.');
  }
  return true;
}
