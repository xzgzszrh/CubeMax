import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const XiaozhiAccountStatus = {
    ACTIVE: "active",
    AUTH_ERROR: "auth_error",
    SYNC_ERROR: "sync_error",
} as const;

export type XiaozhiAccountStatusType =
    (typeof XiaozhiAccountStatus)[keyof typeof XiaozhiAccountStatus];

@AppEntity({ name: "xiaozhi_account", comment: "小智控制台账号" })
export class XiaozhiAccount extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", nullable: true, comment: "所属组织，空值表示个人空间" })
    organizationId: string | null;

    @Index()
    @Column({ type: "uuid", comment: "绑定账号的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 40, comment: "账号备注" })
    label: string;

    @Column({ type: "text", comment: "加密的小智用户名" })
    usernameEncrypted: string;

    @Column({ type: "text", comment: "加密的小智密码" })
    passwordEncrypted: string;

    @Column({ type: "text", comment: "加密的小智访问令牌" })
    accessTokenEncrypted: string;

    @Column({ type: "text", nullable: true, comment: "加密的小智会话Cookie" })
    sessionCookieEncrypted: string | null;

    @Column({ nullable: true, length: 64, comment: "小智用户ID" })
    upstreamUserId: string | null;

    @Column({ type: "varchar", length: 16, default: XiaozhiAccountStatus.ACTIVE })
    status: XiaozhiAccountStatusType;

    @Column({ type: "timestamptz", nullable: true })
    lastSyncAt: Date | null;

    @Column({ type: "text", nullable: true })
    lastError: string | null;
}
