import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const OrganizationAppType = {
    SYSTEM: "system",
    EXTENSION: "extension",
    WORKFLOW: "workflow",
} as const;

export type OrganizationAppTypeValue =
    (typeof OrganizationAppType)[keyof typeof OrganizationAppType];

@AppEntity({ name: "organization_app_grant", comment: "班级应用授权（老师为学生安装应用）" })
@Unique("UQ_organization_app_grant_target", ["organizationId", "userId", "appType", "appRefId"])
export class OrganizationAppGrant extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属组织ID" })
    organizationId: string;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "被授权的学生ID，空值表示整班授权" })
    userId: string | null;

    @Column({
        type: "varchar",
        length: 16,
        comment: "应用类型：system-系统应用；extension-应用；workflow-工作流",
    })
    appType: OrganizationAppTypeValue;

    @Index()
    @Column({ type: "varchar", length: 120, comment: "应用或工作流标识" })
    appRefId: string;

    @Column({
        type: "boolean",
        default: false,
        comment: "是否强制加入组织成员的侧边栏",
    })
    sidebarRequired: boolean;

    @Column({ type: "uuid", comment: "执行授权的老师ID" })
    grantedByUserId: string;
}
