/**
 * 用户 Lua 模块的动态节点注册表。
 * 区别于内置节点，这些节点由用户创建，模块数据从服务端获取后动态注册。
 */

import { nanoid } from "nanoid";

import iconLua from "../../assets/icon-script.png";
import type { FlowNodeRegistry } from "../typings";

const USER_LUA_PREFIX = "user_lua_";

const counters = new Map<string, number>();

function nextTitle(name: string): string {
  const key = USER_LUA_PREFIX + name;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${name}_${next}`;
}

export type UserLuaModuleRef = {
  id: string;
  name: string;
  description?: string | null;
  /** 用于生成节点时预填充 inputs/outputs schema */
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type UserLuaNodeRegistryEntry = {
  registry: FlowNodeRegistry;
  ref: UserLuaModuleRef;
};

function createEmptyInputsSchema(): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  return { type: "object", properties: {}, required: [] };
}

/**
 * 动态注册表：在 Lua 模块服务端数据到达后调用。
 * 每个模块 ID 只注册一次（幂等）。
 */
const _userLuaNodeRegistries = new Map<string, FlowNodeRegistry>();

export function registerUserLuaNode(
  ref: UserLuaModuleRef,
  formMeta: FlowNodeRegistry["formMeta"],
): void {
  const type = `${USER_LUA_PREFIX}${ref.id}`;
  if (_userLuaNodeRegistries.has(type)) return;

  _userLuaNodeRegistries.set(type, {
    type,
    info: {
      icon: iconLua,
      description: ref.description ?? "用户自定义 Lua 模块",
    },
    meta: {
      nodePanelLabel: ref.name,
      nodePanelGroup: "user-lua",
      nodePanelGroupLabel: "我的模块",
      nodePanelVisible: true,
      size: { width: 320, height: 390 },
    },
    onAdd() {
      const inputSchema = (ref.inputSchema ?? {}) as Record<string, unknown>;
      const outputSchema = (ref.outputSchema ?? {}) as Record<string, unknown>;
      const properties = (inputSchema.properties ?? {}) as Record<string, unknown>;

      const inputs = {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(properties).map(([k, v]) => [k, normalizeProperty(v)]),
        ),
        required: (inputSchema.required ?? []) as string[],
      };

      const inputsValues = Object.fromEntries(
        Object.entries(properties).map(([k, v]) => [k, createDefaultFlowValue(normalizeProperty(v))]),
      );

      return {
        id: `${type}_${nanoid(5)}`,
        type,
        data: {
          title: nextTitle(ref.name),
          luaModuleId: ref.id,
          inputs,
          inputsValues,
          outputs: outputSchema,
        },
      };
    },
    formMeta,
  });
}

export function unregisterUserLuaNode(moduleId: string): void {
  const type = `${USER_LUA_PREFIX}${moduleId}`;
  _userLuaNodeRegistries.delete(type);
}

/** 获取当前所有已注册的用户 Lua 节点注册表 */
export function getUserLuaNodeRegistries(): FlowNodeRegistry[] {
  return Array.from(_userLuaNodeRegistries.values());
}

/** 根据 moduleId 查找已注册的节点类型 */
export function getUserLuaNodeType(moduleId: string): string {
  return `${USER_LUA_PREFIX}${moduleId}`;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeProperty(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return { type: "string" };
  const type = normalizeType(input.type);
  const out: Record<string, unknown> = { type };
  if (typeof input.title === "string") out.title = input.title;
  if (typeof input.description === "string") out.description = input.description;
  if (Array.isArray(input.enum)) out.enum = input.enum;
  if ("default" in input) out.default = input.default;
  if (isRecord(input.extra)) out.extra = { ...input.extra };
  if (type === "object" && isRecord(input.properties)) {
    out.properties = Object.fromEntries(
      Object.entries(input.properties).map(([k, v]) => [k, normalizeProperty(v)]),
    );
    if (Array.isArray(input.required)) out.required = input.required;
  }
  if (type === "array" && isRecord(input.items)) {
    out.items = normalizeProperty(input.items);
  }
  return out;
}

function normalizeType(type: unknown): string {
  const v = Array.isArray(type) ? type.find((t) => t !== "null") : type;
  if (typeof v === "string" && new Set(["boolean", "string", "integer", "number", "object", "array", "map"]).has(v)) {
    return v;
  }
  return "string";
}

function createDefaultFlowValue(schema: Record<string, unknown>): { type: string; content: unknown } {
  if (schema.default !== undefined) {
    return { type: "constant", content: schema.default };
  }
  switch (schema.type) {
    case "boolean":
      return { type: "constant", content: false };
    case "integer":
    case "number":
      return { type: "constant", content: 0 };
    case "object":
    case "map":
      return { type: "constant", content: {} };
    case "array":
      return { type: "constant", content: [] };
    default:
      return { type: "template", content: "" };
  }
}
