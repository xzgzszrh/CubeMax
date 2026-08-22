import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const YeelightProAccountStatus = {
    ACTIVE: "active",
    AUTH_ERROR: "auth_error",
    SYNC_ERROR: "sync_error",
} as const;

export type YeelightProAccountStatusType =
    (typeof YeelightProAccountStatus)[keyof typeof YeelightProAccountStatus];

export type YeelightProRegion = "cn" | "sg" | "us" | "de";

export type YeelightProHomeSummary = {
    id: string;
    name: string;
    roomCount: number;
    deviceCount: number;
};

export type YeelightProCapability = {
    kind: "property";
    name: string;
    description: string;
    format: string;
    access: string[];
    unit?: string | null;
    valueRange?: { min: number; max: number; step: number } | null;
    valueList?: Array<{ value: string | number | boolean; description: string }> | null;
};

@AppEntity({ name: "yeelight_pro_account", comment: "易来 Pro 云端账号" })
@Unique("UQ_yeelight_pro_account_owner_upstream_region", [
    "ownerUserId",
    "upstreamUserId",
    "region",
])
export class YeelightProAccount extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "绑定账号的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 80, default: "易来账号", comment: "账号备注" })
    label: string;

    @Column({ length: 8, default: "cn", comment: "易来云区域" })
    region: YeelightProRegion;

    @Index()
    @Column({ length: 64, nullable: true, comment: "易来云用户ID" })
    upstreamUserId: string | null;

    @Column({ length: 120, nullable: true, comment: "易来账号用户名" })
    username: string | null;

    @Column({ length: 80, nullable: true, comment: "当前绑定的家庭ID" })
    houseId: string | null;

    @Column({ length: 120, nullable: true, comment: "当前绑定的家庭名称" })
    houseName: string | null;

    @Column({ length: 80, comment: "扫码登录使用的客户端设备标识" })
    scanDevice: string;

    @Column({ type: "text", nullable: true, comment: "加密的 Open API client ID" })
    clientIdEncrypted: string | null;

    @Column({ type: "text", nullable: true, comment: "加密的 Open API client secret" })
    clientSecretEncrypted: string | null;

    @Column({ type: "text", comment: "加密的 access token" })
    accessTokenEncrypted: string;

    @Column({ type: "text", comment: "加密的 refresh token" })
    refreshTokenEncrypted: string;

    @Column({ type: "timestamptz", nullable: true, comment: "access token 过期时间" })
    accessTokenExpiresAt: Date | null;

    @Column({ type: "varchar", length: 16, default: YeelightProAccountStatus.ACTIVE })
    status: YeelightProAccountStatusType;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb", comment: "家庭摘要列表" })
    homes: YeelightProHomeSummary[];

    @Column({ type: "timestamptz", nullable: true, comment: "最近同步时间" })
    lastSyncAt: Date | null;

    @Column({ type: "text", nullable: true, comment: "最近一次错误" })
    lastError: string | null;
}

@AppEntity({ name: "yeelight_pro_qr_session", comment: "易来 Pro 扫码登录会话" })
@Unique("UQ_yeelight_pro_qr_session_code", ["qrCodeId"])
export class YeelightProQrSession extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "发起扫码的系统用户ID" })
    ownerUserId: string;

    @Column({ length: 8, default: "cn", comment: "易来云区域" })
    region: YeelightProRegion;

    @Column({ length: 80, comment: "扫码客户端设备标识" })
    scanDevice: string;

    @Column({ length: 160, comment: "二维码 ID" })
    qrCodeId: string;

    @Column({ length: 240, comment: "APP 可扫描的二维码内容" })
    qrcodeContent: string;

    @Column({ length: 16, default: "CREATED", comment: "扫码状态" })
    status: string;

    @Column({ type: "timestamptz", comment: "二维码过期时间" })
    expiresAt: Date;

    @Column({ type: "timestamptz", nullable: true, comment: "会话完成时间" })
    consumedAt: Date | null;

    @Column({ type: "uuid", nullable: true, comment: "完成后绑定的账号" })
    accountId: string | null;
}

@AppEntity({ name: "yeelight_pro_device", comment: "易来 Pro 云端设备" })
@Unique("UQ_yeelight_pro_device_account_did", ["accountId", "did"])
export class YeelightProDevice extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属易来账号" })
    accountId: string;

    @Index()
    @Column({ length: 80, comment: "易来设备 ID" })
    did: string;

    @Index()
    @Column({ length: 80, nullable: true, comment: "家庭ID" })
    houseId: string | null;

    @Column({ length: 120, nullable: true, comment: "家庭名称" })
    houseName: string | null;

    @Index()
    @Column({ length: 80, nullable: true, comment: "房间ID" })
    roomId: string | null;

    @Column({ length: 120, nullable: true, comment: "房间名称" })
    roomName: string | null;

    @Column({ length: 160, comment: "设备显示名称" })
    name: string;

    @Column({ length: 160, nullable: true, comment: "设备型号" })
    model: string | null;

    @Column({ type: "integer", nullable: true, comment: "产品 ID" })
    productId: number | null;

    @Column({ type: "text", nullable: true, comment: "设备图标地址" })
    icon: string | null;

    @Index()
    @Column({ type: "varchar", length: 32, default: "other", comment: "设备分类" })
    category: string;

    @Column({ type: "boolean", default: false, comment: "设备在线状态" })
    online: boolean;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb", comment: "云端物模型能力" })
    capabilities: YeelightProCapability[];

    @Column({ type: "jsonb", default: () => "'{}'::jsonb", comment: "最近读取到的属性状态" })
    state: Record<string, unknown>;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb", comment: "设备元数据" })
    metadata: Record<string, unknown>;

    @Column({ type: "timestamptz", nullable: true, comment: "最近状态读取时间" })
    lastStateAt: Date | null;
}
