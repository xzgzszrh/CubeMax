import { MigrationInterface, QueryRunner } from "typeorm";

/** 26.5.12 — Application projects default to hardware simulation, not local. */
export class Migration1787800000000 implements MigrationInterface {
    name = "Migration1787800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "programming_project"
            SET "runtime_target" = 'simulator'
            WHERE "project_type" = 'application'
              AND "runtime_target" = 'local'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "programming_project"
            SET "runtime_target" = 'local'
            WHERE "project_type" = 'application'
              AND "runtime_target" = 'simulator'
              AND "simulator_session_id" IS NULL
        `);
    }
}
