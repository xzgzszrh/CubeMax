import { MigrationInterface, QueryRunner } from "typeorm";

/** Prevent API instances with different Xiaozhi keys from sharing one database. */
export class Migration1787452800001 implements MigrationInterface {
    name = "Migration1787452800001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_encryption_key_guard" (
                "id" smallint PRIMARY KEY CHECK ("id" = 1),
                "fingerprint" varchar(64) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_encryption_key_guard"`);
    }
}
