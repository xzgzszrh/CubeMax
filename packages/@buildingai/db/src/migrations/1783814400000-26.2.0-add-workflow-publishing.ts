import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1783814400000 implements MigrationInterface {
    name = "Migration1783814400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ai_workflow"
                ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ai_workflow"
                DROP COLUMN IF EXISTS "published_at",
                DROP COLUMN IF EXISTS "is_published"
        `);
    }
}
