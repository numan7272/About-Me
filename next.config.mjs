/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Help Next properly bundle ESM-only packages used by R3F + Rapier.
  transpilePackages: ["three"],
};

export default nextConfig;
