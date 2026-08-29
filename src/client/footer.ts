/**
 * dsh-workspace-sidebar — 侧边栏底部入口（sidebar.footer.action）。
 *
 * 从 components.ts 抽出（原 createComponents 内部）。DI 注入 React / icons /
 * service（延迟 Proxy）/ WorkspaceView（覆盖层需挂在 footer 内，经 portal 到 body）。
 * 覆盖层必须挂到 document.body（createPortal），否则渲染在侧边栏 footer 内部时，
 * fixed + z-index 会在侧边栏的 stacking context 里盖住本按钮。
 */
import type * as ReactTypes from "react";
import { APP_ID, CLS, MODES, SIDECAR_OPEN_EVENT } from "./constants";
import type { Icons } from "./icons";
import type { WorkspaceService } from "./types";

export interface FooterDeps {
  React: typeof ReactTypes;
  icons: Icons;
  service: WorkspaceService;
  WorkspaceView: ReactTypes.ComponentType;
}

export function createFooterAction(deps: FooterDeps): {
  WorkspaceFooterAction: ReactTypes.ComponentType<{ wide: boolean }>;
} {
  const { React, icons, service, WorkspaceView } = deps;
  const useSyncExternalStore = React.useSyncExternalStore;

  function WorkspaceFooterAction(props: { wide: boolean }): React.ReactNode {
    const wide = props.wide;
    const hoverState = React.useState(false);
    const hover = hoverState[0];
    const setHover = hoverState[1];
    // 订阅整个状态（open + panels），便于 footer 模式图标显示激活态
    const state = useSyncExternalStore(service.layout.subscribeState, function () { return service.layout.getState(); });
    const open = state.open;

    // 侧车互斥：其他侧车打开时自动收起本工作台
    React.useEffect(function () {
      const onOpen = function (e: Event) {
        const id = (e as CustomEvent<string>).detail;
        if (id !== APP_ID) service.close();
      };
      window.addEventListener(SIDECAR_OPEN_EVENT, onOpen);
      return function () { window.removeEventListener(SIDECAR_OPEN_EVENT, onOpen); };
    }, []);

    const active = open || hover;

    return React.createElement(
      "div",
      { className: CLS + "-footerAction", style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", gap: 4, flexWrap: "nowrap", justifyContent: wide ? "flex-start" : "center" } },
      React.createElement(
        "button",
        {
          type: "button",
          title: "工作台",
          "aria-label": "工作台",
          "data-dsh-workspace-footer": "",
          "data-active": active || undefined,
          onClick: function () { service.toggle(); },
          onMouseEnter: function () { setHover(true); },
          onMouseLeave: function () { setHover(false); },
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxSizing: "border-box",
            // 折叠态 36×36 正圆（对齐 DSH 原生 rail 图标几何）；宽模式整行 42px 高圆角条
            width: wide ? "auto" : 36,
            minWidth: 0,
            flex: "0 1 auto",
            height: wide ? 42 : 36,
            border: "none",
            borderRadius: wide ? 12 : "50%",
            // 跟随 dsh 主题：文字用 label 色、激活/hover 用 interactive-bg-hover（浅/深自适应）
            background: active ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
            color: active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
            cursor: "pointer",
            padding: wide ? "0 10px" : 0,
            justifyContent: wide ? "flex-start" : "center",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            transition: "background .12s, color .12s"
          }
        },
        icons.lucideIcon("LayoutDashboard", 16),
        wide ? React.createElement("span", null, "工作台") : null
      ),
      // 4 个模式图标：与「工作台」同一行、不换行（仅宽模式；折叠时隐藏）
      wide ? React.createElement(
        "div",
        { className: CLS + "-footerModes" },
        MODES.map(function (m) {
          return React.createElement("button", {
            key: m.id,
            className: CLS + "-footerMode" + (state.panels[m.id] ? " " + CLS + "-footerModeActive" : ""),
            title: icons.modeTitle(m, state.panels),
            "aria-label": icons.modeTitle(m, state.panels),
            "data-mode": m.id,
            onClick: function () { service.toggleMode(m.id); }
          }, icons.modeIcon(m.id, 16));
        })
      ) : null,
      // 覆盖层 portal 到 body（见文件头注释）
      open ? icons.createPortalToBody(React.createElement(WorkspaceView, {})) : null
    );
  }

  return { WorkspaceFooterAction: WorkspaceFooterAction };
}
