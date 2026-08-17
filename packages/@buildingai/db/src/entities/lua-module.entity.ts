import { Column, Entity, Index } from "../typeorm";

import { BaseEntity } from "./base";

export type LuaModuleSchema = {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
};

export type LuaAssistantMessage = {
    role: "user" | "assistant";
    content: string;
    codeDiff?: LuaCodeDiff;
};

export type LuaCodeDiff = {
    additions: number;
    deletions: number;
    hunks: Array<{
        header: string;
        lines: Array<{
            type: "context" | "addition" | "deletion";
            content: string;
            oldLineNumber?: number;
            newLineNumber?: number;
        }>;
    }>;
};

@Entity("lua_module")
@Index(["createBy", "name"])
@Index(["projectId", "updatedAt"])
export class LuaModule extends BaseEntity {
    @Column({ type: "varchar", length: 100 })
    name: string;

    @Column({ type: "text", nullable: true })
    description?: string | null;

    @Column({ name: "draft_code", type: "text" })
    draftCode: string;

    @Column({ name: "published_code", type: "text", nullable: true })
    publishedCode?: string | null;

    @Column({ name: "input_schema", type: "jsonb", default: () => "'{}'::jsonb" })
    inputSchema: LuaModuleSchema;

    @Column({ name: "output_schema", type: "jsonb", default: () => "'{}'::jsonb" })
    outputSchema: LuaModuleSchema;

    @Column({ name: "assistant_messages", type: "jsonb", default: () => "'[]'::jsonb" })
    assistantMessages: LuaAssistantMessage[];

    @Column({ name: "test_params", type: "jsonb", default: () => "'{}'::jsonb" })
    testParams: Record<string, unknown>;

    @Column({ name: "published_input_schema", type: "jsonb", nullable: true })
    publishedInputSchema?: LuaModuleSchema | null;

    @Column({ name: "published_output_schema", type: "jsonb", nullable: true })
    publishedOutputSchema?: LuaModuleSchema | null;

    @Column({ name: "is_published", type: "boolean", default: false })
    isPublished: boolean;

    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt?: Date | null;

    @Column({ name: "create_by", type: "varchar", length: 255 })
    createBy: string;

    @Column({ name: "project_id", type: "uuid", nullable: true })
    projectId?: string | null;
}
