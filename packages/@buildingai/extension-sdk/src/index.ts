export { AiPublicModule } from "./modules/ai/ai-public.module";
export { PublicAiModelService } from "./modules/ai/services/ai-model.service";
export { ExtensionBillingModule } from "./modules/billing/extension-billing.module";
export {
    ExtensionBillingService,
    type ExtensionPowerDeductionOptions,
} from "./modules/billing/extension-billing.service";
/**
 * 课堂能力。ClassroomKitModule 由宿主在根模块统一提供（`@Global()`），
 * 应用直接注入 ClassroomKitService 即可，不需要再 imports 一次 ——
 * 重复提供会造出第二个工具注册表，方糖猫网关就看不见应用注册的工具了。
 */
export {
    CLASSROOM_DEVICE_CONFIG_KEYS,
    CLASSROOM_PROMPT_KEY,
    type ClassroomApplyResult,
    type ClassroomCaller,
    type ClassroomDevice,
    type ClassroomDeviceConfigKey,
    type ClassroomInfo,
    ClassroomKitService,
    type ClassroomMember,
    type ClassroomSessionOptions,
    type ClassroomSessionView,
    type ClassroomToolContext,
    type ClassroomToolDefinition,
    type ClassroomToolHandler,
    ClassroomToolRegistryService,
    type ClassroomToolResult,
    pickClassroomConfig,
    type StartClassroomSessionInput,
} from "@buildingai/core/modules/classroom";
export { PublicUserService } from "./services/user.service";
export { defineBuildingAITsupConfig } from "./tsup";
