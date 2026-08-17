/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconRedo, IconUndo } from "@douyinfe/semi-icons";
import { IconButton, Tooltip } from "@douyinfe/semi-ui";
import { useRefresh } from "@flowgram.ai/free-layout-editor";
import { useClientContext } from "@flowgram.ai/free-layout-editor";
import { useEffect, useState } from "react";

import { AddNode } from "../add-node";
import { ProblemButton } from "../problem-panel";
import { TestRunButton } from "../testrun/testrun-button";
import { AutoLayout } from "./auto-layout";
import { DownloadTool } from "./download";
import { FitView } from "./fit-view";
import { Interactive } from "./interactive";
import { Minimap } from "./minimap";
import { PublishTool } from "./publish";
import { Save } from "./save";
import {
  BottomCenterToolSection,
  BottomLeftToolSection,
  BottomRightToolSection,
  LeftToolSection,
  ToolsLayer,
  TopRightToolSection,
  ViewportToolSection,
} from "./styles";
import { SubmitAssignmentTool } from "./submit-assignment";
import { ZoomSelect } from "./zoom-select";

export const DemoTools = () => {
  const { history, playground } = useClientContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    });
    return () => disposable.dispose();
  }, [history]);
  const refresh = useRefresh();

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => refresh());
    return () => disposable.dispose();
  }, [playground]);

  return (
    <ToolsLayer className="demo-free-layout-tools">
      <LeftToolSection aria-label="编程工具">
        <AddNode compact disabled={playground.config.readonly} />
        <Save compact disabled={playground.config.readonly} />
        <DownloadTool />
        <Interactive compact />
        <AutoLayout />
        <FitView />
      </LeftToolSection>

      <BottomCenterToolSection aria-label="检查与运行">
        <ProblemButton />
        <TestRunButton compact disabled={playground.config.readonly} />
      </BottomCenterToolSection>

      <TopRightToolSection aria-label="发布编程工程">
        <SubmitAssignmentTool disabled={playground.config.readonly} />
        <PublishTool disabled={playground.config.readonly} />
      </TopRightToolSection>

      <BottomLeftToolSection aria-label="历史操作">
        <Tooltip content="撤销">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconUndo />}
            disabled={!canUndo || playground.config.readonly}
            onClick={() => history.undo()}
          />
        </Tooltip>
        <Tooltip content="重做">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconRedo />}
            disabled={!canRedo || playground.config.readonly}
            onClick={() => history.redo()}
          />
        </Tooltip>
      </BottomLeftToolSection>

      <BottomRightToolSection aria-label="视图控制">
        <Minimap />
        <ViewportToolSection>
          <ZoomSelect />
        </ViewportToolSection>
      </BottomRightToolSection>
    </ToolsLayer>
  );
};
