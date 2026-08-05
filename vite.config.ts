import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/zero-city-escape/" : "/",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: true,
  },
}));
