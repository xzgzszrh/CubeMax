import { IEngine, IExecutor, IValidation } from "@flowgram.ai/runtime-interface";
import type { ContainerService, IContainer } from "@flowgram.ai/runtime-interface";
import { WorkflowRuntimeNodeExecutors } from "../../nodes/index.ts";
import { WorkflowRuntimeValidation } from "../validation/index.ts";
import { WorkflowRuntimeExecutor } from "../executor/index.ts";
import { WorkflowRuntimeEngine } from "../engine/index.ts";

export class WorkflowRuntimeContainer implements IContainer {
    private readonly services: Record<string, ContainerService>;

    constructor(services: Record<string, ContainerService>) {
        this.services = services;
    }

    public get<T = ContainerService>(key: any): T {
        return this.services[key] as T;
    }

    private static _instance: IContainer;

    public static get instance(): IContainer {
        if (this._instance) {
            return this._instance;
        }
        const services = this.create();
        this._instance = new WorkflowRuntimeContainer(services);
        return this._instance;
    }

    private static create(): Record<symbol, ContainerService> {
        // services
        const Validation = new WorkflowRuntimeValidation();
        const Executor = new WorkflowRuntimeExecutor(WorkflowRuntimeNodeExecutors);
        const Engine = new WorkflowRuntimeEngine({
            Validation,
            Executor,
        });

        return {
            [IValidation]: Validation,
            [IExecutor]: Executor,
            [IEngine]: Engine,
        };
    }
}
