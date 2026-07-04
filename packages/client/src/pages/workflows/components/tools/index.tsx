/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconRedo, IconUndo } from "@douyinfe/semi-icons";
import { Divider, IconButton, Tooltip } from "@douyinfe/semi-ui";
import { useRefresh } from "@flowgram.ai/free-layout-editor";
import { useClientContext } from "@flowgram.ai/free-layout-editor";
import { useEffect, useState } from "react";

import { AddNode } from "../add-node";
import { ProblemButton } from "../problem-panel";
import { TestRunButton } from "../testrun/testrun-button";
import { AutoLayout } from "./auto-layout";
import { Comment } from "./comment";
import { DownloadTool } from "./download";
import { FitView } from "./fit-view";
import { Interactive } from "./interactive";
import { Minimap } from "./minimap";
import { MinimapSwitch } from "./minimap-switch";
import { Readonly } from "./readonly";
import { Save } from "./save";
import { ToolContainer, ToolSection } from "./styles";
import { SwitchLine } from "./switch-line";
import { ZoomSelect } from "./zoom-select";

export const DemoTools = () => {
  const { history, playground } = useClientContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
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
    <ToolContainer className="demo-free-layout-tools">
      <ToolSection>
        <Interactive />
        <AutoLayout />
        <SwitchLine />
        <ZoomSelect />
        <FitView />
        <MinimapSwitch minimapVisible={minimapVisible} setMinimapVisible={setMinimapVisible} />
        <Minimap visible={minimapVisible} />
        <Readonly />
        <Comment />
        <Tooltip content="Undo">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconUndo />}
            disabled={!canUndo || playground.config.readonly}
            onClick={() => history.undo()}
          />
        </Tooltip>
        <Tooltip content="Redo">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconRedo />}
            disabled={!canRedo || playground.config.readonly}
            onClick={() => history.redo()}
          />
        </Tooltip>
        <ProblemButton />
        <Save disabled={playground.config.readonly} />
        <DownloadTool />
        <Divider layout="vertical" style={{ height: "16px" }} margin={3} />
        <AddNode disabled={playground.config.readonly} />
        <Divider layout="vertical" style={{ height: "16px" }} margin={3} />
        <TestRunButton disabled={playground.config.readonly} />
      </ToolSection>
    </ToolContainer>
  );
};
