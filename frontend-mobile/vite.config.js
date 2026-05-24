import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3005,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://backend:8000", changeOrigin: true },
    },
  },
});
