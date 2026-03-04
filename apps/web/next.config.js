/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tasman-transport/shared'],
  typescript: {
    // @vis.gl/react-google-maps exports React 19 types incompatible with React 18
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
