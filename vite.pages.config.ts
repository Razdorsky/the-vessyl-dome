import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const PUBLIC_BASE = "/the-vessyl-dome/";
const PROJECT_ROOT = fileURLToPath(new URL(".", import.meta.url));

function rebasePublicAssets(): Plugin {
  const rootAsset =
    /(["'])\/(fonts\/|media\/|favicon\.svg|footer-mark\.svg|og\.png|vessyl-logo\.svg|vessyl-mark\.svg)/g;

  return {
    name: "rebase-public-assets-for-github-pages",
    enforce: "pre",
    transform(source, id) {
      if (!id.startsWith(PROJECT_ROOT)) return null;

      const code = source.replace(
        rootAsset,
        (_match, quote: string, assetPath: string) =>
          `${quote}${PUBLIC_BASE}${assetPath}`,
      );

      return code === source ? null : { code, map: null };
    },
  };
}

export default defineConfig({
  root: "github-pages",
  base: PUBLIC_BASE,
  publicDir: "../public",
  plugins: [rebasePublicAssets(), react()],
  resolve: {
    alias: {
      "next/dynamic": fileURLToPath(
        new URL("./github-pages/shims/next-dynamic.tsx", import.meta.url),
      ),
      "next/image": fileURLToPath(
        new URL("./github-pages/shims/next-image.tsx", import.meta.url),
      ),
    },
  },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
    sourcemap: false,
  },
});
