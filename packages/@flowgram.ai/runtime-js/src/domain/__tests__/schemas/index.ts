import { validateInputsSchema } from "./validate-inputs.ts";
import { twoLLMSchema } from "./two-llm.ts";
import { startDefaultSchema } from "./start-default.ts";
import { loopBreakContinueSchema } from "./loop-break-continue.ts";
import { loopSchema } from "./loop.ts";
import { llmRealSchema } from "./llm-real.ts";
import { httpSchema } from "./http.ts";
import { globalVariableSchema } from "./global-variable.ts";
import { endConstantSchema } from "./end-constant.ts";
import { codeSchema } from "./code.ts";
import { branchTwoLayersSchema } from "./branch-two-layers.ts";
import { branchSchema } from "./branch.ts";
import { basicSchema } from "./basic.ts";

export const TestSchemas = {
    twoLLMSchema,
    basicSchema,
    branchSchema,
    llmRealSchema,
    loopSchema,
    loopBreakContinueSchema,
    branchTwoLayersSchema,
    validateInputsSchema,
    httpSchema,
    codeSchema,
    endConstantSchema,
    startDefaultSchema,
    globalVariableSchema,
};
