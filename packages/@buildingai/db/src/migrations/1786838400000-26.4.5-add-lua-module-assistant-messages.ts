import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1786838400000 implements MigrationInterface {
    name = "Migration1786838400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lua_module"
            ADD COLUMN IF NOT EXISTS "assistant_messages" jsonb NOT NULL DEFAULT '[]'::jsonb
        `);
        await queryRunner.query(`
            ALTER TABLE "lua_module"
            ADD COLUMN IF NOT EXISTS "test_params" jsonb NOT NULL DEFAULT '{}'::jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lua_module" DROP COLUMN IF EXISTS "assistant_messages"
        `);
        await queryRunner.query(`
            ALTER TABLE "lua_module" DROP COLUMN IF EXISTS "test_params"
        `);
    }
}
