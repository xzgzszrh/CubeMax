export function getRequiredNumber(args: Record<string, unknown>, key: string): number {
    const value = args[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`“${key}”必须是有效数字`);
    }

    return value;
}

export function getRequiredString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string") {
        throw new Error(`“${key}”必须是字符串`);
    }

    return value;
}

export function getOptionalString(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`“${key}”必须是字符串`);
    }

    return value;
}

export function getOptionalNumber(args: Record<string, unknown>, key: string): number | undefined {
    const value = args[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`“${key}”必须是有效数字`);
    }

    return value;
}

export function getOptionalBoolean(
    args: Record<string, unknown>,
    key: string,
): boolean | undefined {
    const value = args[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`“${key}”必须是布尔值`);
}

export function getOptionalStringArray(
    args: Record<string, unknown>,
    key: string,
): string[] | undefined {
    const value = args[key];
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (Array.isArray(value)) {
        return value.map(String);
    }
    throw new Error(`“${key}”必须是字符串数组或以英文逗号分隔的字符串`);
}
