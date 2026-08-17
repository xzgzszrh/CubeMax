import { MigrationInterface, QueryRunner } from "typeorm";

type LegacyWorkflowRow = {
    id: string;
    name: string;
    description: string | null;
    schema: unknown;
    published_schema: unknown;
    is_published: boolean;
    published_at: Date | string | null;
    create_by: string;
};

type LegacyLuaRow = {
    id: string;
    name: string;
    draft_code: string;
    published_code: string | null;
    input_schema: Record<string, unknown>;
    output_schema: Record<string, unknown>;
    published_input_schema: Record<string, unknown> | null;
    published_output_schema: Record<string, unknown> | null;
};

type MenuConfigRow = { id: string; value: string };

type WorkflowReferences = {
    luaModuleIds: Set<string>;
    tools: Array<{ mcpServerId: string; toolName: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
    if (isRecord(value)) return value;
    if (typeof value !== "string") return undefined;
    try {
        const parsed = JSON.parse(value) as unknown;
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function extractReferences(schema: unknown): WorkflowReferences {
    const references: WorkflowReferences = { luaModuleIds: new Set(), tools: [] };
    const seen = new Set<object>();

    const visit = (value: unknown): void => {
        if (!value || typeof value !== "object" || seen.has(value)) return;
        seen.add(value);

        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }

        const node = value as Record<string, unknown>;
        const data = isRecord(node.data) ? node.data : undefined;
        if (typeof data?.luaModuleId === "string" && data.luaModuleId) {
            references.luaModuleIds.add(data.luaModuleId);
        }
        if (
            node.type === "mcp" &&
            typeof data?.mcpServerId === "string" &&
            data.mcpServerId &&
            typeof data.toolName === "string" &&
            data.toolName
        ) {
            references.tools.push({
                mcpServerId: data.mcpServerId,
                toolName: data.toolName,
            });
        }

        Object.values(node).forEach(visit);
    };

    visit(schema);
    return references;
}

/**
 * 26.5.3 — 编程工程：一个工程当前承载一个主流程，并归属 Lua、仿真运行和工具许可。
 */
export class Migration1787097600000 implements MigrationInterface {
    name = "Migration1787097600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "programming_project" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" varchar(100) NOT NULL,
                "description" text,
                "main_workflow_id" uuid,
                "runtime_target" varchar(16) NOT NULL DEFAULT 'local',
                "simulator_session_id" uuid,
                "device_id" varchar(36),
                "is_published" boolean NOT NULL DEFAULT false,
                "published_at" TIMESTAMP WITH TIME ZONE,
                "published_snapshot" jsonb,
                "create_by" varchar(255) NOT NULL,
                CONSTRAINT "PK_programming_project" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_programming_project_create_by_updated_at"
            ON "programming_project" ("create_by", "updated_at")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_programming_project_main_workflow_id"
            ON "programming_project" ("main_workflow_id")
            WHERE "main_workflow_id" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "programming_project_tool" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "mcp_server_id" varchar(255) NOT NULL,
                "tool_name" varchar(255) NOT NULL,
                CONSTRAINT "PK_programming_project_tool" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_programming_project_tool_unique"
            ON "programming_project_tool" ("project_id", "mcp_server_id", "tool_name")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_programming_project_tool_project_id"
            ON "programming_project_tool" ("project_id")
        `);

        await queryRunner.query(`
            ALTER TABLE "ai_workflow"
                ADD COLUMN IF NOT EXISTS "project_id" uuid,
                ADD COLUMN IF NOT EXISTS "is_main" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "published_schema" jsonb
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ai_workflow_project_main"
            ON "ai_workflow" ("project_id", "is_main")
        `);
        await queryRunner.query(`
            ALTER TABLE "lua_module"
                ADD COLUMN IF NOT EXISTS "project_id" uuid
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_lua_module_project_updated"
            ON "lua_module" ("project_id", "updated_at")
        `);
        await queryRunner.query(`
            ALTER TABLE "lua_device_run"
                ADD COLUMN IF NOT EXISTS "project_id" uuid
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_lua_device_run_project_created"
            ON "lua_device_run" ("project_id", "created_at")
        `);

        // PageSeeder keeps existing menu values by id. Update the persisted row here as well,
        // otherwise installations upgraded from an older version would keep three top-level
        // entries even though the seed file has moved to the project workspace.
        const menuRows = (await queryRunner.query(
            `SELECT id, value FROM "config" WHERE "key" = 'menu-config' AND "group" = 'decorate' LIMIT 1`,
        )) as MenuConfigRow[];
        const menuRow = menuRows[0];
        if (menuRow) {
            try {
                const config = JSON.parse(menuRow.value) as {
                    menus?: Array<Record<string, unknown>>;
                };
                if (Array.isArray(config.menus)) {
                    const menus: Array<Record<string, unknown>> = [];
                    let hasProgramming = false;
                    for (const item of config.menus) {
                        const id = item.id;
                        if (id === "menu_lua" || id === "menu_simulator") continue;
                        if (id === "menu_workflows") {
                            hasProgramming = true;
                            menus.push({
                                ...item,
                                icon: "code-2",
                                title: "编程",
                                link: {
                                    ...(typeof item.link === "object" && item.link
                                        ? item.link
                                        : {}),
                                    label: "编程",
                                    path: "/programming",
                                    component: "/src/pages/programming/index.tsx",
                                },
                            });
                            continue;
                        }
                        menus.push(item);
                    }
                    if (!hasProgramming) {
                        menus.push({
                            id: "menu_workflows",
                            icon: "code-2",
                            title: "编程",
                            link: {
                                label: "编程",
                                path: "/programming",
                                type: "system",
                                query: {},
                                component: "/src/pages/programming/index.tsx",
                                target: "_self",
                            },
                        });
                    }
                    await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                        menuRow.id,
                        JSON.stringify({ ...config, menus }),
                    ]);
                }
            } catch {
                // A malformed custom menu should not prevent the schema migration. The seed
                // process will report and repair it on the next startup.
            }
        }

        await queryRunner.query(`
            UPDATE "ai_workflow"
            SET "published_schema" = "schema"
            WHERE "is_published" = true AND "published_schema" IS NULL
        `);

        const workflows = (await queryRunner.query(
            `SELECT id, name, description, schema, published_schema, is_published, published_at, create_by
             FROM "ai_workflow"`,
        )) as LegacyWorkflowRow[];

        for (const workflow of workflows) {
            const schema = parseJson(workflow.schema) ?? {};
            await queryRunner.query(
                `
                    INSERT INTO "programming_project" (
                        "id", "name", "description", "main_workflow_id", "create_by",
                        "is_published", "published_at", "created_at", "updated_at"
                    )
                    SELECT $1, $2, $3, $1, $4, $5, $6, now(), now()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "programming_project" WHERE "main_workflow_id" = $1
                    )
                `,
                [
                    workflow.id,
                    workflow.name,
                    workflow.description,
                    workflow.create_by,
                    workflow.is_published,
                    workflow.published_at,
                ],
            );
            await queryRunner.query(
                `UPDATE "ai_workflow" SET "project_id" = $1, "is_main" = true WHERE "id" = $1`,
                [workflow.id],
            );

            // Old published workflows retain a real immutable flow snapshot. Lua references are
            // completed below after their single-project ownership can be determined.
            if (workflow.is_published) {
                const publishedSchema = parseJson(workflow.published_schema) ?? schema;
                await queryRunner.query(
                    `
                        UPDATE "programming_project"
                        SET "published_snapshot" = $2::jsonb
                        WHERE "id" = $1 AND "published_snapshot" IS NULL
                    `,
                    [
                        workflow.id,
                        JSON.stringify({
                            version: 1,
                            workflow: {
                                id: workflow.id,
                                name: workflow.name,
                                schema: publishedSchema,
                            },
                            luaModules: [],
                            tools: extractReferences(publishedSchema).tools,
                            runtime: { target: "local" },
                            publishedAt: new Date(
                                workflow.published_at ?? Date.now(),
                            ).toISOString(),
                        }),
                    ],
                );
            }
        }

        const referenceOwners = new Map<string, Set<string>>();
        for (const workflow of workflows) {
            const references = extractReferences(parseJson(workflow.schema));
            for (const moduleId of references.luaModuleIds) {
                const projects = referenceOwners.get(moduleId) ?? new Set<string>();
                projects.add(workflow.id);
                referenceOwners.set(moduleId, projects);
            }
        }

        for (const [moduleId, projectIds] of referenceOwners) {
            if (projectIds.size !== 1) continue;
            await queryRunner.query(
                `UPDATE "lua_module" SET "project_id" = $2 WHERE "id" = $1 AND "project_id" IS NULL`,
                [moduleId, [...projectIds][0]],
            );
        }

        const luaModules = (await queryRunner.query(
            `SELECT id, name, draft_code, published_code, input_schema, output_schema,
                    published_input_schema, published_output_schema
             FROM "lua_module"`,
        )) as LegacyLuaRow[];
        const modulesById = new Map(luaModules.map((module) => [module.id, module]));

        for (const workflow of workflows.filter((item) => item.is_published)) {
            const publishedSchema =
                parseJson(workflow.published_schema) ?? parseJson(workflow.schema) ?? {};
            const references = extractReferences(publishedSchema);
            const snapshotModules = [...references.luaModuleIds].flatMap((moduleId) => {
                const module = modulesById.get(moduleId);
                if (!module) return [];
                return [
                    {
                        id: module.id,
                        name: module.name,
                        code: module.published_code ?? module.draft_code,
                        inputSchema: module.published_input_schema ?? module.input_schema,
                        outputSchema: module.published_output_schema ?? module.output_schema,
                    },
                ];
            });
            const dedupedTools = references.tools.filter(
                (tool, index, all) =>
                    all.findIndex(
                        (candidate) =>
                            candidate.mcpServerId === tool.mcpServerId &&
                            candidate.toolName === tool.toolName,
                    ) === index,
            );
            await queryRunner.query(
                `UPDATE "programming_project" SET "published_snapshot" = $2::jsonb WHERE "id" = $1`,
                [
                    workflow.id,
                    JSON.stringify({
                        version: 1,
                        workflow: { id: workflow.id, name: workflow.name, schema: publishedSchema },
                        luaModules: snapshotModules,
                        tools: dedupedTools,
                        runtime: { target: "local" },
                        publishedAt: new Date(workflow.published_at ?? Date.now()).toISOString(),
                    }),
                ],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const menuRows = (await queryRunner.query(
            `SELECT id, value FROM "config" WHERE "key" = 'menu-config' AND "group" = 'decorate' LIMIT 1`,
        )) as MenuConfigRow[];
        const menuRow = menuRows[0];
        if (menuRow) {
            try {
                const config = JSON.parse(menuRow.value) as {
                    menus?: Array<Record<string, unknown>>;
                };
                if (Array.isArray(config.menus)) {
                    const menus = config.menus.map((item) =>
                        item.id === "menu_workflows"
                            ? {
                                  ...item,
                                  icon: "git-branch",
                                  title: "工作流",
                                  link: {
                                      ...(typeof item.link === "object" && item.link
                                          ? item.link
                                          : {}),
                                      label: "工作流",
                                      path: "/workflows",
                                      component: "/src/pages/workflows/index.tsx",
                                  },
                              }
                            : item,
                    );
                    await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                        menuRow.id,
                        JSON.stringify({ ...config, menus }),
                    ]);
                }
            } catch {
                // Ignore malformed custom menus during rollback.
            }
        }
        await queryRunner.query(`ALTER TABLE "lua_device_run" DROP COLUMN IF EXISTS "project_id"`);
        await queryRunner.query(`ALTER TABLE "lua_module" DROP COLUMN IF EXISTS "project_id"`);
        await queryRunner.query(`
            ALTER TABLE "ai_workflow"
                DROP COLUMN IF EXISTS "published_schema",
                DROP COLUMN IF EXISTS "is_main",
                DROP COLUMN IF EXISTS "project_id"
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS "programming_project_tool"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "programming_project"`);
    }
}
