import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 26.5.1 — 作业生效范围：老师可以把一份作业只指派给部分学生。
 * 空数组表示全班，存量作业沿用原有的整班可见行为。
 */
export class Migration1785369600000 implements MigrationInterface {
    name = "Migration1785369600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "organization_assignment"
            ADD COLUMN IF NOT EXISTS "target_user_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "organization_assignment" DROP COLUMN IF EXISTS "target_user_ids"`,
        );
    }
}
