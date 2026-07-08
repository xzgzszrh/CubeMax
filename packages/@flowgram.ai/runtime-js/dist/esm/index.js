// ../interface/dist/esm/index.js
import z2 from "zod";
import z from "zod";
import z3 from "zod";
import z4 from "zod";
import z5 from "zod";
import z6 from "zod";
import z7 from "zod";
var WorkflowIOZodSchema = z.record(z.string(), z.any());
var WorkflowSnapshotZodSchema = z.object({
  id: z.string(),
  nodeID: z.string(),
  inputs: WorkflowIOZodSchema,
  outputs: WorkflowIOZodSchema.optional(),
  data: WorkflowIOZodSchema,
  branch: z.string().optional()
});
var WorkflowStatusZodShape = {
  status: z.string(),
  terminated: z.boolean(),
  startTime: z.number(),
  endTime: z.number().optional(),
  timeCost: z.number()
};
var WorkflowStatusZodSchema = z.object(WorkflowStatusZodShape);
var WorkflowNodeReportZodSchema = z.object({
  id: z.string(),
  ...WorkflowStatusZodShape,
  snapshots: z.array(WorkflowSnapshotZodSchema)
});
var WorkflowReportsZodSchema = z.record(z.string(), WorkflowNodeReportZodSchema);
var WorkflowMessageZodSchema = z.object({
  id: z.string(),
  type: z.enum(["log", "info", "debug", "error", "warning"]),
  message: z.string(),
  nodeID: z.string().optional(),
  timestamp: z.number()
});
var WorkflowMessagesZodSchema = z.record(
  z.enum(["log", "info", "debug", "error", "warning"]),
  z.array(WorkflowMessageZodSchema)
);
var WorkflowZodSchema = {
  Inputs: WorkflowIOZodSchema,
  Outputs: WorkflowIOZodSchema,
  Status: WorkflowStatusZodSchema,
  Snapshot: WorkflowSnapshotZodSchema,
  Reports: WorkflowReportsZodSchema,
  Messages: WorkflowMessagesZodSchema
};
var FlowGramAPIName = /* @__PURE__ */ ((FlowGramAPIName2) => {
  FlowGramAPIName2["ServerInfo"] = "ServerInfo";
  FlowGramAPIName2["TaskRun"] = "TaskRun";
  FlowGramAPIName2["TaskReport"] = "TaskReport";
  FlowGramAPIName2["TaskResult"] = "TaskResult";
  FlowGramAPIName2["TaskCancel"] = "TaskCancel";
  FlowGramAPIName2["TaskValidate"] = "TaskValidate";
  return FlowGramAPIName2;
})(FlowGramAPIName || {});
var TaskValidateDefine = {
  name: "TaskValidate",
  method: "POST",
  path: "/task/validate",
  module: "Task",
  schema: {
    input: z2.object({
      schema: z2.string(),
      inputs: WorkflowZodSchema.Inputs
    }),
    output: z2.object({
      valid: z2.boolean(),
      errors: z2.array(z2.string()).optional()
    })
  }
};
var TaskRunDefine = {
  name: "TaskRun",
  method: "POST",
  path: "/task/run",
  module: "Task",
  schema: {
    input: z3.object({
      schema: z3.string(),
      inputs: WorkflowZodSchema.Inputs
    }),
    output: z3.object({
      taskID: z3.string()
    })
  }
};
var TaskResultDefine = {
  name: "TaskResult",
  method: "GET",
  path: "/task/result",
  module: "Task",
  schema: {
    input: z4.object({
      taskID: z4.string()
    }),
    output: WorkflowZodSchema.Outputs
  }
};
var TaskReportDefine = {
  name: "TaskReport",
  method: "GET",
  path: "/task/report",
  module: "Task",
  schema: {
    input: z5.object({
      taskID: z5.string()
    }),
    output: z5.object({
      id: z5.string(),
      inputs: WorkflowZodSchema.Inputs,
      outputs: WorkflowZodSchema.Outputs,
      workflowStatus: WorkflowZodSchema.Status,
      reports: WorkflowZodSchema.Reports,
      messages: WorkflowZodSchema.Messages
    })
  }
};
var TaskCancelDefine = {
  name: "TaskCancel",
  method: "PUT",
  path: "/task/cancel",
  module: "Task",
  schema: {
    input: z6.object({
      taskID: z6.string()
    }),
    output: z6.object({
      success: z6.boolean()
    })
  }
};
var ServerInfoDefine = {
  name: "ServerInfo",
  method: "GET",
  path: "/info",
  module: "Info",
  schema: {
    input: z7.undefined(),
    output: z7.object({
      name: z7.string(),
      runtime: z7.string(),
      version: z7.string(),
      time: z7.string()
    })
  }
};
var FlowGramAPIs = {
  [
    "ServerInfo"
    /* ServerInfo */
  ]: ServerInfoDefine,
  [
    "TaskRun"
    /* TaskRun */
  ]: TaskRunDefine,
  [
    "TaskReport"
    /* TaskReport */
  ]: TaskReportDefine,
  [
    "TaskResult"
    /* TaskResult */
  ]: TaskResultDefine,
  [
    "TaskCancel"
    /* TaskCancel */
  ]: TaskCancelDefine,
  [
    "TaskValidate"
    /* TaskValidate */
  ]: TaskValidateDefine
};
var FlowGramAPINames = Object.keys(FlowGramAPIs);
var WorkflowPortType = /* @__PURE__ */ ((WorkflowPortType2) => {
  WorkflowPortType2["Input"] = "input";
  WorkflowPortType2["Output"] = "output";
  return WorkflowPortType2;
})(WorkflowPortType || {});
var WorkflowVariableType = /* @__PURE__ */ ((WorkflowVariableType2) => {
  WorkflowVariableType2["String"] = "string";
  WorkflowVariableType2["Integer"] = "integer";
  WorkflowVariableType2["Number"] = "number";
  WorkflowVariableType2["Boolean"] = "boolean";
  WorkflowVariableType2["Object"] = "object";
  WorkflowVariableType2["Array"] = "array";
  WorkflowVariableType2["Map"] = "map";
  WorkflowVariableType2["DateTime"] = "date-time";
  WorkflowVariableType2["Null"] = "null";
  return WorkflowVariableType2;
})(WorkflowVariableType || {});
var FlowGramNode = /* @__PURE__ */ ((FlowGramNode22) => {
  FlowGramNode22["Root"] = "root";
  FlowGramNode22["Start"] = "start";
  FlowGramNode22["End"] = "end";
  FlowGramNode22["LLM"] = "llm";
  FlowGramNode22["Code"] = "code";
  FlowGramNode22["Condition"] = "condition";
  FlowGramNode22["Loop"] = "loop";
  FlowGramNode22["Comment"] = "comment";
  FlowGramNode22["Group"] = "group";
  FlowGramNode22["BlockStart"] = "block-start";
  FlowGramNode22["BlockEnd"] = "block-end";
  FlowGramNode22["HTTP"] = "http";
  FlowGramNode22["Break"] = "break";
  FlowGramNode22["Continue"] = "continue";
  return FlowGramNode22;
})(FlowGramNode || {});
var ConditionOperator = /* @__PURE__ */ ((ConditionOperator22) => {
  ConditionOperator22["EQ"] = "eq";
  ConditionOperator22["NEQ"] = "neq";
  ConditionOperator22["GT"] = "gt";
  ConditionOperator22["GTE"] = "gte";
  ConditionOperator22["LT"] = "lt";
  ConditionOperator22["LTE"] = "lte";
  ConditionOperator22["IN"] = "in";
  ConditionOperator22["NIN"] = "nin";
  ConditionOperator22["CONTAINS"] = "contains";
  ConditionOperator22["NOT_CONTAINS"] = "not_contains";
  ConditionOperator22["IS_EMPTY"] = "is_empty";
  ConditionOperator22["IS_NOT_EMPTY"] = "is_not_empty";
  ConditionOperator22["IS_TRUE"] = "is_true";
  ConditionOperator22["IS_FALSE"] = "is_false";
  return ConditionOperator22;
})(ConditionOperator || {});
var HTTPBodyType = /* @__PURE__ */ ((HTTPBodyType2) => {
  HTTPBodyType2["None"] = "none";
  HTTPBodyType2["FormData"] = "form-data";
  HTTPBodyType2["XWwwFormUrlencoded"] = "x-www-form-urlencoded";
  HTTPBodyType2["RawText"] = "raw-text";
  HTTPBodyType2["JSON"] = "JSON";
  HTTPBodyType2["Binary"] = "binary";
  return HTTPBodyType2;
})(HTTPBodyType || {});
var IEngine = Symbol.for("Engine");
var IExecutor = Symbol.for("Executor");
var WorkflowStatus = /* @__PURE__ */ ((WorkflowStatus2) => {
  WorkflowStatus2["Pending"] = "pending";
  WorkflowStatus2["Processing"] = "processing";
  WorkflowStatus2["Succeeded"] = "succeeded";
  WorkflowStatus2["Failed"] = "failed";
  WorkflowStatus2["Cancelled"] = "canceled";
  return WorkflowStatus2;
})(WorkflowStatus || {});
var IValidation = Symbol.for("Validation");
var WorkflowMessageType = /* @__PURE__ */ ((WorkflowMessageType2) => {
  WorkflowMessageType2["Log"] = "log";
  WorkflowMessageType2["Info"] = "info";
  WorkflowMessageType2["Debug"] = "debug";
  WorkflowMessageType2["Error"] = "error";
  WorkflowMessageType2["Warn"] = "warning";
  return WorkflowMessageType2;
})(WorkflowMessageType || {});

// src/nodes/start/index.ts
var StartExecutor = class {
  constructor() {
    this.type = FlowGramNode.Start;
  }
  async execute(context) {
    return {
      outputs: context.runtime.ioCenter.inputs
    };
  }
};

// src/nodes/loop/index.ts
import { isNil } from "lodash-es";

// src/infrastructure/utils/uuid.ts
import { v4 } from "uuid";
var uuid = v4;

// src/infrastructure/utils/runtime-type.ts
var WorkflowRuntimeType;
((WorkflowRuntimeType2) => {
  WorkflowRuntimeType2.getWorkflowType = (value) => {
    if (value === null || value === void 0) {
      return WorkflowVariableType.Null;
    }
    if (typeof value === "string") {
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (iso8601Regex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return WorkflowVariableType.DateTime;
        }
      }
      return WorkflowVariableType.String;
    }
    if (typeof value === "boolean") {
      return WorkflowVariableType.Boolean;
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        return WorkflowVariableType.Integer;
      }
      return WorkflowVariableType.Number;
    }
    if (Array.isArray(value)) {
      return WorkflowVariableType.Array;
    }
    if (typeof value === "object") {
      return WorkflowVariableType.Object;
    }
    return null;
  };
  WorkflowRuntimeType2.isMatchWorkflowType = (value, type) => {
    const workflowType = (0, WorkflowRuntimeType2.getWorkflowType)(value);
    if (!workflowType) {
      return false;
    }
    return workflowType === type;
  };
  WorkflowRuntimeType2.isTypeEqual = (typeA, typeB) => {
    if (typeA === WorkflowVariableType.Number && typeB === WorkflowVariableType.Integer || typeA === WorkflowVariableType.Integer && typeB === WorkflowVariableType.Number) {
      return true;
    }
    return typeA === typeB;
  };
  WorkflowRuntimeType2.getArrayItemsType = (types) => {
    const expectedType = types[0];
    types.forEach((type) => {
      if (type !== expectedType) {
        throw new Error(`Array items type must be same, expect ${expectedType}, but got ${type}`);
      }
    });
    return expectedType;
  };
})(WorkflowRuntimeType || (WorkflowRuntimeType = {}));

// src/infrastructure/utils/traverse-nodes.ts
function traverseNodes(startNode, getConnectedNodes) {
  const visited = /* @__PURE__ */ new Set();
  const result = [];
  const traverse = (node) => {
    for (const connectedNode of getConnectedNodes(node)) {
      if (!visited.has(connectedNode.id)) {
        visited.add(connectedNode.id);
        result.push(connectedNode);
        traverse(connectedNode);
      }
    }
  };
  traverse(startNode);
  return result;
}

// src/infrastructure/utils/compare-node-groups.ts
function compareNodeGroups(groupA, groupB) {
  const flatA = groupA.flat();
  const setA = /* @__PURE__ */ new Map();
  flatA.forEach((node) => {
    setA.set(node.id, node);
  });
  const flatB = groupB.flat();
  const setB = /* @__PURE__ */ new Map();
  flatB.forEach((node) => {
    setB.set(node.id, node);
  });
  const common = [];
  const uniqueToA = [];
  const uniqueToB = [];
  setA.forEach((node, id) => {
    if (setB.has(id)) {
      common.push(node);
    } else {
      uniqueToA.push(node);
    }
  });
  setB.forEach((node, id) => {
    if (!setA.has(id)) {
      uniqueToB.push(node);
    }
  });
  return {
    common,
    uniqueToA,
    uniqueToB
  };
}

// src/infrastructure/utils/json-schema-validator.ts
var ROOT_PATH = "root";
var isRootPath = (path) => path === ROOT_PATH;
var validateValue = (value, schema, path) => {
  if (schema.$ref) {
    return { result: true };
  }
  if (schema.enum && schema.enum.length > 0) {
    if (!schema.enum.includes(value)) {
      return {
        result: false,
        errorMessage: `Value at ${path} must be one of: ${schema.enum.join(
          ", "
        )}, but got: ${JSON.stringify(value)}`
      };
    }
  }
  switch (schema.type) {
    case "boolean":
      return validateBoolean(value, path);
    case "string":
      return validateString(value, path);
    case "integer":
      return validateInteger(value, path);
    case "number":
      return validateNumber(value, path);
    case "object":
      return validateObject(value, schema, path);
    case "array":
      return validateArray(value, schema, path);
    case "map":
      return validateMap(value, schema, path);
    default:
      return {
        result: false,
        errorMessage: `Unknown type "${schema.type}" at ${path}`
      };
  }
};
var validateBoolean = (value, path) => {
  if (typeof value !== "boolean") {
    return {
      result: false,
      errorMessage: `Expected boolean at ${path}, but got: ${typeof value}`
    };
  }
  return { result: true };
};
var validateString = (value, path) => {
  if (typeof value !== "string") {
    return {
      result: false,
      errorMessage: `Expected string at ${path}, but got: ${typeof value}`
    };
  }
  return { result: true };
};
var validateInteger = (value, path) => {
  if (!Number.isInteger(value)) {
    return {
      result: false,
      errorMessage: `Expected integer at ${path}, but got: ${JSON.stringify(value)}`
    };
  }
  return { result: true };
};
var validateNumber = (value, path) => {
  if (typeof value !== "number" || isNaN(value)) {
    return {
      result: false,
      errorMessage: `Expected number at ${path}, but got: ${JSON.stringify(value)}`
    };
  }
  return { result: true };
};
var validateObject = (value, schema, path) => {
  if (value === null || value === void 0) {
    return {
      result: false,
      errorMessage: `Expected object at ${path}, but got: ${value}`
    };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      result: false,
      errorMessage: `Expected object at ${path}, but got: ${Array.isArray(value) ? "array" : typeof value}`
    };
  }
  const objectValue = value;
  if (schema.required && schema.required.length > 0) {
    for (const requiredProperty of schema.required) {
      if (!(requiredProperty in objectValue)) {
        return {
          result: false,
          errorMessage: `Missing required property "${requiredProperty}" at ${path}`
        };
      }
    }
  }
  if (schema.properties) {
    for (const [propertyName] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(propertyName) ?? false;
      if (isRequired && !(propertyName in objectValue)) {
        return {
          result: false,
          errorMessage: `Missing required property "${propertyName}" at ${path}`
        };
      }
    }
  }
  if (schema.properties) {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      if (propertyName in objectValue) {
        const propertyPath = isRootPath(path) ? propertyName : `${path}.${propertyName}`;
        const propertyResult = validateValue(
          objectValue[propertyName],
          propertySchema,
          propertyPath
        );
        if (!propertyResult.result) {
          return propertyResult;
        }
      }
    }
  }
  if (schema.additionalProperties) {
    const definedProperties = new Set(Object.keys(schema.properties || {}));
    for (const [propertyName, propertyValue] of Object.entries(objectValue)) {
      if (!definedProperties.has(propertyName)) {
        const propertyPath = isRootPath(path) ? propertyName : `${path}.${propertyName}`;
        const propertyResult = validateValue(
          propertyValue,
          schema.additionalProperties,
          propertyPath
        );
        if (!propertyResult.result) {
          return propertyResult;
        }
      }
    }
  }
  return { result: true };
};
var validateArray = (value, schema, path) => {
  if (!Array.isArray(value)) {
    return {
      result: false,
      errorMessage: `Expected array at ${path}, but got: ${typeof value}`
    };
  }
  if (schema.items) {
    for (const [index, item] of value.entries()) {
      const itemPath = `${path}[${index}]`;
      const itemResult = validateValue(item, schema.items, itemPath);
      if (!itemResult.result) {
        return itemResult;
      }
    }
  }
  return { result: true };
};
var validateMap = (value, schema, path) => {
  if (value === null || value === void 0) {
    return {
      result: false,
      errorMessage: `Expected map at ${path}, but got: ${value}`
    };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      result: false,
      errorMessage: `Expected map at ${path}, but got: ${Array.isArray(value) ? "array" : typeof value}`
    };
  }
  const mapValue = value;
  if (schema.additionalProperties) {
    for (const [key, mapItemValue] of Object.entries(mapValue)) {
      const keyPath = isRootPath(path) ? key : `${path}.${key}`;
      const keyResult = validateValue(mapItemValue, schema.additionalProperties, keyPath);
      if (!keyResult.result) {
        return keyResult;
      }
    }
  }
  return { result: true };
};
var JSONSchemaValidator = (params) => {
  const { schema, value } = params;
  try {
    const validationResult = validateValue(value, schema, ROOT_PATH);
    return validationResult;
  } catch (error) {
    return {
      result: false,
      errorMessage: `Validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// src/nodes/loop/index.ts
var LoopExecutor = class {
  constructor() {
    this.type = FlowGramNode.Loop;
  }
  async execute(context) {
    const loopNodeID = context.node.id;
    const engine = context.container.get(IEngine);
    const { value: loopArray, itemsType } = this.getLoopArrayVariable(context);
    const subNodes = context.node.children;
    const blockStartNode = subNodes.find((node) => node.type === FlowGramNode.BlockStart);
    if (!blockStartNode) {
      throw new Error("Loop block start node not found");
    }
    const blockOutputs = [];
    for (let index = 0; index < loopArray.length; index++) {
      const loopItem = loopArray[index];
      const subContext = context.runtime.sub();
      subContext.variableStore.setVariable({
        nodeID: `${loopNodeID}_locals`,
        key: "item",
        type: itemsType,
        value: loopItem
      });
      subContext.variableStore.setVariable({
        nodeID: `${loopNodeID}_locals`,
        key: "index",
        type: WorkflowVariableType.Number,
        value: index
      });
      try {
        await engine.executeNode({
          context: subContext,
          node: blockStartNode
        });
      } catch (e) {
        throw new Error(`Loop block execute error`);
      }
      if (this.isBreak(subContext)) {
        break;
      }
      if (this.isContinue(subContext)) {
        continue;
      }
      const blockOutput = this.getBlockOutput(context, subContext);
      blockOutputs.push(blockOutput);
    }
    this.setLoopNodeOutputs(context, blockOutputs);
    const outputs = this.combineBlockOutputs(context, blockOutputs);
    return {
      outputs
    };
  }
  getLoopArrayVariable(executionContext) {
    const loopNodeData = executionContext.node.data;
    const LoopArrayVariable = executionContext.runtime.state.parseRef(
      loopNodeData.loopFor
    );
    this.checkLoopArray(LoopArrayVariable);
    return LoopArrayVariable;
  }
  checkLoopArray(LoopArrayVariable) {
    const loopArray = LoopArrayVariable?.value;
    if (!loopArray || isNil(loopArray) || !Array.isArray(loopArray)) {
      throw new Error('Loop "loopFor" is required');
    }
    const loopArrayType = LoopArrayVariable.type;
    if (loopArrayType !== WorkflowVariableType.Array) {
      throw new Error('Loop "loopFor" must be an array');
    }
    const loopArrayItemType = LoopArrayVariable.itemsType;
    if (isNil(loopArrayItemType)) {
      throw new Error('Loop "loopFor.items" must be array items');
    }
  }
  getBlockOutput(executionContext, subContext) {
    const loopOutputsDeclare = this.getLoopOutputsDeclare(executionContext);
    const blockOutput = Object.entries(loopOutputsDeclare).reduce(
      (acc, [outputName, outputRef]) => {
        const outputVariable = subContext.state.parseRef(outputRef);
        if (!outputVariable) {
          return acc;
        }
        return {
          ...acc,
          [outputName]: outputVariable
        };
      },
      {}
    );
    return blockOutput;
  }
  setLoopNodeOutputs(executionContext, blockOutputs) {
    const loopNode = executionContext.node;
    const loopOutputsDeclare = this.getLoopOutputsDeclare(executionContext);
    const loopOutputNames = Object.keys(loopOutputsDeclare);
    loopOutputNames.forEach((outputName) => {
      const outputVariables = blockOutputs.map((blockOutput) => blockOutput[outputName]);
      const outputTypes = outputVariables.map((fieldVariable) => fieldVariable.type);
      const itemsType = WorkflowRuntimeType.getArrayItemsType(outputTypes);
      const value = outputVariables.map((fieldVariable) => fieldVariable.value);
      executionContext.runtime.variableStore.setVariable({
        nodeID: loopNode.id,
        key: outputName,
        type: WorkflowVariableType.Array,
        itemsType,
        value
      });
    });
  }
  combineBlockOutputs(executionContext, blockOutputs) {
    const loopOutputsDeclare = this.getLoopOutputsDeclare(executionContext);
    const loopOutputNames = Object.keys(loopOutputsDeclare);
    const loopOutput = loopOutputNames.reduce(
      (outputs, outputName) => ({
        ...outputs,
        [outputName]: blockOutputs.map((blockOutput) => blockOutput[outputName].value)
      }),
      {}
    );
    return loopOutput;
  }
  getLoopOutputsDeclare(executionContext) {
    const loopNodeData = executionContext.node.data;
    const loopOutputsDeclare = loopNodeData.loopOutputs ?? {};
    return loopOutputsDeclare;
  }
  isBreak(subContext) {
    return subContext.cache.get("loop-break") === true;
  }
  isContinue(subContext) {
    return subContext.cache.get("loop-continue") === true;
  }
};

// src/nodes/llm/index.ts
import { isNil as isNil2 } from "lodash-es";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
var LLMExecutor = class {
  constructor() {
    this.type = FlowGramNode.LLM;
  }
  async execute(context) {
    const inputs = context.inputs;
    this.checkInputs(inputs);
    const { modelName, temperature, apiKey, apiHost, systemPrompt, prompt } = inputs;
    const model = new ChatOpenAI({
      modelName,
      temperature,
      apiKey,
      configuration: {
        baseURL: apiHost
      },
      maxRetries: 3
    });
    const messages = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage(prompt));
    let apiMessage;
    try {
      apiMessage = await model.invoke(messages);
    } catch (error) {
      const errorMessage = error?.message;
      if (errorMessage === "Connection error.") {
        throw new Error(`Network error: unreachable api "${apiHost}"`);
      }
      throw error;
    }
    const result = apiMessage.content;
    return {
      outputs: {
        result
      }
    };
  }
  checkInputs(inputs) {
    const { modelName, temperature, apiKey, apiHost, prompt } = inputs;
    const missingInputs = [];
    if (!modelName) missingInputs.push("modelName");
    if (isNil2(temperature)) missingInputs.push("temperature");
    if (!apiKey) missingInputs.push("apiKey");
    if (!apiHost) missingInputs.push("apiHost");
    if (!prompt) missingInputs.push("prompt");
    if (missingInputs.length > 0) {
      throw new Error(`LLM node missing required inputs: "${missingInputs.join('", "')}"`);
    }
    this.checkApiHost(apiHost);
  }
  checkApiHost(apiHost) {
    if (!apiHost || typeof apiHost !== "string") {
      throw new Error(`Invalid API host format - ${apiHost}`);
    }
    const url = new URL(apiHost);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Invalid API host protocol - ${url.protocol}`);
    }
  }
};

// src/nodes/http/index.ts
var HTTPExecutor = class {
  constructor() {
    this.type = FlowGramNode.HTTP;
  }
  async execute(context) {
    const inputs = this.parseInputs(context);
    const response = await this.request(inputs);
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    const responseBody = await response.text();
    return {
      outputs: {
        headers: responseHeaders,
        statusCode: response.status,
        body: responseBody
      }
    };
  }
  async request(inputs) {
    const { method, url, headers, params, bodyType, body, retryTimes, timeout } = inputs;
    const urlWithParams = this.buildUrlWithParams(url, params);
    const requestOptions = {
      method,
      headers: this.prepareHeaders(headers, bodyType),
      signal: AbortSignal.timeout(timeout)
    };
    if (method !== "GET" && method !== "HEAD" && body) {
      requestOptions.body = this.prepareBody(body, bodyType);
    }
    let lastError = null;
    for (let attempt = 0; attempt <= retryTimes; attempt++) {
      try {
        const response = await fetch(urlWithParams, requestOptions);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < retryTimes) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1e3));
        }
      }
    }
    throw lastError || new Error("HTTP request failed after all retry attempts");
  }
  parseInputs(context) {
    const httpNode = context.node;
    const method = httpNode.data.api.method;
    const urlVariable = context.runtime.state.parseTemplate(httpNode.data.api.url);
    if (!urlVariable) {
      throw new Error("HTTP url is required");
    }
    const url = urlVariable.value;
    const headers = context.runtime.state.parseInputs({
      values: httpNode.data.headersValues,
      declare: httpNode.data.headers
    });
    const params = context.runtime.state.parseInputs({
      values: httpNode.data.paramsValues,
      declare: httpNode.data.params
    });
    const body = this.parseBody(context);
    const retryTimes = httpNode.data.timeout.retryTimes;
    const timeout = httpNode.data.timeout.timeout;
    const inputs = {
      method,
      url,
      headers,
      params,
      bodyType: body.bodyType,
      body: body.body,
      retryTimes,
      timeout
    };
    context.snapshot.update({
      inputs: JSON.parse(JSON.stringify(inputs))
    });
    return inputs;
  }
  parseBody(context) {
    const httpNode = context.node;
    const bodyType = httpNode.data.body.bodyType;
    if (bodyType === HTTPBodyType.None) {
      return {
        bodyType,
        body: ""
      };
    }
    if (bodyType === HTTPBodyType.JSON) {
      if (!httpNode.data.body.json) {
        throw new Error("HTTP json body is required");
      }
      const jsonVariable = context.runtime.state.parseTemplate(httpNode.data.body.json);
      if (!jsonVariable) {
        throw new Error("HTTP json body is required");
      }
      return {
        bodyType,
        body: jsonVariable.value
      };
    }
    if (bodyType === HTTPBodyType.FormData) {
      if (!httpNode.data.body.formData || !httpNode.data.body.formDataValues) {
        throw new Error("HTTP form-data body is required");
      }
      const formData = context.runtime.state.parseInputs({
        values: httpNode.data.body.formDataValues,
        declare: httpNode.data.body.formData
      });
      return {
        bodyType,
        body: JSON.stringify(formData)
      };
    }
    if (bodyType === HTTPBodyType.RawText) {
      if (!httpNode.data.body.json) {
        throw new Error("HTTP json body is required");
      }
      const jsonVariable = context.runtime.state.parseTemplate(httpNode.data.body.json);
      if (!jsonVariable) {
        throw new Error("HTTP json body is required");
      }
      return {
        bodyType,
        body: jsonVariable.value
      };
    }
    if (bodyType === HTTPBodyType.Binary) {
      if (!httpNode.data.body.binary) {
        throw new Error("HTTP binary body is required");
      }
      const binaryVariable = context.runtime.state.parseTemplate(httpNode.data.body.binary);
      if (!binaryVariable) {
        throw new Error("HTTP binary body is required");
      }
      return {
        bodyType,
        body: binaryVariable.value
      };
    }
    if (bodyType === HTTPBodyType.XWwwFormUrlencoded) {
      if (!httpNode.data.body.xWwwFormUrlencoded || !httpNode.data.body.xWwwFormUrlencodedValues) {
        throw new Error("HTTP x-www-form-urlencoded body is required");
      }
      const xWwwFormUrlencoded = context.runtime.state.parseInputs({
        values: httpNode.data.body.xWwwFormUrlencodedValues,
        declare: httpNode.data.body.xWwwFormUrlencoded
      });
      return {
        bodyType,
        body: JSON.stringify(xWwwFormUrlencoded)
      };
    }
    throw new Error(`HTTP invalid body type "${bodyType}"`);
  }
  buildUrlWithParams(url, params) {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== void 0 && value !== null && value !== "") {
        urlObj.searchParams.set(key, value);
      }
    });
    return urlObj.toString();
  }
  prepareHeaders(headers, bodyType) {
    const preparedHeaders = { ...headers };
    if (!preparedHeaders["Content-Type"] && !preparedHeaders["content-type"]) {
      switch (bodyType) {
        case HTTPBodyType.JSON:
          preparedHeaders["Content-Type"] = "application/json";
          break;
        case HTTPBodyType.FormData:
          break;
        case HTTPBodyType.XWwwFormUrlencoded:
          preparedHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          break;
        case HTTPBodyType.RawText:
          preparedHeaders["Content-Type"] = "text/plain";
          break;
        case HTTPBodyType.Binary:
          preparedHeaders["Content-Type"] = "application/octet-stream";
          break;
      }
    }
    return preparedHeaders;
  }
  prepareBody(body, bodyType) {
    switch (bodyType) {
      case HTTPBodyType.JSON:
        return body;
      case HTTPBodyType.FormData:
        const formData = new FormData();
        try {
          const data = JSON.parse(body);
          Object.entries(data).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
        } catch (error) {
          throw new Error("Invalid FormData body format");
        }
        return formData;
      case HTTPBodyType.XWwwFormUrlencoded:
        try {
          const data = JSON.parse(body);
          const params = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            params.append(key, String(value));
          });
          return params.toString();
        } catch (error) {
          throw new Error("Invalid x-www-form-urlencoded body format");
        }
      case HTTPBodyType.RawText:
      case HTTPBodyType.Binary:
      default:
        return body;
    }
  }
};

// src/nodes/end/index.ts
var EndExecutor = class {
  constructor() {
    this.type = FlowGramNode.End;
  }
  async execute(context) {
    context.runtime.ioCenter.setOutputs(context.inputs);
    return {
      outputs: context.inputs
    };
  }
};

// src/nodes/empty/index.ts
var BlockStartExecutor = class {
  constructor() {
    this.type = FlowGramNode.BlockStart;
  }
  async execute(context) {
    return {
      outputs: {}
    };
  }
};
var BlockEndExecutor = class {
  constructor() {
    this.type = FlowGramNode.BlockEnd;
  }
  async execute(context) {
    return {
      outputs: {}
    };
  }
};

// src/nodes/continue/index.ts
var ContinueExecutor = class {
  constructor() {
    this.type = FlowGramNode.Continue;
  }
  async execute(context) {
    context.runtime.cache.set("loop-continue", true);
    return {
      outputs: {}
    };
  }
};

// src/nodes/condition/index.ts
import { isNil as isNil11 } from "lodash-es";

// src/nodes/condition/rules.ts
var conditionRules = {
  [WorkflowVariableType.String]: {
    [ConditionOperator.EQ]: WorkflowVariableType.String,
    [ConditionOperator.NEQ]: WorkflowVariableType.String,
    [ConditionOperator.CONTAINS]: WorkflowVariableType.String,
    [ConditionOperator.NOT_CONTAINS]: WorkflowVariableType.String,
    [ConditionOperator.IN]: WorkflowVariableType.Array,
    [ConditionOperator.NIN]: WorkflowVariableType.Array,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.String,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.String
  },
  [WorkflowVariableType.Number]: {
    [ConditionOperator.EQ]: WorkflowVariableType.Number,
    [ConditionOperator.NEQ]: WorkflowVariableType.Number,
    [ConditionOperator.GT]: WorkflowVariableType.Number,
    [ConditionOperator.GTE]: WorkflowVariableType.Number,
    [ConditionOperator.LT]: WorkflowVariableType.Number,
    [ConditionOperator.LTE]: WorkflowVariableType.Number,
    [ConditionOperator.IN]: WorkflowVariableType.Array,
    [ConditionOperator.NIN]: WorkflowVariableType.Array,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Integer]: {
    [ConditionOperator.EQ]: WorkflowVariableType.Integer,
    [ConditionOperator.NEQ]: WorkflowVariableType.Integer,
    [ConditionOperator.GT]: WorkflowVariableType.Integer,
    [ConditionOperator.GTE]: WorkflowVariableType.Integer,
    [ConditionOperator.LT]: WorkflowVariableType.Integer,
    [ConditionOperator.LTE]: WorkflowVariableType.Integer,
    [ConditionOperator.IN]: WorkflowVariableType.Array,
    [ConditionOperator.NIN]: WorkflowVariableType.Array,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Boolean]: {
    [ConditionOperator.EQ]: WorkflowVariableType.Boolean,
    [ConditionOperator.NEQ]: WorkflowVariableType.Boolean,
    [ConditionOperator.IS_TRUE]: WorkflowVariableType.Null,
    [ConditionOperator.IS_FALSE]: WorkflowVariableType.Null,
    [ConditionOperator.IN]: WorkflowVariableType.Array,
    [ConditionOperator.NIN]: WorkflowVariableType.Array,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Object]: {
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Map]: {
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.DateTime]: {
    [ConditionOperator.EQ]: WorkflowVariableType.DateTime,
    [ConditionOperator.NEQ]: WorkflowVariableType.DateTime,
    [ConditionOperator.GT]: WorkflowVariableType.DateTime,
    [ConditionOperator.GTE]: WorkflowVariableType.DateTime,
    [ConditionOperator.LT]: WorkflowVariableType.DateTime,
    [ConditionOperator.LTE]: WorkflowVariableType.DateTime,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Array]: {
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  },
  [WorkflowVariableType.Null]: {
    [ConditionOperator.EQ]: WorkflowVariableType.Null,
    [ConditionOperator.IS_EMPTY]: WorkflowVariableType.Null,
    [ConditionOperator.IS_NOT_EMPTY]: WorkflowVariableType.Null
  }
};

// src/nodes/condition/handlers/string.ts
import { isNil as isNil3 } from "lodash-es";
var conditionStringHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.EQ) {
    const rightValue = condition.rightValue;
    return leftValue === rightValue;
  }
  if (operator === ConditionOperator.NEQ) {
    const rightValue = condition.rightValue;
    return leftValue !== rightValue;
  }
  if (operator === ConditionOperator.CONTAINS) {
    const rightValue = condition.rightValue;
    return leftValue.includes(rightValue);
  }
  if (operator === ConditionOperator.NOT_CONTAINS) {
    const rightValue = condition.rightValue;
    return !leftValue.includes(rightValue);
  }
  if (operator === ConditionOperator.IN) {
    const rightValue = condition.rightValue;
    return rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.NIN) {
    const rightValue = condition.rightValue;
    return !rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil3(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil3(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/object.ts
import { isNil as isNil4 } from "lodash-es";
var conditionObjectHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil4(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil4(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/number.ts
import { isNil as isNil5 } from "lodash-es";
var conditionNumberHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.EQ) {
    const rightValue = condition.rightValue;
    return leftValue === rightValue;
  }
  if (operator === ConditionOperator.NEQ) {
    const rightValue = condition.rightValue;
    return leftValue !== rightValue;
  }
  if (operator === ConditionOperator.GT) {
    const rightValue = condition.rightValue;
    return leftValue > rightValue;
  }
  if (operator === ConditionOperator.GTE) {
    const rightValue = condition.rightValue;
    return leftValue >= rightValue;
  }
  if (operator === ConditionOperator.LT) {
    const rightValue = condition.rightValue;
    return leftValue < rightValue;
  }
  if (operator === ConditionOperator.LTE) {
    const rightValue = condition.rightValue;
    return leftValue <= rightValue;
  }
  if (operator === ConditionOperator.IN) {
    const rightValue = condition.rightValue;
    return rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.NIN) {
    const rightValue = condition.rightValue;
    return !rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil5(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil5(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/null.ts
import { isNil as isNil6 } from "lodash-es";
var conditionNullHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.EQ) {
    return isNil6(leftValue) && isNil6(condition.rightValue);
  }
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil6(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil6(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/map.ts
import { isNil as isNil7 } from "lodash-es";
var conditionMapHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil7(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil7(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/datetime.ts
import { isNil as isNil8 } from "lodash-es";
var parseDateTime = (value) => {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
};
var conditionDateTimeHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil8(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil8(leftValue);
  }
  const leftTime = parseDateTime(leftValue).getTime();
  const rightValue = condition.rightValue;
  const rightTime = parseDateTime(rightValue).getTime();
  if (operator === ConditionOperator.EQ) {
    return leftTime === rightTime;
  }
  if (operator === ConditionOperator.NEQ) {
    return leftTime !== rightTime;
  }
  if (operator === ConditionOperator.GT) {
    return leftTime > rightTime;
  }
  if (operator === ConditionOperator.GTE) {
    return leftTime >= rightTime;
  }
  if (operator === ConditionOperator.LT) {
    return leftTime < rightTime;
  }
  if (operator === ConditionOperator.LTE) {
    return leftTime <= rightTime;
  }
  return false;
};

// src/nodes/condition/handlers/boolean.ts
import { isNil as isNil9 } from "lodash-es";
var conditionBooleanHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.EQ) {
    const rightValue = condition.rightValue;
    return leftValue === rightValue;
  }
  if (operator === ConditionOperator.NEQ) {
    const rightValue = condition.rightValue;
    return leftValue !== rightValue;
  }
  if (operator === ConditionOperator.IS_TRUE) {
    return leftValue === true;
  }
  if (operator === ConditionOperator.IS_FALSE) {
    return leftValue === false;
  }
  if (operator === ConditionOperator.IN) {
    const rightValue = condition.rightValue;
    return rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.NIN) {
    const rightValue = condition.rightValue;
    return !rightValue.includes(leftValue);
  }
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil9(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil9(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/array.ts
import { isNil as isNil10 } from "lodash-es";
var conditionArrayHandler = (condition) => {
  const { operator } = condition;
  const leftValue = condition.leftValue;
  if (operator === ConditionOperator.IS_EMPTY) {
    return isNil10(leftValue);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isNil10(leftValue);
  }
  return false;
};

// src/nodes/condition/handlers/index.ts
var conditionHandlers = {
  [WorkflowVariableType.String]: conditionStringHandler,
  [WorkflowVariableType.Number]: conditionNumberHandler,
  [WorkflowVariableType.Integer]: conditionNumberHandler,
  [WorkflowVariableType.Boolean]: conditionBooleanHandler,
  [WorkflowVariableType.Object]: conditionObjectHandler,
  [WorkflowVariableType.Map]: conditionMapHandler,
  [WorkflowVariableType.Array]: conditionArrayHandler,
  [WorkflowVariableType.DateTime]: conditionDateTimeHandler,
  [WorkflowVariableType.Null]: conditionNullHandler
};

// src/nodes/condition/index.ts
var ConditionExecutor = class {
  constructor() {
    this.type = FlowGramNode.Condition;
  }
  async execute(context) {
    const conditions = context.node.data?.conditions;
    if (!conditions) {
      return {
        outputs: {}
      };
    }
    const parsedConditions = conditions.map((item) => this.parseCondition(item, context)).filter((item) => this.checkCondition(item));
    const activatedCondition = parsedConditions.find((item) => this.handleCondition(item));
    if (!activatedCondition) {
      return {
        outputs: {},
        branch: "else"
      };
    }
    return {
      outputs: {},
      branch: activatedCondition.key
    };
  }
  parseCondition(item, context) {
    const { key, value } = item;
    const { left, operator, right } = value;
    const parsedLeft = context.runtime.state.parseRef(left);
    const leftValue = parsedLeft?.value ?? null;
    const leftType = parsedLeft?.type ?? WorkflowVariableType.Null;
    const expectedRightType = this.getRuleType({ leftType, operator });
    const parsedRight = Boolean(right) ? context.runtime.state.parseFlowValue({
      flowValue: right,
      declareType: expectedRightType
    }) : null;
    const rightValue = parsedRight?.value ?? null;
    const rightType = parsedRight?.type ?? WorkflowVariableType.Null;
    return {
      key,
      leftValue,
      leftType,
      rightValue,
      rightType,
      operator
    };
  }
  checkCondition(condition) {
    const rule = conditionRules[condition.leftType];
    if (isNil11(rule)) {
      throw new Error(`Condition left type "${condition.leftType}" is not supported`);
    }
    const ruleType = rule[condition.operator];
    if (isNil11(ruleType)) {
      throw new Error(
        `Condition left type "${condition.leftType}" has no operator "${condition.operator}"`
      );
    }
    if (!WorkflowRuntimeType.isTypeEqual(ruleType, condition.rightType)) {
      return false;
    }
    return true;
  }
  handleCondition(condition) {
    const handler = conditionHandlers[condition.leftType];
    if (!handler) {
      throw new Error(`Condition left type ${condition.leftType} is not supported`);
    }
    const isActive = handler(condition);
    return isActive;
  }
  getRuleType(params) {
    const { leftType, operator } = params;
    const rule = conditionRules[leftType];
    if (isNil11(rule)) {
      return WorkflowVariableType.Null;
    }
    const ruleType = rule[operator];
    if (isNil11(ruleType)) {
      return WorkflowVariableType.Null;
    }
    return ruleType;
  }
};

// src/nodes/code/index.ts
import { getQuickJS, shouldInterruptAfterDeadline } from "quickjs-emscripten";
var CodeExecutor = class {
  constructor() {
    this.type = FlowGramNode.Code;
  }
  async execute(context) {
    const inputs = this.parseInputs(context);
    if (inputs.script.language === "javascript") {
      return this.javascript(inputs);
    }
    throw new Error(`Unsupported code language "${inputs.script.language}"`);
  }
  parseInputs(context) {
    const codeNode = context.node;
    const params = context.inputs;
    const { language, content } = codeNode.data.script;
    if (!content) {
      throw new Error("Code content is required");
    }
    return {
      params,
      script: {
        language,
        content
      }
    };
  }
  async javascript(inputs) {
    const { params = {}, script } = inputs;
    const serializedParams = JSON.stringify(params);
    const QuickJS = await getQuickJS();
    const context = QuickJS.newContext();
    try {
      const runtime = context.runtime;
      runtime.setMemoryLimit(32 * 1024 * 1024);
      runtime.setMaxStackSize(512 * 1024);
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 6e4));
      const wrappedCode = `
'use strict';

${script.content}

if (typeof main !== 'function') {
  throw new Error('main function is required in the script');
}

const __params__ = ${serializedParams};
main({ params: __params__ });
`;
      const evalResult = context.evalCode(wrappedCode);
      const resultHandle = context.unwrapResult(evalResult);
      let rawResult;
      try {
        const promiseState = context.getPromiseState(resultHandle);
        if (promiseState.type === "fulfilled") {
          rawResult = context.dump(promiseState.value);
          promiseState.value.dispose();
        } else if (promiseState.type === "rejected") {
          const errMsg = context.dump(promiseState.error);
          promiseState.error.dispose();
          throw new Error(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
        } else {
          const resolvedResult = await context.resolvePromise(resultHandle);
          const resolvedHandle = context.unwrapResult(resolvedResult);
          rawResult = context.dump(resolvedHandle);
          resolvedHandle.dispose();
        }
      } finally {
        resultHandle.dispose();
      }
      const outputs = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : { result: rawResult };
      return { outputs };
    } catch (error) {
      throw new Error(`Code execution failed: ${error.message}`);
    } finally {
      context.dispose();
    }
  }
};

// src/nodes/break/index.ts
var BreakExecutor = class {
  constructor() {
    this.type = FlowGramNode.Break;
  }
  async execute(context) {
    context.runtime.cache.set("loop-break", true);
    return {
      outputs: {}
    };
  }
};
var mcpExecutor;
var registerMCPExecutor = (executor) => {
  mcpExecutor = executor;
};
var MCPExecutor = class {
  constructor() {
    this.type = "mcp";
  }
  async execute(context) {
    if (!mcpExecutor) {
      throw new Error("MCP executor is not registered");
    }
    const rawOutputs = await mcpExecutor({
      userId: context.runtime.context?.userId,
      node: {
        id: context.node.id,
        type: context.node.type,
        data: context.node.data
      },
      inputs: context.inputs
    });
    const outputs = rawOutputs && typeof rawOutputs === "object" && !Array.isArray(rawOutputs) ? rawOutputs : { result: rawOutputs };
    return { outputs };
  }
};

// src/nodes/index.ts
var WorkflowRuntimeNodeExecutors = [
  StartExecutor,
  EndExecutor,
  LLMExecutor,
  ConditionExecutor,
  LoopExecutor,
  BlockStartExecutor,
  BlockEndExecutor,
  HTTPExecutor,
  MCPExecutor,
  CodeExecutor,
  BreakExecutor,
  ContinueExecutor
];

// src/domain/validation/validators/cycle-detection.ts
var cycleDetection = (schema) => {
  const { nodes, edges } = schema;
  const adjacencyList = /* @__PURE__ */ new Map();
  const nodeIds = new Set(nodes.map((node) => node.id));
  nodeIds.forEach((nodeId) => {
    adjacencyList.set(nodeId, []);
  });
  edges.forEach((edge) => {
    const sourceList = adjacencyList.get(edge.sourceNodeID);
    if (sourceList) {
      sourceList.push(edge.targetNodeID);
    }
  });
  let NodeStatus;
  ((NodeStatus2) => {
    NodeStatus2[NodeStatus2["Unvisited"] = 0] = "Unvisited";
    NodeStatus2[NodeStatus2["Visiting"] = 1] = "Visiting";
    NodeStatus2[NodeStatus2["Visited"] = 2] = "Visited";
  })(NodeStatus || (NodeStatus = {}));
  const nodeStatusMap = /* @__PURE__ */ new Map();
  nodeIds.forEach((nodeId) => {
    nodeStatusMap.set(nodeId, 0 /* Unvisited */);
  });
  const detectCycleFromNode = (nodeId) => {
    nodeStatusMap.set(nodeId, 1 /* Visiting */);
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const neighborColor = nodeStatusMap.get(neighbor);
      if (neighborColor === 1 /* Visiting */) {
        return true;
      }
      if (neighborColor === 0 /* Unvisited */ && detectCycleFromNode(neighbor)) {
        return true;
      }
    }
    nodeStatusMap.set(nodeId, 2 /* Visited */);
    return false;
  };
  for (const nodeId of nodeIds) {
    if (nodeStatusMap.get(nodeId) === 0 /* Unvisited */) {
      if (detectCycleFromNode(nodeId)) {
        throw new Error("Workflow schema contains a cycle, which is not allowed");
      }
    }
  }
  nodes.forEach((node) => {
    if (node.blocks) {
      cycleDetection({
        nodes: node.blocks,
        edges: node.edges ?? []
      });
    }
  });
};

// src/domain/validation/validators/start-end-node.ts
var blockStartEndNode = (schema) => {
  const { blockStartNodes, blockEndNodes } = schema.nodes.reduce(
    (acc, node) => {
      if (node.type === FlowGramNode.BlockStart) {
        acc.blockStartNodes.push(node);
      } else if (node.type === FlowGramNode.BlockEnd) {
        acc.blockEndNodes.push(node);
      }
      return acc;
    },
    { blockStartNodes: [], blockEndNodes: [] }
  );
  if (!blockStartNodes.length && !blockEndNodes.length) {
    throw new Error("Workflow block schema must have a block-start node and a block-end node");
  }
  if (!blockStartNodes.length) {
    throw new Error("Workflow block schema must have a block-start node");
  }
  if (!blockEndNodes.length) {
    throw new Error("Workflow block schema must have an block-end node");
  }
  if (blockStartNodes.length > 1) {
    throw new Error("Workflow block schema must have only one block-start node");
  }
  if (blockEndNodes.length > 1) {
    throw new Error("Workflow block schema must have only one block-end node");
  }
  schema.nodes.forEach((node) => {
    if (node.blocks) {
      blockStartEndNode({
        nodes: node.blocks,
        edges: node.edges ?? []
      });
    }
  });
};
var startEndNode = (schema) => {
  const { startNodes, endNodes } = schema.nodes.reduce(
    (acc, node) => {
      if (node.type === FlowGramNode.Start) {
        acc.startNodes.push(node);
      } else if (node.type === FlowGramNode.End) {
        acc.endNodes.push(node);
      }
      return acc;
    },
    { startNodes: [], endNodes: [] }
  );
  if (!startNodes.length && !endNodes.length) {
    throw new Error("Workflow schema must have a start node and an end node");
  }
  if (!startNodes.length) {
    throw new Error("Workflow schema must have a start node");
  }
  if (!endNodes.length) {
    throw new Error("Workflow schema must have an end node");
  }
  if (startNodes.length > 1) {
    throw new Error("Workflow schema must have only one start node");
  }
  if (endNodes.length > 1) {
    throw new Error("Workflow schema must have only one end node");
  }
  schema.nodes.forEach((node) => {
    if (node.blocks) {
      blockStartEndNode({
        nodes: node.blocks,
        edges: node.edges ?? []
      });
    }
  });
};

// src/domain/validation/validators/edge-source-target-exist.ts
var edgeSourceTargetExist = (schema) => {
  const { nodes, edges } = schema;
  const nodeSet = new Set(nodes.map((node) => node.id));
  edges.forEach((edge) => {
    if (!nodeSet.has(edge.sourceNodeID)) {
      throw new Error(`Workflow schema edge source node "${edge.sourceNodeID}" not exist`);
    }
    if (!nodeSet.has(edge.targetNodeID)) {
      throw new Error(`Workflow schema edge target node "${edge.targetNodeID}" not exist`);
    }
  });
  nodes.forEach((node) => {
    if (node.blocks) {
      edgeSourceTargetExist({
        nodes: node.blocks,
        edges: node.edges ?? []
      });
    }
  });
};

// src/domain/validation/validators/schema-format.ts
var schemaFormat = (schema) => {
  if (!schema || typeof schema !== "object") {
    throw new Error("Workflow schema must be a valid object");
  }
  if (!Array.isArray(schema.nodes)) {
    throw new Error("Workflow schema must have a valid nodes array");
  }
  if (!Array.isArray(schema.edges)) {
    throw new Error("Workflow schema must have a valid edges array");
  }
  schema.nodes.forEach((node, index) => {
    validateNodeFormat(node, `nodes[${index}]`);
  });
  schema.edges.forEach((edge, index) => {
    validateEdgeFormat(edge, `edges[${index}]`);
  });
  schema.nodes.forEach((node, nodeIndex) => {
    if (node.blocks) {
      if (!Array.isArray(node.blocks)) {
        throw new Error(`Node nodes[${nodeIndex}].blocks must be an array`);
      }
      const nestedSchema = {
        nodes: node.blocks,
        edges: node.edges || []
      };
      schemaFormat(nestedSchema);
    }
  });
};
var validateNodeFormat = (node, path) => {
  if (!node || typeof node !== "object") {
    throw new Error(`${path} must be a valid object`);
  }
  if (typeof node.id !== "string" || !node.id.trim()) {
    throw new Error(`${path}.id must be a non-empty string`);
  }
  if (typeof node.type !== "string" || !node.type.trim()) {
    throw new Error(`${path}.type must be a non-empty string`);
  }
  if (!node.meta || typeof node.meta !== "object") {
    throw new Error(`${path}.meta must be a valid object`);
  }
  if (!node.data || typeof node.data !== "object") {
    throw new Error(`${path}.data must be a valid object`);
  }
  if (node.blocks !== void 0 && !Array.isArray(node.blocks)) {
    throw new Error(`${path}.blocks must be an array if present`);
  }
  if (node.edges !== void 0 && !Array.isArray(node.edges)) {
    throw new Error(`${path}.edges must be an array if present`);
  }
  if (node.data.inputs !== void 0 && (typeof node.data.inputs !== "object" || node.data.inputs === null)) {
    throw new Error(`${path}.data.inputs must be a valid object if present`);
  }
  if (node.data.outputs !== void 0 && (typeof node.data.outputs !== "object" || node.data.outputs === null)) {
    throw new Error(`${path}.data.outputs must be a valid object if present`);
  }
  if (node.data.inputsValues !== void 0 && (typeof node.data.inputsValues !== "object" || node.data.inputsValues === null)) {
    throw new Error(`${path}.data.inputsValues must be a valid object if present`);
  }
  if (node.data.title !== void 0 && typeof node.data.title !== "string") {
    throw new Error(`${path}.data.title must be a string if present`);
  }
};
var validateEdgeFormat = (edge, path) => {
  if (!edge || typeof edge !== "object") {
    throw new Error(`${path} must be a valid object`);
  }
  if (typeof edge.sourceNodeID !== "string" || !edge.sourceNodeID.trim()) {
    throw new Error(`${path}.sourceNodeID must be a non-empty string`);
  }
  if (typeof edge.targetNodeID !== "string" || !edge.targetNodeID.trim()) {
    throw new Error(`${path}.targetNodeID must be a non-empty string`);
  }
  if (edge.sourcePortID !== void 0 && typeof edge.sourcePortID !== "string") {
    throw new Error(`${path}.sourcePortID must be a string if present`);
  }
  if (edge.targetPortID !== void 0 && typeof edge.targetPortID !== "string") {
    throw new Error(`${path}.targetPortID must be a string if present`);
  }
};

// src/domain/validation/index.ts
var WorkflowRuntimeValidation = class {
  invoke(params) {
    const { schema, inputs } = params;
    const schemaValidationResult = this.schema(schema);
    if (!schemaValidationResult.valid) {
      return schemaValidationResult;
    }
    const inputsValidationResult = this.inputs(this.getWorkflowInputsDeclare(schema), inputs);
    if (!inputsValidationResult.valid) {
      return inputsValidationResult;
    }
    return {
      valid: true
    };
  }
  schema(schema) {
    const errors = [];
    const validations = [
      () => schemaFormat(schema),
      () => cycleDetection(schema),
      () => edgeSourceTargetExist(schema),
      () => startEndNode(schema)
    ];
    validations.forEach((validation) => {
      try {
        validation();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    });
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : void 0
    };
  }
  inputs(inputsSchema, inputs) {
    const { result, errorMessage } = JSONSchemaValidator({
      schema: inputsSchema,
      value: inputs
    });
    if (!result) {
      const error = `JSON Schema validation failed: ${errorMessage}`;
      return {
        valid: false,
        errors: [error]
      };
    }
    return {
      valid: true
    };
  }
  getWorkflowInputsDeclare(schema) {
    const startNode = schema.nodes.find((node) => node.type === FlowGramNode.Start);
    if (!startNode) {
      throw new Error("Workflow schema must have a start node");
    }
    return startNode.data.outputs;
  }
};

// src/domain/executor/index.ts
var WorkflowRuntimeExecutor = class {
  constructor(nodeExecutors) {
    this.nodeExecutors = /* @__PURE__ */ new Map();
    nodeExecutors.forEach((executor) => {
      this.register(new executor());
    });
  }
  register(executor) {
    this.nodeExecutors.set(executor.type, executor);
  }
  async execute(context) {
    const nodeType = context.node.type;
    const nodeExecutor = this.nodeExecutors.get(nodeType);
    if (!nodeExecutor) {
      throw new Error(`No executor found for node type ${nodeType}`);
    }
    const output = await nodeExecutor.execute(context);
    return output;
  }
};

// src/domain/task/index.ts
var WorkflowRuntimeTask = class _WorkflowRuntimeTask {
  constructor(params) {
    this.id = uuid();
    this.context = params.context;
    this.processing = params.processing;
  }
  cancel() {
    this.context.statusCenter.workflow.cancel();
    const cancelNodeIDs = this.context.statusCenter.getStatusNodeIDs(WorkflowStatus.Processing);
    cancelNodeIDs.forEach((nodeID) => {
      this.context.statusCenter.nodeStatus(nodeID).cancel();
    });
  }
  static create(params) {
    return new _WorkflowRuntimeTask(params);
  }
};

// src/domain/message/message-value-object/index.ts
var WorkflowRuntimeMessage;
((WorkflowRuntimeMessage2) => {
  WorkflowRuntimeMessage2.create = (params) => {
    const message = {
      id: uuid(),
      ...params
    };
    if (!params.timestamp) {
      message.timestamp = Date.now();
    }
    return message;
  };
})(WorkflowRuntimeMessage || (WorkflowRuntimeMessage = {}));

// src/domain/message/message-center/index.ts
var WorkflowRuntimeMessageCenter = class {
  init() {
    this.messages = {
      [WorkflowMessageType.Log]: [],
      [WorkflowMessageType.Info]: [],
      [WorkflowMessageType.Debug]: [],
      [WorkflowMessageType.Error]: [],
      [WorkflowMessageType.Warn]: []
    };
  }
  dispose() {
  }
  log(data) {
    const message = WorkflowRuntimeMessage.create({
      type: WorkflowMessageType.Log,
      ...data
    });
    this.messages[WorkflowMessageType.Log].push(message);
    return message;
  }
  info(data) {
    const message = WorkflowRuntimeMessage.create({
      type: WorkflowMessageType.Info,
      ...data
    });
    this.messages[WorkflowMessageType.Info].push(message);
    return message;
  }
  debug(data) {
    const message = WorkflowRuntimeMessage.create({
      type: WorkflowMessageType.Debug,
      ...data
    });
    this.messages[WorkflowMessageType.Debug].push(message);
    return message;
  }
  error(data) {
    const message = WorkflowRuntimeMessage.create({
      type: WorkflowMessageType.Error,
      ...data
    });
    this.messages[WorkflowMessageType.Error].push(message);
    return message;
  }
  warn(data) {
    const message = WorkflowRuntimeMessage.create({
      type: WorkflowMessageType.Warn,
      ...data
    });
    this.messages[WorkflowMessageType.Warn].push(message);
    return message;
  }
  export() {
    return {
      [WorkflowMessageType.Log]: this.messages[WorkflowMessageType.Log].slice(),
      [WorkflowMessageType.Info]: this.messages[WorkflowMessageType.Info].slice(),
      [WorkflowMessageType.Debug]: this.messages[WorkflowMessageType.Debug].slice(),
      [WorkflowMessageType.Error]: this.messages[WorkflowMessageType.Error].slice(),
      [WorkflowMessageType.Warn]: this.messages[WorkflowMessageType.Warn].slice()
    };
  }
};

// src/domain/cache/index.ts
var WorkflowRuntimeCache = class {
  init() {
    this.map = /* @__PURE__ */ new Map();
  }
  dispose() {
    this.map.clear();
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, value) {
    this.map.set(key, value);
    return this;
  }
  delete(key) {
    return this.map.delete(key);
  }
  has(key) {
    return this.map.has(key);
  }
};

// src/domain/variable/variable-store/index.ts
import { get, set } from "lodash-es";

// src/domain/variable/variable-value-object/index.ts
var WorkflowRuntimeVariable;
((WorkflowRuntimeVariable2) => {
  WorkflowRuntimeVariable2.create = (params) => ({
    id: uuid(),
    ...params
  });
})(WorkflowRuntimeVariable || (WorkflowRuntimeVariable = {}));

// src/domain/variable/variable-store/index.ts
var WorkflowRuntimeVariableStore = class {
  constructor() {
    this.id = uuid();
  }
  init() {
    this.store = /* @__PURE__ */ new Map();
  }
  dispose() {
    this.store.clear();
  }
  setParent(parent) {
    this.parent = parent;
  }
  globalGet(nodeID) {
    const store = this.store.get(nodeID);
    if (!store && this.parent) {
      return this.parent.globalGet(nodeID);
    }
    return store;
  }
  setVariable(params) {
    const { nodeID, key, value, type, itemsType } = params;
    if (!this.store.has(nodeID)) {
      this.store.set(nodeID, /* @__PURE__ */ new Map());
    }
    const nodeStore = this.store.get(nodeID);
    const variable = WorkflowRuntimeVariable.create({
      nodeID,
      key,
      value,
      type,
      // TODO check type
      itemsType
      // TODO check is array
    });
    nodeStore.set(key, variable);
  }
  setValue(params) {
    const { nodeID, variableKey, variablePath, value } = params;
    if (!this.store.has(nodeID)) {
      this.store.set(nodeID, /* @__PURE__ */ new Map());
    }
    const nodeStore = this.store.get(nodeID);
    if (!nodeStore.has(variableKey)) {
      const variable2 = WorkflowRuntimeVariable.create({
        nodeID,
        key: variableKey,
        value: {},
        type: WorkflowVariableType.Object
      });
      nodeStore.set(variableKey, variable2);
    }
    const variable = nodeStore.get(variableKey);
    if (!variablePath) {
      variable.value = value;
      return;
    }
    set(variable.value, variablePath, value);
  }
  getValue(params) {
    const { nodeID, variableKey, variablePath } = params;
    const variable = this.globalGet(nodeID)?.get(variableKey);
    if (!variable) {
      return null;
    }
    if (!variablePath || variablePath.length === 0) {
      return {
        value: variable.value,
        type: variable.type,
        itemsType: variable.itemsType
      };
    }
    const value = get(variable.value, variablePath);
    const type = WorkflowRuntimeType.getWorkflowType(value);
    if (!type) {
      return null;
    }
    if (type === WorkflowVariableType.Array && Array.isArray(value)) {
      const itemsType = WorkflowRuntimeType.getWorkflowType(value[0]);
      if (!itemsType) {
        return null;
      }
      return {
        value,
        type,
        itemsType
      };
    }
    return {
      value,
      type
    };
  }
};

// src/domain/status/status-entity/index.ts
var WorkflowRuntimeStatus = class _WorkflowRuntimeStatus {
  constructor() {
    this.id = uuid();
    this._status = WorkflowStatus.Pending;
  }
  get status() {
    return this._status;
  }
  get terminated() {
    return [WorkflowStatus.Succeeded, WorkflowStatus.Failed, WorkflowStatus.Cancelled].includes(
      this.status
    );
  }
  get startTime() {
    return this._startTime;
  }
  get endTime() {
    return this._endTime;
  }
  get timeCost() {
    if (!this.startTime) {
      return 0;
    }
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }
  process() {
    this._status = WorkflowStatus.Processing;
    this._startTime = Date.now();
    this._endTime = void 0;
  }
  success() {
    if (this.terminated) {
      return;
    }
    this._status = WorkflowStatus.Succeeded;
    this._endTime = Date.now();
  }
  fail() {
    if (this.terminated) {
      return;
    }
    this._status = WorkflowStatus.Failed;
    this._endTime = Date.now();
  }
  cancel() {
    if (this.terminated) {
      return;
    }
    this._status = WorkflowStatus.Cancelled;
    this._endTime = Date.now();
  }
  export() {
    return {
      status: this.status,
      terminated: this.terminated,
      startTime: this.startTime,
      endTime: this.endTime,
      timeCost: this.timeCost
    };
  }
  static create() {
    const status = new _WorkflowRuntimeStatus();
    return status;
  }
};

// src/domain/status/status-center/index.ts
var WorkflowRuntimeStatusCenter = class {
  init() {
    this._workflowStatus = WorkflowRuntimeStatus.create();
    this._nodeStatus = /* @__PURE__ */ new Map();
  }
  dispose() {
  }
  get workflow() {
    return this._workflowStatus;
  }
  get workflowStatus() {
    return this._workflowStatus;
  }
  nodeStatus(nodeID) {
    if (!this._nodeStatus.has(nodeID)) {
      this._nodeStatus.set(nodeID, WorkflowRuntimeStatus.create());
    }
    const status = this._nodeStatus.get(nodeID);
    return status;
  }
  getStatusNodeIDs(status) {
    return Array.from(this._nodeStatus.entries()).filter(([, nodeStatus]) => nodeStatus.status === status).map(([nodeID]) => nodeID);
  }
  exportNodeStatus() {
    return Object.fromEntries(
      Array.from(this._nodeStatus.entries()).map(([nodeID, status]) => [nodeID, status.export()])
    );
  }
};

// src/domain/state/index.ts
import { isNil as isNil12 } from "lodash-es";
var WorkflowRuntimeState = class {
  constructor(variableStore) {
    this.variableStore = variableStore;
    this.id = uuid();
  }
  init(schema) {
    this.setGlobalVariable(schema?.globalVariable);
    this.executedNodes = /* @__PURE__ */ new Set();
  }
  dispose() {
    this.executedNodes.clear();
  }
  getNodeInputs(node) {
    const inputsDeclare = node.declare.inputs;
    const inputsValues = node.declare.inputsValues;
    return this.parseInputs({
      values: inputsValues,
      declare: inputsDeclare
    });
  }
  setNodeOutputs(params) {
    const { node, outputs } = params;
    const outputsDeclare = node.declare.outputs;
    if (outputsDeclare?.type !== "object" || !outputsDeclare.properties) {
      return;
    }
    Object.entries(outputsDeclare.properties).forEach(([key, typeInfo]) => {
      if (!key || !typeInfo) {
        return;
      }
      const type = typeInfo.type;
      const itemsType = typeInfo.items?.type;
      const defaultValue = this.parseJSONContent(typeInfo.default, type);
      const value = outputs[key] ?? defaultValue;
      this.variableStore.setVariable({
        nodeID: node.id,
        key,
        value,
        type,
        itemsType
      });
    });
  }
  parseInputs(params) {
    const { values, declare } = params;
    if (!declare || !values) {
      return {};
    }
    return Object.entries(values).reduce((prev, [key, flowValue]) => {
      const typeInfo = declare.properties?.[key];
      if (!typeInfo) {
        return prev;
      }
      const declareType = typeInfo.type;
      const result = this.parseFlowValue({ flowValue, declareType });
      if (!result) {
        return prev;
      }
      const { value, type } = result;
      if (!WorkflowRuntimeType.isTypeEqual(type, declareType)) {
        return prev;
      }
      prev[key] = value;
      return prev;
    }, {});
  }
  parseRef(ref) {
    if (ref?.type !== "ref") {
      throw new Error(`Invalid ref value: ${ref}`);
    }
    if (!ref.content || ref.content.length < 2) {
      return null;
    }
    const [nodeID, variableKey, ...variablePath] = ref.content;
    const result = this.variableStore.getValue({
      nodeID,
      variableKey,
      variablePath
    });
    if (!result) {
      return null;
    }
    return result;
  }
  parseTemplate(template) {
    if (template?.type !== "template") {
      throw new Error(`Invalid template value: ${template}`);
    }
    if (!template.content) {
      return null;
    }
    const parsedValue = template.content.replace(
      /\{\{([^\}]+)\}\}/g,
      (match, pattern) => {
        const ref = pattern.trim().split(".");
        const variable = this.parseRef({
          type: "ref",
          content: ref
        });
        if (!variable) {
          return "";
        }
        return variable.value;
      }
    );
    return {
      type: WorkflowVariableType.String,
      value: parsedValue
    };
  }
  parseFlowValue(params) {
    const { flowValue, declareType } = params;
    if (!flowValue?.type) {
      throw new Error(`Invalid flow value type: ${flowValue.type}`);
    }
    if (flowValue.type === "constant") {
      const value = this.parseJSONContent(flowValue.content, declareType);
      const type = declareType ?? WorkflowRuntimeType.getWorkflowType(value);
      if (isNil12(value) || !type) {
        return null;
      }
      return {
        value,
        type
      };
    }
    if (flowValue.type === "ref") {
      return this.parseRef(flowValue);
    }
    if (flowValue.type === "template") {
      return this.parseTemplate(flowValue);
    }
    throw new Error(`Unknown flow value type: ${flowValue.type}`);
  }
  isExecutedNode(node) {
    return this.executedNodes.has(node.id);
  }
  addExecutedNode(node) {
    this.executedNodes.add(node.id);
  }
  parseJSONContent(jsonContent, declareType) {
    const JSONTypes = [
      WorkflowVariableType.Object,
      WorkflowVariableType.Array,
      WorkflowVariableType.Map
    ];
    if (declareType && JSONTypes.includes(declareType) && typeof jsonContent === "string") {
      try {
        return JSON.parse(jsonContent);
      } catch (e) {
        return jsonContent;
      }
    }
    return jsonContent;
  }
  setGlobalVariable(globalVariableDeclare) {
    if (globalVariableDeclare?.type !== "object" || !globalVariableDeclare.properties) {
      return;
    }
    Object.entries(globalVariableDeclare.properties).forEach(([key, typeInfo]) => {
      if (!key || !typeInfo) {
        return;
      }
      const type = typeInfo.type;
      const itemsType = typeInfo.items?.type;
      const defaultValue = this.parseJSONContent(typeInfo.default, type);
      this.variableStore.setVariable({
        nodeID: "global",
        key,
        value: defaultValue,
        type,
        itemsType
      });
    });
  }
};

// src/domain/snapshot/snapshot-entity/index.ts
var WorkflowRuntimeSnapshot = class _WorkflowRuntimeSnapshot {
  constructor(data) {
    this.id = uuid();
    this.data = data;
  }
  update(data) {
    Object.assign(this.data, data);
  }
  validate() {
    const required = ["nodeID", "inputs", "outputs", "data"];
    return required.every((key) => this.data[key] !== void 0);
  }
  export() {
    const snapshot = {
      id: this.id,
      ...this.data
    };
    return snapshot;
  }
  static create(params) {
    return new _WorkflowRuntimeSnapshot(params);
  }
};

// src/domain/snapshot/snapshot-center/index.ts
var WorkflowRuntimeSnapshotCenter = class {
  constructor() {
    this.id = uuid();
  }
  create(snapshotData) {
    const snapshot = WorkflowRuntimeSnapshot.create(snapshotData);
    this.snapshots.push(snapshot);
    return snapshot;
  }
  init() {
    this.snapshots = [];
  }
  dispose() {
  }
  exportAll() {
    return this.snapshots.slice().map((snapshot) => snapshot.export());
  }
  export() {
    const result = {};
    this.exportAll().forEach((snapshot) => {
      if (result[snapshot.nodeID]) {
        result[snapshot.nodeID].push(snapshot);
      } else {
        result[snapshot.nodeID] = [snapshot];
      }
    });
    return result;
  }
};

// src/domain/report/report-value-object/index.ts
var WorkflowRuntimeReport;
((WorkflowRuntimeReport2) => {
  WorkflowRuntimeReport2.create = (params) => ({
    id: uuid(),
    ...params
  });
})(WorkflowRuntimeReport || (WorkflowRuntimeReport = {}));

// src/domain/report/reporter/index.ts
var WorkflowRuntimeReporter = class {
  constructor(ioCenter, snapshotCenter, statusCenter, messageCenter) {
    this.ioCenter = ioCenter;
    this.snapshotCenter = snapshotCenter;
    this.statusCenter = statusCenter;
    this.messageCenter = messageCenter;
  }
  init() {
  }
  dispose() {
  }
  export() {
    const report = WorkflowRuntimeReport.create({
      inputs: this.ioCenter.inputs,
      outputs: this.ioCenter.outputs,
      workflowStatus: this.statusCenter.workflow.export(),
      reports: this.nodeReports(),
      messages: this.messageCenter.export()
    });
    return report;
  }
  nodeReports() {
    const reports = {};
    const statuses = this.statusCenter.exportNodeStatus();
    const snapshots = this.snapshotCenter.export();
    Object.keys(statuses).forEach((nodeID) => {
      const status = statuses[nodeID];
      const nodeSnapshots = snapshots[nodeID] || [];
      const nodeReport = {
        id: nodeID,
        ...status,
        snapshots: nodeSnapshots
      };
      reports[nodeID] = nodeReport;
    });
    return reports;
  }
};

// src/domain/io-center/index.ts
var WorkflowRuntimeIOCenter = class {
  init(inputs) {
    this.setInputs(inputs);
  }
  dispose() {
  }
  get inputs() {
    return this._inputs ?? {};
  }
  get outputs() {
    return this._outputs ?? {};
  }
  setInputs(inputs) {
    this._inputs = inputs;
  }
  setOutputs(outputs) {
    this._outputs = outputs;
  }
  export() {
    return {
      inputs: this._inputs,
      outputs: this._outputs
    };
  }
};

// src/domain/document/entity/edge/index.ts
var WorkflowRuntimeEdge = class {
  constructor(params) {
    const { id, from, to } = params;
    this.id = id;
    this.from = from;
    this.to = to;
  }
  get fromPort() {
    return this._fromPort;
  }
  set fromPort(port) {
    this._fromPort = port;
  }
  get toPort() {
    return this._toPort;
  }
  set toPort(port) {
    this._toPort = port;
  }
  static createID(schema) {
    const { sourceNodeID, sourcePortID, targetNodeID, targetPortID } = schema;
    const sourcePart = sourcePortID ? `${sourceNodeID}:${sourcePortID}` : sourceNodeID;
    const targetPart = targetPortID ? `${targetNodeID}:${targetPortID}` : targetNodeID;
    return `${sourcePart}-${targetPart}`;
  }
};

// src/domain/document/entity/node/index.ts
var WorkflowRuntimeNode = class {
  constructor(params) {
    const { id, type, name, position, variable, data } = params;
    this.id = id;
    this.type = type;
    this.name = name;
    this.position = position;
    this.declare = variable ?? {};
    this.data = data ?? {};
    this._parent = null;
    this._children = [];
    this._ports = [];
    this._inputEdges = [];
    this._outputEdges = [];
    this._prev = [];
    this._next = [];
  }
  get ports() {
    const inputs = this._ports.filter((port) => port.type === WorkflowPortType.Input);
    const outputs = this._ports.filter((port) => port.type === WorkflowPortType.Output);
    return {
      inputs,
      outputs
    };
  }
  get edges() {
    return {
      inputs: this._inputEdges,
      outputs: this._outputEdges
    };
  }
  get parent() {
    return this._parent;
  }
  set parent(parent) {
    this._parent = parent;
  }
  get children() {
    return this._children;
  }
  addChild(child) {
    this._children.push(child);
  }
  addPort(port) {
    this._ports.push(port);
  }
  addInputEdge(edge) {
    this._inputEdges.push(edge);
    this._prev.push(edge.from);
  }
  addOutputEdge(edge) {
    this._outputEdges.push(edge);
    this._next.push(edge.to);
  }
  get prev() {
    return this._prev;
  }
  get next() {
    return this._next;
  }
  get successors() {
    return traverseNodes(this, (node) => node.next);
  }
  get predecessors() {
    return traverseNodes(this, (node) => node.prev);
  }
  get isBranch() {
    return this.ports.outputs.length > 1;
  }
};

// src/domain/document/entity/port/index.ts
var WorkflowRuntimePort = class {
  constructor(params) {
    const { id, node } = params;
    this.id = id;
    this.node = node;
    this.type = params.type;
    this._edges = [];
  }
  get edges() {
    return this._edges;
  }
  addEdge(edge) {
    this._edges.push(edge);
  }
};

// src/domain/document/document/flat-schema.ts
var flatLayer = (data, nodeSchema) => {
  const { blocks, edges } = nodeSchema;
  if (blocks) {
    data.flattenSchema.nodes.push(...blocks);
    const blockIDs = [];
    blocks.forEach((block) => {
      blockIDs.push(block.id);
      if (block.blocks) {
        flatLayer(data, block);
      }
    });
    data.nodeBlocks.set(nodeSchema.id, blockIDs);
    delete nodeSchema.blocks;
  }
  if (edges) {
    data.flattenSchema.edges.push(...edges);
    const edgeIDs = [];
    edges.forEach((edge) => {
      const edgeID = WorkflowRuntimeEdge.createID(edge);
      edgeIDs.push(edgeID);
    });
    data.nodeEdges.set(nodeSchema.id, edgeIDs);
    delete nodeSchema.edges;
  }
};
var flatSchema = (schema = { nodes: [], edges: [] }) => {
  const rootNodes = schema.nodes ?? [];
  const rootEdges = schema.edges ?? [];
  const data = {
    flattenSchema: {
      nodes: [],
      edges: []
    },
    nodeBlocks: /* @__PURE__ */ new Map(),
    nodeEdges: /* @__PURE__ */ new Map()
  };
  const root = {
    id: FlowGramNode.Root,
    type: FlowGramNode.Root,
    blocks: rootNodes,
    edges: rootEdges,
    meta: {
      position: {
        x: 0,
        y: 0
      }
    },
    data: {}
  };
  flatLayer(data, root);
  return data;
};

// src/domain/document/document/create-store.ts
var createNode = (store, params) => {
  const node = new WorkflowRuntimeNode(params);
  store.nodes.set(node.id, node);
  return node;
};
var createEdge = (store, params) => {
  const edge = new WorkflowRuntimeEdge(params);
  store.edges.set(edge.id, edge);
  return edge;
};
var getOrCreatePort = (store, params) => {
  const createdPort = store.ports.get(params.id);
  if (createdPort) {
    return createdPort;
  }
  const port = new WorkflowRuntimePort(params);
  store.ports.set(port.id, port);
  return port;
};
var createStore = (params) => {
  const { flattenSchema, nodeBlocks } = params;
  const { nodes, edges } = flattenSchema;
  const store = {
    nodes: /* @__PURE__ */ new Map(),
    edges: /* @__PURE__ */ new Map(),
    ports: /* @__PURE__ */ new Map()
  };
  createNode(store, {
    id: FlowGramNode.Root,
    type: FlowGramNode.Root,
    name: FlowGramNode.Root,
    position: { x: 0, y: 0 }
  });
  nodes.forEach((nodeSchema) => {
    const id = nodeSchema.id;
    const type = nodeSchema.type;
    const {
      title = `${type}-${id}-untitled`,
      inputsValues,
      inputs,
      outputs,
      ...data
    } = nodeSchema.data ?? {};
    createNode(store, {
      id,
      type,
      name: title,
      position: nodeSchema.meta.position,
      variable: { inputsValues, inputs, outputs },
      data
    });
  });
  nodeBlocks.forEach((blockIDs, parentID) => {
    const parent = store.nodes.get(parentID);
    const children = blockIDs.map((id) => store.nodes.get(id)).filter(Boolean);
    children.forEach((child) => {
      child.parent = parent;
      parent.addChild(child);
    });
  });
  edges.forEach((edgeSchema) => {
    const id = WorkflowRuntimeEdge.createID(edgeSchema);
    const {
      sourceNodeID,
      targetNodeID,
      sourcePortID = "defaultOutput",
      targetPortID = "defaultInput"
    } = edgeSchema;
    const from = store.nodes.get(sourceNodeID);
    const to = store.nodes.get(targetNodeID);
    if (!from || !to) {
      throw new Error(`Invalid edge schema ID: ${id}, from: ${sourceNodeID}, to: ${targetNodeID}`);
    }
    const edge = createEdge(store, {
      id,
      from,
      to
    });
    const fromPort = getOrCreatePort(store, {
      node: from,
      id: sourcePortID,
      type: WorkflowPortType.Output
    });
    fromPort.addEdge(edge);
    edge.fromPort = fromPort;
    from.addPort(fromPort);
    from.addOutputEdge(edge);
    const toPort = getOrCreatePort(store, {
      node: to,
      id: targetPortID,
      type: WorkflowPortType.Input
    });
    toPort.addEdge(edge);
    edge.toPort = toPort;
    to.addPort(toPort);
    to.addInputEdge(edge);
  });
  return store;
};

// src/domain/document/document/index.ts
var WorkflowRuntimeDocument = class {
  constructor() {
    this.id = uuid();
  }
  get root() {
    const rootNode = this.getNode(FlowGramNode.Root);
    if (!rootNode) {
      throw new Error("Root node not found");
    }
    return rootNode;
  }
  get start() {
    const startNode = this.nodes.find((n) => n.type === FlowGramNode.Start);
    if (!startNode) {
      throw new Error("Start node not found");
    }
    return startNode;
  }
  get end() {
    const endNode = this.nodes.find((n) => n.type === FlowGramNode.End);
    if (!endNode) {
      throw new Error("End node not found");
    }
    return endNode;
  }
  getNode(id) {
    return this.store.nodes.get(id) ?? null;
  }
  getEdge(id) {
    return this.store.edges.get(id) ?? null;
  }
  get nodes() {
    return Array.from(this.store.nodes.values());
  }
  get edges() {
    return Array.from(this.store.edges.values());
  }
  init(schema) {
    const flattenSchema = flatSchema(schema);
    this.store = createStore(flattenSchema);
  }
  dispose() {
    this.store.edges.clear();
    this.store.nodes.clear();
    this.store.ports.clear();
  }
};

// src/domain/context/index.ts
var WorkflowRuntimeContext = class _WorkflowRuntimeContext {
  constructor(data) {
    this.subContexts = [];
    this.id = uuid();
    this.cache = data.cache;
    this.document = data.document;
    this.variableStore = data.variableStore;
    this.state = data.state;
    this.ioCenter = data.ioCenter;
    this.snapshotCenter = data.snapshotCenter;
    this.statusCenter = data.statusCenter;
    this.messageCenter = data.messageCenter;
    this.reporter = data.reporter;
  }
  init(params) {
    const { schema, inputs, context } = params;
    this.context = context ?? {};
    this.cache.init();
    this.document.init(schema);
    this.variableStore.init();
    this.state.init(schema);
    this.ioCenter.init(inputs);
    this.snapshotCenter.init();
    this.statusCenter.init();
    this.messageCenter.init();
    this.reporter.init();
  }
  dispose() {
    this.subContexts.forEach((subContext) => {
      subContext.dispose();
    });
    this.subContexts = [];
    this.cache.dispose();
    this.document.dispose();
    this.variableStore.dispose();
    this.state.dispose();
    this.ioCenter.dispose();
    this.snapshotCenter.dispose();
    this.statusCenter.dispose();
    this.messageCenter.dispose();
    this.reporter.dispose();
  }
  sub() {
    const cache = new WorkflowRuntimeCache();
    const variableStore = new WorkflowRuntimeVariableStore();
    variableStore.setParent(this.variableStore);
    const state = new WorkflowRuntimeState(variableStore);
    const contextData = {
      cache,
      document: this.document,
      ioCenter: this.ioCenter,
      snapshotCenter: this.snapshotCenter,
      statusCenter: this.statusCenter,
      messageCenter: this.messageCenter,
      reporter: this.reporter,
      variableStore,
      state
    };
    const subContext = new _WorkflowRuntimeContext(contextData);
    this.subContexts.push(subContext);
    subContext.cache.init();
    subContext.variableStore.init();
    subContext.state.init();
    return subContext;
  }
  static create() {
    const cache = new WorkflowRuntimeCache();
    const document = new WorkflowRuntimeDocument();
    const variableStore = new WorkflowRuntimeVariableStore();
    const state = new WorkflowRuntimeState(variableStore);
    const ioCenter = new WorkflowRuntimeIOCenter();
    const snapshotCenter = new WorkflowRuntimeSnapshotCenter();
    const statusCenter = new WorkflowRuntimeStatusCenter();
    const messageCenter = new WorkflowRuntimeMessageCenter();
    const reporter = new WorkflowRuntimeReporter(
      ioCenter,
      snapshotCenter,
      statusCenter,
      messageCenter
    );
    return new _WorkflowRuntimeContext({
      cache,
      document,
      variableStore,
      state,
      ioCenter,
      snapshotCenter,
      statusCenter,
      messageCenter,
      reporter
    });
  }
};

// src/domain/engine/index.ts
var WorkflowRuntimeEngine = class {
  constructor(service) {
    this.validation = service.Validation;
    this.executor = service.Executor;
  }
  invoke(params) {
    const context = WorkflowRuntimeContext.create();
    context.init(params);
    const valid = this.validate(params, context);
    if (!valid) {
      return WorkflowRuntimeTask.create({
        processing: Promise.resolve({}),
        context
      });
    }
    const processing = this.process(context);
    processing.then(() => {
      context.dispose();
    });
    return WorkflowRuntimeTask.create({
      processing,
      context
    });
  }
  async executeNode(params) {
    const { node, context } = params;
    if (!this.canExecuteNode({ node, context })) {
      return;
    }
    context.statusCenter.nodeStatus(node.id).process();
    const snapshot = context.snapshotCenter.create({
      nodeID: node.id,
      data: node.data
    });
    let nextNodes = [];
    try {
      const inputs = context.state.getNodeInputs(node);
      snapshot.update({
        inputs
      });
      const result = await this.executor.execute({
        node,
        inputs,
        runtime: context,
        container: WorkflowRuntimeContainer.instance,
        snapshot
      });
      if (context.statusCenter.workflow.terminated) {
        return;
      }
      const { outputs, branch } = result;
      snapshot.update({ outputs, branch });
      context.state.setNodeOutputs({ node, outputs });
      context.state.addExecutedNode(node);
      context.statusCenter.nodeStatus(node.id).success();
      nextNodes = this.getNextNodes({ node, branch, context });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      snapshot.update({ error: errorMessage });
      context.messageCenter.error({
        nodeID: node.id,
        message: errorMessage
      });
      context.statusCenter.nodeStatus(node.id).fail();
      console.error(e);
      throw e;
    }
    await this.executeNext({ node, nextNodes, context });
  }
  async process(context) {
    const startNode = context.document.start;
    context.statusCenter.workflow.process();
    try {
      await this.executeNode({ node: startNode, context });
      const outputs = context.ioCenter.outputs;
      context.statusCenter.workflow.success();
      return outputs;
    } catch (e) {
      context.statusCenter.workflow.fail();
      return {};
    }
  }
  validate(params, context) {
    const { valid, errors } = this.validation.invoke(params);
    if (valid) {
      return true;
    }
    errors?.forEach((message) => {
      context.messageCenter.error({
        message
      });
    });
    context.statusCenter.workflow.fail();
    return false;
  }
  canExecuteNode(params) {
    const { node, context } = params;
    const prevNodes = node.prev;
    if (prevNodes.length === 0) {
      return true;
    }
    return prevNodes.every((prevNode) => context.state.isExecutedNode(prevNode));
  }
  getNextNodes(params) {
    const { node, branch, context } = params;
    const allNextNodes = node.next;
    if (!branch) {
      return allNextNodes;
    }
    const targetPort = node.ports.outputs.find((port) => port.id === branch);
    if (!targetPort) {
      throw new Error(`Branch "${branch}" not found`);
    }
    const nextNodeIDs = new Set(targetPort.edges.map((edge) => edge.to.id));
    const nextNodes = allNextNodes.filter((nextNode) => nextNodeIDs.has(nextNode.id));
    const skipNodes = allNextNodes.filter((nextNode) => !nextNodeIDs.has(nextNode.id));
    const nextGroups = nextNodes.map((nextNode) => [nextNode, ...nextNode.successors]);
    const skipGroups = skipNodes.map((skipNode) => [skipNode, ...skipNode.successors]);
    const { uniqueToB: skippedNodes } = compareNodeGroups(nextGroups, skipGroups);
    skippedNodes.forEach((node2) => {
      context.state.addExecutedNode(node2);
    });
    return nextNodes;
  }
  async executeNext(params) {
    const { context, node, nextNodes } = params;
    const terminatingNodeTypes = [
      FlowGramNode.End,
      FlowGramNode.BlockEnd,
      FlowGramNode.Break,
      FlowGramNode.Continue
    ];
    if (terminatingNodeTypes.includes(node.type)) {
      return;
    }
    if (nextNodes.length === 0) {
      throw new Error(`Node "${node.id}" has no next nodes`);
    }
    await Promise.all(
      nextNodes.map(
        (nextNode) => this.executeNode({
          node: nextNode,
          context
        })
      )
    );
  }
};

// src/domain/container/index.ts
var WorkflowRuntimeContainer = class _WorkflowRuntimeContainer {
  constructor(services) {
    this.services = services;
  }
  get(key) {
    return this.services[key];
  }
  static get instance() {
    if (this._instance) {
      return this._instance;
    }
    const services = this.create();
    this._instance = new _WorkflowRuntimeContainer(services);
    return this._instance;
  }
  static create() {
    const Validation = new WorkflowRuntimeValidation();
    const Executor = new WorkflowRuntimeExecutor(WorkflowRuntimeNodeExecutors);
    const Engine = new WorkflowRuntimeEngine({
      Validation,
      Executor
    });
    return {
      [IValidation]: Validation,
      [IExecutor]: Executor,
      [IEngine]: Engine
    };
  }
};

// src/application/workflow.ts
var WorkflowApplication = class _WorkflowApplication {
  constructor() {
    this.container = WorkflowRuntimeContainer.instance;
    this.tasks = /* @__PURE__ */ new Map();
  }
  run(params) {
    const engine = this.container.get(IEngine);
    const task = engine.invoke(params);
    this.tasks.set(task.id, task);
    console.log("> POST TaskRun - taskID: ", task.id);
    console.log(params.inputs);
    task.processing.then((output) => {
      console.log("> LOG Task finished: ", task.id);
      console.log(output);
    });
    return task.id;
  }
  cancel(taskID) {
    console.log("> PUT TaskCancel - taskID: ", taskID);
    const task = this.tasks.get(taskID);
    if (!task) {
      return false;
    }
    task.cancel();
    return true;
  }
  report(taskID) {
    const task = this.tasks.get(taskID);
    console.log("> GET TaskReport - taskID: ", taskID);
    if (!task) {
      return;
    }
    return task.context.reporter.export();
  }
  result(taskID) {
    console.log("> GET TaskResult - taskID: ", taskID);
    const task = this.tasks.get(taskID);
    if (!task) {
      return;
    }
    if (!task.context.statusCenter.workflow.terminated) {
      return;
    }
    return task.context.ioCenter.outputs;
  }
  validate(params) {
    const validation = this.container.get(IValidation);
    const result = validation.invoke(params);
    console.log("> POST TaskValidate - valid: ", result.valid);
    return result;
  }
  static get instance() {
    if (this._instance) {
      return this._instance;
    }
    this._instance = new _WorkflowApplication();
    return this._instance;
  }
};

// src/api/task-validate.ts
var TaskValidateAPI = async (input) => {
  const app = WorkflowApplication.instance;
  const { schema: stringSchema, inputs } = input;
  const schema = JSON.parse(stringSchema);
  const result = app.validate({
    schema,
    inputs
  });
  const output = result;
  return output;
};

// src/api/task-run.ts
var TaskRunAPI = async (input) => {
  const app = WorkflowApplication.instance;
  const { schema: stringSchema, inputs } = input;
  const schema = JSON.parse(stringSchema);
  const taskID = app.run({
    schema,
    inputs
  });
  const output = {
    taskID
  };
  return output;
};

// src/api/task-result.ts
var TaskResultAPI = async (input) => {
  const app = WorkflowApplication.instance;
  const { taskID } = input;
  const output = app.result(taskID);
  return output;
};

// src/api/task-report.ts
var TaskReportAPI = async (input) => {
  const app = WorkflowApplication.instance;
  const { taskID } = input;
  const output = app.report(taskID);
  try {
    TaskReportDefine.schema.output.parse(output);
  } catch (e) {
    console.log("> TaskReportAPI - output: ", JSON.stringify(output));
    console.error(e);
  }
  return output;
};

// src/api/task-cancel.ts
var TaskCancelAPI = async (input) => {
  const app = WorkflowApplication.instance;
  const { taskID } = input;
  const success = app.cancel(taskID);
  const output = {
    success
  };
  return output;
};

// src/api/index.ts
var WorkflowRuntimeAPIs = {
  [FlowGramAPIName.ServerInfo]: () => {
  },
  // TODO
  [FlowGramAPIName.TaskRun]: TaskRunAPI,
  [FlowGramAPIName.TaskReport]: TaskReportAPI,
  [FlowGramAPIName.TaskResult]: TaskResultAPI,
  [FlowGramAPIName.TaskCancel]: TaskCancelAPI,
  [FlowGramAPIName.TaskValidate]: TaskValidateAPI
};
export {
  TaskCancelAPI,
  TaskReportAPI,
  TaskResultAPI,
  TaskRunAPI,
  TaskValidateAPI,
  WorkflowRuntimeAPIs,
  registerMCPExecutor
};
//# sourceMappingURL=index.js.map
