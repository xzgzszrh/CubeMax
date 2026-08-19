import { DataSource } from "typeorm";

export async function up(dataSource: DataSource): Promise<void> {
    await dataSource.query(
        `UPDATE "extension"
         SET "config" = jsonb_set(
             COALESCE("config", '{}'::jsonb),
             '{applicationViews}',
             $2::jsonb,
             true
         )
         WHERE "identifier" = $1`,
        [
            "safe-cracker",
            JSON.stringify({ teacher: "", student: "student", board: "board" }),
        ],
    );
}
