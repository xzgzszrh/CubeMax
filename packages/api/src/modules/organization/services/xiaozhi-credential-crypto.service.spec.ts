import { createCipheriv, createHash, randomBytes } from "crypto";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        serviceUnavailable: (message: string) => new Error(message),
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

        await expect(service.onModuleInit()).rejects.toThrow("尚未配置 XIAOZHI_ENCRYPTION_KEY");
    });

    it("requires a dedicated high-entropy key", async () => {
        process.env.XIAOZHI_ENCRYPTION_KEY = "too-short";
        const service = createService(jest.fn());

        await expect(service.onModuleInit()).rejects.toThrow("至少 32 个字符");
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

        await expect(service.onModuleInit()).rejects.toEqual(
            expect.objectContaining({ code: "key_mismatch" }),
        );
    });
});
