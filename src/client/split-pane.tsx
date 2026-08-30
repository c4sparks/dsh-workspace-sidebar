/**
 * dsh-workspace-sidebar — 分屏 / 拖拽的 React 视图组件（split-pane）。
 *
 * 从 workspace-view.ts 拆出：`SplitRegion`（分屏树渲染）+ `PaneDropTarget` / `DragHint`
 * （拖拽吸附区 / 浮动提示）。纯逻辑在 `split-tree.ts` / `tab-drag.ts`；是否启用分屏由
 * `WorkspaceState.splitEnabled` 控制（settings「布局配置」）。
 *
 * 依赖注入：TabBar / WidgetBody / msOf / itemsFromPane 由 workspace-view 提供（本模块
 * 不直接持有它们的实现），保持视图胶水与分屏能力解耦。
 */
import type * as ReactTypes from "react";
import { Allotment } from "allotment";
import allotmentCss from "allotment/dist/style.css";
import { CLS } from "./constants";
import type { Mode, ModeState, PaneState, Region, SplitNode, TabItem, WidgetDescriptor, WorkspaceService, WorkspaceState } from "./types";
import { DROP_HINT_TEXT, dropOverlayStyle, getActiveDrop, subscribeDrop } from "./tab-drag";
import { useDroppable } from "@dnd-kit/core";

export interface SplitPaneDeps {
  React: typeof ReactTypes;
  service: WorkspaceService;
  msOf: (state: WorkspaceState, mode: Mode) => ModeState;
  itemsFromPane: (pane: PaneState | undefined, widgets: readonly WidgetDescriptor[]) => TabItem[];
  TabBar: (props: any) => ReactTypes.ReactNode;
  WidgetBody: (props: any) => ReactTypes.ReactNode;
}

export interface SplitPaneApi {
  SplitRegion: (props: SplitRegionProps) => ReactTypes.ReactNode;
  PaneDropTarget: (props: { mode: Mode; region: Region; paneId: string; vertical?: boolean; children: ReactTypes.ReactNode }) => ReactTypes.ReactNode;
  DragHint: () => ReactTypes.ReactNode;
}

export interface SplitRegionProps {
  region: Region;
  mode: Mode;
  node: SplitNode;
  widgets: readonly WidgetDescriptor[];
  state: WorkspaceState;
  chrome: boolean;
  path: number[];
}

export function createSplitPane(deps: SplitPaneDeps): SplitPaneApi {
  const { React, service, msOf, itemsFromPane, TabBar, WidgetBody } = deps;

  /**
   * 面板放置目标：dnd-kit droppable（id=paneId，data={mode,region}）；
   * 当它是当前拖拽目标时显示吸附区覆盖层。
   */
  function PaneDropTarget(props: { mode: Mode; region: Region; paneId: string; vertical?: boolean; children: ReactTypes.ReactNode }): ReactTypes.ReactNode {
    // dnd-kit droppable：pane 是 tab 拖拽的落点（onDragMove 经 pointerWithin 命中 → zoneAt 算 zone）
    const { setNodeRef } = useDroppable({ id: props.paneId, data: { kind: "pane", mode: props.mode, region: props.region } });
    const [, setTick] = React.useState(0);
    React.useEffect(function () {
      return subscribeDrop(function () { setTick(function (t) { return t + 1; }); });
    }, []);
    const d = getActiveDrop();
    const zone = d !== null && d.paneId === props.paneId ? d.zone : null;
    const overlay = zone !== null ? React.createElement("div", { style: dropOverlayStyle(zone) }) : null;
    return React.createElement(
      "div",
      { ref: setNodeRef, "data-dnd-pane": props.paneId, "data-dnd-mode": props.mode, "data-dnd-region": props.region, style: { position: "relative", flex: 1, height: "100%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: props.vertical === true ? "row" : "column" } },
      props.children,
      overlay
    );
  }

  /** 拖拽中的浮动提示（跟随指针，显示落点动作）。 */
  function DragHint(): ReactTypes.ReactNode {
    const [, setTick] = React.useState(0);
    React.useEffect(function () {
      return subscribeDrop(function () { setTick(function (t) { return t + 1; }); });
    }, []);
    const d = getActiveDrop();
    if (d === null) return null;
    return React.createElement("div", {
      style: { position: "fixed", left: d.x + 14, top: d.y + 20, zIndex: 2000, pointerEvents: "none", background: "rgba(15,25,45,.92)", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,.25)", whiteSpace: "nowrap" }
    }, DROP_HINT_TEXT[d.zone]);
  }

  /** allotment 样式一次性注入（+ 分割线光标/颜色/粗细统一为 --dsws-divider-*，与区域手柄一致）。
   *  allotment 默认可见线 4px（--sash-hover-size），区域手柄是 --dsws-divider-width（1px）；
   *  这里把热区收敛为 6px、可见线跟随 dividerWidth，避免分屏分割线明显偏粗。 */
  let allotmentCssInjected = false;
  function ensureAllotmentCss(): void {
    if (allotmentCssInjected) return;
    allotmentCssInjected = true;
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-workspace-sidebar";
    tag.textContent = allotmentCss + [
      // max(1px, ...) 兜底：全屏「单画布」模式 overlay 把 --dsws-divider-width 置 0px（隐藏区域分割线），
      // 但分屏 sash 仍要可见细线 —— 用 max 保证至少 1px，dividerWidth≥1 时跟随设置。
      ".split-view .sash{--sash-size:6px;--sash-hover-size:max(1px,var(--dsws-divider-width,1px))}",
      ".split-view .sash-vertical{cursor:col-resize}",
      ".split-view .sash-horizontal{cursor:row-resize}",
      ".split-view .sash::before{background:var(--dsws-divider-color,rgba(0,0,0,.12))}",
      ".split-view .sash-active::before,.split-view .sash:hover::before{background:var(--dsw-alias-state-business-primary,#3b82f6)}",
      // allotment 只给「.split-view-container > .split-view-view」设 height:100%；pane 内部还有一层
      // 嵌套的 .split-view-view（内容包裹层）没高度 → 塌成内容高、分屏内容不可见。这里补上填满。
      ".split-view-view > .split-view-view{height:100%;width:100%;min-height:0;min-width:0}"
    ].join("");
    document.head.appendChild(tag);
  }

  /** 分屏树渲染（基于 allotment）：leaf = Allotment.Pane(TabBar+WidgetBody)；split = 嵌套 Allotment。 */
  function SplitRegion(props: SplitRegionProps): ReactTypes.ReactNode {
    ensureAllotmentCss();
    const node = props.node;
    if (node.kind === "leaf") {
      const pane = msOf(props.state, props.mode).panes[node.paneId];
      const items = itemsFromPane(pane, props.widgets);
      const active = pane?.active ?? null;
      const inner = React.createElement(
        "div",
        // flex:1 填满 PaneDropTarget（height:100%）；height:100% 兜底（allotment view 是 absolute）
        { style: { position: "relative", display: "flex", flexDirection: "column", flex: 1, height: "100%", minWidth: 0, minHeight: 0 } },
        React.createElement("button", {
          onClick: function (e) { e.stopPropagation(); service.closePane(props.region, node.paneId, props.mode); },
          title: "关闭此面板",
          style: { position: "absolute", top: 2, right: 2, zIndex: 5, border: "none", background: "rgba(0,0,0,0.35)", color: "#fff", borderRadius: 4, width: 16, height: 16, fontSize: 10, cursor: "pointer", lineHeight: 1 }
        }, "✕"),
        props.chrome ? React.createElement(TabBar, {
          items: items,
          active: active,
          region: props.region,
          paneId: node.paneId,
          onSelect: function (id: string) { service.setActiveWidget(props.region, id, props.mode); },
          onCloseTab: function (id: string) { service.closeTab(id); },
          onOpenWidget: function (wid: string, region: Region, paneId: string) { service.openWidget(wid, { mode: props.mode, region: region, paneId: paneId }); },
          widgets: props.widgets
        }) : null,
        React.createElement("div", { className: CLS + "-regionBody", style: { flex: 1, minHeight: 0 } },
          React.createElement(WidgetBody, { items: items, active: active })
        )
      );
      const paneContent = React.createElement(PaneDropTarget, { mode: props.mode, region: props.region, paneId: node.paneId, children: inner });
      return React.createElement(Allotment.Pane, { minSize: 60, children: paneContent });
    }
    const vertical = node.dir === "col";
    const total = node.weights.reduce(function (s, w) { return s + (w ?? 1); }, 0) || 1;
    const sizes = node.children.map(function (_c, i) { return ((node.weights[i] ?? 1) / total) * 100; });
    const children = node.children.map(function (child, i) {
      return React.createElement(SplitRegion, { key: i, region: props.region, mode: props.mode, node: child, widgets: props.widgets, state: props.state, chrome: props.chrome, path: props.path.concat(i) });
    });
    // 分屏容器：flex:1 + height:100% 填满父级（flex 区域或 allotment view）。
    // **嵌套分屏（path 非空）必须是 Allotment.Pane 子节点**——否则父 Allotment 不认这个
    // div 子节点、不给尺寸，塌成内容高（34.67）→ regionBody 0 → 内容不可见。
    const inner = React.createElement(
      "div",
      { style: { flex: 1, height: "100%", minHeight: 0, display: "flex" } },
      React.createElement(Allotment, {
        vertical: vertical,
        defaultSizes: sizes,
        children: children,
        onChange: function (sizesArr) {
          const sum = sizesArr.reduce(function (a, b) { return a + b; }, 0) || 1;
          const w = sizesArr.map(function (s) { return s / sum; });
          service.setSplitNodeWeights(props.region, props.path, w, props.mode);
        }
      })
    );
    return props.path.length > 0
      ? React.createElement(Allotment.Pane, { minSize: 60, children: inner })
      : inner;
  }

  return { SplitRegion: SplitRegion, PaneDropTarget: PaneDropTarget, DragHint: DragHint };
}
