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
};

@Entity("lua_module")
@Index(["createBy", "name"])
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
}
