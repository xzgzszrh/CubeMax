import { MigrationInterface, QueryRunner } from "typeorm";

const SIDEBAR_SYSTEM_ITEMS = [
    {
        id: "menu_datasets_fixed",
        icon: "book-search",
        title: "知识库",
        path: "/datasets",
        component: "/src/pages/datasets/index.tsx",
    },
    {
        id: "menu_smart-home_fixed",
        icon: "house-plug",
        title: "智能家居",
        path: "/smart-home",
        component: "/src/pages/smart-home/index.tsx",
    },
    {
        id: "menu_my-assignments_fixed",
        icon: "clipboard-list",
        title: "我的任务",
        path: "/my-assignments",
        component: "/src/pages/my-assignments/index.tsx",
    },
    {
        id: "menu_triggers_fixed",
        icon: "zap",
        title: "触发器",
        path: "/triggers",
        component: "/src/pages/triggers/index.tsx",
    },
];

const SYSTEM_MENU_IDS = new Set([
    "menu_datasets",
    "menu_smart-home",
    "menu_triggers",
    "menu_my_assignments_fixed",
    "menu_my-assignments_fixed",
    "menu_datasets_fixed",
    "menu_smart-home_fixed",
    "menu_triggers_fixed",
    "menu_my-assignments",
]);

const SYSTEM_MENU_PATHS = new Set(SIDEBAR_SYSTEM_ITEMS.map((item) => item.path));

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSystemMenuItem(item: unknown): boolean {
    if (!isRecord(item)) return false;
    if (SYSTEM_MENU_IDS.has(String(item.id))) return true;
    return isRecord(item.link) && SYSTEM_MENU_PATHS.has(String(item.link.path));
}

function isSimpleBlogMenuItem(item: unknown): boolean {
    if (!isRecord(item)) return false;
    if (String(item.id).includes("simple-blog")) return true;
    return isRecord(item.link) && String(item.link.path).includes("/apps/simple-blog");
}

type MenuConfigRow = { id: string; value: string };

/** 26.5.7 - 个人应用栏、组织强制置顶与系统应用归档。 */
export class Migration1787366400000 implements MigrationInterface {
    name = "Migration1787366400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Existing installations stored app references as UUIDs. System apps
        // use stable string identifiers, so widen the column without touching
        // the existing values.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'organization_app_grant'
                      AND column_name = 'app_ref_id'
                      AND data_type = 'uuid'
                ) THEN
                    ALTER TABLE "organization_app_grant"
                        ALTER COLUMN "app_ref_id" TYPE varchar(120)
                        USING "app_ref_id"::text;
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "organization_app_grant"
            ADD COLUMN IF NOT EXISTS "sidebar_required" boolean NOT NULL DEFAULT false
        `);

        const menuRows = (await queryRunner.query(
            `SELECT id, value FROM "config" WHERE "key" = 'menu-config' AND "group" = 'decorate' LIMIT 1`,
        )) as MenuConfigRow[];
        const menuRow = menuRows[0];
        if (menuRow) {
            try {
                const config = JSON.parse(menuRow.value) as {
                    menus?: Array<Record<string, unknown>>;
                    groups?: Array<Record<string, unknown>>;
                };
                const menus = (config.menus ?? []).filter((item) => !isSystemMenuItem(item));
                const groups = Array.isArray(config.groups) ? [...config.groups] : [];
                let applicationGroup = groups.find((group) => group.id === "group_default_apps");
                if (!applicationGroup) {
                    applicationGroup = { id: "group_default_apps", title: "应用", items: [] };
                    groups.push(applicationGroup);
                }

                const groupItems = Array.isArray(applicationGroup.items)
                    ? applicationGroup.items.filter(
                          (item) =>
                              item.id !== "menu_group_extension_demo" &&
                              !isSystemMenuItem(item) &&
                              !isSimpleBlogMenuItem(item),
                      )
                    : [];
                const existingIds = new Set(groupItems.map((item) => item.id));
                for (const item of SIDEBAR_SYSTEM_ITEMS) {
                    if (existingIds.has(item.id)) continue;
                    groupItems.push({
                        id: item.id,
                        icon: item.icon,
                        title: item.title,
                        link: {
                            label: item.title,
                            path: item.path,
                            type: "system",
                            query: {},
                            component: item.component,
                            target: "_self",
                        },
                    });
                }
                applicationGroup.items = groupItems;

                await queryRunner.query(`UPDATE "config" SET "value" = $2 WHERE "id" = $1`, [
                    menuRow.id,
                    JSON.stringify({ ...config, menus, groups }),
                ]);
            } catch {
                // A customized malformed menu must not block schema changes.
            }
        }

        // Remove stale grants and the obsolete demo extension before deleting
        // its row. The schema is extension-owned and can be safely discarded.
        await queryRunner.query(`
            DELETE FROM "organization_app_grant"
            WHERE "app_type" = 'extension'
              AND "app_ref_id" IN (
                  SELECT "id"::text FROM "extension" WHERE "identifier" = 'simple-blog'
              )
        `);
        await queryRunner.query(`DROP SCHEMA IF EXISTS "simple_blog" CASCADE`);
        await queryRunner.query(`DELETE FROM "extension" WHERE "identifier" = 'simple-blog'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SCHEMA IF EXISTS "simple_blog" CASCADE`);
        await queryRunner.query(
            `ALTER TABLE "organization_app_grant" DROP COLUMN IF EXISTS "sidebar_required"`,
        );
        // System application identifiers are not UUIDs and did not exist
        // before this migration, so remove them before restoring the old type.
        await queryRunner.query(`DELETE FROM "organization_app_grant" WHERE "app_type" = 'system'`);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'organization_app_grant'
                      AND column_name = 'app_ref_id'
                      AND data_type IN ('character varying', 'text')
                ) THEN
                    ALTER TABLE "organization_app_grant"
                        ALTER COLUMN "app_ref_id" TYPE uuid
                        USING "app_ref_id"::uuid;
                END IF;
            END $$;
        `);
    }
}
