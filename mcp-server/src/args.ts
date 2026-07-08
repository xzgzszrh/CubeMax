export function getRequiredNumber(args: Record<string, unknown>, key: string): number {
    const value = args[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`"${key}" must be a finite number`);
    }

    return value;
}

export function getRequiredString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string") {
        throw new Error(`"${key}" must be a string`);
    }

    return value;
}

export function getOptionalString(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`"${key}" must be a string`);
    }

    return value;
}
