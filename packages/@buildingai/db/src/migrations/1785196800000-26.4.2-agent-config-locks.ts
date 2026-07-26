import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.4.2 — per-field config locks: teachers can lock individual role-config
 * options so assigned students cannot change them.
 */
export class Migration1785196800000 implements MigrationInterface {
    name = "Migration1785196800000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "xiaozhi_agent_binding"
            ADD COLUMN IF NOT EXISTS "locked_config_keys" jsonb NOT NULL DEFAULT '[]'::jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "xiaozhi_agent_binding" DROP COLUMN IF EXISTS "locked_config_keys"`,
        );
    }
}
