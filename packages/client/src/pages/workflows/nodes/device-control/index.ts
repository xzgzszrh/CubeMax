/**
 * 设备控制节点 - 控制 CubeCat 背光、通知和震动
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
    description: "控制 CubeCat 背光、通知和震动马达。",
  },
  meta: {
    nodePanelLabel: "设备控制",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 420 },
    defaultPorts: [{ type: "input" }, { type: "output" }],
  },
  onAdd() {
    return {
      id: `device_${nanoid(5)}`,
      type: WorkflowNodeType.DeviceControl,
      data: {
        title: `设备控制_${++index}`,
        // 设备 ID（由工程设置中配置）
        // 控制动作类型
        action: "led_toggle",
        ledIndex: 0,
        ledState: true,
        notifyText: "",
        buzzerFrequency: 1000,
        buzzerDurationMs: 400,
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
        // 输入定义（接收前置节点的控制参数）
        inputs: {
          type: "object",
          properties: {
            params: {
              type: "object",
              title: "控制参数",
              description: "来自前置节点的控制参数",
            },
          },
        },
        inputsValues: {},
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
