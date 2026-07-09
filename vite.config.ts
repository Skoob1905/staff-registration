import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import pkg from "./package.json";

const ALGOLIA_INDEX_PREFIX = process.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const APP_VERSION =
  ALGOLIA_INDEX_PREFIX === "dev_"
    ? `${pkg.version}-preview`
    : pkg.version;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ["node_modules", ".opencode", "functions"],
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
