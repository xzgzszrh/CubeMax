import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1784937600000 implements MigrationInterface {
    name = "Migration1784937600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS "has_personal_workspace" boolean NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "organization" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "name" varchar(80) NOT NULL,
                "code" varchar(20) NOT NULL,
                "owner_id" uuid NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_organization" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_organization_code" UNIQUE ("code"),
                CONSTRAINT "FK_organization_owner" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organization_owner" ON "organization" ("owner_id")`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "organization_member" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "roles" jsonb NOT NULL DEFAULT '["student"]'::jsonb,
                "member_type" varchar(16) NOT NULL DEFAULT 'invited',
                "can_leave" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_organization_member" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_organization_member_org_user" UNIQUE ("organization_id", "user_id"),
                CONSTRAINT "FK_organization_member_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_organization_member_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organization_member_org" ON "organization_member" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organization_member_user" ON "organization_member" ("user_id")`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_account" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "label" varchar(40) NOT NULL,
                "username_encrypted" text NOT NULL,
                "password_encrypted" text NOT NULL,
                "access_token_encrypted" text NOT NULL,
                "session_cookie_encrypted" text,
                "upstream_user_id" varchar(64),
                "status" varchar(16) NOT NULL DEFAULT 'active',
                "last_sync_at" TIMESTAMP WITH TIME ZONE,
                "last_error" text,
                CONSTRAINT "PK_xiaozhi_account" PRIMARY KEY ("id"),
                CONSTRAINT "FK_xiaozhi_account_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_account_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_account_org" ON "xiaozhi_account" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_account_owner" ON "xiaozhi_account" ("owner_user_id")`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_agent_binding" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "xiaozhi_account_id" uuid NOT NULL,
                "organization_id" uuid,
                "owner_user_id" uuid NOT NULL,
                "upstream_agent_id" bigint NOT NULL,
                "name" varchar(100) NOT NULL,
                "model" varchar(120),
                "voice" varchar(160),
                "device_count" integer NOT NULL DEFAULT 0,
                "online_device_count" integer NOT NULL DEFAULT 0,
                "last_connected_at" TIMESTAMP WITH TIME ZONE,
                "assigned_user_id" uuid,
                CONSTRAINT "PK_xiaozhi_agent_binding" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaozhi_agent_account_upstream" UNIQUE ("xiaozhi_account_id", "upstream_agent_id"),
                CONSTRAINT "FK_xiaozhi_agent_account" FOREIGN KEY ("xiaozhi_account_id") REFERENCES "xiaozhi_account"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_agent_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_agent_owner" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_xiaozhi_agent_assignee" FOREIGN KEY ("assigned_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_agent_org" ON "xiaozhi_agent_binding" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_agent_owner" ON "xiaozhi_agent_binding" ("owner_user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_agent_assignee" ON "xiaozhi_agent_binding" ("assigned_user_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_agent_binding"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_account"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "organization_member"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "organization"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "has_personal_workspace"`);
    }
}
