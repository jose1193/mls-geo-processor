import type { NextConfig } from "next";

// Para desarrollo - más permisiva
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data: blob:; font-src 'self'; connect-src 'self' https://api.mapbox.com https://generativelanguage.googleapis.com https://api.geocod.io *;"
              : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https: data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; connect-src 'self' https://api.mapbox.com https://generativelanguage.googleapis.com https://api.geocod.io https:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
