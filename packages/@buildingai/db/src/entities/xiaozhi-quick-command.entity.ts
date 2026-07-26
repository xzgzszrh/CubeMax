import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export type XiaozhiQuickCommandTarget = {
    agentId: string;
    agentName: string;
};

@AppEntity({ name: "xiaozhi_quick_command", comment: "方糖猫快捷指令（场景+目标智能体组合）" })
export class XiaozhiQuickCommand extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "创建指令的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 60, comment: "指令名称" })
    name: string;

    @Index()
    @Column({ type: "uuid", comment: "关联的场景ID" })
    sceneId: string;

    @Column({ type: "boolean", default: false, comment: "是否固定展示" })
    pinned: boolean;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "目标智能体绑定列表" })
    targets: XiaozhiQuickCommandTarget[];
}
