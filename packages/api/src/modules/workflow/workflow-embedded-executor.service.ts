import {
    type BuiltinMcpServer,
    BuiltinMcpRegistryService,
} from "@modules/ai/mcp/services/builtin-mcp-registry.service";
import { Injectable } from "@nestjs/common";

import { WorkflowRuntimeTaskDto } from "./workflow-runtime.dto";

const EMBEDDED_MCP_SERVICE_KEY = "embedded";
const EMBEDDED_NODE_TYPE_PREFIX = "embedded_";
const MCP_NODE_TYPE = "mcp";

const EMBEDDED_ACTIONS = new Set([
    "scan_serial_ports",
    "open_serial",
    "close_device",
    "reset_device",
    "get_device_info",
    "flash_firmware",
    "serial_write_text",
    "serial_write_bytes",
    "serial_read_line",
    "serial_expect_text",
    "serial_request_response",
    "gpio_set_mode",
    "gpio_write",
    "gpio_read",
    "analog_read",
    "pwm_write",
    "servo_write_angle",
    "i2c_scan",
    "i2c_write_register",
    "i2c_read_register",
    "delay_ms",
    "save_serial_log",
]);

type WorkflowSchema = {
    nodes?: unknown;
    [key: string]: unknown;
};

type WorkflowSchemaNode = {
    type?: unknown;
    data?: unknown;
    blocks?: unknown;
    [key: string]: unknown;
};

@Injectable()
export class WorkflowEmbeddedExecutorService {
    constructor(private readonly builtinMcpRegistryService: BuiltinMcpRegistryService) {}

    prepareTaskDto(dto: WorkflowRuntimeTaskDto): WorkflowRuntimeTaskDto {
        const schema = JSON.parse(dto.schema) as WorkflowSchema;
        let embeddedServer: BuiltinMcpServer | undefined;

        const getEmbeddedServer = () => {
            embeddedServer ??=
                this.builtinMcpRegistryService.getServerByKey(EMBEDDED_MCP_SERVICE_KEY);
            if (!embeddedServer || !embeddedServer.connectable) {
                throw new Error("Built-in embedded MCP service is not available");
            }
            return embeddedServer;
        };

        const transformed = this.transformNodes(schema.nodes, getEmbeddedServer);

        if (!transformed) {
            return dto;
        }

        return {
            ...dto,
            schema: JSON.stringify(schema),
        };
    }

    private transformNodes(value: unknown, getEmbeddedServer: () => BuiltinMcpServer): boolean {
        if (!Array.isArray(value)) {
            return false;
        }

        let transformed = false;
        for (const node of value) {
            if (!this.isRecord(node)) {
                continue;
            }

            const action = this.resolveEmbeddedAction(node);
            if (action) {
                const server = getEmbeddedServer();
                const data = this.isRecord(node.data) ? node.data : {};

                node.type = MCP_NODE_TYPE;
                node.data = {
                    ...data,
                    mcpServerId: server.id,
                    toolName: action,
                };
                transformed = true;
            }

            if (this.transformNodes(node.blocks, getEmbeddedServer)) {
                transformed = true;
            }
        }

        return transformed;
    }

    private resolveEmbeddedAction(node: WorkflowSchemaNode): string | undefined {
        const type = typeof node.type === "string" ? node.type : undefined;
        const data = this.isRecord(node.data) ? node.data : undefined;
        const dataAction =
            typeof data?.embeddedAction === "string" ? data.embeddedAction : undefined;
        const typeAction = type?.startsWith(EMBEDDED_NODE_TYPE_PREFIX)
            ? type.slice(EMBEDDED_NODE_TYPE_PREFIX.length)
            : undefined;

        if (!typeAction && !dataAction) {
            return undefined;
        }

        const action = dataAction || typeAction;
        if (!action || !EMBEDDED_ACTIONS.has(action)) {
            throw new Error(`Unsupported embedded workflow action "${action ?? type}"`);
        }

        return action;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }
}
