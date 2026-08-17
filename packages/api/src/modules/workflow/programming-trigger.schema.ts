import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

export type ProgrammingInputSchema = Record<string, unknown>;

const EMPTY_INPUT_SCHEMA: ProgrammingInputSchema = {
    type: "object",
    properties: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function findStartNode(value: unknown): Record<string, unknown> | undefined {
    if (!isRecord(value)) return undefined;
    if (Array.isArray(value.nodes)) {
        for (const node of value.nodes) {
            if (!isRecord(node)) continue;
            if (node.type === "start") return node;
            const nested = findStartNode(node);
            if (nested) return nested;
        }
    }
    if (Array.isArray(value.blocks)) {
        for (const node of value.blocks) {
            const nested = findStartNode(node);
            if (nested) return nested;
        }
    }
    return undefined;
}

function normalizeSchema(value: unknown): ProgrammingInputSchema {
    if (!isRecord(value)) return { ...EMPTY_INPUT_SCHEMA };
    const schema = { ...value } as ProgrammingInputSchema;
    if (schema.type === "map") schema.type = "object";
    if (isRecord(schema.properties)) {
        schema.properties = Object.fromEntries(
            Object.entries(schema.properties).map(([key, property]) => [
                key,
                normalizeSchema(property),
            ]),
        );
    }
    if (isRecord(schema.items)) schema.items = normalizeSchema(schema.items);
    return schema;
}

/** Extracts the public form contract from the main workflow's start node. */
export function extractProgrammingInputSchema(workflowSchema: unknown): ProgrammingInputSchema {
    const start = findStartNode(workflowSchema);
    const data = isRecord(start?.data) ? start.data : undefined;
    const outputs = data?.outputs;
    const normalized = normalizeSchema(outputs);
    return normalized.type === "object" ? normalized : { ...EMPTY_INPUT_SCHEMA };
}

function formatValidationError(error: ErrorObject): string {
    const path = error.instancePath || "输入";
    if (error.keyword === "required") {
        const missing = (error.params as { missingProperty?: string }).missingProperty;
        return `${path}缺少必填项「${missing || "未知字段"}」`;
    }
    if (error.keyword === "additionalProperties") {
        const property = (error.params as { additionalProperty?: string }).additionalProperty;
        return `${path}包含未定义字段「${property || "未知字段"}」`;
    }
    if (error.keyword === "type") {
        return `${path}应为${String((error.params as { type?: string }).type || "正确类型")}`;
    }
    if (error.keyword === "enum") return `${path}不是可选值`;
    return `${path}${error.message || "校验失败"}`;
}

export type ValidatedProgrammingInputs = Record<string, unknown>;

/** Validates and applies JSON Schema defaults without mutating the request body. */
export function validateProgrammingInputs(
    schema: ProgrammingInputSchema,
    inputs: Record<string, unknown>,
): { valid: true; inputs: ValidatedProgrammingInputs } | { valid: false; message: string } {
    const validator: ValidateFunction = new Ajv({
        allErrors: true,
        useDefaults: true,
        strict: false,
    }).compile(normalizeSchema(schema));
    const copy = JSON.parse(JSON.stringify(inputs)) as Record<string, unknown>;
    if (validator(copy)) return { valid: true, inputs: copy };
    const errors = validator.errors?.map(formatValidationError) ?? ["输入参数校验失败"];
    return { valid: false, message: errors.join("；") };
}
