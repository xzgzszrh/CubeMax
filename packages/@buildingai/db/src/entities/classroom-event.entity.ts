import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

@AppEntity({ name: "classroom_event", comment: "课堂任务完成事件（MCP 网关或手动测试写入）" })
export class ClassroomEvent extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属课堂活动ID" })
    interactionId: string;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "上报事件的智能体绑定ID，绑定移除后置空" })
    agentBindingId: string | null;

    @Column({ length: 100, comment: "智能体名称快照" })
    agentName: string;

    @Column({ length: 120, default: "", comment: "任务标识，由 MCP 工具调用方传入" })
    taskKey: string;

    @Column({ length: 300, default: "", comment: "完成情况摘要" })
    summary: string;

    @Column({ type: "double precision", nullable: true, comment: "得分，可空" })
    score: number | null;

    @Index()
    @Column({ type: "timestamptz", default: () => "now()", comment: "事件发生时间" })
    occurredAt: Date;
}
