import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1786924800000 implements MigrationInterface {
    name = "Migration1786924800000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "public"."IDX_6520bd35b25b17a0cda2b503cd"`,
        );
        await queryRunner.query(`ALTER TABLE "lua_physical_device" DROP COLUMN IF EXISTS "key_id"`);
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" DROP COLUMN IF EXISTS "secret_ciphertext"`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" DROP COLUMN IF EXISTS "create_by"`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" DROP COLUMN IF EXISTS "revoked_at"`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_lua_physical_device_display_name" ON "lua_physical_device" ("display_name")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "public"."IDX_lua_physical_device_display_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" ADD COLUMN IF NOT EXISTS "create_by" varchar(255) NOT NULL DEFAULT 'system'`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" ADD COLUMN IF NOT EXISTS "key_id" varchar(16) NOT NULL DEFAULT 'v1'`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" ADD COLUMN IF NOT EXISTS "secret_ciphertext" text NOT NULL DEFAULT ''`,
        );
        await queryRunner.query(
            `ALTER TABLE "lua_physical_device" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP WITH TIME ZONE`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_6520bd35b25b17a0cda2b503cd" ON "lua_physical_device" ("create_by", "display_name")`,
        );
    }
}
