import { nanoid } from "nanoid";

import iconVision from "../../assets/icon-vision.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const PhoneCameraNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.PhoneCamera,
  info: {
    icon: iconVision,
    description: "调用手机摄像头拍摄一张照片，供后续节点使用。",
  },
  meta: {
    nodePanelLabel: "手机摄像头",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 420 },
  },
  onAdd() {
    return {
      id: `phone_camera_${nanoid(5)}`,
      type: WorkflowNodeType.PhoneCamera,
      data: {
        title: `手机摄像头_${++index}`,
        deviceBinding: "triggering_device",
        installationId: "",
        imageUrlTtlSec: 3600,
        facingDefault: "back",
        allowSwitchFacing: true,
        resolution: "1080p",
        jpegQuality: 0.8,
        maxBytes: 2097152,
        consentTimeoutMs: 60000,
        previewMaxMs: 600000,
        timeoutMs: 30000,
        openCameraOn: "workflow_start",
        captureDelayMs: 0,
        inputs: { type: "object", properties: {} },
        inputsValues: {},
        outputs: {
          type: "object",
          properties: {
            success: { type: "boolean", title: "成功" },
            imageUrl: { type: "string", title: "图片地址" },
            fileId: { type: "string", title: "文件 ID" },
            mimeType: { type: "string", title: "MIME" },
            width: { type: "number", title: "宽度" },
            height: { type: "number", title: "高度" },
            size: { type: "number", title: "字节数" },
            sha256: { type: "string", title: "SHA-256" },
            facing: { type: "string", title: "镜头" },
            captureId: { type: "string", title: "拍摄 ID" },
          },
        },
      },
    };
  },
  formMeta,
};
