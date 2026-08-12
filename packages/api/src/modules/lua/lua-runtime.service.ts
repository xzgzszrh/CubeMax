import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { existsSync } from "fs";
import { join } from "path";
import { Worker } from "worker_threads";

type LuaWorkerResult = { ok: true; result: unknown } | { ok: false; error: string };

export interface LuaExecutionResult {
    output: Record<string, unknown>;
    executionTime: number;
}

@Injectable()
export class LuaRuntimeService {
    private readonly timeoutMs = 3_000;
    private readonly maxPayloadBytes = 256 * 1024;

    async execute(code: string, params: Record<string, unknown> = {}): Promise<LuaExecutionResult> {
        this.assertPayloadSize(params, "输入参数");
        const startedAt = Date.now();
        const result = await this.runWorker(code, params);

        if (result.ok === false) {
            throw HttpErrorFactory.badRequest(`Lua 执行失败：${result.error}`);
        }

        const output = this.normalizeOutput(result.result);
        this.assertPayloadSize(output, "输出结果");
        return { output, executionTime: Date.now() - startedAt };
    }

    async validate(code: string): Promise<void> {
        const result = await this.runWorker(code, {}, true);
        if (result.ok === false) {
            throw HttpErrorFactory.badRequest(`Lua 校验失败：${result.error}`);
        }
    }

    private runWorker(
        code: string,
        params: Record<string, unknown>,
        validateOnly = false,
    ): Promise<LuaWorkerResult> {
        const workerPath = this.resolveWorkerPath();

        return new Promise((resolve, reject) => {
            const worker = new Worker(workerPath, {
                resourceLimits: {
                    maxOldGenerationSizeMb: 32,
                    maxYoungGenerationSizeMb: 8,
                    stackSizeMb: 2,
                },
            });
            let settled = false;

            const finish = (callback: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                void worker.terminate();
                callback();
            };

            const timer = setTimeout(() => {
                finish(() => reject(HttpErrorFactory.badRequest("Lua 执行超时（最多3秒）")));
            }, this.timeoutMs);

            worker.once("message", (message: LuaWorkerResult) => {
                finish(() => resolve(message));
            });
            worker.once("error", (error) => {
                finish(() =>
                    reject(HttpErrorFactory.badRequest(`Lua 运行时错误：${error.message}`)),
                );
            });
            worker.once("exit", (code) => {
                if (!settled && code !== 0) {
                    finish(() => reject(HttpErrorFactory.badRequest("Lua 运行时意外退出")));
                }
            });
            worker.postMessage({ code, params, validateOnly });
        });
    }

    private resolveWorkerPath(): string {
        const candidates = [
            join(__dirname, "lua-runtime.worker.js"),
            join(process.cwd(), "dist", "modules", "lua", "lua-runtime.worker.js"),
            join(
                process.cwd(),
                "packages",
                "api",
                "dist",
                "modules",
                "lua",
                "lua-runtime.worker.js",
            ),
        ];
        const workerPath = candidates.find((candidate) => existsSync(candidate));
        if (!workerPath) {
            throw new Error("Lua runtime worker is missing; build the API package first");
        }
        return workerPath;
    }

    private normalizeOutput(value: unknown): Record<string, unknown> {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
        return { result: value };
    }

    private assertPayloadSize(value: unknown, label: string): void {
        let serialized: string;
        try {
            serialized = JSON.stringify(value);
        } catch {
            throw HttpErrorFactory.badRequest(`${label}必须是 JSON 兼容数据`);
        }
        if (Buffer.byteLength(serialized, "utf8") > this.maxPayloadBytes) {
            throw HttpErrorFactory.badRequest(`${label}不能超过256KB`);
        }
    }
}
