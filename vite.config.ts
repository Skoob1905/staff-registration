import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import pkg from "./package.json";

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(
      mode === "production" ? pkg.version : `${pkg.version}-preview`,
    ),
  },
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ["node_modules", "functions"],
  },
  server: {
    host: "localhost",
    port: 5000,
    https: {
      key: fs.readFileSync("certs/handysign.local-key.pem"),
      cert: fs.readFileSync("certs/handysign.local-cert.pem"),
    },
  },
});
