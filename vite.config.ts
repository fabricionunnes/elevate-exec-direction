import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],
  },
  optimizeDeps: {
    // Pré-bundla apenas o essencial para o cold start.
    // Three.js é pesado (>500KB) e só é usado nas páginas 3D — não pode entrar aqui.
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
    // Garante que three e relacionados nunca sejam puxados no boot
    exclude: ["three", "@react-three/fiber", "@react-three/drei"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // IMPORTANT: NÃO separar React em chunks manuais — isso causa
        // "Cannot read properties of null (reading 'useState')" quando
        // react/jsx-runtime carrega antes de react. Deixe o Rollup decidir
        // o splitting padrão por route (lazy-loaded pages).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // Apenas isolamos libs MUITO pesadas que são usadas em poucas telas
          // (e não dependem do React de maneira a causar reordenação)
          if (
            id.includes("/three/") ||
            id.includes("@react-three")
          ) {
            return "three";
          }

          if (
            id.includes("html2canvas") ||
            id.includes("jspdf") ||
            id.includes("pdfjs-dist") ||
            id.includes("/docx/") ||
            id.includes("/xlsx/") ||
            id.includes("exceljs")
          ) {
            return "documents";
          }

          return undefined;
        },
      },
    },
  },
}));
