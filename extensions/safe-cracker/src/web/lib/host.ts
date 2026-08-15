/**
 * 扩展跑在宿主的 iframe 里，但「打开大屏」要跳到宿主自己的路由（`/board/...`），
 * 所以得先知道宿主的 origin。
 *
 * - 生产环境宿主和扩展同源，`window.parent.location` 直接可读；
 * - 开发环境两者是不同端口，读 parent 会抛跨域错误，退回用 `document.referrer`
 *   （iframe 的 referrer 就是父页面），再不行才用自己的 origin。
 */
function resolveHostOrigin(): string {
    if (typeof window === "undefined") return "";
    if (window.parent === window) return window.location.origin;

    try {
        return window.parent.location.origin;
    } catch {
        if (document.referrer) {
            try {
                return new URL(document.referrer).origin;
            } catch {
                // referrer 不是合法 URL，走下面的兜底。
            }
        }
        return window.location.origin;
    }
}

/** 宿主的课堂大屏地址，用 `target="_blank"` 打开投到教室屏幕上。 */
export function getBoardUrl(identifier: string): string {
    return `${resolveHostOrigin()}/board/${identifier}/board`;
}
