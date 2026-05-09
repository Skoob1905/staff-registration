import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "localhost",
    port: 5000,
    https: {
      key: fs.readFileSync("certs/handysign.local-key.pem"),
      cert: fs.readFileSync("certs/handysign.local-cert.pem"),
    },
  },
});
