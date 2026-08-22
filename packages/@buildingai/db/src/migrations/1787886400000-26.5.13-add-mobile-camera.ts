import { MigrationInterface, QueryRunner } from "typeorm";

/** 26.5.13 — Mobile camera sessions, captures, and iOS installation registry. */
export class Migration1787886400000 implements MigrationInterface {
    name = "Migration1787886400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "mobile_installation" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "installation_id" varchar(36) NOT NULL,
                "platform" varchar(16) NOT NULL DEFAULT 'ios',
                "app_version" varchar(32),
                "os_version" varchar(32),
                "device_model" varchar(64),
                "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "last_seen_at" TIMESTAMP WITH TIME ZONE,
                "superseded_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_mobile_installation" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_mobile_installation_user_installation"
                    UNIQUE ("user_id", "installation_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_mobile_installation_installation_id"
            ON "mobile_installation" ("installation_id")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "mobile_connection" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "connection_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "installation_id" varchar(36) NOT NULL,
                "remote_address" varchar(100),
                "connected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "disconnected_at" TIMESTAMP WITH TIME ZONE,
                "close_code" integer,
                CONSTRAINT "PK_mobile_connection" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_mobile_connection_connection_id" UNIQUE ("connection_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_mobile_connection_user_installation"
            ON "mobile_connection" ("user_id", "installation_id")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "camera_session" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "installation_id" varchar(36) NOT NULL,
                "workflow_task_id" varchar(64) NOT NULL,
                "project_id" uuid,
                "trigger_id" uuid,
                "title" varchar(100) NOT NULL DEFAULT '',
                "node_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "status" varchar(32) NOT NULL DEFAULT 'created',
                "facing_default" varchar(8) NOT NULL DEFAULT 'back',
                "allow_switch_facing" boolean NOT NULL DEFAULT true,
                "resolution" varchar(16) NOT NULL DEFAULT '1080p',
                "jpeg_quality" double precision NOT NULL DEFAULT 0.8,
                "max_bytes" integer NOT NULL DEFAULT 2097152,
                "max_edge_px" integer NOT NULL DEFAULT 1920,
                "consent_timeout_ms" integer NOT NULL DEFAULT 60000,
                "preview_max_ms" integer NOT NULL DEFAULT 600000,
                "image_url_ttl_sec" integer NOT NULL DEFAULT 3600,
                "pending_capture_id" uuid,
                "error" jsonb,
                "started_at" TIMESTAMP WITH TIME ZONE,
                "ready_at" TIMESTAMP WITH TIME ZONE,
                "closed_at" TIMESTAMP WITH TIME ZONE,
                "consent_deadline_at" TIMESTAMP WITH TIME ZONE,
                "preview_deadline_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_camera_session" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_camera_session_task_installation"
                    UNIQUE ("workflow_task_id", "installation_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_camera_session_user_created"
            ON "camera_session" ("user_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_camera_session_installation_status"
            ON "camera_session" ("installation_id", "status")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "camera_capture" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "session_id" uuid NOT NULL,
                "node_id" varchar(64) NOT NULL,
                "status" varchar(16) NOT NULL DEFAULT 'pending',
                "file_id" uuid,
                "image_url" varchar(1024),
                "sha256" varchar(64),
                "size" integer,
                "width" integer,
                "height" integer,
                "facing" varchar(8),
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "error" jsonb,
                "command_message_id" varchar(64),
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_camera_capture" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_camera_capture_session_node"
            ON "camera_capture" ("session_id", "node_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_camera_capture_expires_at"
            ON "camera_capture" ("expires_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "camera_capture"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "camera_session"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "mobile_connection"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "mobile_installation"`);
    }
}
