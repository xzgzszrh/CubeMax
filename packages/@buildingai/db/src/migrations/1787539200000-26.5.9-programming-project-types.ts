import { MigrationInterface, QueryRunner } from "typeorm";

/** 26.5.9 - Keep legacy projects as conversation flows and distinguish app projects. */
export class Migration1787539200000 implements MigrationInterface {
    name = "Migration1787539200000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "programming_project"
                ADD COLUMN IF NOT EXISTS "project_type" varchar(20) NOT NULL DEFAULT 'conversation'
        `);
        // Existing rows came from the original text-first workflow. The default above is
        // intentionally explicit so old projects are visible as 对话流 after upgrading.
        await queryRunner.query(`
            UPDATE "programming_project"
            SET "project_type" = 'conversation'
            WHERE "project_type" IS NULL
               OR "project_type" NOT IN ('conversation', 'application')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "programming_project"
                DROP COLUMN IF EXISTS "project_type"
        `);
    }
}
