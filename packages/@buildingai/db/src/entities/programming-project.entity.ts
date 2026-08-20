import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";

import { BaseEntity } from "./base";

export type ProgrammingRuntimeTarget = "local" | "simulator" | "device";

/** The two intentionally different programming experiences. */
export type ProgrammingProjectType = "conversation" | "application";

export type ProgrammingProjectToolSnapshot = {
    mcpServerId: string;
    toolName: string;
};

export type ProgrammingProjectLuaSnapshot = {
    id: string;
    name: string;
    code: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
};

export type ProgrammingProjectPublishedSnapshot = {
    version: 1;
    workflow: {
        id: string;
        name: string;
        schema: Record<string, unknown>;
    };
    luaModules: ProgrammingProjectLuaSnapshot[];
    tools: ProgrammingProjectToolSnapshot[];
    runtime: {
        target: ProgrammingRuntimeTarget;
        simulatorSessionId?: string;
        deviceId?: string;
    };
    publishedAt: string;
};

@AppEntity({ name: "programming_project", comment: "编程工程" })
@Index(["createBy", "updatedAt"])
@Index(["mainWorkflowId"], { unique: true })
export class ProgrammingProject extends BaseEntity {
    @Column({ length: 100, comment: "工程名称" })
    name: string;

    @Column({ type: "text", nullable: true, comment: "工程描述" })
    description?: string | null;

    @Column({
        name: "project_type",
        type: "varchar",
        length: 20,
        default: "conversation",
        comment: "工程类型：对话流或应用",
    })
    projectType: ProgrammingProjectType;

    @Column({ name: "main_workflow_id", type: "uuid", nullable: true, comment: "主流程ID" })
    mainWorkflowId?: string | null;

    @Column({ name: "runtime_target", type: "varchar", length: 16, default: "local" })
    runtimeTarget: ProgrammingRuntimeTarget;

    @Column({ name: "simulator_session_id", type: "uuid", nullable: true })
    simulatorSessionId?: string | null;

    @Column({ name: "device_id", type: "varchar", length: 36, nullable: true })
    deviceId?: string | null;

    @Column({ name: "is_published", type: "boolean", default: false })
    isPublished: boolean;

    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt?: Date | null;

    @Column({ name: "published_snapshot", type: "jsonb", nullable: true })
    publishedSnapshot?: ProgrammingProjectPublishedSnapshot | null;

    @Column({ name: "create_by", type: "varchar", length: 255 })
    createBy: string;
}

@AppEntity({ name: "programming_project_tool", comment: "编程工程可调用工具" })
@Index(["projectId", "mcpServerId", "toolName"], { unique: true })
@Index(["projectId"])
export class ProgrammingProjectTool extends BaseEntity {
    @Column({ name: "project_id", type: "uuid" })
    projectId: string;

    @Column({ name: "mcp_server_id", type: "varchar", length: 255 })
    mcpServerId: string;

    @Column({ name: "tool_name", type: "varchar", length: 255 })
    toolName: string;
}
