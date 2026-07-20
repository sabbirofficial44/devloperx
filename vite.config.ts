// Veu Unlimited — Vite Config
// Uses @lovable.dev/vite-tanstack-config for TanStack Start + all plugins
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
