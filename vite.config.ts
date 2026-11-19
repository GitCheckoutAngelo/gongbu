import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Cloudflare plugin runs the Worker (worker/) in the real Workers runtime alongside the app,
// so /api/* is served by the Worker in dev, preview and production.
export default defineConfig({ plugins: [react(), cloudflare()] });
