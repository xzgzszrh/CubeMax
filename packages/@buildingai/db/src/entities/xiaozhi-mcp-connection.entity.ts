import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const XiaozhiMcpConnectionStatus = {
    DISABLED: "disabled",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    ERROR: "error",
} as const;

export type XiaozhiMcpConnectionStatusType =
    (typeof XiaozhiMcpConnectionStatus)[keyof typeof XiaozhiMcpConnectionStatus];

@AppEntity({ name: "xiaozhi_mcp_connection", comment: "方糖猫 MCP 网关连接" })
@Unique("UQ_xiaozhi_mcp_connection_agent", ["agentBindingId"])
export class XiaozhiMcpConnection extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "创建连接的系统用户ID" })
    ownerUserId: string;

    @Index()
    @Column({ type: "uuid", comment: "智能体绑定ID（xiaozhi_agent_binding.id）" })
    agentBindingId: string;

    @Column({ length: 100, comment: "智能体名称快照" })
    agentName: string;

    @Column({ type: "text", comment: "加密的 MCP 接入点地址（含令牌）" })
    endpointEncrypted: string;

    @Column({ type: "boolean", default: true, comment: "是否启用" })
    enabled: boolean;

    @Index()
    @Column({
        type: "varchar",
        length: 16,
        default: XiaozhiMcpConnectionStatus.CONNECTING,
        comment: "连接状态",
    })
    status: XiaozhiMcpConnectionStatusType;

    @Column({ type: "timestamptz", nullable: true, comment: "最近连接成功时间" })
    lastConnectedAt: Date | null;

    @Column({ type: "text", nullable: true, comment: "最近一次连接错误" })
    lastError: string | null;
}

@AppEntity({ name: "xiaozhi_mcp_settings", comment: "方糖猫 MCP 完成工具配置（每工作空间一份）" })
export class XiaozhiMcpSettings extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "配置归属的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 64, default: "classroom_report_completion", comment: "MCP 工具名称" })
    toolName: string;

    @Column({ length: 80, default: "报告课堂任务完成", comment: "MCP 工具显示名称" })
    toolTitle: string;

    @Column({
        length: 600,
        default:
            "仅当学生已经完成老师要求的课堂任务时调用。调用后会通知课堂控制台，并记录完成摘要。",
        comment: "MCP 工具说明",
    })
    toolDescription: string;

    @Column({
        length: 300,
        default: "老师给出的任务标识；没有明确标识时可以省略",
        comment: "task_key 参数说明",
    })
    taskKeyDescription: string;

    @Column({ length: 300, default: "学生完成内容的简短摘要", comment: "summary 参数说明" })
    summaryDescription: string;

    @Column({
        length: 300,
        default: "有明确评分依据时填写 0 到 100 的得分",
        comment: "score 参数说明",
    })
    scoreDescription: string;

    @Column({
        type: "text",
        default:
            "当用户已经完成本次课堂任务时，必须调用 MCP 工具 {tool_name}。task_key 填写老师给出的任务标识，summary 简要说明完成内容；有明确评分依据时再填写 score。只有确认任务完成后才能调用，不要提前调用或重复调用。",
        comment: "提示词模板，使用 {tool_name} 占位",
    })
    promptTemplate: string;
}
