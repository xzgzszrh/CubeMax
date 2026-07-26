import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

@AppEntity({ name: "xiaozhi_scene", comment: "方糖猫场景（完整角色配置模板）" })
export class XiaozhiScene extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "创建场景的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 60, comment: "场景名称" })
    name: string;

    @Column({ length: 300, default: "", comment: "场景备注" })
    description: string;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "场景保存的角色配置" })
    config: Record<string, unknown>;

    @Column({ type: "uuid", nullable: true, comment: "复制来源的智能体绑定ID" })
    sourceAgentId: string | null;

    @Column({ length: 100, default: "", comment: "复制来源的智能体名称快照" })
    sourceAgentName: string;
}
