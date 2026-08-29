/**
 * dsh-workspace-sidebar — 测试接缝（仅 ?workspace-test 时装配）。
 *
 * 从 plugin.ts 抽出：plugin 主体只做纯装配，测试脚手架单独成文件（高内聚）。
 * 暴露 window.__dshWorkspaceTest__：service / getState / registerTestWidget
 * （注册 test:alpha / beta / gamma，gamma 演示懒加载 loadComponent）。
 */
import type * as ReactTypes from "react";
import { CLS } from "./constants";
import type { WorkspaceService } from "./types";

export interface TestSeamDeps {
  React: typeof ReactTypes;
  service: WorkspaceService;
}

export function mountTestSeam(deps: TestSeamDeps): void {
  const { React, service } = deps;
  (window as any).__dshWorkspaceTest__ = {
    service: service,
    getState: function () { return service.layout.getState(); },
    registerTestWidget: function () {
      service.registerWidget({
        id: "test:alpha",
        title: "测试 Alpha",
        icon: "\u{1F4CC}",
        order: 40,
        // 声明式设置 demo：设置页「工作台」分区出现「测试 Alpha」设置块
        settings: {
          fields: [
            { type: "switch", key: "enabled", label: "启用" },
            { type: "number", key: "rows", label: "行数", min: 1, max: 100 }
          ]
        },
        component: function () {
          return React.createElement("div", { className: CLS + "-testContent" }, "test-alpha-content");
        }
      });
      service.registerWidget({
        id: "test:beta",
        title: "测试 Beta",
        icon: "\u{1F3D7}",
        order: 50,
        region: "right",
        component: function () {
          return React.createElement("div", { className: CLS + "-testContent" }, "test-beta-content");
        }
      });
      // 懒加载示例：首次激活该标签才解析（模拟动态 import 的重组件）
      service.registerWidget({
        id: "test:gamma",
        title: "测试 Gamma（懒加载）",
        icon: "\u{1F4AB}",
        order: 60,
        region: "bottom",
        loadComponent: function () {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(function () {
                return React.createElement("div", { className: CLS + "-testContent" }, "test-gamma-lazy-content");
              });
            }, 400);
          });
        }
      });
      // 多开示例：multi:true → TabBar 出现「+」，可开多个实例；每实例收到独立 instanceId prop
      service.registerWidget({
        id: "test:multi",
        title: "测试多开",
        icon: "\u{1F4AC}",
        order: 70,
        region: "center",
        multi: true,
        component: function (props: any) {
          return React.createElement("div", { className: CLS + "-testContent" },
            "multi-instance:" + String(props.instanceId ?? "?"));
        }
      });
    }
  };
}
