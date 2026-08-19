/**
 * Parse extension identifier from URL pathname
 * Extension URL format: /extension/{identifier}/...
 *
 * @param pathname - URL pathname (e.g., "/extension/my-extension/console")
 * @returns Extension identifier or null if not found
 *
 * @example
 * ```ts
 * parseExtensionIdentifier("/extension/my-extension/console") // "my-extension"
 * parseExtensionIdentifier("/extension/my-extension") // "my-extension"
 * parseExtensionIdentifier("/other/path") // null
 * ```
 */
export function parseExtensionIdentifier(pathname: string): string | null {
    const match = pathname.match(/^\/extension\/([^/]+)/);
    return match?.[1] ?? null;
}

/**
 * Parse extension identifier from current window location
 *
 * @returns Extension identifier or null if not found
 *
 * @example
 * ```ts
 * // When URL is: http://localhost:3000/extension/my-extension/console
 * parseExtensionIdentifierFromLocation() // "my-extension"
 * ```
 */
export function parseExtensionIdentifierFromLocation(): string | null {
    if (typeof window === "undefined") return null;
    return parseExtensionIdentifier(window.location.pathname);
}
