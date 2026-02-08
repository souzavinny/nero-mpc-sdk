import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    chains: "src/chains/index.ts",
    modal: "src/modal/index.ts",
    "no-modal": "src/no-modal/index.ts",
    aa: "src/aa/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ["@noble/curves", "@noble/hashes", "react", "ethers"],
  platform: "browser",
  target: "es2020",
});
