import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    YeelightProAccount,
    YeelightProAccountStatus,
    YeelightProDevice,
    type YeelightProHomeSummary,
    YeelightProQrSession,
    type YeelightProRegion,
} from "@buildingai/db/entities";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpError, HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import QRCode from "qrcode";

import {
    inferYeelightLight,
    YeelightProCloudClient,
    YeelightProCloudError,
} from "./yeelight-pro.cloud";
import {
    normalizeYeelightRegion,
    YEELIGHT_PRO_QR_TTL_MS,
    YEELIGHT_PRO_REGIONS,
    YEELIGHT_PRO_TOKEN_REFRESH_MARGIN_MS,
    yeelightQrcodeContent,
    yeelightScanDeviceId,
} from "./yeelight-pro.constants";
import type {
    YeelightProAccountToken,
    YeelightProCloudDevice,
    YeelightProHouse,
    YeelightProPublicAccount,
    YeelightProPublicDevice,
} from "./yeelight-pro.types";

const WRITABLE_LIGHT_PROPERTIES = new Set(["p", "l", "ct", "c", "m", "slisaon", "bp", "dd"]);

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class YeelightProService {
    private readonly encryptionKey = createHash("sha256")
        .update(
            process.env.YEELIGHT_PRO_ENCRYPTION_KEY ||
                process.env.JWT_SECRET ||
                "BuildingAI-yeelight-pro-development-key",
        )
        .digest();

    constructor(
        @InjectRepository(YeelightProAccount)
        private readonly accountRepository: Repository<YeelightProAccount>,
        @InjectRepository(YeelightProQrSession)
        private readonly qrSessionRepository: Repository<YeelightProQrSession>,
        @InjectRepository(YeelightProDevice)
        private readonly deviceRepository: Repository<YeelightProDevice>,
    ) {}

    async listAccounts(userId: string): Promise<YeelightProPublicAccount[]> {
        const accounts = await this.accountRepository.find({
            where: { ownerUserId: userId },
            order: { createdAt: "ASC" },
        });
        const devices = accounts.length
            ? await this.deviceRepository.find({
                  where: { accountId: In(accounts.map((account) => account.id)) },
                  select: { accountId: true, online: true },
              })
            : [];
        const counts = new Map<string, { total: number; online: number }>();
        for (const device of devices) {
            const count = counts.get(device.accountId) || { total: 0, online: 0 };
            count.total += 1;
            if (device.online) count.online += 1;
            counts.set(device.accountId, count);
        }
        return accounts.map((account) => {
            const count = counts.get(account.id) || { total: 0, online: 0 };
            return this.toPublicAccount(account, count.total, count.online);
        });
    }

    async startQrLogin(userId: string, regionValue?: string) {
        let region: YeelightProRegion;
        try {
            region = normalizeYeelightRegion(regionValue);
        } catch {
            throw HttpErrorFactory.badRequest("不支持的易来云区域");
        }
        const scanDevice = yeelightScanDeviceId(userId);
        const qr = await YeelightProCloudClient.createQrCode(region, scanDevice);
        const expiresAt = new Date(
            qr.expireAtMs || Date.now() + (qr.expireInMs || YEELIGHT_PRO_QR_TTL_MS),
        );
        const session = await this.qrSessionRepository.save(
            this.qrSessionRepository.create({
                ownerUserId: userId,
                region,
                scanDevice,
                qrCodeId: qr.qrCodeId,
                qrcodeContent: yeelightQrcodeContent(qr.device, qr.qrCodeId),
                status: qr.status,
                expiresAt,
                consumedAt: null,
                accountId: null,
            }),
        );
        return {
            sessionId: session.id,
            region,
            regionLabel: YEELIGHT_PRO_REGIONS[region],
            qrcodeContent: session.qrcodeContent,
            qrcodeDataUrl: await QRCode.toDataURL(session.qrcodeContent, {
                margin: 1,
                width: 280,
                errorCorrectionLevel: "M",
            }),
            status: session.status,
            expiresAt: session.expiresAt.toISOString(),
        };
    }

    async pollQrLogin(userId: string, sessionId: string) {
        const session = await this.qrSessionRepository.findOne({
            where: { id: sessionId, ownerUserId: userId },
        });
        if (!session) throw HttpErrorFactory.notFound("扫码登录会话不存在");
        if (session.consumedAt && session.accountId) {
            const account = await this.requireAccount(userId, session.accountId);
            return this.loginResult(session, account);
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            session.status = "EXPIRED";
            await this.qrSessionRepository.save(session);
            throw HttpErrorFactory.badRequest("二维码已过期，请重新生成");
        }

        const qr = await YeelightProCloudClient.checkQrCode(session.region, session.qrCodeId);
        session.status = qr.status;
        if (qr.status !== "LOGIN" || !qr.token) {
            if (qr.status === "EXPIRED") {
                await this.qrSessionRepository.save(session);
                throw HttpErrorFactory.badRequest("二维码已过期，请重新生成");
            }
            await this.qrSessionRepository.save(session);
            return {
                sessionId: session.id,
                status: session.status,
                qrcodeContent: session.qrcodeContent,
                expiresAt: session.expiresAt.toISOString(),
                account: null,
                houses: [],
            };
        }

        const { account, houses } = await this.saveAuthenticatedAccount(userId, session, qr.token);
        session.consumedAt = new Date();
        session.accountId = account.id;
        await this.qrSessionRepository.save(session);
        return this.loginResult(session, account, houses);
    }

    async selectHouse(userId: string, accountId: string, houseId: string) {
        const account = await this.requireAccount(userId, accountId);
        const cloud = await this.cloudClient(account);
        const houses = await cloud.listHouses();
        const house = houses.find((item) => item.id === houseId);
        if (!house) throw HttpErrorFactory.badRequest("未找到该易来家庭");
        account.houseId = house.id;
        account.houseName = house.name;
        await this.accountRepository.save(account);
        return this.syncAccount(userId, account.id);
    }

    async syncAccount(userId: string, accountId: string): Promise<YeelightProPublicAccount> {
        const account = await this.requireAccount(userId, accountId);
        try {
            const cloud = await this.cloudClient(account);
            const houses = await cloud.listHouses();
            const house = this.resolveHouse(account, houses);
            if (!house) throw HttpErrorFactory.badRequest("当前账号没有可用的易来家庭");
            const inventory = await cloud.getInventory(house);
            await this.saveInventory(account, house, houses, inventory.devices, cloud);
            return this.toPublicAccount(
                account,
                inventory.devices.length,
                inventory.devices.filter((device) => device.online).length,
            );
        } catch (error) {
            await this.recordAccountError(account, error);
            throw this.toHttpError(error);
        }
    }

    async updateAccountLabel(userId: string, accountId: string, label: string) {
        const account = await this.requireAccount(userId, accountId);
        account.label = label;
        await this.accountRepository.save(account);
        return this.toPublicAccount(account, 0, 0);
    }

    async removeAccount(userId: string, accountId: string) {
        const account = await this.requireAccount(userId, accountId);
        await this.deviceRepository.delete({ accountId: account.id });
        await this.accountRepository.remove(account);
    }

    async listDevices(
        userId: string,
        filters: { houseId?: string; roomId?: string; category?: string; keyword?: string } = {},
    ): Promise<YeelightProPublicDevice[]> {
        const accounts = await this.accountRepository.find({
            where: { ownerUserId: userId },
            select: { id: true },
        });
        if (!accounts.length) return [];
        const devices = await this.deviceRepository.find({
            where: { accountId: In(accounts.map((account) => account.id)) },
            order: { houseName: "ASC", roomName: "ASC", name: "ASC" },
        });
        const keyword = filters.keyword?.trim().toLowerCase();
        return devices
            .filter((device) => {
                if (filters.houseId && device.houseId !== filters.houseId) return false;
                if (filters.roomId && device.roomId !== filters.roomId) return false;
                if (filters.category && device.category !== filters.category) return false;
                if (!keyword) return true;
                return [device.name, device.model, device.roomName, device.houseName]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(keyword));
            })
            .map((device) => this.toPublicDevice(device));
    }

    async getDevice(userId: string, deviceId: string): Promise<YeelightProPublicDevice> {
        const device = await this.requireDevice(userId, deviceId);
        return this.toPublicDevice(device);
    }

    async refreshDevice(userId: string, deviceId: string): Promise<YeelightProPublicDevice> {
        const device = await this.requireDevice(userId, deviceId);
        const account = await this.requireAccount(userId, device.accountId);
        try {
            const cloud = await this.cloudClient(account);
            if (!device.houseId) throw HttpErrorFactory.badRequest("设备未绑定家庭");
            const state = await cloud.readLightState(device.houseId, device.did);
            device.state = { ...device.state, ...state };
            device.online = state.o === false ? false : device.online;
            device.lastStateAt = new Date();
            await this.deviceRepository.save(device);
            return this.toPublicDevice(device);
        } catch (error) {
            await this.recordAccountError(account, error);
            throw this.toHttpError(error);
        }
    }

    async setProperty(
        userId: string,
        deviceId: string,
        command: { name: string; value: unknown },
    ): Promise<YeelightProPublicDevice> {
        return this.setProperties(userId, deviceId, { [command.name]: command.value });
    }

    async setProperties(
        userId: string,
        deviceId: string,
        properties: Record<string, unknown>,
        duration?: number,
    ): Promise<YeelightProPublicDevice> {
        const device = await this.requireDevice(userId, deviceId);
        const account = await this.requireAccount(userId, device.accountId);
        const params = this.normalizeLightCommand(device, properties);
        if (params.c !== undefined && device.capabilities.some((item) => item.name === "m")) {
            params.m = params.m ?? "rgb";
        }
        if (params.ct !== undefined && device.capabilities.some((item) => item.name === "m")) {
            params.m = params.m ?? "ct";
        }
        if (
            (params.l !== undefined || params.c !== undefined || params.ct !== undefined) &&
            device.state.p !== true &&
            device.capabilities.some((item) => item.name === "p")
        ) {
            params.p = true;
        }
        try {
            const cloud = await this.cloudClient(account);
            if (!device.houseId) throw HttpErrorFactory.badRequest("设备未绑定家庭");
            await cloud.setLightProperties(device.houseId, device.did, params, duration);
            device.state = { ...device.state, ...params };
            device.lastStateAt = new Date();
            await this.deviceRepository.save(device);
            return this.toPublicDevice(device);
        } catch (error) {
            await this.recordAccountError(account, error);
            throw this.toHttpError(error);
        }
    }

    private loginResult(
        session: YeelightProQrSession,
        account: YeelightProAccount,
        houses?: YeelightProHouse[],
    ) {
        return {
            sessionId: session.id,
            status: "LOGIN" as const,
            qrcodeContent: session.qrcodeContent,
            expiresAt: session.expiresAt.toISOString(),
            account: this.toPublicAccount(account, 0, 0),
            houses: (houses || account.homes).map((house) => ({
                id: house.id,
                name: house.name,
            })),
        };
    }

    private async saveAuthenticatedAccount(
        userId: string,
        session: YeelightProQrSession,
        token: YeelightProAccountToken,
    ) {
        const cloud = new YeelightProCloudClient(
            session.region,
            token.accessToken,
            token.clientId || undefined,
        );
        const houses = await cloud.listHouses();
        const upstreamUserId =
            token.userId || `yeelight:${session.region}:${token.username || session.scanDevice}`;
        const linked = await this.accountRepository.find({
            where: { upstreamUserId, region: session.region },
        });
        if (linked.some((item) => item.ownerUserId !== userId)) {
            throw HttpErrorFactory.badRequest("该易来账号已经绑定到其他 BuildingAI 用户");
        }
        let account = linked.find((item) => item.ownerUserId === userId);
        if (!account) {
            account = this.accountRepository.create({
                ownerUserId: userId,
                label: token.username || "易来账号",
                region: session.region,
                upstreamUserId,
                username: token.username || null,
                houseId: houses.length === 1 ? houses[0].id : null,
                houseName: houses.length === 1 ? houses[0].name : null,
                scanDevice: session.scanDevice,
                clientIdEncrypted: null,
                clientSecretEncrypted: null,
                accessTokenEncrypted: "",
                refreshTokenEncrypted: "",
                accessTokenExpiresAt: null,
                status: YeelightProAccountStatus.ACTIVE,
                homes: [],
                lastSyncAt: null,
                lastError: null,
            });
        }
        account.username = token.username || account.username;
        account.scanDevice = session.scanDevice;
        account.accessTokenEncrypted = this.encrypt(token.accessToken);
        account.refreshTokenEncrypted = this.encrypt(token.refreshToken);
        account.clientIdEncrypted = token.clientId
            ? this.encrypt(token.clientId)
            : account.clientIdEncrypted;
        account.clientSecretEncrypted = token.clientSecret
            ? this.encrypt(token.clientSecret)
            : account.clientSecretEncrypted;
        account.accessTokenExpiresAt = new Date(Date.now() + token.expiresIn * 1000);
        account.status = YeelightProAccountStatus.ACTIVE;
        account.lastError = null;
        account.homes = houses.map((house) => ({
            id: house.id,
            name: house.name,
            roomCount: 0,
            deviceCount: 0,
        }));
        if (!account.houseId && houses.length === 1) {
            account.houseId = houses[0].id;
            account.houseName = houses[0].name;
        }
        account = await this.accountRepository.save(account);
        if (account.houseId) {
            const house = houses.find((item) => item.id === account.houseId) || houses[0];
            if (house) {
                const inventory = await cloud.getInventory(house);
                await this.saveInventory(account, house, houses, inventory.devices, cloud);
            }
        }
        return { account, houses };
    }

    private async saveInventory(
        account: YeelightProAccount,
        house: YeelightProHouse,
        houses: YeelightProHouse[],
        devices: YeelightProCloudDevice[],
        cloud: YeelightProCloudClient,
    ) {
        const existing = await this.deviceRepository.find({ where: { accountId: account.id } });
        const existingByDid = new Map(existing.map((device) => [device.did, device]));
        const rows: YeelightProDevice[] = [];
        for (const device of devices) {
            const normalized = inferYeelightLight(device);
            if (normalized.category !== "light") continue;
            const previous = existingByDid.get(device.id);
            const row =
                previous || this.deviceRepository.create({ accountId: account.id, did: device.id });
            row.houseId = device.houseId;
            row.houseName = device.houseName;
            row.roomId = device.roomId;
            row.roomName = device.roomName;
            row.name = device.name;
            row.model = device.model;
            row.productId = device.productId;
            row.icon = device.icon;
            row.category = "light";
            row.online = device.online;
            row.capabilities = normalized.capabilities;
            row.state = { ...(previous?.state || {}), ...device.properties };
            row.metadata = {
                productId: device.productId,
                sourceCategory: device.category,
            };
            row.lastStateAt = previous?.lastStateAt || null;
            rows.push(row);
            existingByDid.delete(device.id);
        }
        await Promise.all(
            rows.map(async (row) => {
                if (!row.houseId) return;
                try {
                    const state = await cloud.readLightState(row.houseId, row.did);
                    row.state = { ...row.state, ...state };
                    row.lastStateAt = new Date();
                } catch {
                    // Keep the inventory snapshot when live property reads fail.
                }
            }),
        );
        await this.accountRepository.manager.transaction(async (manager) => {
            if (existingByDid.size) {
                await manager.getRepository(YeelightProDevice).delete({
                    id: In([...existingByDid.values()].map((device) => device.id)),
                });
            }
            if (rows.length) await manager.getRepository(YeelightProDevice).save(rows);
            account.houseId = house.id;
            account.houseName = house.name;
            account.homes = houses.map((item) => ({
                id: item.id,
                name: item.name,
                roomCount:
                    item.id === house.id
                        ? new Set(rows.map((row) => row.roomId).filter(Boolean)).size
                        : 0,
                deviceCount: item.id === house.id ? rows.length : 0,
            })) as YeelightProHomeSummary[];
            account.status = YeelightProAccountStatus.ACTIVE;
            account.lastError = null;
            account.lastSyncAt = new Date();
            await manager.getRepository(YeelightProAccount).save(account);
        });
    }

    private normalizeLightCommand(
        device: YeelightProDevice,
        properties: Record<string, unknown>,
    ): Record<string, unknown> {
        const allowed = new Set(device.capabilities.map((capability) => capability.name));
        const params: Record<string, unknown> = {};
        for (const [name, rawValue] of Object.entries(properties)) {
            if (!WRITABLE_LIGHT_PROPERTIES.has(name) || !allowed.has(name)) {
                throw HttpErrorFactory.badRequest(`不支持的彩光属性：${name}`);
            }
            const capability = device.capabilities.find((item) => item.name === name);
            params[name] = this.normalizePropertyValue(capability?.format || "string", rawValue);
        }
        if (!Object.keys(params).length) throw HttpErrorFactory.badRequest("没有可下发的灯光属性");
        return params;
    }

    private normalizePropertyValue(format: string, value: unknown): unknown {
        if (format === "bool") {
            if (typeof value === "boolean") return value;
            if (value === 1 || value === "true" || value === "1") return true;
            if (value === 0 || value === "false" || value === "0") return false;
            throw HttpErrorFactory.badRequest("开关值无效");
        }
        if (format === "rgb") {
            if (typeof value === "number" && Number.isFinite(value)) {
                return Math.max(0, Math.min(0xffffff, Math.trunc(value)));
            }
            if (typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value)) {
                return Number.parseInt(value.replace("#", ""), 16);
            }
            if (Array.isArray(value) && value.length === 3) {
                const [r, g, b] = value.map((item) => Number(item));
                if ([r, g, b].every((item) => Number.isFinite(item))) {
                    return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
                }
            }
            throw HttpErrorFactory.badRequest("颜色值无效");
        }
        if (format === "int") {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) throw HttpErrorFactory.badRequest("数值无效");
            return Math.trunc(parsed);
        }
        return value;
    }

    private resolveHouse(account: YeelightProAccount, houses: YeelightProHouse[]) {
        return houses.find((house) => house.id === account.houseId) || houses[0] || null;
    }

    private async cloudClient(account: YeelightProAccount) {
        await this.ensureFreshToken(account);
        return new YeelightProCloudClient(
            account.region,
            this.decrypt(account.accessTokenEncrypted),
            account.clientIdEncrypted ? this.decrypt(account.clientIdEncrypted) : undefined,
        );
    }

    private async ensureFreshToken(account: YeelightProAccount) {
        const expiresAt = account.accessTokenExpiresAt?.getTime() || 0;
        if (expiresAt - YEELIGHT_PRO_TOKEN_REFRESH_MARGIN_MS > Date.now()) return;
        if (
            !account.refreshTokenEncrypted ||
            !account.clientIdEncrypted ||
            !account.clientSecretEncrypted
        ) {
            account.status = YeelightProAccountStatus.AUTH_ERROR;
            account.lastError = "易来授权已失效，请重新扫码登录";
            await this.accountRepository.save(account);
            throw HttpErrorFactory.unauthorized("易来授权已失效，请重新扫码登录");
        }
        try {
            const token = await YeelightProCloudClient.refreshToken({
                region: account.region,
                clientId: this.decrypt(account.clientIdEncrypted),
                clientSecret: this.decrypt(account.clientSecretEncrypted),
                refreshToken: this.decrypt(account.refreshTokenEncrypted),
            });
            account.accessTokenEncrypted = this.encrypt(token.accessToken);
            account.refreshTokenEncrypted = this.encrypt(token.refreshToken);
            if (token.clientId) account.clientIdEncrypted = this.encrypt(token.clientId);
            if (token.clientSecret)
                account.clientSecretEncrypted = this.encrypt(token.clientSecret);
            account.accessTokenExpiresAt = new Date(Date.now() + token.expiresIn * 1000);
            account.status = YeelightProAccountStatus.ACTIVE;
            account.lastError = null;
            await this.accountRepository.save(account);
        } catch (error) {
            account.status = YeelightProAccountStatus.AUTH_ERROR;
            account.lastError = errorMessage(error);
            await this.accountRepository.save(account);
            throw this.toHttpError(error);
        }
    }

    private async requireAccount(userId: string, accountId: string) {
        const account = await this.accountRepository.findOne({
            where: { id: accountId, ownerUserId: userId },
        });
        if (!account) throw HttpErrorFactory.notFound("易来账号不存在");
        return account;
    }

    private async requireDevice(userId: string, deviceId: string) {
        const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
        if (!device) throw HttpErrorFactory.notFound("易来设备不存在");
        const account = await this.accountRepository.findOne({
            where: { id: device.accountId, ownerUserId: userId },
            select: { id: true },
        });
        if (!account) throw HttpErrorFactory.notFound("易来设备不存在");
        return device;
    }

    private async recordAccountError(account: YeelightProAccount, error: unknown) {
        const unauthorized = error instanceof YeelightProCloudError && error.unauthorized;
        account.status = unauthorized
            ? YeelightProAccountStatus.AUTH_ERROR
            : YeelightProAccountStatus.SYNC_ERROR;
        account.lastError = errorMessage(error);
        await this.accountRepository.save(account);
    }

    private toPublicAccount(
        account: YeelightProAccount,
        deviceCount: number,
        onlineDeviceCount: number,
    ): YeelightProPublicAccount {
        return {
            id: account.id,
            label: account.label,
            region: account.region,
            regionLabel: YEELIGHT_PRO_REGIONS[account.region],
            username: account.username,
            houseId: account.houseId,
            houseName: account.houseName,
            status: account.status,
            homes: account.homes,
            deviceCount,
            onlineDeviceCount,
            lastSyncAt: account.lastSyncAt,
            lastError: account.lastError,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
        };
    }

    private toPublicDevice(device: YeelightProDevice): YeelightProPublicDevice {
        return {
            id: device.id,
            provider: "yeelight",
            accountId: device.accountId,
            did: device.did,
            name: device.name,
            model: device.model,
            icon: device.icon,
            category: device.category,
            categoryLabel: device.category === "light" ? "彩光灯" : "其他设备",
            online: device.online,
            houseId: device.houseId,
            houseName: device.houseName,
            roomId: device.roomId,
            roomName: device.roomName,
            capabilities: device.capabilities,
            state: device.state,
            metadata: device.metadata,
            lastStateAt: device.lastStateAt?.toISOString() || null,
            createdAt: device.createdAt.toISOString(),
            updatedAt: device.updatedAt.toISOString(),
        };
    }

    private encrypt(value: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        return [iv, cipher.getAuthTag(), encrypted]
            .map((part) => part.toString("base64url"))
            .join(".");
    }

    private decrypt(value: string): string {
        const [iv, tag, encrypted] = value.split(".");
        if (!iv || !tag || !encrypted) throw new YeelightProCloudError("无效的易来账号凭据", true);
        const decipher = createDecipheriv(
            "aes-256-gcm",
            this.encryptionKey,
            Buffer.from(iv, "base64url"),
        );
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([
            decipher.update(Buffer.from(encrypted, "base64url")),
            decipher.final(),
        ]).toString("utf8");
    }

    private toHttpError(error: unknown) {
        if (error instanceof HttpError) return error;
        if (error instanceof YeelightProCloudError) {
            if (error.unauthorized) return HttpErrorFactory.unauthorized(error.message);
            return HttpErrorFactory.badGateway(error.message);
        }
        return HttpErrorFactory.badGateway(errorMessage(error));
    }
}
