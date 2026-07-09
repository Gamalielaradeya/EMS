import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["chart.js", "react-chartjs-2"],
          maps: ["leaflet"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
