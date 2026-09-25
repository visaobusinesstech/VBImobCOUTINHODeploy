#!/usr/bin/env node
/**
 * Corrige clsx (mjs) e remove tailwind.config.js conflitante com Tailwind v4.
 * Nunca deve derrubar o npm install (Vercel/CI).
 */
const fs = require("fs");
const path = require("path");

try {
  const root = path.join(__dirname, "..");

  const tailwindConfigs = [
    "tailwind.config.js",
    "tailwind.config.ts",
    "tailwind.config.cjs",
    "tailwind.config.mjs"
  ];

  for (const name of tailwindConfigs) {
    const file = path.join(root, name);
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(
          `[fix-node-modules] removido ${name} (conflita com Tailwind v4 + @tailwindcss/postcss)`
        );
      }
    } catch (err) {
      console.warn(`[fix-node-modules] não removeu ${name}:`, err && err.message);
    }
  }

  const clsxDist = path.join(root, "node_modules", "clsx", "dist");
  const clsxMjs = path.join(clsxDist, "clsx.mjs");
  const clsxMjsSource = path.join(clsxDist, "clsx.m.js");

  try {
    if (fs.existsSync(clsxMjsSource) && !fs.existsSync(clsxMjs)) {
      fs.copyFileSync(clsxMjsSource, clsxMjs);
      console.log("[fix-node-modules] criado clsx/dist/clsx.mjs a partir de clsx.m.js");
    }
  } catch (err) {
    console.warn("[fix-node-modules] clsx.mjs:", err && err.message);
  }

  console.log("[fix-node-modules] OK");
} catch (err) {
  console.warn("[fix-node-modules] aviso (ignorado):", err && err.message);
}

process.exit(0);
