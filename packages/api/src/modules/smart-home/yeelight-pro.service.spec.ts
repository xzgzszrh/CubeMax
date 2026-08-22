import type {
    YeelightProAccount,
    YeelightProDevice,
    YeelightProQrSession,
} from "@buildingai/db/entities";
import type { Repository } from "@buildingai/db/typeorm";

jest.mock("@buildingai/db/@nestjs/typeorm", () => ({
    InjectRepository: () => () => undefined,
}));

jest.mock("@buildingai/db/entities", () => ({
    YeelightProAccount: class YeelightProAccount {},
    YeelightProAccountStatus: {
        ACTIVE: "active",
        AUTH_ERROR: "auth_error",
        SYNC_ERROR: "sync_error",
    },
    YeelightProDevice: class YeelightProDevice {},
    YeelightProQrSession: class YeelightProQrSession {},
}));

jest.mock("@buildingai/db/typeorm", () => ({
    In: (value: unknown) => value,
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

import { YeelightProService } from "./yeelight-pro.service";

function createService() {
    const accountRepository = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        save: jest.fn(async (value) => value),
        create: jest.fn((value) => value),
        remove: jest.fn(),
    } as unknown as Repository<YeelightProAccount>;
    const qrSessionRepository = {
        save: jest.fn(async (value) => value),
        create: jest.fn((value) => value),
        findOne: jest.fn(),
    } as unknown as Repository<YeelightProQrSession>;
    const deviceRepository = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        save: jest.fn(async (value) => value),
        create: jest.fn((value) => value),
        delete: jest.fn(),
    } as unknown as Repository<YeelightProDevice>;
    return {
        service: new YeelightProService(accountRepository, qrSessionRepository, deviceRepository),
        accountRepository,
        deviceRepository,
    };
}

describe("YeelightProService", () => {
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
        deviceRepository.findOne = jest.fn().mockResolvedValue({
            id: "device-b",
            accountId: "account-b",
        });
        accountRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.getDevice("user-a", "device-b")).rejects.toThrow("易来设备不存在");
        expect(accountRepository.findOne).toHaveBeenCalledWith({
            where: { id: "account-b", ownerUserId: "user-a" },
            select: { id: true },
        });
    });

    it("rejects unsupported color-light properties", () => {
        const { service } = createService();
        const normalize = (
            service as unknown as {
                normalizeLightCommand: (
                    device: { capabilities: Array<{ name: string; format: string }> },
                    properties: Record<string, unknown>,
                ) => Record<string, unknown>;
            }
        ).normalizeLightCommand.bind(service);

        expect(() =>
            normalize(
                {
                    capabilities: [
                        { name: "p", format: "bool" },
                        { name: "c", format: "rgb" },
                    ],
                },
                { unknown: true },
            ),
        ).toThrow("不支持的彩光属性");
        expect(
            normalize(
                {
                    capabilities: [
                        { name: "p", format: "bool" },
                        { name: "c", format: "rgb" },
                    ],
                },
                { c: "#ff0000" },
            ),
        ).toEqual({ c: 0xff0000 });
    });
});
