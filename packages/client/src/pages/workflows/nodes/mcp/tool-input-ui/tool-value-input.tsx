import type { FlowValueInputProps } from "../../../form-components";
import { FlowValueInput } from "../../../form-components";
import type { McpToolInputUi } from "./registry";

interface McpToolValueInputProps extends Omit<FlowValueInputProps, "inputUi"> {
  inputUi: McpToolInputUi;
}

export function McpToolValueInput({ inputUi, ...props }: McpToolValueInputProps) {
  return <FlowValueInput {...props} inputUi={inputUi} />;
}
