import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import path from "path";
// import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

const flowgramDedupe = [
  "@flowgram.ai/background-plugin",
  "@flowgram.ai/command",
  "@flowgram.ai/core",
  "@flowgram.ai/document",
  "@flowgram.ai/editor",
  "@flowgram.ai/export-plugin",
  "@flowgram.ai/form",
  "@flowgram.ai/form-core",
  "@flowgram.ai/form-materials",
  "@flowgram.ai/free-auto-layout-plugin",
  "@flowgram.ai/free-container-plugin",
  "@flowgram.ai/free-group-plugin",
  "@flowgram.ai/free-history-plugin",
  "@flowgram.ai/free-hover-plugin",
  "@flowgram.ai/free-layout-core",
  "@flowgram.ai/free-layout-editor",
  "@flowgram.ai/free-lines-plugin",
  "@flowgram.ai/free-node-panel-plugin",
  "@flowgram.ai/free-snap-plugin",
  "@flowgram.ai/free-stack-plugin",
  "@flowgram.ai/history",
  "@flowgram.ai/history-node-plugin",
  "@flowgram.ai/i18n",
  "@flowgram.ai/i18n-plugin",
  "@flowgram.ai/json-schema",
  "@flowgram.ai/materials-plugin",
  "@flowgram.ai/minimap-plugin",
  "@flowgram.ai/node",
  "@flowgram.ai/node-core-plugin",
  "@flowgram.ai/node-variable-plugin",
  "@flowgram.ai/panel-manager-plugin",
  "@flowgram.ai/playground-react",
  "@flowgram.ai/reactive",
  "@flowgram.ai/renderer",
  "@flowgram.ai/select-box-plugin",
  "@flowgram.ai/shortcuts-plugin",
  "@flowgram.ai/utils",
  "@flowgram.ai/variable-core",
  "@flowgram.ai/variable-layout",
  "@flowgram.ai/variable-plugin",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({
      presets: [reactCompilerPreset()],
      plugins: [
        ["@babel/plugin-proposal-decorators", { legacy: true }],
        ["@babel/plugin-transform-class-properties", { loose: true }],
      ],
    }),
    // visualizer({
    //   open: true,
    // }),
  ],
  clearScreen: false,
  resolve: {
    conditions: ["style"],
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "inversify", ...flowgramDedupe],
  },
  optimizeDeps: {
    include: [
      "@douyinfe/semi-ui",
      "@douyinfe/semi-ui > Textarea",
      "@douyinfe/semi-ui > Input",
      "@douyinfe/semi-ui > Button",
      "wasmoon",
    ],
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    host: host || "0.0.0.0",
    open: true,
    port: 4091,
    strictPort: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (warning.code === "COMMONJS_VARIABLE_IN_ESM") return;
        if (
          warning.message &&
          warning.message.includes("dynamic import will not move module into another chunk")
        )
          return;
        if (warning.message && warning.message.includes("externalized for browser compatibility"))
          return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes("lucide-react")) {
            return "lucide";
          }
        },
      },
    },
  },
  envDir: "../../",
});
