import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.4.1 — allow binding a BuildingAI agent to a xiaozhi agent so its role
 * prompt drives the device's custom character.
 */
export class Migration1785110400000 implements MigrationInterface {
    name = "Migration1785110400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "xiaozhi_agent_binding"
            ADD COLUMN IF NOT EXISTS "linked_agent_id" uuid
        `);
        await queryRunner.query(`
            ALTER TABLE "xiaozhi_agent_binding"
            ADD COLUMN IF NOT EXISTS "linked_agent_name" varchar(255)
        `);
        await queryRunner.query(`
            ALTER TABLE "xiaozhi_agent_binding"
            ADD COLUMN IF NOT EXISTS "linked_agent_synced_at" TIMESTAMP WITH TIME ZONE
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_xiaozhi_agent_binding_linked_agent'
                ) THEN
                    ALTER TABLE "xiaozhi_agent_binding"
                    ADD CONSTRAINT "FK_xiaozhi_agent_binding_linked_agent"
                    FOREIGN KEY ("linked_agent_id") REFERENCES "ai_agent"("id") ON DELETE SET NULL;
                END IF;
            END $$
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "xiaozhi_agent_binding" DROP CONSTRAINT IF EXISTS "FK_xiaozhi_agent_binding_linked_agent"`,
        );
        await queryRunner.query(
            `ALTER TABLE "xiaozhi_agent_binding" DROP COLUMN IF EXISTS "linked_agent_synced_at"`,
        );
        await queryRunner.query(
            `ALTER TABLE "xiaozhi_agent_binding" DROP COLUMN IF EXISTS "linked_agent_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "xiaozhi_agent_binding" DROP COLUMN IF EXISTS "linked_agent_id"`,
        );
    }
}
