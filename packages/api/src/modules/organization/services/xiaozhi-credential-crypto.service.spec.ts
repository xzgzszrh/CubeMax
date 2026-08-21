import { Logger } from "@nestjs/common";
import { createCipheriv, createHash, randomBytes } from "crypto";

jest.mock("@buildingai/errors", () => ({
    HttpStatus: { SERVICE_UNAVAILABLE: 503 },
    HttpErrorFactory: {
        serviceUnavailable: (message: string) => new Error(message),
        create: (message: string, options?: { level?: string }) =>
            Object.assign(new Error(message), options),
    },
}));

import { XiaozhiCredentialCryptoService } from "./xiaozhi-credential-crypto.service";

const TEST_KEY = "test-only-xiaozhi-key-with-more-than-thirty-two-characters";

function fingerprint(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function legacyEncrypt(value: string, rawKey: string) {
    const key = createHash("sha256").update(rawKey).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function createService(query: jest.Mock) {
    return new XiaozhiCredentialCryptoService({ query } as never);
}

describe("XiaozhiCredentialCryptoService", () => {
    const originalKey = process.env.XIAOZHI_ENCRYPTION_KEY;
    const originalJwtSecret = process.env.JWT_SECRET;

    beforeEach(() => {
        jest.spyOn(Logger.prototype, "warn").mockImplementation();
        jest.spyOn(Logger.prototype, "log").mockImplementation();
    });

    afterEach(() => {
        if (originalKey === undefined) delete process.env.XIAOZHI_ENCRYPTION_KEY;
        else process.env.XIAOZHI_ENCRYPTION_KEY = originalKey;
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
        jest.restoreAllMocks();
    });

    it("never falls back to JWT_SECRET or a development default", async () => {
        delete process.env.XIAOZHI_ENCRYPTION_KEY;
        process.env.JWT_SECRET = "a-long-jwt-secret-that-must-not-encrypt-xiaozhi-credentials";
        const service = createService(jest.fn());
        const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();

        await expect(service.onModuleInit()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("尚未配置 XIAOZHI_ENCRYPTION_KEY"));

        warn.mockClear();
        expect(() => service.encrypt("secret")).toThrow("尚未配置 XIAOZHI_ENCRYPTION_KEY");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("尚未配置 XIAOZHI_ENCRYPTION_KEY"));
        await expect(service.ensureWritable()).rejects.toThrow("尚未配置 XIAOZHI_ENCRYPTION_KEY");
    });

    it("requires a dedicated high-entropy key", async () => {
        process.env.XIAOZHI_ENCRYPTION_KEY = "too-short";
        const service = createService(jest.fn());
        const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();

        await expect(service.onModuleInit()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("至少 32 个字符"));
        expect(() => service.encrypt("secret")).toThrow("至少 32 个字符");
    });

    it("exposes a missing key as a Xiaozhi-only warning, not a fatal API error", () => {
        delete process.env.XIAOZHI_ENCRYPTION_KEY;
        const service = createService(jest.fn());

        try {
            service.encrypt("secret");
            throw new Error("expected encrypt to throw");
        } catch (error) {
            expect(service.toHttpError(error)).toEqual(
                expect.objectContaining({
                    message: "小智账号功能暂时不可用，请联系管理员配置后再试",
                    level: "warn",
                }),
            );
        }
    });

    it("claims the shared database guard at startup and emits versioned ciphertext", async () => {
        process.env.XIAOZHI_ENCRYPTION_KEY = TEST_KEY;
        let guard: string | null = null;
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT "fingerprint"')) {
                return guard ? [{ fingerprint: guard }] : [];
            }
            if (sql.includes("INSERT INTO")) guard = params?.[0] as string;
            return [];
        });
        const service = createService(query);

        expect(() => service.encrypt("secret")).toThrow("共享数据库密钥校验");
        await service.onModuleInit();

        const encrypted = service.encrypt("secret");
        expect(encrypted).toMatch(/^x1\.[a-f0-9]{16}\./);
        expect(encrypted).not.toContain("secret");
        expect(service.decrypt(encrypted)).toBe("secret");
        expect(guard).toBe(fingerprint(TEST_KEY));
    });

    it("keeps legacy three-part ciphertext readable during migration", async () => {
        process.env.XIAOZHI_ENCRYPTION_KEY = TEST_KEY;
        const query = jest.fn(async (sql: string) =>
            sql.includes('SELECT "fingerprint"') ? [{ fingerprint: fingerprint(TEST_KEY) }] : [],
        );
        const service = createService(query);
        await service.ensureReadable();

        expect(service.decrypt(legacyEncrypt("legacy-secret", TEST_KEY))).toBe("legacy-secret");
    });

    it("rejects an API instance whose key differs from the shared database guard", async () => {
        process.env.XIAOZHI_ENCRYPTION_KEY = TEST_KEY;
        const query = jest.fn(async (sql: string) =>
            sql.includes('SELECT "fingerprint"')
                ? [
                      {
                          fingerprint: fingerprint(
                              "another-long-xiaozhi-key-for-a-different-instance",
                          ),
                      },
                  ]
                : [],
        );
        const service = createService(query);
        const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();

        await expect(service.onModuleInit()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("与共享数据库登记的密钥不一致"));
        await expect(service.ensureWritable()).rejects.toEqual(
            expect.objectContaining({ code: "key_mismatch" }),
        );
        expect(() => service.encrypt("secret")).toThrow("共享数据库密钥校验");
    });
});
