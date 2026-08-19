import { MigrationInterface, QueryRunner } from "typeorm";

/** 26.5.8 - 方糖猫设备型号资料与多设备管理。 */
export class Migration1787452800000 implements MigrationInterface {
    name = "Migration1787452800000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "xiaozhi_device_profile" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "agent_binding_id" uuid NOT NULL,
                "upstream_device_id" bigint NOT NULL,
                "device_type" varchar(24) NOT NULL DEFAULT 'unknown',
                "settings" jsonb NOT NULL DEFAULT '{"volume":65,"brightness":70,"doNotDisturb":false}'::jsonb,
                CONSTRAINT "PK_xiaozhi_device_profile" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_xiaozhi_device_profile_agent_device"
                    UNIQUE ("agent_binding_id", "upstream_device_id"),
                CONSTRAINT "FK_xiaozhi_device_profile_agent"
                    FOREIGN KEY ("agent_binding_id")
                    REFERENCES "xiaozhi_agent_binding"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_xiaozhi_device_profile_agent"
            ON "xiaozhi_device_profile" ("agent_binding_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "xiaozhi_device_profile"`);
    }
}
