import { OrganizationRole, type OrganizationRoleType } from "@buildingai/db/entities";

export const OrganizationPermission = {
    ASSIGNMENT_SUBMIT: "assignment:submit",
    ASSIGNMENT_PUBLISH: "assignment:publish",
    MEMBER_READ: "member:read",
    MEMBER_MANAGE: "member:manage",
    ASSET_READ: "asset:read",
    ASSET_MANAGE: "asset:manage",
    ORGANIZATION_MANAGE: "organization:manage",
    BILLING_MANAGE: "billing:manage",
} as const;

export type OrganizationPermissionType =
    (typeof OrganizationPermission)[keyof typeof OrganizationPermission];

const ADMIN_PERMISSIONS: OrganizationPermissionType[] = Object.values(OrganizationPermission);

export const ORGANIZATION_ROLE_PERMISSIONS: Record<
    OrganizationRoleType,
    OrganizationPermissionType[]
> = {
    [OrganizationRole.STUDENT]: [OrganizationPermission.ASSIGNMENT_SUBMIT],
    [OrganizationRole.TEACHER]: [
        OrganizationPermission.ASSIGNMENT_SUBMIT,
        OrganizationPermission.ASSIGNMENT_PUBLISH,
        OrganizationPermission.MEMBER_READ,
        OrganizationPermission.MEMBER_MANAGE,
        OrganizationPermission.ASSET_READ,
        OrganizationPermission.ASSET_MANAGE,
    ],
    [OrganizationRole.ADMIN]: ADMIN_PERMISSIONS,
    [OrganizationRole.SCHOOL_ADMIN]: ADMIN_PERMISSIONS,
};

export function resolveOrganizationPermissions(
    roles: OrganizationRoleType[],
): OrganizationPermissionType[] {
    return [
        ...new Set(roles.flatMap((role) => ORGANIZATION_ROLE_PERMISSIONS[role] ?? [])),
    ];
}
