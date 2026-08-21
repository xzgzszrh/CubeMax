import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.5.10 — Repair schema drift left by older generated migrations:
 *
 * 1. `user_subscription` was never CREATE TABLE'd in 25.1.0 (the generator ran
 *    against a synchronized database). Create the table and current constraints
 *    if they are still missing.
 * 2. Drop leftover tables/columns whose entities were removed without a DROP
 *    in any later migration (`decorate_page`, `decorate_micropage`,
 *    `menus.pluginPackName`, `permissions.plugin_pack_name`).
 */
export class Migration1787625600000 implements MigrationInterface {
    name = "Migration1787625600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_subscription" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "level_id" uuid NOT NULL,
                "order_id" uuid,
                "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
                "end_time" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_user_subscription" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "user_subscription"
                ADD COLUMN IF NOT EXISTS "user_id" uuid,
                ADD COLUMN IF NOT EXISTS "level_id" uuid,
                ADD COLUMN IF NOT EXISTS "order_id" uuid,
                ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMP WITH TIME ZONE
        `);
        await queryRunner.query(
            `ALTER TABLE "user_subscription" DROP COLUMN IF EXISTS "source"`,
        );
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'user_subscription'
                      AND column_name = 'level_id'
                      AND is_nullable = 'YES'
                ) AND NOT EXISTS (
                    SELECT 1 FROM "user_subscription" WHERE "level_id" IS NULL
                ) THEN
                    ALTER TABLE "user_subscription" ALTER COLUMN "level_id" SET NOT NULL;
                END IF;
            END $$
        `);
        await queryRunner.query(`COMMENT ON TABLE "user_subscription" IS '用户订阅'`);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ec4e57f4138e339fb111948a16"
            ON "user_subscription" ("id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_3c6b79d14e6539ddb486aab80f"
            ON "user_subscription" ("user_id")
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'UQ_user_subscription_user_level'
                ) THEN
                    ALTER TABLE "user_subscription"
                        ADD CONSTRAINT "UQ_user_subscription_user_level" UNIQUE ("user_id", "level_id");
                END IF;
            END $$
        `);
        await this.addForeignKeyIfMissing(
            queryRunner,
            "FK_3c6b79d14e6539ddb486aab80f5",
            `"user_subscription" ADD CONSTRAINT "FK_3c6b79d14e6539ddb486aab80f5" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
            ["user_subscription", "user"],
        );
        await this.addForeignKeyIfMissing(
            queryRunner,
            "FK_273c32785b2e09ccdd2649068fd",
            `"user_subscription" ADD CONSTRAINT "FK_273c32785b2e09ccdd2649068fd" FOREIGN KEY ("level_id") REFERENCES "membership_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
            ["user_subscription", "membership_levels"],
        );
        await this.addForeignKeyIfMissing(
            queryRunner,
            "FK_353a0e40480ecd1b1edc9e892f9",
            `"user_subscription" ADD CONSTRAINT "FK_353a0e40480ecd1b1edc9e892f9" FOREIGN KEY ("order_id") REFERENCES "membership_order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
            ["user_subscription", "membership_order"],
        );

        await queryRunner.query(
            `ALTER TABLE "menus" DROP COLUMN IF EXISTS "pluginPackName"`,
        );
        await queryRunner.query(
            `ALTER TABLE "menus" DROP COLUMN IF EXISTS "plugin_pack_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "permissions" DROP COLUMN IF EXISTS "plugin_pack_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "permissions" DROP COLUMN IF EXISTS "pluginPackName"`,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS "decorate_micropage"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "decorate_page"`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Repair only. Do not drop user_subscription (it may hold live membership
        // data) or recreate the leftover decorate/plugin columns.
    }

    private async addForeignKeyIfMissing(
        queryRunner: QueryRunner,
        constraintName: string,
        alterClause: string,
        requiredTables: string[],
    ): Promise<void> {
        const tableChecks = requiredTables
            .map((table) => `to_regclass('public.${table}') IS NOT NULL`)
            .join(" AND ");
        await queryRunner.query(`
            DO $$ BEGIN
                IF ${tableChecks}
                   AND NOT EXISTS (
                       SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}'
                   )
                THEN
                    ALTER TABLE ${alterClause};
                END IF;
            END $$
        `);
    }
}
