import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const ClassroomInteractionStatus = {
    DRAFT: "draft",
    ACTIVE: "active",
    ENDED: "ended",
} as const;

export type ClassroomInteractionStatusType =
    (typeof ClassroomInteractionStatus)[keyof typeof ClassroomInteractionStatus];

export type ClassroomInteractionTarget = {
    agentId: string;
    agentName: string;
};

export type ClassroomDisplayLayout = "grid" | "leaderboard" | "timeline";

export type ClassroomDisplaySortBy = "completed_at" | "score";

/** 公开大屏的外观与统计项配置，随活动一起保存。 */
export type ClassroomDisplayConfig = {
    title: string;
    subtitle: string;
    layout: ClassroomDisplayLayout;
    accentColor: string;
    columns: number;
    showTimer: boolean;
    showScore: boolean;
    showRecent: boolean;
    completionText: string;
    sortBy: ClassroomDisplaySortBy;
};

@AppEntity({ name: "classroom_interaction", comment: "课堂互动活动（场景+目标智能体+大屏配置）" })
export class ClassroomInteraction extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "创建活动的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 60, comment: "活动名称" })
    name: string;

    @Column({ length: 300, default: "", comment: "活动备注，仅后台可见" })
    description: string;

    @Index()
    @Column({ type: "uuid", comment: "活动开始时应用的场景ID" })
    sceneId: string;

    @Column({ type: "jsonb", default: () => "'[]'", comment: "目标智能体绑定列表" })
    targets: ClassroomInteractionTarget[];

    @Column({ type: "jsonb", default: () => "'{}'", comment: "公开大屏展示配置" })
    displayConfig: ClassroomDisplayConfig;

    @Index({ unique: true })
    @Column({ length: 32, comment: "公开大屏访问ID（随机串，无需登录）" })
    publicId: string;

    @Column({
        type: "varchar",
        length: 12,
        default: ClassroomInteractionStatus.DRAFT,
        comment: "活动状态：draft/active/ended",
    })
    status: ClassroomInteractionStatusType;

    @Column({ type: "timestamptz", nullable: true, comment: "最近一次开始时间" })
    startedAt: Date | null;

    @Column({ type: "timestamptz", nullable: true, comment: "最近一次结束时间" })
    endedAt: Date | null;
}
