/**
 * 一台方糖猫身上会被课堂功能读写的配置项。
 *
 * 场景（XiaozhiScene）的快照/下发、以及课堂应用会话的接管/恢复用的是同一组字段 ——
 * 两边必须一致，否则应用改过的某项配置在恢复时会被漏掉，永久留在学生的设备上。
 */
export const CLASSROOM_DEVICE_CONFIG_KEYS = [
    "language",
    "tts_voice",
    "character",
    "asr_speed",
    "tts_speech_speed",
    "tts_pitch",
    "llm_model",
    "memory_type",
    "teen_mode",
    "mcp_endpoints",
    "knowledge_base_ids",
] as const;

export type ClassroomDeviceConfigKey = (typeof CLASSROOM_DEVICE_CONFIG_KEYS)[number];

/** 承载人设/提示词的字段名。改提示词就是改它。 */
export const CLASSROOM_PROMPT_KEY = "character";

/** 只保留课堂关心的字段，丢掉上游返回的其它内容。 */
export function pickClassroomConfig(config: Record<string, unknown>) {
    return Object.fromEntries(
        CLASSROOM_DEVICE_CONFIG_KEYS.flatMap((key) => (key in config ? [[key, config[key]]] : [])),
    ) as Record<string, unknown>;
}
