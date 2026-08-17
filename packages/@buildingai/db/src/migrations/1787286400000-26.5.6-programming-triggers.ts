import { MigrationInterface, QueryRunner } from "typeorm";

type MenuConfigRow = { id: string; value: string };

const TRIGGERS_MENU = {
    id: "menu_triggers",
    icon: "zap",
    title: "触发器",
    link: {
        label: "触发器",
        path: "/triggers",
        type: "system",
        query: {},
        component: "/src/pages/triggers/index.tsx",
        target: "_self",
    },
};

/** 26.5.6 - User-owned form entry points for published programming projects. */
export class Migration1787286400000 implements MigrationInterface {
    name = "Migration1787286400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "programming_trigger" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" varchar(100) NOT NULL,
                "description" text,
                "project_id" uuid NOT NULL,
                "trigger_type" varchar(32) NOT NULL DEFAULT 'form',
                "input_schema" jsonb NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
                "is_enabled" boolean NOT NULL DEFAULT true,
                "is_pinned" boolean NOT NULL DEFAULT false,
                "home_order" integer NOT NULL DEFAULT 0,
                "create_by" varchar(255) NOT NULL,
                CONSTRAINT "PK_programming_trigger" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_programming_trigger_create_by_updated_at"
            ON "programming_trigger" ("create_by", "updated_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_programming_trigger_create_by_project"
            ON "programming_trigger" ("create_by", "project_id")
        `);

        const menuRows = (await queryRunner.query(
            `SELECT id, value FROM "config" WHERE "key" = 'menu-config' AND "group" = 'decorate' LIMIT 1`,
        )) as MenuConfigRow[];
        const menuRow = menuRows[0];
        if (!menuRow) return;

        try {
            const config = JSON.parse(menuRow.value) as {
                menus?: Array<Record<string, unknown>>;
            };
            if (!Array.isArray(config.menus)) return;
            if (config.menus.some((item) => item.id === TRIGGERS_MENU.id)) return;

            const menus = [...config.menus];
            const programmingIndex = menus.findIndex((item) => item.id === "menu_workflows");
            menus.splice(
                programmingIndex >= 0 ? programmingIndex + 1 : menus.length,
                0,
                TRIGGERS_MENU,
            );
            await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                menuRow.id,
                JSON.stringify({ ...config, menus }),
            ]);
        } catch {
            // Customized malformed menu configuration must not block this migration.
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
                    const menus = config.menus.filter((item) => item.id !== TRIGGERS_MENU.id);
                    await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                        menuRow.id,
                        JSON.stringify({ ...config, menus }),
                    ]);
                }
            } catch {
                // Ignore malformed customized menus during rollback.
            }
        }
        await queryRunner.query(`DROP TABLE IF EXISTS "programming_trigger"`);
    }
}
