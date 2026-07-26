jest.mock("@buildingai/db/entities", () => ({
    OrganizationRole: {
        STUDENT: "student",
        TEACHER: "teacher",
        ADMIN: "admin",
        SCHOOL_ADMIN: "school_admin",
    },
}));

const OrganizationRole = {
    STUDENT: "student",
    TEACHER: "teacher",
    ADMIN: "admin",
    SCHOOL_ADMIN: "school_admin",
} as const;

import {
    OrganizationPermission,
    resolveOrganizationPermissions,
} from "./organization-permissions";

describe("resolveOrganizationPermissions", () => {
    it("allows every organization role to submit assignments", () => {
        for (const role of Object.values(OrganizationRole)) {
            expect(resolveOrganizationPermissions([role])).toContain(
                OrganizationPermission.ASSIGNMENT_SUBMIT,
            );
        }
    });

    it("combines permissions for users with multiple identities", () => {
        const permissions = resolveOrganizationPermissions([
            OrganizationRole.STUDENT,
            OrganizationRole.TEACHER,
        ]);

        expect(permissions).toContain(OrganizationPermission.ASSIGNMENT_SUBMIT);
        expect(permissions).toContain(OrganizationPermission.ASSIGNMENT_PUBLISH);
        expect(permissions).toContain(OrganizationPermission.MEMBER_MANAGE);
        expect(new Set(permissions).size).toBe(permissions.length);
    });

    it("treats school administrators as organization administrators for now", () => {
        expect(resolveOrganizationPermissions([OrganizationRole.SCHOOL_ADMIN]).sort()).toEqual(
            resolveOrganizationPermissions([OrganizationRole.ADMIN]).sort(),
        );
    });
});
