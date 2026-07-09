import type {
    WorkflowVariableType,
    ConditionOperator,
    ConditionItem,
} from "@flowgram.ai/runtime-interface";

export type Conditions = ConditionItem[];

export type ConditionRule = Partial<Record<ConditionOperator, WorkflowVariableType | null>>;

export type ConditionRules = Record<WorkflowVariableType, ConditionRule>;

export interface ConditionValue {
    key: string;
    leftValue: unknown | null;
    rightValue: unknown | null;
    leftType: WorkflowVariableType;
    rightType: WorkflowVariableType;
    operator: ConditionOperator;
}

export type ConditionHandler = (condition: ConditionValue) => boolean;

export type ConditionHandlers = Record<WorkflowVariableType, ConditionHandler>;
