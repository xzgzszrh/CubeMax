import { MigrationInterface, QueryRunner } from "typeorm";

type MenuConfigRow = { id: string; value: string };

const SMART_HOME_MENU = {
    id: "menu_smart-home",
    icon: "house-plug",
    title: "智能家居",
    link: {
        label: "智能家居",
        path: "/smart-home",
        type: "system",
        query: {},
        component: "/src/pages/smart-home/index.tsx",
        target: "_self",
    },
};

/**
 * 26.5.5 - Xiaomi Home OAuth accounts, MIoT device snapshots and short-lived OAuth sessions.
 */
export class Migration1787200000000 implements MigrationInterface {
    name = "Migration1787200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaomi_home_account" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "owner_user_id" uuid NOT NULL,
                "label" varchar(80) NOT NULL DEFAULT '小米账号',
                "cloud_server" varchar(8) NOT NULL DEFAULT 'cn',
                "upstream_user_id" varchar(64),
                "nickname" varchar(120),
                "oauth_device_id" varchar(100) NOT NULL,
                "oauth_redirect_uri" text NOT NULL,
                "access_token_encrypted" text NOT NULL,
                "refresh_token_encrypted" text NOT NULL,
                "access_token_expires_at" TIMESTAMP WITH TIME ZONE,
                "status" varchar(16) NOT NULL DEFAULT 'active',
                "homes" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "last_sync_at" TIMESTAMP WITH TIME ZONE,
                "last_error" text,
                CONSTRAINT "PK_xiaomi_home_account" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaomi_home_account_owner_upstream_server"
                    UNIQUE ("owner_user_id", "upstream_user_id", "cloud_server")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_account_owner"
            ON "xiaomi_home_account" ("owner_user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_account_upstream_user"
            ON "xiaomi_home_account" ("upstream_user_id")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaomi_home_oauth_session" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "owner_user_id" uuid NOT NULL,
                "cloud_server" varchar(8) NOT NULL DEFAULT 'cn',
                "device_id" varchar(100) NOT NULL,
                "redirect_uri" text NOT NULL,
                "frontend_origin" varchar(300) NOT NULL,
                "state_hash" text NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "consumed_at" TIMESTAMP WITH TIME ZONE,
                "account_id" uuid,
                CONSTRAINT "PK_xiaomi_home_oauth_session" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaomi_home_oauth_session_state_hash" UNIQUE ("state_hash")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_oauth_session_owner_expires"
            ON "xiaomi_home_oauth_session" ("owner_user_id", "expires_at")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaomi_home_device" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "account_id" uuid NOT NULL,
                "did" varchar(255) NOT NULL,
                "uid" varchar(64),
                "home_id" varchar(80),
                "home_name" varchar(120),
                "room_id" varchar(80),
                "room_name" varchar(120),
                "name" varchar(160) NOT NULL,
                "model" varchar(160),
                "urn" text,
                "manufacturer" varchar(80),
                "icon" text,
                "category" varchar(32) NOT NULL DEFAULT 'other',
                "online" boolean NOT NULL DEFAULT false,
                "connect_type" integer,
                "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "state" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "last_state_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_xiaomi_home_device" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaomi_home_device_account_did" UNIQUE ("account_id", "did")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_device_account_home"
            ON "xiaomi_home_device" ("account_id", "home_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_device_account_room"
            ON "xiaomi_home_device" ("account_id", "room_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaomi_home_device_account_category"
            ON "xiaomi_home_device" ("account_id", "category")
        `);

        const menuRows = (await queryRunner.query(
            `SELECT id, value FROM "config" WHERE "key" = 'menu-config' AND "group" = 'decorate' LIMIT 1`,
        )) as MenuConfigRow[];
        const menuRow = menuRows[0];
        if (menuRow) {
            try {
                const config = JSON.parse(menuRow.value) as {
                    menus?: Array<Record<string, unknown>>;
                };
                if (
                    Array.isArray(config.menus) &&
                    !config.menus.some((item) => item.id === SMART_HOME_MENU.id)
                ) {
                    const menus = [...config.menus];
                    const programmingIndex = menus.findIndex(
                        (item) => item.id === "menu_workflows",
                    );
                    menus.splice(
                        programmingIndex >= 0 ? programmingIndex + 1 : menus.length,
                        0,
                        SMART_HOME_MENU,
                    );
                    await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                        menuRow.id,
                        JSON.stringify({ ...config, menus }),
                    ]);
                }
            } catch {
                // A customized malformed menu must not block the schema migration.
            }
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
                    const menus = config.menus.filter((item) => item.id !== SMART_HOME_MENU.id);
                    await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                        menuRow.id,
                        JSON.stringify({ ...config, menus }),
                    ]);
                }
            } catch {
                // Ignore malformed customized menus during rollback.
            }
        }
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaomi_home_device"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaomi_home_oauth_session"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaomi_home_account"`);
    }
}
