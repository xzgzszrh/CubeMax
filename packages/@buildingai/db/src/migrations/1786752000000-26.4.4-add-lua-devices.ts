import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1786752000000 implements MigrationInterface {
    name = "Migration1786752000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lua_physical_device" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "device_id" varchar(36) NOT NULL,
                "display_name" varchar(100) NOT NULL,
                "create_by" varchar(255) NOT NULL,
                "key_id" varchar(16) NOT NULL DEFAULT 'v1',
                "secret_ciphertext" text NOT NULL,
                "firmware_version" varchar(32),
                "boot_id" varchar(36),
                "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "limits" jsonb,
                "runtime" jsonb,
                "last_seen_at" TIMESTAMP WITH TIME ZONE,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_lua_physical_device" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_daa8a84a1f85111f6b3df7ee6e"
            ON "lua_physical_device" ("device_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_6520bd35b25b17a0cda2b503cd"
            ON "lua_physical_device" ("create_by", "display_name")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lua_device_connection" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "connection_id" uuid NOT NULL,
                "device_id" varchar(36) NOT NULL,
                "boot_id" varchar(36) NOT NULL,
                "remote_address" varchar(100),
                "connected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "disconnected_at" TIMESTAMP WITH TIME ZONE,
                "close_code" integer,
                CONSTRAINT "PK_lua_device_connection" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_45b56cb401e56b259ce7e2a83b"
            ON "lua_device_connection" ("connection_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_d9d54ef015baf70e350c1600d6"
            ON "lua_device_connection" ("device_id", "connected_at")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lua_device_run" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "device_id" varchar(36) NOT NULL,
                "create_by" varchar(255) NOT NULL,
                "module_id" uuid,
                "name" varchar(100) NOT NULL,
                "source" text NOT NULL,
                "source_sha256" char(64) NOT NULL,
                "params" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "params_json" text NOT NULL,
                "params_sha256" char(64) NOT NULL,
                "required_capabilities" jsonb NOT NULL DEFAULT '["lua"]'::jsonb,
                "status" varchar(32) NOT NULL DEFAULT 'queued',
                "timeout_ms" integer NOT NULL,
                "chunk_bytes" integer NOT NULL DEFAULT 1024,
                "next_chunk_index" integer NOT NULL DEFAULT 0,
                "result" jsonb,
                "error" jsonb,
                "started_at" TIMESTAMP WITH TIME ZONE,
                "finished_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_lua_device_run" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_e94d7e8d8ade2a5dc54e61ddd0"
            ON "lua_device_run" ("device_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_9ecaeb04ef8be65a18093907df"
            ON "lua_device_run" ("create_by", "created_at")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lua_device_run_log" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "run_id" uuid NOT NULL,
                "sequence" integer NOT NULL,
                "level" varchar(8) NOT NULL,
                "text" varchar(1024) NOT NULL,
                CONSTRAINT "PK_lua_device_run_log" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fbb7707a744ca7edd155f4ce05"
            ON "lua_device_run_log" ("run_id", "sequence")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "lua_device_run_log"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "lua_device_run"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "lua_device_connection"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "lua_physical_device"`);
    }
}
