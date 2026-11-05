import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["rss-parser", "nodemailer"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Hide the floating Next.js “N” dev badge on the page
  devIndicators: false,
};

export default nextConfig;
