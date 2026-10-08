import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf bringt seinen eigenen PDF.js-Build mit und soll nicht gebündelt werden.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
