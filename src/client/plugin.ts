/**
 * dsh-workspace-sidebar — 插件主体（浏览器端）。
 *
 * 架构约束：
 *  - 业务代码不得 import 任何外部包；种子模块（React）经 createPlugin(deps)
 *    依赖注入。
 *  - 公开服务 `workspace` 经 ctx.reflect.provide 暴露；第三方插件
 *    `inject: ['workspace']` 后调用 registerWidget / unregisterWidget。
 *  - 覆盖层从侧边栏底部入口（sidebar.footer.action）展开，不接管 dsh 根布局。
 */
import type * as ReactTypes from "react";
import { APP_ID } from "./constants";
import { injectCss, injectFooterStackCss } from "./styles";
import { createWorkspaceStore } from "./store";
import { createDshAdapter, type DshAdapter } from "./adapter";
import { createWidgetRegistry } from "./registry";
import { createWorkspaceService } from "./service";
import { createHooks } from "./hooks";
import { createIcons } from "./icons";
import { createWorkspaceView } from "./workspace-view";
import { createFooterAction } from "./footer";
import { createSettingsSection } from "./settings";
import { injectSettingsNavIconCss, registerSettingsNavIcon } from "./settings-nav-icon";
import { createDeferredService, type ComponentScope } from "./scope";
import { mountTestSeam } from "./test-seam";
import type { DshClientCtx } from "./types";

interface PluginDeps {
  React: typeof ReactTypes;
}
/** 宿主传入的 client ctx（窄接口，见 types.ts DshClientCtx）。 */
type Ctx = DshClientCtx;

export function createPlugin(deps: PluginDeps) {
  const React = deps.React;
  const hooks = createHooks(React);
  const icons = createIcons(React);
  const scope: ComponentScope = { service: null, ctx: null };
  // 延迟服务代理：组件渲染时才转发到 scope.service（apply 赋值后即当前服务），
  // 由 ./scope 统一产出，footer / view / settings 共用同一实例。
  const service = createDeferredService(scope);
  const { WorkspaceView } = createWorkspaceView({ React, hooks, icons, service, scope });
  const { WorkspaceFooterAction } = createFooterAction({ React, icons, service, WorkspaceView });
  // 设置分区独立文件：src/client/settings.ts。改这里时记得同步重建 lib。
  const { WorkspaceSettingsSection } = createSettingsSection({ React, icons, service });

  // ---- plugin body ----------------------------------------------------

  // 模块级闭包：apply 时赋值；组件只在 slot 挂载后渲染，彼时已就绪。
  let adapter: DshAdapter = null as unknown as DshAdapter;

  // 依赖 dsh 官方服务：slots（注册 footer 入口）+ remote / connection（Remote 网关客户端，
  // 供 widget 组件经 ctx 访问——widget 渲染在本文档的 ctx 上，需在此注入才能用 ctx.remote）
  // + theme（主题快照，供 widget 组件读 ctx.theme 跟随浅/深/跟随系统）。
  const inject = ["slots", "remote", "connection", "theme"];

  function apply(ctx: Ctx) {
    scope.ctx = ctx;
    injectCss();
    adapter = createDshAdapter(ctx);
    const registry = createWidgetRegistry();
    const store = createWorkspaceStore();
    const svc = createWorkspaceService(registry, store);
    scope.service = svc;

    // 公开服务：第三方 `inject: ['workspace']`
    adapter.effect(function () {
      const disposeService = adapter.provide("workspace", svc);
      return function () { disposeService(); };
    }, "workspace: provide service");

    // 侧边栏底部入口：`sidebar.footer.action` 槽位，多个入口纵向堆叠
    adapter.effect(function () {
      injectFooterStackCss();
      return adapter.injectSlot("sidebar.footer.action", function () {
        return adapter.registerSlot({ name: "sidebar.footer.action", id: APP_ID, order: 100 }, WorkspaceFooterAction);
      });
    }, "workspace: footer action");

    // 设置分区：`settings.section` 槽位（dsh 设置页出现「工作台」分区）
    // 左导航图标：DSH 0.1.x 无 icon 字段，用标记 + CSS 把通用齿轮换成 LayoutDashboard
    adapter.effect(function () {
      injectSettingsNavIconCss();
      const disposeIcon = registerSettingsNavIcon(function () { return "工作台"; });
      const disposeSlot = adapter.injectSlot("settings.section", function () {
        return adapter.registerSlot({
          name: "settings.section",
          id: APP_ID,
          order: 100,
          label: function () { return "工作台"; }
        }, WorkspaceSettingsSection);
      });
      return function () { disposeSlot(); disposeIcon(); };
    }, "workspace: settings section");

    // 测试接缝：?workspace-test 暴露注册表（实现见 ./test-seam）
    if (typeof location !== "undefined" && location.search.indexOf("workspace-test") >= 0) {
      mountTestSeam({ React, service: svc });
    }
  }

  return { apply: apply, inject: inject };
}
