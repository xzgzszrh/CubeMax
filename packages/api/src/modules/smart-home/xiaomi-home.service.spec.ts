import type {
    XiaomiHomeAccount,
    XiaomiHomeDevice,
    XiaomiHomeOAuthSession,
} from "@buildingai/db/entities";
import type { Repository } from "@buildingai/db/typeorm";
import { HttpError } from "@buildingai/errors";

jest.mock("@buildingai/db/@nestjs/typeorm", () => ({
    InjectRepository: () => () => undefined,
}));

jest.mock("@buildingai/db/entities", () => ({
    XiaomiHomeAccount: class XiaomiHomeAccount {},
    XiaomiHomeAccountStatus: {
        ACTIVE: "active",
        AUTH_ERROR: "auth_error",
        SYNC_ERROR: "sync_error",
    },
    XiaomiHomeDevice: class XiaomiHomeDevice {},
    XiaomiHomeOAuthSession: class XiaomiHomeOAuthSession {},
}));

jest.mock("@buildingai/db/typeorm", () => ({
    In: (value: unknown) => value,
    IsNull: () => null,
    MoreThan: (value: unknown) => value,
}));

jest.mock("@buildingai/errors", () => ({
    HttpError: class HttpError extends Error {},
    HttpErrorFactory: {
        badGateway: (message: string) => new Error(message),
        badRequest: (message: string) => new Error(message),
        internal: (message: string) => new Error(message),
        notFound: (message: string) => new Error(message),
        unauthorized: (message: string) => new Error(message),
    },
}));

import { XiaomiHomeService } from "./xiaomi-home.service";

function createService() {
    const accountRepository = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
    } as unknown as Repository<XiaomiHomeAccount>;
    const oauthSessionRepository = {} as Repository<XiaomiHomeOAuthSession>;
    const deviceRepository = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
    } as unknown as Repository<XiaomiHomeDevice>;
    return {
        service: new XiaomiHomeService(accountRepository, oauthSessionRepository, deviceRepository),
        accountRepository,
        deviceRepository,
    };
}

describe("XiaomiHomeService", () => {
    it("scopes account listing to the current BuildingAI user", async () => {
        const { service, accountRepository } = createService();

        await service.listAccounts("user-a");

        expect(accountRepository.find).toHaveBeenCalledWith({
            where: { ownerUserId: "user-a" },
            order: { createdAt: "ASC" },
        });
    });

    it("does not expose devices when the account belongs to another user", async () => {
        const { service, accountRepository, deviceRepository } = createService();
        accountRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.listDevices("user-a", "account-b", {})).rejects.toThrow(
            "小米智能家居账号不存在",
        );
        expect(accountRepository.findOne).toHaveBeenCalledWith({
            where: { id: "account-b", ownerUserId: "user-a" },
        });
        expect(deviceRepository.find).not.toHaveBeenCalled();
    });

    it("lists devices only through accounts owned by the current user", async () => {
        const { service, accountRepository, deviceRepository } = createService();
        accountRepository.find = jest.fn().mockResolvedValue([{ id: "account-a" }]);
        deviceRepository.find = jest.fn().mockResolvedValue([]);

        await service.listAllDevices("user-a", {});

        expect(accountRepository.find).toHaveBeenCalledWith({
            where: { ownerUserId: "user-a" },
            select: { id: true },
        });
        expect(deviceRepository.find).toHaveBeenCalledWith({
            where: { accountId: ["account-a"] },
            order: { homeName: "ASC", roomName: "ASC", name: "ASC" },
        });
    });

    it("blocks cross-user device reads and controls", async () => {
        const { service, accountRepository, deviceRepository } = createService();
        deviceRepository.findOne = jest.fn().mockResolvedValue({
            id: "device-b",
            accountId: "account-b",
        });
        accountRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.getDevice("user-a", "device-b")).rejects.toThrow(
            "小米智能家居设备不存在",
        );
        await expect(
            service.setProperty("user-a", "device-b", { siid: 2, piid: 1, value: true }),
        ).rejects.toThrow("小米智能家居设备不存在");
        expect(accountRepository.findOne).toHaveBeenCalledTimes(2);
        expect(accountRepository.findOne).toHaveBeenCalledWith({
            where: { id: "account-b", ownerUserId: "user-a" },
            select: { id: true },
        });
    });

    it("preserves HTTP errors raised while importing credentials", () => {
        const { service } = createService();
        const original = new HttpError("账号已绑定", { businessCode: 40000 });
        const mapError = (
            service as unknown as { toHttpError: (error: unknown) => unknown }
        ).toHttpError.bind(service);

        expect(mapError(original)).toBe(original);
    });

    it("accepts only the local Home Assistant credential shape", () => {
        const { service } = createService();
        const parse = (
            service as unknown as {
                parseLocalCredentials: (value: string) => Record<string, unknown>;
            }
        ).parseLocalCredentials.bind(service);
        const credentials = parse(
            JSON.stringify({
                provider: "xiaomi_home",
                version: 1,
                cloudServer: "cn",
                clientId: "2882303761520251711",
                deviceId: "ha.test-device",
                redirectUri: "http://homeassistant.local:8123/api/webhook/buildingai-test",
                state: "a".repeat(43),
                accessToken: "access-token-".repeat(3),
                refreshToken: "refresh-token-".repeat(3),
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }),
        );

        expect(credentials).toMatchObject({
            provider: "xiaomi_home",
            version: 1,
            cloudServer: "cn",
        });
        expect(() =>
            parse(
                JSON.stringify({
                    provider: "xiaomi_home",
                    version: 1,
                    cloudServer: "cn",
                    clientId: "2882303761520251711",
                    deviceId: "ha.test-device",
                    redirectUri: "https://attacker.example/api/webhook/fake",
                    state: "a".repeat(43),
                    accessToken: "access-token-".repeat(3),
                    refreshToken: "refresh-token-".repeat(3),
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                }),
            ),
        ).toThrow("本地 Home Assistant 地址");
    });
});
