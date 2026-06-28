import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1782691200000 implements MigrationInterface {
    name = "Migration1782691200000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_workflow" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "schema" jsonb,
        "create_by" varchar(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_workflow" PRIMARY KEY ("id")
      )
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "ai_workflow"`);
    }
}
