import { WorkflowApplication } from "../application/workflow.ts";

export function onTaskSettled(taskID: string, cb: () => void): boolean {
    const task = WorkflowApplication.instance.tasks.get(taskID);
    if (!task) return false;
    task.processing.then(
        () => cb(),
        () => cb(),
    );
    return true;
}
