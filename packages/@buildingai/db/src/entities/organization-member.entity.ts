import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const OrganizationRole = {
    STUDENT: "student",
    TEACHER: "teacher",
    ADMIN: "admin",
    SCHOOL_ADMIN: "school_admin",
} as const;

export type OrganizationRoleType = (typeof OrganizationRole)[keyof typeof OrganizationRole];

export const OrganizationMemberType = {
    MANAGED: "managed",
    INVITED: "invited",
    OWNER: "owner",
} as const;

export type OrganizationMemberTypeValue =
    (typeof OrganizationMemberType)[keyof typeof OrganizationMemberType];

@AppEntity({ name: "organization_member", comment: "组织成员及组织内身份" })
@Unique("UQ_organization_member_org_user", ["organizationId", "userId"])
export class OrganizationMember extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "组织ID" })
    organizationId: string;

    @Index()
    @Column({ type: "uuid", comment: "用户ID" })
    userId: string;

    @Column({ type: "jsonb", default: () => "'[\"student\"]'", comment: "组织内身份列表" })
    roles: OrganizationRoleType[];

    @Column({ type: "varchar", length: 16, default: OrganizationMemberType.INVITED })
    memberType: OrganizationMemberTypeValue;

    @Column({ type: "boolean", default: true, comment: "成员是否可以主动退出组织" })
    canLeave: boolean;
}
