/**
 * xiaozhi.me 智能体集成服务
 * 处理智能体提示词切换、语音播报等功能
 */

import { Injectable } from "@nestjs/common";

import { HttpError, HttpErrorFactory } from "@buildingai/errors";

export interface XiaozhiAgentPrompt {
  systemPrompt: string;
  modelConfig?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools?: XiaozhiTool[];
}

export interface XiaozhiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface XiaozhiSpeechRequest {
  text: string;
  voice?: string;
  speed?: number;
  volume?: number;
}

export interface XiaozhiSpeechResponse {
  success: boolean;
  audioUrl?: string;
  durationMs?: number;
}

@Injectable()
export class XiaozhiAgentService {
  private readonly baseUrl: string;

  constructor() {
    // xiaozhi.me API 地址，从环境变量读取
    this.baseUrl = process.env.XIAOZHI_API_URL || "https://api.xiaozhi.me";
  }

  /**
   * 获取智能体配置
   */
  async getAgentConfig(agentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`获取智能体配置失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`获取智能体配置失败: ${error}`);
    }
  }

  /**
   * 切换智能体提示词
   */
  async switchPrompt(agentId: string, prompt: string, promptName?: string): Promise<{ success: boolean; previousPrompt?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: prompt,
          promptName: promptName || `自动切换 - ${new Date().toISOString()}`,
        }),
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`切换提示词失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        previousPrompt: result.previousPrompt,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`切换提示词失败: ${error}`);
    }
  }

  /**
   * 启用智能体
   */
  async enableAgent(agentId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: true,
        }),
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`启用智能体失败: ${response.statusText}`);
      }
      
      return { success: true };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`启用智能体失败: ${error}`);
    }
  }

  /**
   * 停用智能体
   */
  async disableAgent(agentId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: false,
        }),
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`停用智能体失败: ${response.statusText}`);
      }
      
      return { success: true };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`停用智能体失败: ${error}`);
    }
  }

  /**
   * 语音播报
   */
  async speak(agentId: string, request: XiaozhiSpeechRequest): Promise<XiaozhiSpeechResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`语音播报失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        audioUrl: result.audioUrl,
        durationMs: result.durationMs,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`语音播报失败: ${error}`);
    }
  }

  /**
   * 获取设备列表
   */
  async listDevices(agentId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/devices`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`获取设备列表失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.devices || [];
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`获取设备列表失败: ${error}`);
    }
  }

  /**
   * 设备控制
   */
  async controlDevice(agentId: string, deviceId: string, action: string, params: Record<string, any>): Promise<{ success: boolean; response?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/devices/${deviceId}/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...params,
        }),
      });
      
      if (!response.ok) {
        throw HttpErrorFactory.badRequest(`设备控制失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        response: result,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw HttpErrorFactory.internal(`设备控制失败: ${error}`);
    }
  }
}
