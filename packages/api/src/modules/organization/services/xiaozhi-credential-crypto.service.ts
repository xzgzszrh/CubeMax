import { DataSource } from "@buildingai/db/typeorm";
import { HttpErrorFactory, HttpStatus } from "@buildingai/errors";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const CIPHER_VERSION = "x1";
const FINGERPRINT_LENGTH = 16;
const KEY_GUARD_TABLE = "xiaozhi_encryption_key_guard";

export const XIAOZHI_CREDENTIAL_RECOVERY_MESSAGE =
    "小智账号凭据无法使用当前加密密钥读取，请由老师或组织管理员重新登录该账号";

type CredentialErrorCode = "not_configured" | "key_mismatch" | "invalid_ciphertext";

export class XiaozhiCredentialCryptoError extends Error {
    constructor(
        readonly code: CredentialErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "XiaozhiCredentialCryptoError";
    }
}

type KeyGuardPayload = {
    version: 1;
    fingerprint: string;
};

/**
 * Encrypts every xiaozhi secret with one explicit application key.
 *
 * The key fingerprint is registered in the shared database before any write.
 * This prevents two API instances that point at the same database from silently
 * encrypting credentials with different environment configuration.
 */
@Injectable()
export class XiaozhiCredentialCryptoService implements OnModuleInit {
    private readonly logger = new Logger(XiaozhiCredentialCryptoService.name);
    private readonly rawKey = process.env.XIAOZHI_ENCRYPTION_KEY?.trim() || "";
    private readonly key = this.rawKey ? createHash("sha256").update(this.rawKey).digest() : null;
    private readonly fingerprint = this.rawKey
        ? createHash("sha256").update(this.rawKey).digest("hex")
        : null;
    private databaseKeyVerified = false;
    private databaseCheck: Promise<boolean> | null = null;

    constructor(private readonly dataSource: DataSource) {}

    async onModuleInit() {
        try {
            await this.ensureWritable();
        } catch (error) {
            // Missing/mismatched key only disables Xiaozhi credentials.
            // The rest of the API must keep serving.
            if (this.isCredentialError(error)) return;
            throw error;
        }
        this.logger.log(
            `小智凭据加密已启用（密钥指纹 ${this.fingerprint?.slice(0, FINGERPRINT_LENGTH)}）`,
        );
    }

    /** Check an existing guard without claiming an uninitialized database. */
    async ensureReadable(): Promise<void> {
        this.requireConfigured();
        await this.verifyDatabaseKey(false);
    }

    /** Claim an uninitialized database guard, then require every writer to match it. */
    async ensureWritable(): Promise<void> {
        this.requireConfigured();
        await this.verifyDatabaseKey(true);
    }

    encrypt(value: string): string {
        const key = this.requireConfigured();
        if (!this.databaseKeyVerified) {
            throw this.keyMismatch("保存小智凭据前必须先通过共享数据库密钥校验");
        }
        const fingerprint = this.fingerprint as string;
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        return [
            CIPHER_VERSION,
            fingerprint.slice(0, FINGERPRINT_LENGTH),
            iv.toString("base64url"),
            cipher.getAuthTag().toString("base64url"),
            encrypted.toString("base64url"),
        ].join(".");
    }

    decrypt(value: string): string {
        const key = this.requireConfigured();
        const parts = value.split(".");
        let iv: string;
        let tag: string;
        let encrypted: string;

        if (parts[0] === CIPHER_VERSION) {
            const [version, keyId, versionedIv, versionedTag, versionedEncrypted] = parts;
            if (!version || !keyId || !versionedIv || !versionedTag || !versionedEncrypted) {
                throw this.invalidCiphertext();
            }
            if (keyId !== this.fingerprint?.slice(0, FINGERPRINT_LENGTH)) {
                throw this.keyMismatch();
            }
            iv = versionedIv;
            tag = versionedTag;
            encrypted = versionedEncrypted;
        } else {
            [iv, tag, encrypted] = parts;
            if (!iv || !tag || !encrypted || parts.length !== 3) {
                throw this.invalidCiphertext();
            }
        }

        try {
            const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
            decipher.setAuthTag(Buffer.from(tag, "base64url"));
            return Buffer.concat([
                decipher.update(Buffer.from(encrypted, "base64url")),
                decipher.final(),
            ]).toString("utf8");
        } catch (error) {
            if (error instanceof XiaozhiCredentialCryptoError) throw error;
            throw this.keyMismatch();
        }
    }

    isCredentialError(error: unknown): error is XiaozhiCredentialCryptoError {
        return error instanceof XiaozhiCredentialCryptoError;
    }

    toHttpError(error: unknown) {
        if (!this.isCredentialError(error)) return error;
        const message =
            error.code === "not_configured"
                ? "小智账号功能暂时不可用，请联系管理员配置后再试"
                : error.message;
        return HttpErrorFactory.create(message, {
            httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
            businessCode: 50001,
            data: {
                code: `xiaozhi_credential_${error.code}`,
                recoverable: error.code !== "not_configured",
            },
            level: "warn",
        });
    }

    private requireConfigured(): Buffer {
        if (!this.key || !this.fingerprint) {
            throw this.fail(
                "not_configured",
                "服务端尚未配置 XIAOZHI_ENCRYPTION_KEY，小智账号功能暂不可用，其他服务不受影响",
            );
        }
        if (this.rawKey.length < 32) {
            throw this.fail(
                "not_configured",
                "XIAOZHI_ENCRYPTION_KEY 长度不足，请配置至少 32 个字符的独立随机密钥；小智账号功能暂不可用，其他服务不受影响",
            );
        }
        return this.key;
    }

    private async verifyDatabaseKey(claimIfMissing: boolean): Promise<boolean> {
        if (this.databaseKeyVerified) return true;
        if (this.databaseCheck) {
            await this.databaseCheck;
            if (this.databaseKeyVerified || !claimIfMissing) return this.databaseKeyVerified;
        }

        const check = this.checkDatabaseKey(claimIfMissing);
        this.databaseCheck = check;
        try {
            return await check;
        } finally {
            if (this.databaseCheck === check) this.databaseCheck = null;
        }
    }

    private async checkDatabaseKey(claimIfMissing: boolean): Promise<boolean> {
        await this.ensureGuardTable();
        let guard = await this.readDatabaseGuard();
        if (!guard && claimIfMissing) {
            const payload: KeyGuardPayload = {
                version: 1,
                fingerprint: this.fingerprint as string,
            };
            await this.dataSource.query(
                `
                    INSERT INTO "${KEY_GUARD_TABLE}" ("id", "fingerprint", "created_at", "updated_at")
                    VALUES (1, $1, now(), now())
                    ON CONFLICT ("id") DO NOTHING
                `,
                [payload.fingerprint],
            );
            guard = await this.readDatabaseGuard();
        }

        if (!guard) return false;
        if (guard.version !== 1 || guard.fingerprint !== this.fingerprint) {
            throw this.keyMismatch(
                "当前 API 的 XIAOZHI_ENCRYPTION_KEY 与共享数据库登记的密钥不一致，已拒绝访问以避免损坏账号数据",
            );
        }
        this.databaseKeyVerified = true;
        return true;
    }

    private async readDatabaseGuard(): Promise<KeyGuardPayload | null> {
        const rows = (await this.dataSource.query(
            `
                SELECT "fingerprint"
                FROM "${KEY_GUARD_TABLE}"
                WHERE "id" = 1
            `,
        )) as Array<{ fingerprint?: string }>;
        const fingerprint = rows[0]?.fingerprint;
        return fingerprint ? { version: 1, fingerprint } : null;
    }

    private async ensureGuardTable() {
        await this.dataSource.query(`
            CREATE TABLE IF NOT EXISTS "${KEY_GUARD_TABLE}" (
                "id" smallint PRIMARY KEY CHECK ("id" = 1),
                "fingerprint" varchar(64) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            )
        `);
    }

    private keyMismatch(message = XIAOZHI_CREDENTIAL_RECOVERY_MESSAGE) {
        return this.fail("key_mismatch", message);
    }

    private invalidCiphertext() {
        return this.fail(
            "invalid_ciphertext",
            "小智账号凭据格式无效，请由老师或组织管理员重新登录该账号",
        );
    }

    private fail(code: CredentialErrorCode, message: string): XiaozhiCredentialCryptoError {
        const error = new XiaozhiCredentialCryptoError(code, message);
        this.logger.warn(error.message);
        return error;
    }
}
