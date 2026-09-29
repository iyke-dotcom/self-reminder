import { defineConfig } from "vite";

const previewHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "media-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' http://localhost:3000",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default defineConfig({
  preview: {
    headers: previewHeaders,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js", "tests/server/**/*.test.js"],
  },
});
