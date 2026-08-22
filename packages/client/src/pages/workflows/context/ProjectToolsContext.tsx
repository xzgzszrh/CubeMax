import {
  programmingProjectToolKey,
  useAllXiaomiHomeDevicesQuery,
  useMcpServersAllQuery,
  useYeelightProDevicesQuery,
  type ProgrammingProjectToolRef,
  type XiaomiHomeDevice,
  type YeelightProDevice,
} from "@buildingai/services/web";
import { nanoid } from "nanoid";
import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type ReactNode,
} from "react";

import { useOptionalProgrammingProject } from "../../programming/context";
import iconDevice from "../assets/icon-device.svg";
import iconMCP from "../assets/icon-mcp.svg";
import { WorkflowNodeType } from "../nodes";
import { formMeta as mcpFormMeta } from "../nodes/mcp/form-meta";
import {
  defaultCommandForCategory,
  getCategoryLabel,
} from "../nodes/smart-home/controls";
import { formMeta as smartHomeFormMeta } from "../nodes/smart-home/form-meta";
import type { FlowNodeRegistry } from "../typings";
import {
  createMcpInputsValues,
  createMcpOutputsSchema,
  createMcpToolInputsSchema,
} from "../utils/mcp-schema";

export type ProjectToolItem =
  | {
      kind: "mcp";
      key: string;
      title: string;
      description: string;
      mcpServerId: string;
      toolName: string;
      serverLabel: string;
      inputSchema?: Record<string, unknown>;
    }
  | {
      kind: "xiaomi" | "yeelight";
      key: string;
      title: string;
      description: string;
      deviceId: string;
      category: string;
      categoryLabel: string;
      online: boolean;
      provider: "xiaomi" | "yeelight";
    };

type ProjectToolsContextValue = {
  tools: ProjectToolItem[];
  registries: FlowNodeRegistry[];
  isLoading: boolean;
};

const ProjectToolsContext = createContext<ProjectToolsContextValue>({
  tools: [],
  registries: [],
  isLoading: false,
});

export function useProjectTools(): ProjectToolsContextValue {
  return useContext(ProjectToolsContext);
}

function selectedToolRefs(tools: ProgrammingProjectToolRef[]): ProgrammingProjectToolRef[] {
  return tools.map((tool) =>
    tool.kind === "xiaomi" || tool.kind === "yeelight"
      ? tool
      : { ...tool, kind: "mcp" as const },
  );
}

function createMcpRegistry(tool: Extract<ProjectToolItem, { kind: "mcp" }>): FlowNodeRegistry {
  return {
    type: `project_tool_${tool.key}`,
    info: {
      icon: iconMCP,
      description: tool.description,
    },
    meta: {
      nodePanelLabel: tool.title,
      nodePanelGroup: "tools",
      nodePanelGroupLabel: "工具",
      nodePanelVisible: true,
      toolKey: tool.key,
      size: { width: 320, height: 390 },
    },
    onAdd() {
      const inputs = createMcpToolInputsSchema(tool.inputSchema);
      return {
        id: `mcp_${nanoid(5)}`,
        type: WorkflowNodeType.MCP,
        data: {
          title: tool.title,
          mcpServerId: tool.mcpServerId,
          toolName: tool.toolName,
          toolBound: true,
          toolInputSchema: tool.inputSchema ?? {},
          inputs,
          inputsValues: createMcpInputsValues(inputs),
          outputs: createMcpOutputsSchema(),
          timeoutMs: 60000,
          failOnToolError: true,
        },
      };
    },
    formMeta: mcpFormMeta,
  };
}

function createDeviceRegistry(
  tool: Extract<ProjectToolItem, { kind: "xiaomi" | "yeelight" }>,
): FlowNodeRegistry {
  return {
    type: `project_tool_${tool.key}`,
    info: {
      icon: iconDevice,
      description: tool.description,
    },
    meta: {
      nodePanelLabel: tool.title,
      nodePanelGroup: "tools",
      nodePanelGroupLabel: "工具",
      nodePanelVisible: true,
      toolKey: tool.key,
      size: { width: 360, height: 460 },
    },
    onAdd() {
      return {
        id: `smarthome_${nanoid(5)}`,
        type: WorkflowNodeType.SmartHome,
        data: {
          title: tool.title,
          provider: tool.provider,
          deviceId: tool.deviceId,
          deviceName: tool.title,
          category: tool.category,
          command: defaultCommandForCategory(tool.category),
          outputs: {
            type: "object",
            properties: {
              success: { type: "boolean", title: "执行成功" },
              deviceId: { type: "string", title: "设备 ID" },
              name: { type: "string", title: "设备名称" },
              online: { type: "boolean", title: "在线" },
              state: { type: "object", title: "设备状态" },
            },
          },
        },
      };
    },
    formMeta: smartHomeFormMeta,
  };
}

function deviceDescription(device: { category: string; categoryLabel?: string; roomName?: string | null; homeName?: string | null; online: boolean }) {
  const place = [device.roomName, device.homeName].filter(Boolean).join(" · ");
  return [
    getCategoryLabel(device.category, device.categoryLabel),
    place,
    device.online ? "在线" : "离线",
  ]
    .filter(Boolean)
    .join(" · ");
}

export const ProjectToolsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const project = useOptionalProgrammingProject();
  const projectTools = project?.tools;
  const selected = selectedToolRefs(projectTools ?? []);
  const enabled = Boolean(project);
  const mcpQuery = useMcpServersAllQuery({ isDisabled: false }, { enabled });
  const xiaomiQuery = useAllXiaomiHomeDevicesQuery(undefined, { enabled });
  const yeelightQuery = useYeelightProDevicesQuery({ enabled });

  const tools = useMemo<ProjectToolItem[]>(() => {
    const xiaomiById = new Map((xiaomiQuery.data ?? []).map((device) => [device.id, device]));
    const yeelightById = new Map((yeelightQuery.data ?? []).map((device) => [device.id, device]));
    const items: ProjectToolItem[] = [];

    for (const reference of selected) {
      if (reference.kind === "xiaomi" && reference.deviceId) {
        const device = xiaomiById.get(reference.deviceId) as XiaomiHomeDevice | undefined;
        items.push({
          kind: "xiaomi",
          key: programmingProjectToolKey(reference),
          title: device?.name || "米家设备",
          description: device
            ? deviceDescription(device)
            : "米家设备",
          deviceId: reference.deviceId,
          category: device?.category || "other",
          categoryLabel: device?.categoryLabel || "其他设备",
          online: device?.online ?? false,
          provider: "xiaomi",
        });
        continue;
      }
      if (reference.kind === "yeelight" && reference.deviceId) {
        const device = yeelightById.get(reference.deviceId) as YeelightProDevice | undefined;
        items.push({
          kind: "yeelight",
          key: programmingProjectToolKey(reference),
          title: device?.name || "易来设备",
          description: device
            ? deviceDescription({
                category: device.category,
                categoryLabel: device.categoryLabel,
                roomName: device.roomName,
                homeName: device.houseName,
                online: device.online,
              })
            : "易来设备",
          deviceId: reference.deviceId,
          category: device?.category || "light",
          categoryLabel: device?.categoryLabel || "灯光",
          online: device?.online ?? false,
          provider: "yeelight",
        });
        continue;
      }
      if (!reference.mcpServerId || !reference.toolName) continue;
      const server = (mcpQuery.data ?? []).find((item) => item.id === reference.mcpServerId);
      const tool = server?.tools?.find((item) => item.name === reference.toolName);
      items.push({
        kind: "mcp",
        key: programmingProjectToolKey(reference),
        title: tool?.title || tool?.name || reference.toolName,
        description: tool?.description || server?.alias || server?.name || "MCP 工具",
        mcpServerId: reference.mcpServerId,
        toolName: reference.toolName,
        serverLabel: server?.alias || server?.name || "MCP",
        inputSchema: tool?.inputSchema as Record<string, unknown> | undefined,
      });
    }
    return items;
  }, [mcpQuery.data, projectTools, xiaomiQuery.data, yeelightQuery.data]);

  const registries = useMemo(
    () =>
      tools.map((tool) =>
        tool.kind === "mcp" ? createMcpRegistry(tool) : createDeviceRegistry(tool),
      ),
    [tools],
  );

  return (
    <ProjectToolsContext.Provider
      value={{
        tools,
        registries,
        isLoading: mcpQuery.isLoading || xiaomiQuery.isLoading || yeelightQuery.isLoading,
      }}
    >
      {children}
    </ProjectToolsContext.Provider>
  );
};
