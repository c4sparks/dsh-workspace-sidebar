/**
 * dsh-workspace-sidebar — 组件运行作用域 + 延迟服务代理。
 *
 * scope.service 在 apply() 时赋值；组件渲染时经 createDeferredService 返回的
 * Proxy 转发到当前服务（方法用闭包，无需 this）。settings / footer / view 共用
 * 这一个实现，避免各处重复写 Proxy。
 */
import type { DshClientCtx, WorkspaceService } from "./types";

export interface ComponentScope {
  service: WorkspaceService | null;
  /** 宿主 client ctx（apply 赋值；透传给 widget 组件，供其自行取服务）。 */
  ctx: DshClientCtx | null;
}

/** service 经 Proxy 转发到 scope.service（apply 赋值后即当前服务）。 */
export function createDeferredService(scope: ComponentScope): WorkspaceService {
  return new Proxy({} as WorkspaceService, {
    get: function (_t, p) {
      const s = scope.service;
      return s === null ? undefined : (s as any)[p];
    }
  });
}
