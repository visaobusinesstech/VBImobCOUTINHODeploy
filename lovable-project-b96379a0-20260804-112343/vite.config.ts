import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split large vendor libs into their own chunks so they don't bloat the initial bundle.
    // Route-level pages already use React.lazy — this keeps heavy libs out of the entry chunk.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "vendor-pdf";
          if (id.includes("xlsx")) return "vendor-xlsx";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@dnd-kit")) return "vendor-dnd";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("lucide-react")) return "vendor-icons";
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
}));
