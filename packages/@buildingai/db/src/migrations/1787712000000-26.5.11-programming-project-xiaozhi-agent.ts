import { MigrationInterface, QueryRunner } from "typeorm";

/** 26.5.11 — Application workflows bind a CubeCat / xiaozhi agent at the project. */
export class Migration1787712000000 implements MigrationInterface {
    name = "Migration1787712000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "programming_project"
                ADD COLUMN IF NOT EXISTS "xiaozhi_agent_id" uuid
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "programming_project"
                DROP COLUMN IF EXISTS "xiaozhi_agent_id"
        `);
    }
}
