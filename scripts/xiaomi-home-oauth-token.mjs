#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 8123;
const HOME_ASSISTANT_ORIGIN = "http://homeassistant.local:8123";
const HOME_ASSISTANT_CLIENT_ID = "2882303761520251711";
const SUPPORTED_SERVERS = new Set(["cn", "de", "i2", "ru", "sg", "us"]);
const HTTP_TIMEOUT_MS = 30_000;

function usage() {
    console.log(
        "用法: pnpm xiaomi-home:oauth-token -- <authorization-url> <cloud-server> [--no-open]",
    );
}

function parseArguments() {
    const values = process.argv.slice(2);
    const noOpen = values.includes("--no-open");
    const positional = values.filter((value) => value !== "--no-open" && value !== "--");
    if (positional.length !== 2) {
        usage();
        process.exit(1);
    }

    const authorizationUrl = new URL(positional[0]);
    const cloudServer = positional[1];
    const redirectUri = authorizationUrl.searchParams.get("redirect_uri") || "";
    const oauthRedirect = new URL(redirectUri);
    const clientId = authorizationUrl.searchParams.get("client_id") || "";
    const deviceId = authorizationUrl.searchParams.get("device_id") || "";
    const state = authorizationUrl.searchParams.get("state") || "";

    if (
        authorizationUrl.protocol !== "https:" ||
        authorizationUrl.hostname !== "account.xiaomi.com" ||
        authorizationUrl.pathname !== "/oauth2/authorize"
    ) {
        throw new Error("授权地址不是受支持的小米 OAuth 地址");
    }
    if (!SUPPORTED_SERVERS.has(cloudServer)) {
        throw new Error("小米云区域无效，可选值为 cn、de、i2、ru、sg、us");
    }
    if (
        oauthRedirect.origin !== HOME_ASSISTANT_ORIGIN ||
        !/^\/api\/webhook\/[A-Za-z0-9_-]+$/.test(oauthRedirect.pathname) ||
        oauthRedirect.search ||
        oauthRedirect.hash
    ) {
        throw new Error(`授权回调必须是 ${HOME_ASSISTANT_ORIGIN}/api/webhook/...`);
    }
    if (
        clientId !== HOME_ASSISTANT_CLIENT_ID ||
        authorizationUrl.searchParams.get("response_type") !== "code" ||
        !/^ha\.[A-Za-z0-9_-]+$/.test(deviceId) ||
        !/^[A-Za-z0-9_-]{32,160}$/.test(state)
    ) {
        throw new Error("小米 OAuth 授权参数无效");
    }

    return {
        authorizationUrl,
        cloudServer,
        oauthRedirect,
        clientId,
        deviceId,
        redirectUri,
        state,
        noOpen,
    };
}

function getApiHost(cloudServer) {
    return cloudServer === "cn" ? "ha.api.io.mi.com" : `${cloudServer}.ha.api.io.mi.com`;
}

function findBrowser() {
    const configured = process.env.XIAOMI_HOME_TEST_BROWSER;
    if (configured) {
        if (!existsSync(configured)) throw new Error("XIAOMI_HOME_TEST_BROWSER 指向的文件不存在");
        return configured;
    }

    if (process.platform === "darwin") {
        const candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ];
        const browser = candidates.find(existsSync);
        if (browser) return browser;
    }

    for (const command of ["google-chrome", "microsoft-edge", "chromium", "chromium-browser"]) {
        const result = spawnSync("which", [command], { encoding: "utf8" });
        if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
    }
    throw new Error("未找到 Chrome、Edge 或 Chromium，可通过 XIAOMI_HOME_TEST_BROWSER 指定路径");
}

function escapeHtml(value) {
    return String(value).replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character],
    );
}

function page(title, body, accent = "#0f766e") {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f3f5f4; color: #17201f; }
    main { width: min(720px, 100%); padding: 28px; border: 1px solid #d8dfdd; border-radius: 8px; background: #fff; box-shadow: 0 18px 48px rgba(23, 32, 31, .10); }
    .mark { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 18px; border-radius: 8px; background: ${accent}; color: #fff; font-weight: 700; }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    p { margin: 10px 0 18px; color: #65716f; font-size: 14px; line-height: 1.65; }
    textarea { width: 100%; min-height: 310px; resize: vertical; padding: 14px; border: 1px solid #cbd4d2; border-radius: 8px; background: #f8faf9; color: #17201f; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; margin-top: 12px; padding: 0 16px; border: 0; border-radius: 8px; background: #17201f; color: #fff; font: inherit; cursor: pointer; }
    .note { margin-bottom: 0; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <div class="mark">${accent === "#0f766e" ? "OK" : "!"}</div>
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </main>
</body>
</html>`;
}

function credentialsPage(credentials) {
    const serialized = JSON.stringify(credentials, null, 2);
    return page(
        "小米凭据已生成",
        `<p>复制下面的完整 JSON，回到 BuildingAI 的“本地脚本登录”窗口粘贴并导入。不要把它发送给其他人。</p>
         <textarea id="credentials" readonly spellcheck="false">${escapeHtml(serialized)}</textarea>
         <button id="copy" type="button">复制凭据</button>
         <p class="note">导入成功后可关闭此窗口，并在终端按 Ctrl+C 停止本地服务。</p>
         <script>
           history.replaceState(null, "", "/xiaomi-home/credentials");
           document.getElementById("copy").addEventListener("click", async () => {
             const field = document.getElementById("credentials");
             try {
               await navigator.clipboard.writeText(field.value);
             } catch {
               field.select();
               document.execCommand("copy");
             }
             document.getElementById("copy").textContent = "已复制";
           });
         </script>`,
    );
}

function errorPage(message) {
    return page(
        "小米授权未完成",
        `<p>${escapeHtml(message)}</p><p class="note">请关闭此窗口，重新从 BuildingAI 生成授权命令。</p>`,
        "#b42318",
    );
}

async function exchangeCode({ cloudServer, clientId, redirectUri, code, deviceId }) {
    const endpoint = new URL(`https://${getApiHost(cloudServer)}/app/v2/ha/oauth/get_token`);
    endpoint.searchParams.set(
        "data",
        JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            code,
            device_id: deviceId,
        }),
    );

    let response;
    try {
        response = await fetch(endpoint, {
            headers: { "content-type": "application/x-www-form-urlencoded" },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
    } catch (error) {
        throw new Error(
            `连接小米 OAuth 服务失败：${error instanceof Error ? error.message : error}`,
        );
    }
    const text = await response.text();
    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error("小米 OAuth 服务返回了无效响应");
    }
    if (!response.ok || payload?.code !== 0 || !payload.result) {
        throw new Error(`小米 OAuth 授权失败：${payload?.message || response.statusText}`);
    }
    const accessToken = payload.result.access_token;
    const refreshToken = payload.result.refresh_token;
    const expiresIn = Number(payload.result.expires_in);
    if (
        typeof accessToken !== "string" ||
        accessToken.length < 20 ||
        typeof refreshToken !== "string" ||
        refreshToken.length < 20 ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
    ) {
        throw new Error("小米 OAuth 服务返回了无效 token");
    }
    return { accessToken, refreshToken, expiresIn };
}

const options = parseArguments();
let browserProcess;
let profileDir;
let closing = false;
let completed = false;

const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    );
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");

    const host = String(request.headers.host || "").toLowerCase();
    if (!new Set(["homeassistant.local:8123", "127.0.0.1:8123", "localhost:8123"]).has(host)) {
        response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" }).end("无效主机");
        return;
    }
    if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end();
        return;
    }

    const incoming = new URL(request.url || "/", HOME_ASSISTANT_ORIGIN);
    if (incoming.pathname !== options.oauthRedirect.pathname) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("OAuth 回调路径不存在");
        return;
    }
    if (completed) {
        response.writeHead(409, { "Content-Type": "text/html; charset=utf-8" });
        response.end(errorPage("这次授权已经生成过凭据，请使用页面中现有的凭据。"));
        return;
    }

    const state = incoming.searchParams.get("state");
    const code = incoming.searchParams.get("code");
    const oauthError = incoming.searchParams.get("error");
    if (state !== options.state) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(errorPage("OAuth state 校验失败，已拒绝本次回调。"));
        return;
    }
    if (oauthError || !code) {
        const description = incoming.searchParams.get("error_description");
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end(errorPage(description || oauthError || "小米账号没有返回授权码。"));
        return;
    }

    try {
        const token = await exchangeCode({
            cloudServer: options.cloudServer,
            clientId: options.clientId,
            redirectUri: options.redirectUri,
            code,
            deviceId: options.deviceId,
        });
        const credentials = {
            provider: "xiaomi_home",
            version: 1,
            cloudServer: options.cloudServer,
            clientId: options.clientId,
            deviceId: options.deviceId,
            redirectUri: options.redirectUri,
            state: options.state,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
        };
        completed = true;
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(credentialsPage(credentials));
        console.log("小米凭据已在本地页面生成，请复制后导入 BuildingAI。终端不会输出 token。");
    } catch (error) {
        response.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
        response.end(errorPage(error instanceof Error ? error.message : String(error)));
        console.error(error instanceof Error ? error.message : String(error));
    }
});

async function closeHelper(exitCode = 0) {
    if (closing) return;
    closing = true;
    if (browserProcess && !browserProcess.killed) browserProcess.kill("SIGTERM");
    await new Promise((resolve) => server.close(resolve));
    if (profileDir?.startsWith(join(tmpdir(), "buildingai-xiaomi-oauth-"))) {
        try {
            rmSync(profileDir, { recursive: true, force: true });
        } catch {
            // The browser may still be releasing its temporary profile on Windows.
        }
    }
    process.exit(exitCode);
}

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`本地端口 ${LOCAL_PORT} 已被占用，请先停止占用该端口的服务。`);
    } else {
        console.error(error);
    }
    process.exit(1);
});

server.listen(LOCAL_PORT, LOCAL_HOST, async () => {
    console.log(`本地 Home Assistant 模拟服务已启动：http://${LOCAL_HOST}:${LOCAL_PORT}`);
    if (options.noOpen) return;

    try {
        profileDir = await mkdtemp(join(tmpdir(), "buildingai-xiaomi-oauth-"));
        browserProcess = spawn(
            findBrowser(),
            [
                `--user-data-dir=${profileDir}`,
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-features=HttpsUpgrades",
                "--host-resolver-rules=MAP homeassistant.local 127.0.0.1",
                options.authorizationUrl.toString(),
            ],
            { stdio: "ignore" },
        );
        browserProcess.once("error", (error) => {
            console.error(`无法启动浏览器：${error.message}`);
            void closeHelper(1);
        });
        console.log("已打开隔离浏览器，请在其中完成小米账号登录。完成导入后按 Ctrl+C 退出。");
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        void closeHelper(1);
    }
});

process.once("SIGINT", () => void closeHelper(130));
process.once("SIGTERM", () => void closeHelper(143));
