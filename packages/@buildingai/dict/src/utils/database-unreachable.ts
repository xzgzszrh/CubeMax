function collectErrorText(error: unknown): string {
    if (!error || typeof error !== "object") {
        return String(error ?? "");
    }
    const record = error as {
        message?: unknown;
        code?: unknown;
        driverError?: { message?: unknown; code?: unknown };
    };
    return [
        record.message,
        record.code,
        record.driverError?.message,
        record.driverError?.code,
    ]
        .filter((value) => value !== undefined && value !== null)
        .map(String)
        .join(" ");
}

/** Connection/DNS failures should not be treated as "config missing". */
export function isDatabaseUnreachableError(error: unknown): boolean {
    return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ECONNRESET|getaddrinfo/i.test(
        collectErrorText(error),
    );
}
