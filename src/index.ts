/**
 * dsh-workspace-sidebar — host entry.
 *
 * 宿主侧无逻辑（不依赖 cordis，不注册路由），全部能力在浏览器端
 * （lib/client.js，经 exports["./client"] 提供）。工作台是侧边栏底部入口 +
 * 自包含覆盖层，无需 server 侧配合。
 */
export function apply(): void {}
