/**
 * UserLuaNodesContext
 *
 * 在编程项目布局中包裹 Provider，当用户的 Lua 模块列表加载完成后，
 * 动态注册对应的节点到 user-lua 节点表。
 * NodeList 通过 useUserLuaNodes() 获取当前已注册节点列表，
 * 从而实现"我的模块"标签的响应式更新。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from "react";

import type { LuaModuleItem } from "@buildingai/services/web";
import { useLuaModulesQuery } from "@buildingai/services/web";

import {
  getUserLuaNodeRegistries,
  registerUserLuaNode,
  type UserLuaModuleRef,
  unregisterUserLuaNode,
} from "../nodes/user-lua/user-lua-nodes";
import { userLuaFormMeta } from "../nodes/user-lua/form-meta";
import type { FlowNodeRegistry } from "../typings";

// ── context value ────────────────────────────────────────────────────────────

type UserLuaNodesContextValue = {
  modules: LuaModuleItem[];
  registries: FlowNodeRegistry[];
  isLoading: boolean;
  /** 强制刷新节点列表（例如 Lua 模块增删后） */
  refresh: () => void;
};

const UserLuaNodesContext = createContext<UserLuaNodesContextValue>({
  modules: [],
  registries: [],
  isLoading: false,
  refresh: () => undefined,
});

export function useUserLuaNodes(): UserLuaNodesContextValue {
  return useContext(UserLuaNodesContext);
}

// ── provider ──────────────────────────────────────────────────────────────────

interface UserLuaNodesProviderProps {
  projectId?: string;
  children: ReactNode;
}

export const UserLuaNodesProvider: FC<UserLuaNodesProviderProps> = ({
  projectId,
  children,
}) => {
  const query = useLuaModulesQuery(projectId ? { projectId } : undefined);
  const modules = query.data?.items ?? [];
  const [registries, setRegistries] = useState<FlowNodeRegistry[]>(() =>
    getUserLuaNodeRegistries(),
  );

  // 模块列表变化时，重新注册/注销所有节点
  useEffect(() => {
    const current = new Map(registries.map((r) => [r.type, r]));
    const next = new Map<string, FlowNodeRegistry>();

    for (const mod of modules) {
      const type = `user_lua_${mod.id}`;
      if (current.has(type)) {
        // 已注册，跳过
        next.set(type, current.get(type)!);
      } else {
        // 新增模块，注册
        const ref: UserLuaModuleRef = {
          id: mod.id,
          name: mod.name,
          description: mod.description,
          inputSchema: mod.inputSchema as Record<string, unknown>,
          outputSchema: mod.outputSchema as Record<string, unknown>,
        };
        registerUserLuaNode(ref, userLuaFormMeta);
        const reg = getUserLuaNodeRegistries().find((r) => r.type === type);
        if (reg) next.set(type, reg);
      }
    }

    // 移除已删除的模块
    for (const type of current.keys()) {
      if (!next.has(type)) {
        const moduleId = type.replace("user_lua_", "");
        unregisterUserLuaNode(moduleId);
      }
    }

    setRegistries(getUserLuaNodeRegistries());
  }, [modules]);

  // 初次加载时同步注册表
  useEffect(() => {
    setRegistries(getUserLuaNodeRegistries());
  }, [query.dataUpdatedAt]);

  const refresh = useCallback(() => {
    setRegistries(getUserLuaNodeRegistries());
  }, []);

  return (
    <UserLuaNodesContext.Provider
      value={{ modules, registries, isLoading: query.isLoading, refresh }}
    >
      {children}
    </UserLuaNodesContext.Provider>
  );
};
