/**
 * 设备控制节点 - 直接控制 CubeCat 设备的硬件输出
 * 应用工作流中用于控制 LED、蜂鸣器、电机等外设
 */

import { nanoid } from "nanoid";

import iconDevice from "../../assets/icon-device.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const DeviceControlNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.DeviceControl,
  info: {
    icon: iconDevice,
    description: "直接控制 CubeCat 设备的硬件输出，如 LED、蜂鸣器、电机等。",
  },
  meta: {
    nodePanelLabel: "设备控制",
    nodePanelGroup: "application",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 420 },
    defaultPorts: [{ type: "output" }],
  },
  onAdd() {
    return {
      id: `device_${nanoid(5)}`,
      type: WorkflowNodeType.DeviceControl,
      data: {
        title: `设备控制_${++index}`,
        // 设备 ID
        deviceId: "",
        // 控制动作类型
        action: "led_toggle",
        // LED 控制参数
        ledIndex: 0,
        ledState: true,
        // 蜂鸣器参数
        buzzerFrequency: 1000,
        buzzerDurationMs: 500,
        // 电机参数
        motorIndex: 0,
        motorSpeed: 100,
        motorDirection: "forward",
        // PWM 参数
        pwmPin: "",
        pwmDutyCycle: 50,
        // GPIO 参数
        gpioPin: "",
        gpioValue: true,
        // 输出定义
        outputs: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              title: "执行成功",
              description: "设备控制是否执行成功",
            },
            response: {
              type: "string",
              title: "设备响应",
              description: "设备返回的状态信息",
            },
          },
        },
      },
    };
  },
  formMeta,
};
