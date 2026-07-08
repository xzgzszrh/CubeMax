import type {
    InvokeParams,
    IContext,
    IDocument,
    IState,
    ISnapshotCenter,
    IVariableStore,
    IStatusCenter,
    IReporter,
    IIOCenter,
    ContextData,
    IMessageCenter,
    ICache,
} from "@flowgram.ai/runtime-interface";
import { WorkflowRuntimeMessageCenter } from "../message/index.ts";
import { WorkflowRuntimeCache } from "../cache/index.ts";
import { uuid } from "../../infrastructure/utils/index.ts";
import { WorkflowRuntimeVariableStore } from "../variable/index.ts";
import { WorkflowRuntimeStatusCenter } from "../status/index.ts";
import { WorkflowRuntimeState } from "../state/index.ts";
import { WorkflowRuntimeSnapshotCenter } from "../snapshot/index.ts";
import { WorkflowRuntimeReporter } from "../report/index.ts";
import { WorkflowRuntimeIOCenter } from "../io-center/index.ts";
import { WorkflowRuntimeDocument } from "../document/index.ts";

export type WorkflowRuntimeMetadata = {
    userId?: string;
    [key: string]: unknown;
};

type WorkflowRuntimeInvokeParams = InvokeParams & {
    context?: WorkflowRuntimeMetadata;
};

export class WorkflowRuntimeContext implements IContext {
    public readonly id: string;

    public metadata: WorkflowRuntimeMetadata = {};

    public readonly cache: ICache;

    public readonly document: IDocument;

    public readonly variableStore: IVariableStore;

    public readonly state: IState;

    public readonly ioCenter: IIOCenter;

    public readonly snapshotCenter: ISnapshotCenter;

    public readonly statusCenter: IStatusCenter;

    public readonly messageCenter: IMessageCenter;

    public readonly reporter: IReporter;

    private subContexts: IContext[] = [];

    constructor(data: ContextData) {
        this.id = uuid();
        this.cache = data.cache;
        this.document = data.document;
        this.variableStore = data.variableStore;
        this.state = data.state;
        this.ioCenter = data.ioCenter;
        this.snapshotCenter = data.snapshotCenter;
        this.statusCenter = data.statusCenter;
        this.messageCenter = data.messageCenter;
        this.reporter = data.reporter;
    }

    public init(params: InvokeParams): void {
        const { schema, inputs } = params;
        this.metadata = { ...((params as WorkflowRuntimeInvokeParams).context ?? {}) };
        this.cache.init();
        this.document.init(schema);
        this.variableStore.init();
        this.state.init(schema);
        this.ioCenter.init(inputs);
        this.snapshotCenter.init();
        this.statusCenter.init();
        this.messageCenter.init();
        this.reporter.init();
    }

    public dispose(): void {
        this.subContexts.forEach((subContext) => {
            subContext.dispose();
        });
        this.subContexts = [];
        this.cache.dispose();
        this.document.dispose();
        this.variableStore.dispose();
        this.state.dispose();
        this.ioCenter.dispose();
        this.snapshotCenter.dispose();
        this.statusCenter.dispose();
        this.messageCenter.dispose();
        this.reporter.dispose();
        this.metadata = {};
    }

    public sub(): IContext {
        const cache = new WorkflowRuntimeCache();
        const variableStore = new WorkflowRuntimeVariableStore();
        variableStore.setParent(this.variableStore);
        const state = new WorkflowRuntimeState(variableStore);
        const contextData: ContextData = {
            cache,
            document: this.document,
            ioCenter: this.ioCenter,
            snapshotCenter: this.snapshotCenter,
            statusCenter: this.statusCenter,
            messageCenter: this.messageCenter,
            reporter: this.reporter,
            variableStore,
            state,
        };
        const subContext = new WorkflowRuntimeContext(contextData);
        subContext.metadata = this.metadata;
        this.subContexts.push(subContext);
        subContext.cache.init();
        subContext.variableStore.init();
        subContext.state.init();
        return subContext;
    }

    public static create(): IContext {
        const cache = new WorkflowRuntimeCache();
        const document = new WorkflowRuntimeDocument();
        const variableStore = new WorkflowRuntimeVariableStore();
        const state = new WorkflowRuntimeState(variableStore);
        const ioCenter = new WorkflowRuntimeIOCenter();
        const snapshotCenter = new WorkflowRuntimeSnapshotCenter();
        const statusCenter = new WorkflowRuntimeStatusCenter();
        const messageCenter = new WorkflowRuntimeMessageCenter();
        const reporter = new WorkflowRuntimeReporter(
            ioCenter,
            snapshotCenter,
            statusCenter,
            messageCenter,
        );
        return new WorkflowRuntimeContext({
            cache,
            document,
            variableStore,
            state,
            ioCenter,
            snapshotCenter,
            statusCenter,
            messageCenter,
            reporter,
        });
    }
}
