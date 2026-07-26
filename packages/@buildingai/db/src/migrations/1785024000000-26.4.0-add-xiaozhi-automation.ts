import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.4.0 — xiaozhi automation: scenes, quick commands, MCP gateway
 * connections and classroom interactions ported from the standalone console.
 */
export class Migration1785024000000 implements MigrationInterface {
    name = "Migration1785024000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_scene" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "name" varchar(60) NOT NULL,
                "description" varchar(300) NOT NULL DEFAULT '',
                "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "source_agent_id" uuid,
                "source_agent_name" varchar(100) NOT NULL DEFAULT '',
                CONSTRAINT "PK_xiaozhi_scene" PRIMARY KEY ("id"),
                CONSTRAINT "FK_xiaozhi_scene_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_scene_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_scene_org" ON "xiaozhi_scene" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_scene_owner" ON "xiaozhi_scene" ("owner_user_id")`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_quick_command" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "name" varchar(60) NOT NULL,
                "scene_id" uuid NOT NULL,
                "pinned" boolean NOT NULL DEFAULT false,
                "targets" jsonb NOT NULL DEFAULT '[]'::jsonb,
                CONSTRAINT "PK_xiaozhi_quick_command" PRIMARY KEY ("id"),
                CONSTRAINT "FK_xiaozhi_quick_command_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_quick_command_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_quick_command_scene" FOREIGN KEY ("scene_id") REFERENCES "xiaozhi_scene"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_quick_command_org" ON "xiaozhi_quick_command" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_quick_command_owner" ON "xiaozhi_quick_command" ("owner_user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_quick_command_scene" ON "xiaozhi_quick_command" ("scene_id")`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_mcp_connection" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "agent_binding_id" uuid NOT NULL,
                "agent_name" varchar(100) NOT NULL,
                "endpoint_encrypted" text NOT NULL,
                "enabled" boolean NOT NULL DEFAULT true,
                "status" varchar(16) NOT NULL DEFAULT 'connecting',
                "last_connected_at" TIMESTAMP WITH TIME ZONE,
                "last_error" text,
                CONSTRAINT "PK_xiaozhi_mcp_connection" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaozhi_mcp_connection_agent" UNIQUE ("agent_binding_id"),
                CONSTRAINT "FK_xiaozhi_mcp_connection_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_mcp_connection_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_mcp_connection_agent" FOREIGN KEY ("agent_binding_id") REFERENCES "xiaozhi_agent_binding"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_mcp_connection_org" ON "xiaozhi_mcp_connection" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_mcp_connection_owner" ON "xiaozhi_mcp_connection" ("owner_user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_mcp_connection_status" ON "xiaozhi_mcp_connection" ("status")`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_mcp_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "tool_name" varchar(64) NOT NULL DEFAULT 'classroom_report_completion',
                "tool_title" varchar(80) NOT NULL DEFAULT '报告课堂任务完成',
                "tool_description" varchar(600) NOT NULL DEFAULT '仅当学生已经完成老师要求的课堂任务时调用。调用后会通知课堂控制台，并记录完成摘要。',
                "task_key_description" varchar(300) NOT NULL DEFAULT '老师给出的任务标识；没有明确标识时可以省略',
                "summary_description" varchar(300) NOT NULL DEFAULT '学生完成内容的简短摘要',
                "score_description" varchar(300) NOT NULL DEFAULT '有明确评分依据时填写 0 到 100 的得分',
                "prompt_template" text NOT NULL DEFAULT '当用户已经完成本次课堂任务时，必须调用 MCP 工具 {tool_name}。task_key 填写老师给出的任务标识，summary 简要说明完成内容；有明确评分依据时再填写 score。只有确认任务完成后才能调用，不要提前调用或重复调用。',
                CONSTRAINT "PK_xiaozhi_mcp_settings" PRIMARY KEY ("id"),
                CONSTRAINT "FK_xiaozhi_mcp_settings_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_mcp_settings_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_mcp_settings_org" ON "xiaozhi_mcp_settings" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_mcp_settings_owner" ON "xiaozhi_mcp_settings" ("owner_user_id")`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_xiaozhi_mcp_settings_org" ON "xiaozhi_mcp_settings" ("organization_id") WHERE "organization_id" IS NOT NULL AND "deleted_at" IS NULL`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_xiaozhi_mcp_settings_personal" ON "xiaozhi_mcp_settings" ("owner_user_id") WHERE "organization_id" IS NULL AND "deleted_at" IS NULL`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "classroom_interaction" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "name" varchar(60) NOT NULL,
                "description" varchar(300) NOT NULL DEFAULT '',
                "scene_id" uuid NOT NULL,
                "targets" jsonb NOT NULL DEFAULT '[]',
                "display_config" jsonb NOT NULL DEFAULT '{}',
                "public_id" varchar(32) NOT NULL,
                "status" varchar(12) NOT NULL DEFAULT 'draft',
                "started_at" TIMESTAMP WITH TIME ZONE,
                "ended_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_classroom_interaction" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_classroom_interaction_public" UNIQUE ("public_id"),
                CONSTRAINT "FK_classroom_interaction_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_classroom_interaction_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_classroom_interaction_scene" FOREIGN KEY ("scene_id") REFERENCES "xiaozhi_scene"("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_interaction_org" ON "classroom_interaction" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_interaction_owner" ON "classroom_interaction" ("owner_user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_interaction_scene" ON "classroom_interaction" ("scene_id")`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "classroom_event" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "interaction_id" uuid NOT NULL,
                "agent_binding_id" uuid,
                "agent_name" varchar(100) NOT NULL,
                "task_key" varchar(120) NOT NULL DEFAULT '',
                "summary" varchar(300) NOT NULL DEFAULT '',
                "score" double precision,
                "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_classroom_event" PRIMARY KEY ("id"),
                CONSTRAINT "FK_classroom_event_interaction" FOREIGN KEY ("interaction_id") REFERENCES "classroom_interaction"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_classroom_event_agent" FOREIGN KEY ("agent_binding_id") REFERENCES "xiaozhi_agent_binding"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_event_interaction" ON "classroom_event" ("interaction_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_event_agent" ON "classroom_event" ("agent_binding_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_event_occurred" ON "classroom_event" ("occurred_at")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "classroom_event"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "classroom_interaction"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_mcp_settings"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_mcp_connection"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_quick_command"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_scene"`);
    }
}
