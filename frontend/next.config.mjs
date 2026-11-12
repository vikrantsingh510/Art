/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com', 'trycloudflare.com'],
  transpilePackages: ['@google/model-viewer', 'lit', '@monogrid/gainmap-js'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/dev/ar-poc/:file*.glb',
        headers: [
          { key: 'Content-Type', value: 'model/gltf-binary' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/dev/ar-poc/:file*.usdz',
        headers: [
          { key: 'Content-Type', value: 'model/vnd.usdz+zip' },
          { key: 'Content-Disposition', value: 'inline; filename="painting.usdz"' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/ar-assets/:artworkId/:file*.glb',
        headers: [
          { key: 'Content-Type', value: 'model/gltf-binary' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/ar-assets/:artworkId/:hash/:file*.glb',
        headers: [
          { key: 'Content-Type', value: 'model/gltf-binary' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/ar-assets/:artworkId/:file*.usdz',
        headers: [
          { key: 'Content-Type', value: 'model/vnd.usdz+zip' },
          { key: 'Content-Disposition', value: 'inline; filename="painting.usdz"' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/ar-assets/:artworkId/:hash/:file*.usdz',
        headers: [
          { key: 'Content-Type', value: 'model/vnd.usdz+zip' },
          { key: 'Content-Disposition', value: 'inline; filename="painting.usdz"' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
