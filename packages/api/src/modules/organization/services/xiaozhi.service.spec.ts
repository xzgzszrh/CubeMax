jest.mock("@buildingai/core/modules/classroom", () => ({
    ClassroomKitService: class ClassroomKitService {},
}));

jest.mock("@buildingai/db/@nestjs/typeorm", () => ({
    InjectRepository: () => () => undefined,
}));

jest.mock("@buildingai/db/entities", () => ({
    Agent: class Agent {},
    CubeCatDeviceType: {
        UNKNOWN: "unknown",
        LITE: "CubeCat-Lite",
        S: "CubeCat-S",
    },
    OrganizationRole: {
        STUDENT: "student",
        TEACHER: "teacher",
        ADMIN: "admin",
        SCHOOL_ADMIN: "school_admin",
    },
    XiaozhiAccount: class XiaozhiAccount {},
    XiaozhiAccountStatus: {
        ACTIVE: "active",
        AUTH_ERROR: "auth_error",
        SYNC_ERROR: "sync_error",
    },
    XiaozhiAgentBinding: class XiaozhiAgentBinding {},
    XiaozhiDeviceProfile: class XiaozhiDeviceProfile {},
}));

jest.mock("@buildingai/db/typeorm", () => ({
    DataSource: class DataSource {},
    In: (value: unknown) => value,
    IsNull: () => null,
}));

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badGateway: (message: string) => new Error(message),
        badRequest: (message: string) => new Error(message),
        forbidden: (message: string) => new Error(message),
        notFound: (message: string) => new Error(message),
        serviceUnavailable: (message: string) => new Error(message),
    },
}));

jest.mock("./organization.service", () => ({
    OrganizationService: class OrganizationService {},
}));

jest.mock("./xiaozhi-mcp.service", () => ({
    XiaozhiMcpGatewayService: class XiaozhiMcpGatewayService {},
}));

import { OrganizationPermission } from "../constants/organization-permissions";
import { XiaozhiService } from "./xiaozhi.service";

function createService() {
    const accountRepository = {
        find: jest.fn().mockResolvedValue([]),
    };
    const organizationService = {
        requireWorkspace: jest.fn(),
    };
    const credentialCrypto = {
        ensureReadable: jest.fn().mockResolvedValue(undefined),
        ensureWritable: jest.fn().mockResolvedValue(undefined),
        decrypt: jest.fn((value: string) => value),
        encrypt: jest.fn((value: string) => value),
        isCredentialError: jest.fn().mockReturnValue(false),
        toHttpError: jest.fn((error: unknown) => error),
    };
    const service = new XiaozhiService(
        accountRepository as never,
        {} as never,
        {} as never,
        {} as never,
        organizationService as never,
        {} as never,
        {} as never,
        credentialCrypto as never,
    );
    return { service, accountRepository, organizationService, credentialCrypto };
}

describe("XiaozhiService account ownership", () => {
    it("does not expose xiaozhi accounts in a personal workspace", async () => {
        const { service, accountRepository, organizationService } = createService();

        await expect(service.listAccounts("student-a", null)).rejects.toThrow(
            "小智账号只能由老师或组织管理员在组织工作空间中管理",
        );

        expect(organizationService.requireWorkspace).not.toHaveBeenCalled();
        expect(accountRepository.find).not.toHaveBeenCalled();
    });

    it("propagates the organization permission check before reading credentials", async () => {
        const { service, accountRepository, organizationService } = createService();
        const denied = new Error("当前组织身份没有执行此操作的权限");
        organizationService.requireWorkspace.mockRejectedValue(denied);

        await expect(service.listAccounts("student-a", "organization-a")).rejects.toBe(denied);

        expect(organizationService.requireWorkspace).toHaveBeenCalledWith(
            "student-a",
            "organization-a",
            OrganizationPermission.ASSET_MANAGE,
        );
        expect(accountRepository.find).not.toHaveBeenCalled();
    });

    it("scopes account reads to the managed organization", async () => {
        const { service, accountRepository, organizationService } = createService();
        organizationService.requireWorkspace.mockResolvedValue({
            type: "organization",
            organizationId: "organization-a",
            permissions: [OrganizationPermission.ASSET_MANAGE],
        });

        await expect(service.listAccounts("teacher-a", "organization-a")).resolves.toEqual([]);

        expect(accountRepository.find).toHaveBeenCalledWith({
            where: { organizationId: "organization-a" },
            order: { createdAt: "ASC" },
        });
    });
});
