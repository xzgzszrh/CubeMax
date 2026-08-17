import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "ai_workflow", comment: "工作流" })
@Index(["projectId", "isMain"])
export class AiWorkflow extends BaseEntity {
    @Column({ length: 255, comment: "名称" })
    name: string;

    @Column({ type: "text", nullable: true, comment: "描述" })
    description?: string;

    @Column({ type: "jsonb", nullable: true, comment: "流程图JSON" })
    schema?: object;

    @Column({ name: "published_schema", type: "jsonb", nullable: true, comment: "发布流程快照" })
    publishedSchema?: object | null;

    @Column({ name: "project_id", type: "uuid", nullable: true, comment: "所属编程工程" })
    projectId?: string | null;

    @Column({ name: "is_main", type: "boolean", default: false, comment: "是否工程主流程" })
    isMain: boolean;

    @Column({ type: "boolean", default: false, comment: "是否处于发布状态" })
    isPublished: boolean;

    @Column({ type: "timestamptz", nullable: true, comment: "最近发布时间" })
    publishedAt?: Date | null;

    @Column({ length: 255, comment: "创建者ID" })
    createBy: string;
}
