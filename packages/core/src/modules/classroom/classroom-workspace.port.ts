/**
 * 课堂能力的外部依赖端口。
 *
 * ClassroomKit 需要两类它自己做不到的事：判断调用者在这个工作空间里有没有权限，
 * 以及把配置真正下发到小智服务器。这两件事的实现都在 api 层（`OrganizationService`
 * 与 `XiaozhiService`，后者持有加密的上游账号凭据），而 core 不能反向依赖 api。
 * 因此这里只声明端口，由 api 在启动时把实现注入进来。
 */

/** 与 api 层 `OrganizationPermission` 保持一致的权限字面量。 */
export const ClassroomKitPermission = {
    ASSET_READ: "asset:read",
    ASSET_MANAGE: "asset:manage",
    MEMBER_READ: "member:read",
} as const;

export type ClassroomKitPermissionType =
    (typeof ClassroomKitPermission)[keyof typeof ClassroomKitPermission];

export type ClassroomWorkspaceAccess = {
    type: "personal" | "organization";
    organizationId: string | null;
    permissions: string[];
};

export abstract class ClassroomWorkspacePort {
    /** 断言调用者可以在该工作空间执行某个操作；不通过时抛错。 */
    abstract requireWorkspace(
        userId: string,
        organizationId: string | null | undefined,
        permission?: ClassroomKitPermissionType,
    ): Promise<ClassroomWorkspaceAccess>;

    /** 读取一台方糖猫在小智侧的当前配置。 */
    abstract readDeviceConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentBindingId: string,
    ): Promise<Record<string, unknown>>;

    /** 把配置下发到一台方糖猫。 */
    abstract writeDeviceConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentBindingId: string,
        config: Record<string, unknown>,
    ): Promise<void>;
}
