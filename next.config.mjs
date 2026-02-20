/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"]
};

export default nextConfig;
