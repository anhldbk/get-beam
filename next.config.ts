import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },
  output: "export",
  distDir: "build",
  eslint: {
    ignoreDuringBuilds: true, // Ignores the linting step
  },
  typescript: {
    ignoreBuildErrors: true, // Ignores the type-checking step
  },
  // basePath: "/whisper",
  // assetPrefix: "https://llamaxist.github.io/whisper/",

  // compiler: {
  //   removeConsole: true,
  // },
};

export default nextConfig;
