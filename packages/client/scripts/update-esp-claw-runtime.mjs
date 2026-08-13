import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, "..");
const sourceDir = path.resolve(
  process.env.SIMULATOR_RUNTIME_SOURCE || path.join(clientDir, "..", "..", "esp-claw", "build", "lua_lvgl_web_sim"),
);
const targetDir = path.join(clientDir, "public", "esp-claw-runtime");
const files = ["esp_claw_sim.html", "esp_claw_sim.js", "esp_claw_sim.wasm", "esp_claw_sim.data"];

fs.mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const source = path.join(sourceDir, file);
  if (!fs.existsSync(source)) throw new Error(`missing runtime artifact: ${source}`);
  fs.copyFileSync(source, path.join(targetDir, file));
  console.log(`copied ${file}`);
}
