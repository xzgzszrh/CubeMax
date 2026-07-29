import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const ClassroomAppSessionStatus = {
    ACTIVE: "active",
    ENDED: "ended",
} as const;

export type ClassroomAppSessionStatusType =
    (typeof ClassroomAppSessionStatus)[keyof typeof ClassroomAppSessionStatus];

/**
 * 一次课堂应用会话：某个已安装应用在一段时间内临时接管一批方糖猫。
 *
 * 之所以要落库而不是只放在内存里：会话期间设备的提示词被改写、学生端被锁定，
 * 如果服务重启时这些状态随进程消失，学生的方糖猫会永远停在被改写的人设上
 * （比如「你守着密码 4821」），且没人能解锁。落库让重启后仍可恢复，
 * `expiresAt` 则兜住老师忘记结束、或应用崩溃再没回来的情况。
 */
@AppEntity({ name: "classroom_app_session", comment: "课堂应用会话（应用对方糖猫的临时接管）" })
@Unique("UQ_classroom_app_session_key", ["extensionIdentifier", "sessionKey"])
export class ClassroomAppSession extends SoftDeleteBaseEntity {
    @Index()
    @Column({ length: 100, comment: "发起会话的应用标识" })
    extensionIdentifier: string;

    @Column({ length: 120, comment: "应用自定义的会话标识，需在该应用内唯一" })
    sessionKey: string;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "发起会话的用户（老师）" })
    ownerUserId: string;

    @Column({ length: 120, default: "", comment: "会话标题，便于在后台辨认" })
    title: string;

    @Index()
    @Column({
        type: "varchar",
        length: 16,
        default: ClassroomAppSessionStatus.ACTIVE,
        comment: "会话状态",
    })
    status: ClassroomAppSessionStatusType;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "被接管的方糖猫绑定ID列表" })
    agentBindingIds: string[];

    /**
     * 接管前的原始配置，按设备分别保存。
     *
     * 必须按设备存而不是存一份共享快照：每个学生的方糖猫音色、人设本来就不同，
     * 用一份共享配置恢复会把学生的个性化设置一并抹掉。字段集与场景（XiaozhiScene）
     * 一致，恢复时走的也是同一条下发通道。
     */
    @Column({ type: "jsonb", default: () => "'{}'", comment: "接管前的逐设备配置快照" })
    configSnapshots: Record<string, Record<string, unknown>>;

    @Column({ type: "boolean", default: false, comment: "会话期间是否禁止学生修改自己的方糖猫" })
    lockStudentEdits: boolean;

    @Column({
        type: "boolean",
        default: false,
        comment: "会话期间是否隐藏内置的 classroom_report_completion",
    })
    suppressClassroomTool: boolean;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "应用自定义的会话元数据" })
    metadata: Record<string, unknown>;

    @Column({ type: "timestamptz", nullable: true, comment: "超时自动结束时间" })
    expiresAt: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    endedAt: Date | null;

    @Column({ type: "text", nullable: true, comment: "结束时恢复配置的失败原因" })
    restoreError: string | null;
}
