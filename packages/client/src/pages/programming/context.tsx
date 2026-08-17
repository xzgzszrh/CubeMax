import type { ProgrammingProjectItem } from "@buildingai/services/web";
import { createContext, useContext } from "react";

export const ProgrammingProjectContext = createContext<ProgrammingProjectItem | null>(null);

export function useProgrammingProject() {
  const project = useContext(ProgrammingProjectContext);
  if (!project) {
    throw new Error("useProgrammingProject must be used within ProgrammingProjectContext");
  }
  return project;
}

export function useOptionalProgrammingProject() {
  return useContext(ProgrammingProjectContext);
}
