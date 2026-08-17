import type { ProgrammingTrigger } from "@buildingai/db/entities";
import type { Repository } from "@buildingai/db/typeorm";

jest.mock("@buildingai/db/@nestjs/typeorm", () => ({
    InjectRepository: () => () => undefined,
}));

jest.mock("@buildingai/db/entities", () => ({
    ProgrammingTrigger: class ProgrammingTrigger {},
}));

jest.mock("./programming-project.service", () => ({
    ProgrammingProjectService: class ProgrammingProjectService {},
}));

jest.mock("./workflow-runtime-execution.service", () => ({
    WorkflowRuntimeExecutionService: class WorkflowRuntimeExecutionService {},
}));

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
        notFound: (message: string) => new Error(message),
    },
}));

import { ProgrammingTriggerService } from "./programming-trigger.service";

function trigger(overrides: Partial<ProgrammingTrigger> = {}): ProgrammingTrigger {
    return {
        id: "trigger-a",
        name: "打开客厅灯",
        description: "",
        projectId: "project-a",
        triggerType: "form",
        inputSchema: { type: "object", properties: { room: { type: "string" } } },
        isEnabled: true,
        isPinned: false,
        homeOrder: 0,
        createBy: "user-a",
        ...overrides,
    } as ProgrammingTrigger;
}

function createService() {
    const saved = trigger();
    const triggerRepository = {
        findOne: jest.fn().mockResolvedValue(saved),
        save: jest.fn().mockImplementation(async (value) => value),
        remove: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation((value) => value),
    } as unknown as Repository<ProgrammingTrigger>;
    const programmingProjectService = {
        findDetail: jest.fn(),
        findOne: jest.fn().mockResolvedValue({
            id: "project-a",
            name: "客厅自动化",
            isPublished: true,
            runtimeTarget: "simulator",
            mainWorkflowId: "workflow-a",
            mainWorkflow: { schema: { nodes: [] } },
        }),
        findPublished: jest.fn(),
    };
    const runtimeExecutionService = {
        runPublishedProject: jest.fn().mockResolvedValue({ taskId: "task-a" }),
    };
    const service = new ProgrammingTriggerService(
        triggerRepository,
        programmingProjectService as never,
        runtimeExecutionService as never,
    );
    return { service, triggerRepository, programmingProjectService, runtimeExecutionService };
}

describe("ProgrammingTriggerService", () => {
    it("does not read a trigger owned by another user", async () => {
        const { service, triggerRepository } = createService();
        triggerRepository.findOne = jest.fn().mockResolvedValue(null);

        await expect(service.findOne("trigger-b", "user-b")).rejects.toThrow("触发器不存在");
        expect(triggerRepository.findOne).toHaveBeenCalledWith({
            where: { id: "trigger-b", createBy: "user-b" },
        });
    });

    it("rejects disabled triggers before executing", async () => {
        const { service, triggerRepository, runtimeExecutionService } = createService();
        triggerRepository.findOne = jest.fn().mockResolvedValue(trigger({ isEnabled: false }));

        await expect(service.execute("trigger-a", "user-a", { inputs: {} })).rejects.toThrow(
            "该触发器已停用",
        );
        expect(runtimeExecutionService.runPublishedProject).not.toHaveBeenCalled();
    });

    it("rejects unpublished projects", async () => {
        const { service, programmingProjectService, runtimeExecutionService } = createService();
        programmingProjectService.findOne.mockResolvedValue({
            id: "project-a",
            isPublished: false,
        });

        await expect(service.execute("trigger-a", "user-a", { inputs: {} })).rejects.toThrow(
            "请先发布触发器绑定的编程工程",
        );
        expect(runtimeExecutionService.runPublishedProject).not.toHaveBeenCalled();
    });

    it("validates inputs and executes only the trigger-bound published project", async () => {
        const { service, programmingProjectService, runtimeExecutionService } = createService();
        const inputs = { room: "living-room" };

        await expect(service.execute("trigger-a", "user-a", { inputs })).resolves.toEqual({
            taskId: "task-a",
        });
        expect(programmingProjectService.findOne).toHaveBeenCalledWith("project-a", "user-a");
        expect(runtimeExecutionService.runPublishedProject).toHaveBeenCalledWith(
            "project-a",
            { id: "user-a" },
            inputs,
        );
    });

    it("applies schema defaults before execution", async () => {
        const { service, triggerRepository, runtimeExecutionService } = createService();
        triggerRepository.findOne = jest.fn().mockResolvedValue(
            trigger({
                inputSchema: {
                    type: "object",
                    properties: { count: { type: "integer", default: 2 } },
                },
            }),
        );

        await service.execute("trigger-a", "user-a", { inputs: {} });

        expect(runtimeExecutionService.runPublishedProject).toHaveBeenCalledWith(
            "project-a",
            { id: "user-a" },
            { count: 2 },
        );
    });
});
