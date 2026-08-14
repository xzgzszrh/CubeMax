import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Keeps the JSONB conversation column compatible with persisted chat metadata,
 * including the optional code diff attached to assistant messages.
 */
export class Migration1787011200000 implements MigrationInterface {
    name = "Migration1787011200000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Keep this repair migration safe for installations where 26.4.5 was
        // recorded but the ALTER TABLE did not reach the target database.
        await queryRunner.query(`
            ALTER TABLE "lua_module"
            ADD COLUMN IF NOT EXISTS "assistant_messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS "test_params" jsonb NOT NULL DEFAULT '{}'::jsonb
        `);
        await queryRunner.query(`
            UPDATE "lua_module"
            SET "assistant_messages" = '[]'::jsonb
            WHERE "assistant_messages" IS NULL
               OR jsonb_typeof("assistant_messages") <> 'array'
        `);
        await queryRunner.query(`
            ALTER TABLE "lua_module"
            ALTER COLUMN "assistant_messages" SET DEFAULT '[]'::jsonb,
            ALTER COLUMN "assistant_messages" SET NOT NULL
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'CHK_lua_module_assistant_messages_array'
                ) THEN
                    ALTER TABLE "lua_module"
                    ADD CONSTRAINT "CHK_lua_module_assistant_messages_array"
                    CHECK (jsonb_typeof("assistant_messages") = 'array');
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lua_module"
            DROP CONSTRAINT IF EXISTS "CHK_lua_module_assistant_messages_array"
        `);
    }
}
