/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["web-ifc", "@thatopen/components", "@thatopen/fragments"],
  swcMinify: true,
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // Handle .mjs files from @thatopen packages as proper ES modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        /^web-ifc/,
        /^@thatopen/,
        /^three/,
        /^camera-controls/,
      ];
    }

    return config;
  },
};

export default nextConfig;
