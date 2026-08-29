/**
 * dsh-workspace-sidebar — Lucide 图标与通用渲染助手（经 createIcons(React) 注入
 * React，避免把 lucide-react 打进 client bundle）。
 */
import type * as ReactTypes from "react";
import type { Mode, PanelsState } from "./types";

export interface Icons {
  createPortalToBody(child: ReactTypes.ReactNode): ReactTypes.ReactNode;
  lucideIcon(name: string, size: number): ReactTypes.ReactNode;
  modeIcon(mode: Mode, size?: number): ReactTypes.ReactNode;
  /** 模式图标 hover 标题：按面板开关显示「展开X / 收起X」。 */
  modeTitle(m: { id: Mode; label: string }, panels: PanelsState): string;
  resolveNode(v: unknown, size: number): ReactTypes.ReactNode;
}

export function createIcons(React: typeof ReactTypes): Icons {
  /** React 19 的 createPortal（react 包运行时导出；@types/react 未在默认命名空间声明）。 */
  const _reactWithPortal = React as unknown as {
    createPortal?: (child: ReactTypes.ReactNode, container: Element | DocumentFragment) => ReactTypes.ReactNode;
  };
  function createPortalToBody(child: ReactTypes.ReactNode): ReactTypes.ReactNode {
    if (typeof _reactWithPortal.createPortal === "function" && typeof document !== "undefined") {
      return _reactWithPortal.createPortal(child, document.body);
    }
    return child;
  }

  // Lucide Icons（ISC）的 SVG 路径数据内嵌渲染：外观与 lucide-react 一致，
  // 但避免把 lucide-react 打进 client bundle（其顶层 require("react") 在 dsh
  // 加载器里解析不到，会导致 bundle 未注册即失败）。
  const LUCIDE_ICONS: Record<string, { tag: string; attrs: Record<string, string | number> }[]> = {
    fullscreen: [
      { tag: "path", attrs: { d: "M3 7V5a2 2 0 0 1 2-2h2" } },
      { tag: "path", attrs: { d: "M17 3h2a2 2 0 0 1 2 2v2" } },
      { tag: "path", attrs: { d: "M21 17v2a2 2 0 0 1-2 2h-2" } },
      { tag: "path", attrs: { d: "M7 21H5a2 2 0 0 1-2-2v-2" } },
      { tag: "rect", attrs: { x: 7, y: 8, width: 10, height: 8, rx: 1 } }
    ],
    left: [
      { tag: "rect", attrs: { x: 3, y: 3, width: 18, height: 18, rx: 2 } },
      { tag: "path", attrs: { d: "M9 3v18" } }
    ],
    right: [
      { tag: "rect", attrs: { x: 3, y: 3, width: 18, height: 18, rx: 2 } },
      { tag: "path", attrs: { d: "M15 3v18" } }
    ],
    bottom: [
      { tag: "rect", attrs: { x: 3, y: 3, width: 18, height: 18, rx: 2 } },
      { tag: "path", attrs: { d: "M3 15h18" } }
    ],
    LayoutDashboard: [
      { tag: "rect", attrs: { x: 3, y: 3, width: 7, height: 9, rx: 1 } },
      { tag: "rect", attrs: { x: 14, y: 3, width: 7, height: 5, rx: 1 } },
      { tag: "rect", attrs: { x: 14, y: 12, width: 7, height: 9, rx: 1 } },
      { tag: "rect", attrs: { x: 3, y: 16, width: 7, height: 5, rx: 1 } }
    ],
    close: [
      { tag: "path", attrs: { d: "M18 6 6 18" } },
      { tag: "path", attrs: { d: "m6 6 12 12" } }
    ],
    chevronDown: [
      { tag: "path", attrs: { d: "m6 9 6 6 6-6" } }
    ],
    chevronUp: [
      { tag: "path", attrs: { d: "m18 15-6-6-6 6" } }
    ]
  };
  function lucideIcon(name: keyof typeof LUCIDE_ICONS, size: number): ReactTypes.ReactNode {
    return React.createElement(
      "svg",
      { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, style: { display: "block" } },
      LUCIDE_ICONS[name].map(function (n, i) { return React.createElement(n.tag, { key: i, ...n.attrs }); })
    );
  }
  /** 模式图标（Lucide 风格）；size 可调小以适配窄空间。 */
  function modeIcon(mode: Mode, size = 16): ReactTypes.ReactNode {
    return lucideIcon(mode === "left" ? "left" : mode === "right" ? "right" : mode === "bottom" ? "bottom" : "fullscreen", size);
  }
  /** 模式图标 hover 标题：按面板开关显示「展开X / 收起X」。 */
  function modeTitle(m: { id: Mode; label: string }, panels: PanelsState): string {
    return (panels[m.id] ? "收起" : "展开") + m.label;
  }

  function resolveNode(v: unknown, size: number): ReactTypes.ReactNode {
    if (v == null) return null;
    return typeof v === "function" ? (v as (s: number) => ReactTypes.ReactNode)(size) : (v as ReactTypes.ReactNode);
  }

  return { createPortalToBody: createPortalToBody, lucideIcon: lucideIcon, modeIcon: modeIcon, modeTitle: modeTitle, resolveNode: resolveNode };
}
