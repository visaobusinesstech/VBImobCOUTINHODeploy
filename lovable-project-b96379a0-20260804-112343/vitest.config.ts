import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text-summary", "json", "json-summary", "lcov"],
      // Foco no gerador de PDF de avaliação premium (módulo coberto por esta suíte).
      include: ["src/lib/exportAvaliacaoPremiumPDF.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
      thresholds: {
        lines: 85,
        functions: 80,
        statements: 85,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
