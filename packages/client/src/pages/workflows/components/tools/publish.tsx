/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  useProgrammingProjectQuery,
  usePublishProgrammingProjectMutation,
  usePublishWorkflowMutation,
  useUnpublishProgrammingProjectMutation,
  useUnpublishWorkflowMutation,
  useWorkflowDetailQuery,
} from "@buildingai/services/web";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { Button as SemiButton, Dropdown, IconButton, Tooltip } from "@douyinfe/semi-ui";
import { useClientContext, useService } from "@flowgram.ai/free-layout-editor";
import { CircleCheck, CloudOff, MoreHorizontal, Rocket } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { serializeWorkflowSchema, useWorkflowSave } from "../../context";
import { useProblemPanel } from "../../plugins/panel-manager-plugin/hooks";
import { ValidateService } from "../../services/validate-service";

export function PublishTool({ disabled = false }: { disabled?: boolean }) {
  const { confirm } = useAlertDialog();
  const clientContext = useClientContext();
  const validateService = useService(ValidateService);
  const { open: openProblemPanel } = useProblemPanel();
  const { workflowId, projectId, saveSchema, saving } = useWorkflowSave();
  const [preparing, setPreparing] = useState(false);

  const workflowQuery = useWorkflowDetailQuery(workflowId);
  const workflow = workflowQuery.data;
  const projectQuery = useProgrammingProjectQuery(projectId, { enabled: Boolean(projectId) });
  const project = projectQuery.data;
  const publishMutation = usePublishWorkflowMutation();
  const unpublishMutation = useUnpublishWorkflowMutation();
  const publishProjectMutation = usePublishProgrammingProjectMutation();
  const unpublishProjectMutation = useUnpublishProgrammingProjectMutation();

  const isProject = Boolean(projectId);
  const isPublished = isProject ? project?.isPublished : workflow?.isPublished;
  const isPending =
    preparing ||
    saving ||
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    publishProjectMutation.isPending ||
    unpublishProjectMutation.isPending;
  const publishLabel = isPublished ? (isProject ? "重新发布" : "已发布") : "发布";

  const handlePublish = useCallback(async () => {
    if (!isProject && workflow?.isPublished) return;
    try {
      await confirm({
        title: isProject ? "发布编程工程？" : "发布工作流？",
        description: isProject
          ? "发布会固化主流程、Lua 模块、工具权限和运行目标。"
          : "发布后工作流将可被调用，后续保存的修改会直接作用于已发布工作流。",
        confirmText: "确认发布",
      });
    } catch {
      return;
    }

    setPreparing(true);
    try {
      const validationResults = await validateService.validateNodes();
      const errorCount = validationResults.reduce(
        (count, result) =>
          count + result.feedbacks.filter((feedback) => feedback.feedbackStatus === "error").length,
        0,
      );

      if (errorCount > 0) {
        openProblemPanel();
        toast.error(`发布前请先解决 ${errorCount} 个问题`);
        return;
      }

      await saveSchema(serializeWorkflowSchema(clientContext));
      if (projectId) {
        await publishProjectMutation.mutateAsync(projectId);
        toast.success("编程工程已发布");
      } else {
        await publishMutation.mutateAsync(workflowId);
        toast.success("工作流已发布");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    } finally {
      setPreparing(false);
    }
  }, [
    clientContext,
    confirm,
    isProject,
    openProblemPanel,
    projectId,
    publishProjectMutation,
    publishMutation,
    saveSchema,
    validateService,
    workflow?.isPublished,
    workflowId,
  ]);

  const handleUnpublish = useCallback(async () => {
    try {
      await confirm({
        title: isProject ? "取消发布编程工程？" : "取消发布工作流？",
        description: isProject
          ? "取消发布后工程不会被调用，当前草稿和模块仍会保留。"
          : "取消发布后工作流将停止对外提供，工作流内容会继续保留。",
        confirmText: "取消发布",
        confirmVariant: "destructive",
      });
      if (projectId) {
        await unpublishProjectMutation.mutateAsync(projectId);
        toast.success("编程工程已取消发布");
      } else {
        await unpublishMutation.mutateAsync(workflowId);
        toast.success("工作流已取消发布");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "AlertDialog cancelled") return;
      toast.error(error instanceof Error ? error.message : "取消发布失败");
    }
  }, [confirm, isProject, projectId, unpublishMutation, unpublishProjectMutation, workflowId]);

  const button = (
    <SemiButton
      aria-label={publishLabel}
      disabled={
        disabled ||
        (!isProject && (!workflow || workflowQuery.isLoading || workflow.isPublished)) ||
        (isProject && (!project || projectQuery.isLoading))
      }
      icon={
        isPublished ? (
          <CircleCheck aria-hidden="true" size={16} />
        ) : (
          <Rocket aria-hidden="true" size={16} />
        )
      }
      loading={isPending}
      onClick={() => void handlePublish()}
      size="small"
      theme="solid"
      type="primary"
    >
      {publishLabel}
    </SemiButton>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Tooltip content={isPublished ? (isProject ? "重新固化工程快照" : "工作流已发布") : "发布"}>
        {button}
      </Tooltip>
      {isPublished && (
        <Dropdown
          trigger="click"
          position="bottomRight"
          render={
            <Dropdown.Menu>
              <Dropdown.Item
                icon={<CloudOff aria-hidden="true" size={15} />}
                disabled={isPending || disabled}
                onClick={() => void handleUnpublish()}
              >
                取消发布
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <IconButton
            aria-label="发布操作"
            disabled={isPending || disabled}
            icon={<MoreHorizontal aria-hidden="true" size={17} />}
            size="small"
            theme="borderless"
            type="tertiary"
          />
        </Dropdown>
      )}
    </div>
  );
}
