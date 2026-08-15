/**
 * `@buildingai/db/entities` 的最小替身。
 *
 * 课堂能力的公开入口是 `@buildingai/core/modules/classroom` 这个 barrel，加载它
 * 会连带拉进整个实体图，而实体图深处有个只发 ESM 的依赖，jest 的默认
 * transformIgnorePatterns 处理不了。这些测试验证的是接管/归还逻辑，实体在其中
 * 只充当 DI 注入令牌，所以用空壳类替掉即可 —— 与 organization-permissions.spec
 * 的做法一致。
 */
export class ClassroomAppSession {}
export class Organization {}
export class OrganizationMember {}
export class User {}
export class XiaozhiAgentBinding {}
export class XiaozhiMcpConnection {}

export const ClassroomAppSessionStatus = {
    ACTIVE: "active",
    ENDED: "ended",
} as const;

export const XiaozhiMcpConnectionStatus = {
    DISABLED: "disabled",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    ERROR: "error",
} as const;

export const OrganizationRole = {
    STUDENT: "student",
    TEACHER: "teacher",
    ADMIN: "admin",
    SCHOOL_ADMIN: "school_admin",
} as const;
