/**
 * 契约的真身在 `src/api/shared/contract.ts`，这里只是转出给前端用。
 *
 * 为什么不放在这一层：扩展后端由 tsup 以 `bundle: false` 逐文件转译，
 * entry 只覆盖 `src/api/**`。契约若放在 `src/api` 之外，产物里的相对
 * import 会指向一个根本没被 emit 的路径，扩展加载时直接 Cannot find module。
 * 前端走 vite 打包，import 谁都无所谓，所以让前端迁就后端。
 */
export * from "../api/shared/contract";
