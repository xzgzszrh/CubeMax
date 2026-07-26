import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

@AppEntity({ name: "xiaozhi_agent_binding", comment: "方糖猫智能体绑定与分发" })
@Unique("UQ_xiaozhi_agent_account_upstream", ["xiaozhiAccountId", "upstreamAgentId"])
export class XiaozhiAgentBinding extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "小智账号ID" })
    xiaozhiAccountId: string;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "绑定账号的系统用户ID" })
    ownerUserId: string;

    @Column({ type: "bigint", comment: "小智智能体ID" })
    upstreamAgentId: string;

    @Column({ length: 100, comment: "智能体名称" })
    name: string;

    @Column({ nullable: true, length: 120 })
    model: string | null;

    @Column({ nullable: true, length: 160 })
    voice: string | null;

    @Column({ type: "integer", default: 0, comment: "智能体下设备数量" })
    deviceCount: number;

    @Column({ type: "integer", default: 0, comment: "在线设备数量" })
    onlineDeviceCount: number;

    @Column({ type: "timestamptz", nullable: true })
    lastConnectedAt: Date | null;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "分发到的组织成员用户ID" })
    assignedUserId: string | null;

    @Column({ type: "uuid", nullable: true, comment: "绑定的 BuildingAI 智能体ID" })
    linkedAgentId: string | null;

    @Column({ nullable: true, length: 255, comment: "绑定的 BuildingAI 智能体名称快照" })
    linkedAgentName: string | null;

    @Column({ type: "timestamptz", nullable: true, comment: "角色设定最近同步时间" })
    linkedAgentSyncedAt: Date | null;

    @Column({
        type: "jsonb",
        default: () => "'[]'",
        comment: "老师锁定的配置项，学生不可修改",
    })
    lockedConfigKeys: string[];
}
