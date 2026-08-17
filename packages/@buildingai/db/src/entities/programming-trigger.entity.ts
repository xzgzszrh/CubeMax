import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";

import { BaseEntity } from "./base";

export const ProgrammingTriggerType = {
    FORM: "form",
} as const;

export type ProgrammingTriggerTypeValue =
    (typeof ProgrammingTriggerType)[keyof typeof ProgrammingTriggerType];

/** A user-owned entry point for running a published programming project. */
@AppEntity({ name: "programming_trigger", comment: "编程触发器" })
@Index(["createBy", "updatedAt"])
@Index(["createBy", "projectId"])
export class ProgrammingTrigger extends BaseEntity {
    @Column({ length: 100, comment: "触发器名称" })
    name: string;

    @Column({ type: "text", nullable: true, comment: "触发器说明" })
    description?: string | null;

    @Column({ name: "project_id", type: "uuid", comment: "绑定的编程工程" })
    projectId: string;

    @Column({
        name: "trigger_type",
        type: "varchar",
        length: 32,
        default: ProgrammingTriggerType.FORM,
        comment: "触发方式",
    })
    triggerType: ProgrammingTriggerTypeValue;

    @Column({ name: "input_schema", type: "jsonb", comment: "触发器输入表单 schema" })
    inputSchema: Record<string, unknown>;

    @Column({ name: "is_enabled", type: "boolean", default: true, comment: "是否启用" })
    isEnabled: boolean;

    @Column({ name: "is_pinned", type: "boolean", default: false, comment: "是否显示在首页" })
    isPinned: boolean;

    @Column({ name: "home_order", type: "integer", default: 0, comment: "首页排序" })
    homeOrder: number;

    @Column({ name: "create_by", type: "varchar", length: 255, comment: "创建人" })
    createBy: string;
}
