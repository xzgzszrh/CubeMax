import type { LocaleMessages } from "@buildingai/i18n";

import enUS from "./en-US";
import zhCN from "./zh-CN";

export const messages: LocaleMessages = {
    "en-US": enUS,
    "zh-CN": zhCN,
};

/** 课堂场景只面向中文用户，界面文案直接写在组件里，这里只是给 I18nProvider 兜底。 */
export const defaultLocale = "zh-CN";
