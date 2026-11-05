import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["rss-parser", "nodemailer"],
};

export default nextConfig;
