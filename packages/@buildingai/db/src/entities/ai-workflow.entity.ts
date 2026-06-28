import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "ai_workflow", comment: "工作流" })
export class AiWorkflow extends BaseEntity {
    @Column({ length: 255, comment: "名称" })
    name: string;

    @Column({ type: "text", nullable: true, comment: "描述" })
    description?: string;

    @Column({ type: "jsonb", nullable: true, comment: "流程图JSON" })
    schema?: object;

    @Column({ length: 255, comment: "创建者ID" })
    createBy: string;
}
