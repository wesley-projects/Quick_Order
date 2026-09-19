/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // better-sqlite3 loads a native .node file through the `bindings`
      // package, which locates it by walking up from the calling file. Bundled
      // into a webpack chunk that walk lands in the wrong package and the load
      // fails at runtime. serverComponentsExternalPackages alone does not cover
      // every entry point here, so mark it external outright.
      config.externals.push('better-sqlite3', '@prisma/adapter-better-sqlite3');
    }
    return config;
  },
};

export default nextConfig;
