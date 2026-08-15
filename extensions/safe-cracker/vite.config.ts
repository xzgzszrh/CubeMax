import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json";

/**
 * 不设 `server.open` —— 开发时宿主 iframe 加载的是 `.output/public` 里的
 * 构建产物（由 `.env` 的 VITE_DEVELOP_APP_BASE_URL 指向 API 端口），
 * 扩展自己的 vite dev server 没有任何人访问。开着它只会额外弹一个
 * 5173 窗口，让人误以为那才是应用入口。
 *
 * 因此 `dev:web` 用的是 `vite build --watch` 而不是 `vite`。
 */
export default defineExtensionViteConfig(packageJson);
