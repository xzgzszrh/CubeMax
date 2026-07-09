export const DISPLAY_APP_NAME = "CubeMax";

const LEGACY_DISPLAY_APP_NAME = "BuildingAI";

function normalizeDisplayText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (value instanceof String) {
    return value.toString().trim();
  }

  if (Array.isArray(value) && value.length === 1) {
    return normalizeDisplayText(value[0]);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeDisplayText(record.name ?? record.value ?? record.text);
  }

  return "";
}

export function getDisplayAppName(_name?: unknown) {
  return DISPLAY_APP_NAME;
}

export function getDisplayAppInitial(name?: unknown) {
  return getDisplayAppName(name).slice(0, 1).toUpperCase();
}

export function replaceLegacyDisplayAppName(value?: unknown) {
  const text = normalizeDisplayText(value);
  return text === LEGACY_DISPLAY_APP_NAME ? DISPLAY_APP_NAME : text;
}
