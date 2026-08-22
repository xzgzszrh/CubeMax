/**
 * 应用工作流节点执行服务
 * 处理 Agent、Wait、Webhook、Vision、Speech、DeviceControl 等应用工作流专用节点
 */

import { Injectable } from "@nestjs/common";

import { WorkflowRuntimeTaskDto } from "./workflow-runtime.dto";

const APPLICATION_NODE_TYPES = new Set([
  "agent",
  "wait",
  "webhook",
  "vision",
  "speech",
  "device_control",
]);

type WorkflowSchema = {
  nodes?: unknown;
  [key: string]: unknown;
};

type WorkflowSchemaNode = {
  type?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export interface AgentNodeData {
  action: "switch_prompt" | "enable" | "disable";
  prompt?: string;
  promptName?: string;
}

export interface WaitNodeData {
  waitType: "mcp_call" | "webhook" | "timeout" | "variable";
  triggerId?: string;
  timeoutMs?: number;
  expectedDataPath?: string;
  expectedValue?: string;
}

export interface WebhookNodeData {
  toolName: string;
  toolDescription?: string;
  inputSchema?: Record<string, unknown>;
}

export interface VisionNodeData {
  deviceId: string;
  captureMode: "photo" | "continuous" | "stream";
  analysisPrompt?: string;
  modelId?: string;
  saveImage?: boolean;
}

export interface SpeechNodeData {
  agentId: string;
  text: string;
  mode: "speak" | "queue";
  modelId?: string;
  speed?: number;
  volume?: number;
  waitForComplete?: boolean;
}

export interface DeviceControlNodeData {
  deviceId: string;
  action: "led_toggle" | "led_rgb" | "buzzer" | "motor" | "servo" | "gpio_write" | "pwm";
  ledIndex?: number;
  ledState?: boolean;
  buzzerFrequency?: number;
  buzzerDurationMs?: number;
  motorIndex?: number;
  motorSpeed?: number;
  motorDirection?: "forward" | "reverse" | "stop";
  pwmPin?: string;
  pwmDutyCycle?: number;
  gpioPin?: string;
  gpioValue?: boolean;
}

@Injectable()
export class WorkflowApplicationExecutorService {
  /**
   * 检查节点是否为应用工作流专用节点
   */
  isApplicationNode(node: WorkflowSchemaNode): boolean {
    const type = typeof node.type === "string" ? node.type : undefined;
    return type ? APPLICATION_NODE_TYPES.has(type) : false;
  }

  /**
   * 获取节点数据
   */
  getNodeData<T = Record<string, unknown>>(node: WorkflowSchemaNode): T | undefined {
    const data = node.data;
    if (data && typeof data === "object") {
      return data as T;
    }
    return undefined;
  }

  /**
   * 验证 Agent 节点数据
   */
  validateAgentNode(data: AgentNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.action) {
      errors.push("Agent 节点缺少 action");
    }
    
    if (data.action === "switch_prompt" && !data.prompt) {
      errors.push("切换提示词操作需要提供 prompt");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证 Wait 节点数据
   */
  validateWaitNode(data: WaitNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.waitType) {
      errors.push("Wait 节点缺少 waitType");
    }
    
    if ((data.waitType === "mcp_call" || data.waitType === "webhook") && !data.triggerId) {
      errors.push("MCP 调用或 Webhook 触发需要 triggerId");
    }
    if (data.waitType === "timeout" && !(Number(data.timeoutMs) > 0)) {
      errors.push("超时等待需要大于 0 的 timeoutMs");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证 Webhook 节点数据
   */
  validateWebhookNode(data: WebhookNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.toolName) {
      errors.push("Webhook 节点缺少 toolName");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证 Vision 节点数据
   */
  validateVisionNode(data: VisionNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.deviceId) {
      errors.push("Vision 节点缺少 deviceId");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证 Speech 节点数据
   */
  validateSpeechNode(data: SpeechNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.agentId) {
      errors.push("Speech 节点缺少 agentId");
    }
    
    if (!data.text?.trim()) {
      errors.push("Speech 节点缺少 text");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证 DeviceControl 节点数据
   */
  validateDeviceControlNode(data: DeviceControlNodeData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.deviceId) {
      errors.push("DeviceControl 节点缺少 deviceId");
    }
    
    if (!data.action) {
      errors.push("DeviceControl 节点缺少 action");
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证所有应用工作流节点
   */
  validateApplicationWorkflow(schema: WorkflowSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const nodes = Array.isArray(schema.nodes) ? schema.nodes : [];
    
    for (const node of nodes) {
      if (!this.isRecord(node)) continue;
      
      const type = typeof node.type === "string" ? node.type : undefined;
      const data = this.getNodeData(node);
      
      if (!type || !data) continue;
      
      switch (type) {
        case "agent":
          const agentResult = this.validateAgentNode(data as unknown as AgentNodeData);
          if (!agentResult.valid) {
            errors.push(`Agent 节点: ${agentResult.errors.join(", ")}`);
          }
          break;
        case "wait":
          const waitResult = this.validateWaitNode(data as unknown as WaitNodeData);
          if (!waitResult.valid) {
            errors.push(`Wait 节点: ${waitResult.errors.join(", ")}`);
          }
          break;
        case "webhook":
          const webhookResult = this.validateWebhookNode(data as unknown as WebhookNodeData);
          if (!webhookResult.valid) {
            errors.push(`Webhook 节点: ${webhookResult.errors.join(", ")}`);
          }
          break;
        case "vision":
          const visionResult = this.validateVisionNode(data as unknown as VisionNodeData);
          if (!visionResult.valid) {
            errors.push(`Vision 节点: ${visionResult.errors.join(", ")}`);
          }
          break;
        case "speech":
          const speechResult = this.validateSpeechNode(data as unknown as SpeechNodeData);
          if (!speechResult.valid) {
            errors.push(`Speech 节点: ${speechResult.errors.join(", ")}`);
          }
          break;
        case "device_control":
          const deviceResult = this.validateDeviceControlNode(data as unknown as DeviceControlNodeData);
          if (!deviceResult.valid) {
            errors.push(`DeviceControl 节点: ${deviceResult.errors.join(", ")}`);
          }
          break;
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
}
