import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1785283200000 implements MigrationInterface {
    name = "Migration1785283200000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lua_module" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar(100) NOT NULL,
                "description" text,
                "draft_code" text NOT NULL,
                "published_code" text,
                "input_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "output_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "published_input_schema" jsonb,
                "published_output_schema" jsonb,
                "is_published" boolean NOT NULL DEFAULT false,
                "published_at" TIMESTAMP WITH TIME ZONE,
                "create_by" varchar(255) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lua_module" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_lua_module_create_by_name"
            ON "lua_module" ("create_by", "name")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "lua_module"`);
    }
}
