/**
 * 数字布尔值
 */
export const BooleanNumber = {
    YES: 1,
    NO: 0,
} as const;
export type BooleanNumberType = (typeof BooleanNumber)[keyof typeof BooleanNumber];
export type BooleanNumberKey = keyof typeof BooleanNumber;

/**
 * 用户来源
 */
export const UserCreateSource = {
    CONSOLE: 0,
    PHONE: 1,
    WECHAT: 2,
    EMAIL: 3,
    USERNAME: 4,
    GOOGLE: 5,
} as const;
export type UserCreateSourceType = (typeof UserCreateSource)[keyof typeof UserCreateSource];
export type UserCreateSourceKey = keyof typeof UserCreateSource;

/**
 * 用户终端
 */
export const UserTerminal = {
    PC: 1,
    H5: 2,
    MP: 3,
    APP: 4,
    /**
     * 教室大屏。
     *
     * 单独占一个终端类型不是为了统计，而是为了隔离：撤销旧令牌的
     * `revokeTokensByTerminal` 按终端分桶，老师在大屏上登录自己的账号时
     * 落在 SCREEN 桶里，因此**结构上不可能**踢掉他在 PC 上的控制台会话 ——
     * 哪怕管理员把"允许多处登录"关掉。
     */
    SCREEN: 5,
} as const;
export type UserTerminalType = (typeof UserTerminal)[keyof typeof UserTerminal];
export type UserTerminalKey = keyof typeof UserTerminal;
export const USER_TERMINAL_TYPE_DESCRIPTION = {
    [UserTerminal.PC]: "PC网页",
    [UserTerminal.H5]: "手机H5",
    [UserTerminal.MP]: "微信小程序",
    [UserTerminal.APP]: "APP",
    [UserTerminal.SCREEN]: "教室大屏",
} as const;
