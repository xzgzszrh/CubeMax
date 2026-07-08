import type { IMessage, MessageData, WorkflowMessageType } from "@flowgram.ai/runtime-interface";
import { uuid } from "../../../infrastructure/utils/index.ts";

export const WorkflowRuntimeMessage = {
    create: (
        params: MessageData & {
            type: WorkflowMessageType;
        },
    ): IMessage => {
        const message = {
            id: uuid(),
            ...params,
        };
        if (!params.timestamp) {
            message.timestamp = Date.now();
        }
        return message as IMessage;
    },
};
