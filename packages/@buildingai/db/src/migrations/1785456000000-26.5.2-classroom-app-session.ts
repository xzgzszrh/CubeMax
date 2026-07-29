import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.5.2 — 课堂应用会话：已安装应用在一段时间内临时接管一批方糖猫。
 *
 * 会话记录接管了哪些设备、接管前的逐设备配置快照、以及会话期间的两项管控
 * （禁止学生改自己的方糖猫、隐藏内置课堂上报工具）。落库的原因见实体注释：
 * 这些状态如果只存在内存里，服务重启会让学生的设备永远停在被改写的人设上。
 */
export class Migration1785456000000 implements MigrationInterface {
    name = "Migration1785456000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "classroom_app_session" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "extension_identifier" varchar(100) NOT NULL,
                "session_key" varchar(120) NOT NULL,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "title" varchar(120) NOT NULL DEFAULT '',
                "status" varchar(16) NOT NULL DEFAULT 'active',
                "agent_binding_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "config_snapshots" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "lock_student_edits" boolean NOT NULL DEFAULT false,
                "suppress_classroom_tool" boolean NOT NULL DEFAULT false,
                "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "ended_at" TIMESTAMP WITH TIME ZONE,
                "restore_error" text,
                CONSTRAINT "PK_classroom_app_session" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_classroom_app_session_key" UNIQUE ("extension_identifier", "session_key")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_app_session_ext" ON "classroom_app_session" ("extension_identifier")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_app_session_org" ON "classroom_app_session" ("organization_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_app_session_owner" ON "classroom_app_session" ("owner_user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_classroom_app_session_status" ON "classroom_app_session" ("status")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "classroom_app_session"`);
    }
}
