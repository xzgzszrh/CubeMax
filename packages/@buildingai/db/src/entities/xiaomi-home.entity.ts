import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const XiaomiHomeAccountStatus = {
    ACTIVE: "active",
    AUTH_ERROR: "auth_error",
    SYNC_ERROR: "sync_error",
} as const;

export type XiaomiHomeAccountStatusType =
    (typeof XiaomiHomeAccountStatus)[keyof typeof XiaomiHomeAccountStatus];

export type XiaomiHomeServer = "cn" | "de" | "i2" | "ru" | "sg" | "us";

export type XiaomiHomeSummary = {
    id: string;
    name: string;
    uid?: string | null;
    roomCount: number;
    deviceCount: number;
};

export type XiaomiHomeCapability = {
    kind: "property" | "action";
    siid: number;
    piid?: number;
    aiid?: number;
    serviceName: string;
    serviceDescription?: string;
    name: string;
    description?: string;
    format?: string;
    access?: string[];
    unit?: string | null;
    valueRange?: { min: number; max: number; step: number } | null;
    valueList?: Array<{ value: string | number | boolean; description: string }> | null;
    input?: Array<{
        piid: number;
        name: string;
        description?: string;
        format?: string;
        valueRange?: { min: number; max: number; step: number } | null;
        valueList?: Array<{ value: string | number | boolean; description: string }> | null;
    }>;
};

@AppEntity({ name: "xiaomi_home_account", comment: "小米智能家居 OAuth 账号" })
@Unique("UQ_xiaomi_home_account_owner_upstream_server", [
    "ownerUserId",
    "upstreamUserId",
    "cloudServer",
])
export class XiaomiHomeAccount extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "绑定账号的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 80, default: "小米账号", comment: "账号备注" })
    label: string;

    @Column({ length: 8, default: "cn", comment: "小米云区域" })
    cloudServer: XiaomiHomeServer;

    @Index()
    @Column({ length: 64, nullable: true, comment: "小米云用户ID" })
    upstreamUserId: string | null;

    @Column({ length: 120, nullable: true, comment: "小米账号昵称" })
    nickname: string | null;

    @Column({ length: 100, comment: "OAuth 授权设备标识" })
    oauthDeviceId: string;

    @Column({ type: "text", comment: "OAuth token 交换与刷新使用的回调地址" })
    oauthRedirectUri: string;

    @Column({ type: "text", comment: "加密的 OAuth access token" })
    accessTokenEncrypted: string;

    @Column({ type: "text", comment: "加密的 OAuth refresh token" })
    refreshTokenEncrypted: string;

    @Column({ type: "timestamptz", nullable: true, comment: "access token 过期时间" })
    accessTokenExpiresAt: Date | null;

    @Column({ type: "varchar", length: 16, default: XiaomiHomeAccountStatus.ACTIVE })
    status: XiaomiHomeAccountStatusType;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb", comment: "家庭摘要列表" })
    homes: XiaomiHomeSummary[];

    @Column({ type: "timestamptz", nullable: true, comment: "最近同步时间" })
    lastSyncAt: Date | null;

    @Column({ type: "text", nullable: true, comment: "最近一次错误" })
    lastError: string | null;
}

@AppEntity({ name: "xiaomi_home_oauth_session", comment: "小米智能家居 OAuth 会话" })
@Unique("UQ_xiaomi_home_oauth_session_state_hash", ["stateHash"])
export class XiaomiHomeOAuthSession extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "发起授权的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 8, default: "cn", comment: "小米云区域" })
    cloudServer: XiaomiHomeServer;

    @Column({ length: 100, comment: "授权设备标识" })
    deviceId: string;

    @Column({ type: "text", comment: "小米 OAuth 回调地址" })
    redirectUri: string;

    @Column({ length: 300, comment: "完成授权后允许 postMessage 的前端来源" })
    frontendOrigin: string;

    @Column({ type: "text", comment: "OAuth state SHA-256" })
    stateHash: string;

    @Index()
    @Column({ type: "timestamptz", comment: "会话过期时间" })
    expiresAt: Date;

    @Column({ type: "timestamptz", nullable: true, comment: "消费时间" })
    consumedAt: Date | null;

    @Column({ type: "uuid", nullable: true, comment: "授权完成后生成的账号ID" })
    accountId: string | null;
}

@AppEntity({ name: "xiaomi_home_device", comment: "小米智能家居设备" })
@Unique("UQ_xiaomi_home_device_account_did", ["accountId", "did"])
export class XiaomiHomeDevice extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属小米账号" })
    accountId: string;

    @Index()
    @Column({ length: 255, comment: "MIoT device id" })
    did: string;

    @Column({ length: 64, nullable: true, comment: "设备所属小米用户ID" })
    uid: string | null;

    @Index()
    @Column({ length: 80, nullable: true, comment: "家庭ID" })
    homeId: string | null;

    @Column({ length: 120, nullable: true, comment: "家庭名称" })
    homeName: string | null;

    @Index()
    @Column({ length: 80, nullable: true, comment: "房间ID" })
    roomId: string | null;

    @Column({ length: 120, nullable: true, comment: "房间名称" })
    roomName: string | null;

    @Column({ length: 160, comment: "设备显示名称" })
    name: string;

    @Column({ length: 160, nullable: true, comment: "设备型号" })
    model: string | null;

    @Column({ type: "text", nullable: true, comment: "MIoT-Spec-V2 URN" })
    urn: string | null;

    @Column({ length: 80, nullable: true, comment: "设备厂商" })
    manufacturer: string | null;

    @Column({ type: "text", nullable: true, comment: "设备图标地址" })
    icon: string | null;

    @Index()
    @Column({
        type: "varchar",
        length: 32,
        default: "other",
        comment: "Home Assistant domain 分类",
    })
    category: string;

    @Column({ type: "boolean", default: false, comment: "设备在线状态" })
    online: boolean;

    @Column({ type: "integer", nullable: true, comment: "小米设备连接类型" })
    connectType: number | null;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb", comment: "MIoT 属性和动作能力" })
    capabilities: XiaomiHomeCapability[];

    @Column({ type: "jsonb", default: () => "'{}'::jsonb", comment: "最近读取到的 MIoT 状态" })
    state: Record<string, unknown>;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb", comment: "小米设备元数据" })
    metadata: Record<string, unknown>;

    @Column({ type: "timestamptz", nullable: true, comment: "最近状态读取时间" })
    lastStateAt: Date | null;
}
