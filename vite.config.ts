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
    // Eleva limite só pra silenciar warnings desnecessários — chunks abaixo são intencionalmente quebrados
    chunkSizeWarningLimit: 1000,
    // Source maps off em produção pra reduzir payload
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Code-splitting manual para garantir que vendors pesados não entrem no chunk principal
        // e fiquem em cache do browser entre versões da app.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // Three.js e React Three Fiber → chunk próprio, só carrega em páginas 3D
          if (
            id.includes("three") ||
            id.includes("@react-three") ||
            id.includes("react-three")
          ) {
            return "three";
          }

          // Editores ricos / PDF / canvas — pesadões usados em poucas telas
          if (
            id.includes("html2canvas") ||
            id.includes("jspdf") ||
            id.includes("pdfjs-dist") ||
            id.includes("docx") ||
            id.includes("xlsx") ||
            id.includes("exceljs")
          ) {
            return "documents";
          }

          // Charts — recharts é pesado, isolar
          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }

          // Editor de slides / outros
          if (id.includes("dnd-kit") || id.includes("react-beautiful-dnd")) {
            return "dnd";
          }

          // Radix UI — usado em muitos lugares mas se beneficia de cache compartilhado
          if (id.includes("@radix-ui")) {
            return "radix";
          }

          // Supabase
          if (id.includes("@supabase")) {
            return "supabase";
          }

          // React core (mantém no chunk principal pra evitar waterfall)
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }

          // Tudo o resto do node_modules vai pro vendor genérico
          return "vendor";
        },
      },
    },
  },
}));
