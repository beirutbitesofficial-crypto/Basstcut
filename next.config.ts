import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export: `npm run build` writes plain HTML/CSS/JS to `out/`,
  // ready to upload to Hostinger (or any static host). No Node server needed.
  output: "export",
  trailingSlash: true,
  images: {
    // Static hosting has no image optimizer; images are served as-is.
    unoptimized: true,
  },
};

export default nextConfig;
