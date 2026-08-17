import { Migration1787097600000 } from "./1787097600000-26.5.3-programming-projects";

/**
 * 26.5.4 — Re-run the idempotent programming-project migration for installations
 * that already recorded 26.5.3 before the programming workspace was introduced.
 */
export class Migration1787097600001 extends Migration1787097600000 {
    name = "Migration1787097600001";
}
