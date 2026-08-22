import { HttpErrorFactory, HttpStatus } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

export const XIAOZHI_CREDENTIAL_RECOVERY_MESSAGE =
    "小智账号凭据无法读取，请由老师或组织管理员重新登录该账号";

type CredentialErrorCode = "invalid_ciphertext";

export class XiaozhiCredentialCryptoError extends Error {
    constructor(
        readonly code: CredentialErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "XiaozhiCredentialCryptoError";
    }
}

/**
 * Xiaozhi account cookies/passwords are stored as plaintext.
 * The previous AES path (XIAOZHI_ENCRYPTION_KEY) is intentionally removed.
 */
@Injectable()
export class XiaozhiCredentialCryptoService {
    private readonly logger = new Logger(XiaozhiCredentialCryptoService.name);

    async onModuleInit() {
        this.logger.log("小智凭据按明文存储（不再使用 XIAOZHI_ENCRYPTION_KEY）");
    }

    async ensureReadable(): Promise<void> {}

    async ensureWritable(): Promise<void> {}

    encrypt(value: string): string {
        return value ?? "";
    }

    decrypt(value: string): string {
        if (this.looksEncrypted(value)) {
            throw new XiaozhiCredentialCryptoError(
                "invalid_ciphertext",
                XIAOZHI_CREDENTIAL_RECOVERY_MESSAGE,
            );
        }
        return value ?? "";
    }

    isCredentialError(error: unknown): error is XiaozhiCredentialCryptoError {
        return error instanceof XiaozhiCredentialCryptoError;
    }

    toHttpError(error: unknown) {
        if (!this.isCredentialError(error)) return error;
        return HttpErrorFactory.create(error.message, {
            httpStatus: HttpStatus.BAD_REQUEST,
            businessCode: 50001,
            data: {
                code: `xiaozhi_credential_${error.code}`,
                recoverable: true,
            },
            level: "warn",
        });
    }

    private looksEncrypted(value: string): boolean {
        return typeof value === "string" && value.startsWith("x1.");
    }
}
