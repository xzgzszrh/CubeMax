import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { Public } from "@buildingai/decorators/public.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import {
    ImportXiaomiHomeCredentialsDto,
    QueryXiaomiHomeDevicesDto,
    StartXiaomiHomeOAuthDto,
    UpdateXiaomiHomeAccountDto,
    XiaomiHomeActionCommandDto,
    XiaomiHomePropertyCommandDto,
} from "./xiaomi-home.dto";
import { XiaomiHomeService } from "./xiaomi-home.service";
import type { XiaomiHomeOAuthQuery } from "./xiaomi-home.types";

const CALLBACK_MESSAGE_TYPE = "buildingai:xiaomi-home-oauth";

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character] || character,
    );
}

function escapeScriptJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

function requestOrigin(request: Request): string {
    const forwardedProto = String(request.headers["x-forwarded-proto"] || "")
        .split(",")[0]
        .trim();
    const forwardedHost = String(request.headers["x-forwarded-host"] || "")
        .split(",")[0]
        .trim();
    const protocol = forwardedProto || request.protocol || "http";
    const host = forwardedHost || request.get("host") || "127.0.0.1:4090";
    return `${protocol}://${host}`;
}

function callbackHtml(result: {
    success: boolean;
    accountId?: string;
    message: string;
    frontendOrigin: string;
}): string {
    const payload = escapeScriptJson({
        type: CALLBACK_MESSAGE_TYPE,
        success: result.success,
        accountId: result.accountId,
        message: result.message,
    });
    const targetOrigin = escapeScriptJson(result.frontendOrigin);
    const title = result.success ? "小米账号已连接" : "小米账号连接失败";
    const description = result.success
        ? "授权已完成，可以关闭此窗口返回智能家居。"
        : "授权没有完成，请关闭窗口后重试。";
    const accent = result.success ? "#0f766e" : "#b42318";
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f6f6; color: #172121; }
    main { width: min(420px, calc(100% - 32px)); box-sizing: border-box; padding: 32px; border: 1px solid #d9e0df; border-radius: 18px; background: white; text-align: center; box-shadow: 0 18px 50px rgba(24, 44, 43, .10); }
    .mark { width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 16px; display: grid; place-items: center; background: ${accent}; color: white; font-size: 27px; font-weight: 700; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
    p { margin: 10px 0 22px; color: #667372; font-size: 14px; line-height: 1.6; }
    button { border: 0; border-radius: 9px; padding: 10px 18px; background: #172121; color: white; font: inherit; cursor: pointer; }
  </style>
  <script>
    (() => {
      const payload = ${payload};
      const targetOrigin = ${targetOrigin};
      try {
        if (window.opener && !window.opener.closed) window.opener.postMessage(payload, targetOrigin);
      } finally {
        window.setTimeout(() => window.close(), 180);
      }
    })();
  </script>
</head>
<body>
  <main>
    <div class="mark">${result.success ? "✓" : "!"}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}<br />${escapeHtml(result.message)}</p>
    <button type="button" onclick="window.close()">关闭窗口</button>
  </main>
</body>
</html>`;
}

@WebController("smart-home")
export class XiaomiHomeController {
    constructor(private readonly xiaomiHomeService: XiaomiHomeService) {}

    @Get("xiaomi/accounts")
    listAccounts(@Playground() user: UserPlayground) {
        return this.xiaomiHomeService.listAccounts(user.id);
    }

    @Post("xiaomi/oauth/start")
    startOAuth(
        @Playground() user: UserPlayground,
        @Body() dto: StartXiaomiHomeOAuthDto,
        @Req() request: Request,
        @Headers("origin") origin?: string,
    ) {
        return this.xiaomiHomeService.startOAuth({
            userId: user.id,
            cloudServer: dto.cloudServer || "cn",
            mode: dto.mode || "direct",
            apiOrigin: requestOrigin(request),
            frontendOrigin: origin,
        });
    }

    @Public()
    @Get("xiaomi/oauth/callback")
    async oauthCallback(@Query() query: XiaomiHomeOAuthQuery, @Res() response: Response) {
        const result = await this.xiaomiHomeService.completeOAuth(query);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Frame-Options", "DENY");
        response.type("html").send(callbackHtml(result));
    }

    @Post("xiaomi/import")
    importCredentials(
        @Playground() user: UserPlayground,
        @Body() dto: ImportXiaomiHomeCredentialsDto,
    ) {
        return this.xiaomiHomeService.importCredentials(user.id, dto.credentials);
    }

    @Post("xiaomi/accounts/:accountId/sync")
    syncAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        return this.xiaomiHomeService.syncAccount(user.id, accountId);
    }

    @Patch("xiaomi/accounts/:accountId")
    updateAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Body() dto: UpdateXiaomiHomeAccountDto,
    ) {
        return this.xiaomiHomeService.updateAccountLabel(user.id, accountId, dto.label);
    }

    @Delete("xiaomi/accounts/:accountId")
    async removeAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        await this.xiaomiHomeService.removeAccount(user.id, accountId);
    }

    @Get("xiaomi/accounts/:accountId/devices")
    listDevices(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Query() filters: QueryXiaomiHomeDevicesDto,
    ) {
        return this.xiaomiHomeService.listDevices(user.id, accountId, filters);
    }

    @Get("xiaomi/devices/:deviceId")
    getDevice(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
    ) {
        return this.xiaomiHomeService.getDevice(user.id, deviceId);
    }

    @Post("xiaomi/devices/:deviceId/refresh")
    refreshDevice(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
    ) {
        return this.xiaomiHomeService.refreshDevice(user.id, deviceId);
    }

    @Post("xiaomi/devices/:deviceId/properties")
    setProperty(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
        @Body() command: XiaomiHomePropertyCommandDto,
    ) {
        return this.xiaomiHomeService.setProperty(user.id, deviceId, command);
    }

    @Post("xiaomi/devices/:deviceId/actions")
    executeAction(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
        @Body() command: XiaomiHomeActionCommandDto,
    ) {
        return this.xiaomiHomeService.executeAction(user.id, deviceId, command);
    }
}
