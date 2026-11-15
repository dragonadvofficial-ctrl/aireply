import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",          // small Docker image for the VPS
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  // public tunnels for local testing with Meta (Cloudflare quick tunnel / ngrok)
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app"],
  experimental: { serverActions: { allowedOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app", "localhost:3000"] } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**.fbcdn.net" }, { protocol: "https", hostname: "**.cdninstagram.com" }] },
};
export default config;
