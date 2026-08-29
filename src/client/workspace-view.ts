/**
 * dsh-workspace-sidebar — 覆盖层工作台视图（WorkspaceView 及其子组件）。
 *
 * 面板模型（v4）：左 / 右 / 底**可同时打开**（各自独立 fixed 面板）；全屏独占。
 * 每个面板渲染自己的 `SinglePane(mode)`（读 `modeState[mode]` 的打开实例）。
 * 停靠面板的开关由 footer 图标 / `toggleMode` 控制；全屏内仍分左/中/右/底区域。
 */
import type * as ReactTypes from "react";
import { CLS, MIN_MAIN_AREA, MODES, NARROW_BREAKPOINT, OVERLAY_Z_INDEX } from "./constants";
import type { ComponentScope } from "./scope";
import type { Hooks } from "./hooks";
import type { Icons } from "./icons";
import { applyPushLayout } from "./push-layout";
import { createSplitPane } from "./split-pane";
import { createDndWorkspace } from "./dnd";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import type { Mode, ModeState, PaneState, PanelsState, Region, TabItem, WidgetComponent, WidgetDescriptor, WorkspaceState, WorkspaceService } from "./types";

export interface WorkspaceViewDeps {
  React: typeof ReactTypes;
  hooks: Hooks;
  icons: Icons;
  service: WorkspaceService;
  scope: ComponentScope;
}

/** 由 pane 的 TabRef 列表 + 注册表解析出 TabItem 列表（描述符缺失的实例丢弃）。 */
function itemsFromPane(pane: PaneState | undefined, widgets: readonly WidgetDescriptor[]): TabItem[] {
  if (pane === undefined) return [];
  const out: TabItem[] = [];
  for (const ref of pane.tabs) {
    const desc = widgets.find(function (w) { return w.id === ref.widgetId; });
    if (desc !== undefined) out.push({ id: ref.id, widgetId: ref.widgetId, desc: desc });
  }
  return out;
}

export function createWorkspaceView(deps: WorkspaceViewDeps): {
  WorkspaceView: ReactTypes.ComponentType;
} {
  const { React, hooks, icons, service, scope } = deps;
  const useSyncExternalStore = React.useSyncExternalStore;
  // 拖拽事件层（dnd-kit）：包住整个工作台视图；TabBar 标签 useDraggable、pane useDroppable
  const { DndWorkspace } = createDndWorkspace({ React, service, icons });

  /** 指定面板的打开实例状态（左/右/底可同时开，各自独立）。 */
  function msOf(state: WorkspaceState, mode: Mode): ModeState {
    return state.modeState[mode];
  }

  /** 单个标签：dnd-kit useSortable（可拖 + 可作重排落点）。PointerSensor 6px 阈值区分
   *  点击/拖拽；点击激活；✕ 关闭（onPointerDown stopPropagation 阻止标签启动拖拽）。 */
  function TabView(props: {
    item: TabItem;
    active: boolean;
    label: string;
    paneId: string;
    onSelect: (instanceId: string) => void;
    onCloseTab: (instanceId: string) => void;
  }): React.ReactNode {
    const { setNodeRef, attributes, listeners, isDragging } = useSortable({
      id: props.item.id,
      data: { kind: "tab", instanceId: props.item.id, widgetId: props.item.widgetId, paneId: props.paneId },
      disabled: service.getState().splitEnabled === false,
    });
    return React.createElement(
      "div",
      {
        ref: setNodeRef,
        ...attributes,
        ...listeners,
        role: "tab",
        className: CLS + "-tab" + (props.active ? " " + CLS + "-tabActive" : ""),
        "data-tab": props.item.id,
        title: props.label,
        style: isDragging ? { opacity: 0.4 } : undefined,
        onClick: function () { props.onSelect(props.item.id); }
      },
      React.createElement("span", { className: CLS + "-tabIcon" }, icons.resolveNode(props.item.desc.icon, 14) ?? "\u{1F9E9}"),
      React.createElement("span", { className: CLS + "-tabLabel" }, props.label),
      React.createElement("button", {
        className: CLS + "-tabClose",
        title: "关闭",
        "aria-label": "关闭 " + props.label,
        onPointerDown: function (e) { e.stopPropagation(); },
        onClick: function (e) { e.stopPropagation(); props.onCloseTab(props.item.id); }
      }, "✕")
    );
  }

  function TabBar(props: {
    items: readonly TabItem[];
    active: string | null;
    region: Region;
    paneId: string;
    onSelect: (instanceId: string) => void;
    onCloseTab: (instanceId: string) => void;
    onOpenWidget: (widgetId: string, region: Region, paneId: string) => void;
    widgets: readonly WidgetDescriptor[];
  }): React.ReactNode {
    // widget 选择弹层（「+」按钮）：portaled 到 body（避开 tabbar overflow 裁剪），
    // fixed 定位锚在按钮下方 + 全屏 backdrop（z 高于覆盖层，始终可见可点）
    const pickerState = React.useState(false);
    const pickerOpen = pickerState[0];
    const setPickerOpen = pickerState[1];
    const addBtnRef = React.useRef<HTMLButtonElement | null>(null);
    const pickerPosRef = React.useRef({ top: 44, left: 24, minWidth: 180 });
    function openPicker() {
      const el = addBtnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        pickerPosRef.current = { top: r.bottom + 4, left: r.left, minWidth: 180 };
      }
      setPickerOpen(true);
    }
    function closePicker() { setPickerOpen(false); }
    // 可选插件（过滤禁用）；空则「+」置灰不可用
    const available = props.widgets.filter(function (w) { return !service.isWidgetDisabled(w.id); });
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        { className: CLS + "-tabbar" },
        React.createElement(
          SortableContext,
          {
            items: props.items.map(function (t) { return t.id; }),
            strategy: horizontalListSortingStrategy,
            children: props.items.map(function (t) {
            const base = typeof t.desc.title === "function" ? t.desc.title() : t.desc.title;
            // 多开实例编号**稳定**（跨 pane/面板不因拖走重排）：实例 id 推导
            // （widgetId → #1；widgetId:instN → #N+2），全局实例数 >1 才显示
            let label = base;
            if (t.desc.multi) {
              const mm = /:inst(\d+)$/.exec(t.id);
              const num = mm ? (Number(mm[1]) + 2) : 1;
              if (service.getWidgetInstanceCount(t.widgetId) > 1) label = base + " #" + num;
            }
              return React.createElement(TabView, {
                key: t.id,
                item: t,
                active: t.id === props.active,
                label: label,
                paneId: props.paneId,
                onSelect: props.onSelect,
                onCloseTab: props.onCloseTab
              });
            })
          }
        ),
        React.createElement("button", {
          className: CLS + "-tabAdd",
          title: available.length === 0 ? "未安装对应类型插件" : "打开插件",
          "aria-label": available.length === 0 ? "未安装对应类型插件" : "打开插件",
          ref: addBtnRef,
          disabled: available.length === 0,
          onClick: function () { if (available.length === 0) return; pickerOpen ? closePicker() : openPicker(); },
          style: available.length === 0 ? { opacity: 0.35, cursor: "not-allowed" } : undefined
        }, "+"),
        pickerOpen ? icons.createPortalToBody(
          React.createElement(
            React.Fragment,
            null,
            React.createElement("div", { className: CLS + "-tabPickerBackdrop", onClick: closePicker }),
            React.createElement(
              "div",
              { className: CLS + "-tabPicker", role: "menu", style: { top: pickerPosRef.current.top, left: pickerPosRef.current.left, minWidth: pickerPosRef.current.minWidth } },
              // 可选插件（已过滤禁用；空则「+」禁用打不开这里）
              available.map(function (w) {
                return React.createElement("button", {
                  key: w.id,
                  role: "menuitem",
                  className: CLS + "-tabPickerItem",
                  type: "button",
                  onPointerDown: function (e) { e.stopPropagation(); }, // 不被父级指针逻辑干扰
                  onClick: function () { closePicker(); props.onOpenWidget(w.id, props.region, props.paneId); }
                }, React.createElement("span", { className: CLS + "-tabPickerIcon" }, icons.resolveNode(w.icon, 14) ?? "\u{1F9E9}"),
                  React.createElement("span", null, typeof w.title === "function" ? w.title() : w.title));
              })
            )
          )
        ) : null
      )
    );
  }

  /**
   * 区域内已访问实例的 keep-alive + 懒加载解析（WidgetBody 渲染用）。
   * - visited：激活过的实例 id 保持挂载（非激活 display:none），保留其内部状态（iframe / 表单）。
   * - resolved：懒加载组件缓存（按 widgetId 缓存，多实例共享），仅首次激活时调用 loadComponent。
   */
  function useResolvedTabs(items: readonly TabItem[], active: string | null) {
    const visitedState = React.useState<string[]>([]);
    const visited = visitedState[0];
    const setVisited = visitedState[1];
    React.useEffect(function () {
      if (active !== null && visited.indexOf(active) === -1) setVisited(visited.concat(active));
    }, [active]);

    // 用 ref 读最新 items：懒加载 effect 只依赖 active，items 每次渲染变化不取消在途加载
    const itemsRef = React.useRef(items);
    itemsRef.current = items;
    const resolvedRef = React.useRef(new Map<string, WidgetComponent>());
    const lazyTickState = React.useState(0);
    const setLazyTick = lazyTickState[1];
    React.useEffect(function () {
      if (active === null) return;
      const item = itemsRef.current.find(function (it) { return it.id === active; });
      if (item === undefined || item.desc.loadComponent === undefined) return;
      if (resolvedRef.current.has(item.widgetId)) return;
      let cancelled = false;
      item.desc.loadComponent().then(function (C) {
        if (cancelled) return;
        resolvedRef.current.set(item.widgetId, C);
        setLazyTick(function (t) { return t + 1; });
      }).catch(function (err) {
        console.error("workspace: lazy widget \"" + item.widgetId + "\" failed to load", err);
      });
      return function () { cancelled = true; };
    }, [active]);
    return { visited: visited, resolved: resolvedRef.current };
  }

  /** 区域内已访问实例的 keep-alive 渲染（含懒加载解析与空 pane 占位）。 */
  function WidgetBody(props: { items: readonly TabItem[]; active: string | null }): React.ReactNode {
    const active = props.active;
    const { visited, resolved } = useResolvedTabs(props.items, active);
    if (props.items.length === 0) {
      return null; // 空 pane 保持空白
    }
    return React.createElement(
      React.Fragment,
      null,
      visited.map(function (id) {
        const item = props.items.find(function (it) { return it.id === id; });
        if (item === undefined) return null;
        const isActive = id === active;
        const comp = item.desc.component ?? resolved.get(item.widgetId);
        if (comp === undefined) {
          // 懒加载未就绪：仅激活实例显示加载占位；非激活不渲染
          return isActive
            ? React.createElement(
                "div",
                { key: id, className: CLS + "-widgetPane", style: { display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dsw-alias-label-secondary,#999)", fontSize: 12 } },
                "加载中…"
              )
            : null;
        }
        return React.createElement(
          "div",
          { key: id, className: CLS + "-widgetPane", style: { display: isActive ? undefined : "none" } },
          React.createElement(comp, { active: isActive, ctx: scope.ctx, service: service, instanceId: id })
        );
      })
    );
  }

  // 分屏 / 拖拽视图（SplitRegion / PaneDropTarget / DragHint）在 split-pane.tsx，注入共享 helper
  const { SplitRegion, PaneDropTarget, DragHint } = createSplitPane({ React, service, msOf, itemsFromPane, TabBar, WidgetBody });

  /** 全屏模式的区域渲染（左/中/右/底）。mode 恒为 "fullscreen"。 */
  function RegionPane(props: {
    region: Region;
    mode: Mode;
    width?: number | null;
    height?: number | null;
    state: WorkspaceState;
    chrome: boolean;
  }): React.ReactNode {
    const region = props.region;
    // 注册表用稳定的缓存数组（getWidgets）；pane 来自 state（useSyncExternalStore 订阅快照）
    const widgets = useSyncExternalStore(service.subscribe, function () { return service.getWidgets(); });
    const pane = msOf(props.state, props.mode).panes[region + ":main"];
    const items = React.useMemo(function () { return itemsFromPane(pane, widgets); }, [pane, widgets]);
    const active = pane?.active ?? null;

    const style: ReactTypes.CSSProperties = {};
    if (typeof props.width === "number") style.width = props.width;
    if (typeof props.height === "number") style.height = props.height;
    const regionCls = CLS + "-region" + " " + CLS + "-region" + (region.charAt(0).toUpperCase() + region.slice(1));

    const splits = msOf(props.state, props.mode).splits[region];
    return React.createElement(
      "div",
      { className: regionCls, style: style, "data-region": region },
      splits
        ? React.createElement(SplitRegion, { region: region, mode: props.mode, node: splits, widgets: widgets, state: props.state, chrome: props.chrome, path: [] })
        : React.createElement(PaneDropTarget, {
            mode: props.mode,
            region: region,
            paneId: region + ":main",
            children: React.createElement(
              React.Fragment,
              null,
              props.chrome ? React.createElement(TabBar, {
                items: items,
                active: active,
                region: region,
                paneId: region + ":main",
                onSelect: function (id) { service.setActiveWidget(region, id, props.mode); },
                onCloseTab: function (id) { service.closeTab(id); },
                onOpenWidget: function (wid, r, paneId) { service.openWidget(wid, { mode: props.mode, region: r, paneId: paneId }); },
                widgets: widgets
              }) : null,
              React.createElement(
                "div",
                { className: CLS + "-regionBody" },
                React.createElement(WidgetBody, { items: items, active: active })
              )
            )
          })
    );
  }

  /** 停靠 / 底部模式的单面板：某面板的全部 pane 打开实例平铺成标签，一次显示一个；center 分屏时渲染分屏树。 */
  function SinglePane(props: { state: WorkspaceState; mode: Mode }): React.ReactNode {
    const mode = props.mode;
    const widgets = useSyncExternalStore(service.subscribe, function () { return service.getWidgets(); });
    // 该面板按 center→left→right→bottom 顺序合并全部 pane 的打开实例（实例去重）
    const items = React.useMemo(function () {
      const out: TabItem[] = [];
      const seen = new Set<string>();
      for (const r of ["center", "left", "right", "bottom"] as Region[]) {
        for (const ref of service.getTabRefs(r, mode)) {
          if (seen.has(ref.id)) continue;
          seen.add(ref.id);
          const desc = widgets.find(function (w) { return w.id === ref.widgetId; });
          if (desc !== undefined) out.push({ id: ref.id, widgetId: ref.widgetId, desc: desc });
        }
      }
      return out;
    }, [props.state, widgets, mode]);
    const splits = msOf(props.state, mode).splits["center"];
    if (splits) {
      return React.createElement(
        "div",
        { className: CLS + "-pane", "data-pane": mode },
        React.createElement(SplitRegion, { region: "center", mode: mode, node: splits, widgets: widgets, state: props.state, chrome: true, path: [] })
      );
    }
    // 激活高亮 = 该实例所在 pane 里恰为 active 的那一个（每 pane 至多一个）
    const m0 = msOf(props.state, mode);
    const active = items.find(function (it) {
      const pid = m0.paneOfWidget[it.id];
      return pid !== undefined && m0.panes[pid]?.active === it.id;
    })?.id ?? null;
    return React.createElement(
      "div",
      { className: CLS + "-pane", "data-pane": mode },
      React.createElement(PaneDropTarget, {
        mode: mode,
        region: "center",
        paneId: "center:main",
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement(TabBar, {
            items: items,
            active: active,
            region: "center",
            paneId: "center:main",
            onSelect: function (id) { service.setActiveWidget("center", id, mode); },
            onCloseTab: function (id) { service.closeTab(id); },
            onOpenWidget: function (wid, r, paneId) { service.openWidget(wid, { mode: mode, region: r, paneId: paneId }); },
            widgets: widgets
          }),
          React.createElement(
            "div",
            { className: CLS + "-regionBody" },
            React.createElement(WidgetBody, { items: items, active: active })
          )
        )
      })
    );
  }

  interface ResizeHandleProps {
    side: string;
    horizontal: boolean;
    onStart?: () => void;
    onDrag?: (dx: number, dy: number) => void;
    onEnd?: () => void;
    style?: ReactTypes.CSSProperties;
  }
  /** 一条分割线句柄（flex 项；列间纵向、底栏上方横向；可传 style 作绝对定位）。 */
  function ResizeHandle(props: ResizeHandleProps): React.ReactNode {
    const drag = hooks.usePointerDrag({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd });
    const style = props.style || {};
    return React.createElement("div", {
      className: CLS + (props.horizontal ? "-resize" : "-resizeRow"),
      "data-resize": props.side,
      "data-dragging": drag.dragging || void 0,
      style: style,
      onPointerDown: drag.onPointerDown,
      onPointerMove: drag.onPointerMove,
      onPointerUp: drag.onPointerUp
    });
  }

  /** 顶部工具栏：4 个模式图标（固定在左上角）+ 右上角关闭。图标 = 面板开关（toggle）。 */
  function Toolbar(props: { panels: PanelsState; mode?: Mode }): React.ReactNode {
    const panels = props.panels;
    // X 按钮：全屏 = 关闭整个工作台；停靠面板（左/右/底）多面板同屏时 = 只收起当前面板
    const dockClose = props.mode !== undefined && props.mode !== "fullscreen";
    return React.createElement(
      "div",
      { className: CLS + "-toolbar" },
      MODES.map(function (m) {
        return React.createElement("button", {
          key: m.id,
          className: CLS + "-modeBtn" + (panels[m.id] ? " " + CLS + "-modeBtnActive" : ""),
          "data-mode": m.id,
          title: icons.modeTitle(m, panels),
          "aria-label": icons.modeTitle(m, panels),
          onClick: function () { service.toggleMode(m.id); }
        }, icons.modeIcon(m.id));
      }),
      React.createElement("span", { className: CLS + "-spacer" }),
      React.createElement("button", {
        className: CLS + "-close",
        onClick: function () { if (dockClose && props.mode) service.toggleMode(props.mode); else service.close(); },
        title: dockClose ? "关闭此面板" : "关闭工作台",
        "aria-label": dockClose ? "关闭此面板" : "关闭工作台"
      }, icons.lucideIcon("close", 14))
    );
  }

  function WorkspaceView(): React.ReactNode {
    // 双保险订阅：useSyncExternalStore 快照 + useEffect tick 强制每次 store emit 都重渲染
    // （避免快照引用未变化导致新增 tab 不显示）
    const state = useSyncExternalStore(service.layout.subscribeState, function () { return service.layout.getState(); });
    const [, setTick] = React.useState(0);
    React.useEffect(function () {
      return service.layout.subscribeState(function () { setTick(function (t) { return t + 1; }); });
    }, []);
    const viewport = hooks.useViewport();
    const sidebarRight = hooks.useSidebarRight();

    React.useEffect(function () {
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") service.close();
      }
      window.addEventListener("keydown", onKey);
      return function () { window.removeEventListener("keydown", onKey); };
    }, []);
    if (!state.open) return null;
    const panels = state.panels;

    // 停靠面板有效尺寸（受主内容区 × dockMaxRatio 约束）
    const mainW = Math.max(0, viewport.width - sidebarRight);
    const maxMainW = Math.max(MIN_MAIN_AREA, mainW * state.dockMaxRatio);
    const maxMainH = Math.max(MIN_MAIN_AREA, viewport.height * state.dockMaxRatio);
    const effLeftW = Math.min(state.leftW, maxMainW);
    const effRightW = Math.min(state.rightW, maxMainW);
    const effBottomH = Math.min(state.bottomH, maxMainH);

    // hooks 无条件调用
    const enterAnim = "dsws-enter-dock .2s ease-out";
    const animWindowState = React.useState(true);
    const animWindow = animWindowState[0];
    const setAnimWindow = animWindowState[1];
    React.useLayoutEffect(function () {
      setAnimWindow(true);
      const t = setTimeout(function () { setAnimWindow(false); }, 250);
      return function () { clearTimeout(t); };
    }, []);
    const dragActiveState = React.useState(false);
    const dragActive = dragActiveState[0];
    const setDragActive = dragActiveState[1];

    // 停靠面板边缘拖拽：左面板右缘 / 右面板左缘 / 底面板上缘（各自独立基准）
    const leftEdgeBase = React.useRef(0);
    const rightEdgeBase = React.useRef(0);
    const bottomEdgeBase = React.useRef(0);
    const leftEdge = {
      onStart: function () { setDragActive(true); leftEdgeBase.current = effLeftW; },
      onDrag: function (dx: number) { service.layout.setModeSize("left", leftEdgeBase.current + dx); },
      onEnd: function () { setDragActive(false); }
    };
    const rightEdge = {
      onStart: function () { setDragActive(true); rightEdgeBase.current = effRightW; },
      onDrag: function (dx: number) { service.layout.setModeSize("right", rightEdgeBase.current - dx); },
      onEnd: function () { setDragActive(false); }
    };
    const bottomEdge = {
      onStart: function () { setDragActive(true); bottomEdgeBase.current = effBottomH; },
      onDrag: function (dx: number, dy: number) { void dx; service.layout.setModeSize("bottom", bottomEdgeBase.current - dy); },
      onEnd: function () { setDragActive(false); }
    };

    // 全屏区域拖拽基准（左/右/底区域宽高）
    const leftBase = React.useRef(0);
    const rightBase = React.useRef(0);
    const bottomBase = React.useRef(0);
    const onLeftStart = React.useCallback(function () { leftBase.current = state.regionSizes.left || 0; }, [state.regionSizes.left]);
    const onLeftDrag = React.useCallback(function (dx: number) { service.layout.setRegionSize("left", leftBase.current + dx); }, []);
    const onRightStart = React.useCallback(function () { rightBase.current = state.regionSizes.right || 0; }, [state.regionSizes.right]);
    const onRightDrag = React.useCallback(function (dx: number) { service.layout.setRegionSize("right", rightBase.current - dx); }, []);
    const onBottomStart = React.useCallback(function () { bottomBase.current = state.regionSizes.bottom || 0; }, [state.regionSizes.bottom]);
    const onBottomDrag = React.useCallback(function (dx: number, dy: number) {
      void dx;
      service.layout.setRegionSize("bottom", bottomBase.current - dy);
    }, []);

    // 推挤主布局：停靠右/底推挤；全屏不推挤（覆盖接管）
    React.useEffect(function () {
      const dock = !panels.fullscreen;
      return applyPushLayout({
        rightOpen: dock && panels.right,
        effRightW: effRightW,
        bottomOpen: dock && panels.bottom,
        effBottomH: effBottomH,
        dragActive: dragActive
      });
    }, [panels.fullscreen, panels.right, panels.bottom, effRightW, effBottomH, dragActive]);

    const overlayBase: ReactTypes.CSSProperties = {
      zIndex: OVERLAY_Z_INDEX,
      animation: enterAnim,
      transition: (animWindow || dragActive) ? "none" : "width .25s ease, height .25s ease"
    };

    // ---- 全屏布局（独占）----
    if (panels.fullscreen) {
      const mode = "fullscreen";
      const overlayWidth = mainW;
      const narrow = overlayWidth < NARROW_BREAKPOINT;
      const leftW = state.regionSizes.left;
      const rightW = narrow ? 0 : state.regionSizes.right;
      const bottomH = narrow ? 0 : state.regionSizes.bottom;
      const chrome = state.preset !== "fullscreen";
      const geom: ReactTypes.CSSProperties = { left: sidebarRight, top: 0, width: mainW, height: viewport.height };
      const overlayProps = {
        className: CLS + "-overlay",
        style: { ...geom, ...overlayBase, "--dsws-divider-width": state.dividerWidth + "px", "--dsws-divider-color": state.dividerColor || undefined } as ReactTypes.CSSProperties,
        "data-dsh-workspace-sidebar": "",
        "data-mode": mode
      };
      return React.createElement(
        DndWorkspace,
        null,
        React.createElement(
          "div",
          overlayProps,
          React.createElement(Toolbar, { panels: panels, mode: "fullscreen" }),
          React.createElement(
            "div",
            { className: CLS + "-body" },
            React.createElement(
              "div",
              { className: CLS + "-row" },
              leftW > 0 ? React.createElement(RegionPane, { region: "left", mode: mode, width: leftW, state: state, chrome: chrome }) : null,
              leftW > 0 ? React.createElement(ResizeHandle, { side: "left", horizontal: true, onStart: onLeftStart, onDrag: onLeftDrag }) : null,
              React.createElement(RegionPane, { region: "center", mode: mode, width: null, state: state, chrome: chrome }),
              rightW > 0 ? React.createElement(ResizeHandle, { side: "right", horizontal: true, onStart: onRightStart, onDrag: onRightDrag }) : null,
              rightW > 0 ? React.createElement(RegionPane, { region: "right", mode: mode, width: rightW, state: state, chrome: chrome }) : null
            ),
            bottomH > 0 ? React.createElement(ResizeHandle, { side: "bottom", horizontal: false, onStart: onBottomStart, onDrag: onBottomDrag }) : null,
            bottomH > 0 ? React.createElement(RegionPane, { region: "bottom", mode: mode, height: bottomH, state: state, chrome: chrome }) : null
          ),
          React.createElement(DragHint, {})
        )
      );
    }

    // ---- 停靠面板：左 / 右 / 底可同时打开，各自独立 fixed 面板 ----
    // 分割线不靠 border：由每个面板边缘的拖拽手柄居中画出（--dsws-divider-* 跟随设置）
    const panelBase: ReactTypes.CSSProperties = {
      position: "fixed",
      zIndex: OVERLAY_Z_INDEX,
      display: "flex",
      flexDirection: "column",
      // 不去 overflow:hidden：边缘手柄定位在 right/left/top:-3（跨在面板边界上），
      // 裁剪会把分割线（手柄中线，位于边界）外面一半裁掉 → 线条几乎不可见。
      // 内容本身由 pane / regionBody 的 overflow:hidden 裁剪，这里不裁是安全的。
      background: "var(--dsw-alias-bg-base,#fff)",
      "--dsws-divider-width": state.dividerWidth + "px",
      "--dsws-divider-color": state.dividerColor || undefined
    } as ReactTypes.CSSProperties;
    return React.createElement(
      DndWorkspace,
      null,
      React.createElement(
        React.Fragment,
        null,
        panels.left ? React.createElement(
          "div",
          {
            key: "left",
            className: CLS + "-overlay",
            "data-dsh-workspace-sidebar": "",
            "data-panel": "left",
            style: { ...panelBase, left: sidebarRight, top: 0, bottom: 0, right: "auto", width: effLeftW }
          },
          React.createElement(Toolbar, { panels: panels, mode: "left" }),
          React.createElement(SinglePane, { state: state, mode: "left" }),
          React.createElement(ResizeHandle, {
            side: "left-edge",
            horizontal: true,
            onStart: leftEdge.onStart,
            onDrag: leftEdge.onDrag,
            onEnd: leftEdge.onEnd,
            style: { position: "absolute", right: -3, top: 0, width: 6, height: "100%", cursor: "col-resize", zIndex: 5 }
          })
        ) : null,
        panels.right ? React.createElement(
          "div",
          {
            key: "right",
            className: CLS + "-overlay",
            "data-dsh-workspace-sidebar": "",
            "data-panel": "right",
            style: { ...panelBase, right: 0, top: 0, bottom: 0, left: "auto", width: effRightW }
          },
          React.createElement(Toolbar, { panels: panels, mode: "right" }),
          React.createElement(SinglePane, { state: state, mode: "right" }),
          React.createElement(ResizeHandle, {
            side: "right-edge",
            horizontal: true,
            onStart: rightEdge.onStart,
            onDrag: rightEdge.onDrag,
            onEnd: rightEdge.onEnd,
            style: { position: "absolute", left: -3, top: 0, width: 6, height: "100%", cursor: "col-resize", zIndex: 5 }
          })
        ) : null,
        panels.bottom ? React.createElement(
          "div",
          {
            key: "bottom",
            className: CLS + "-overlay",
            "data-dsh-workspace-sidebar": "",
            "data-panel": "bottom",
            style: { ...panelBase, left: sidebarRight + (panels.left ? effLeftW : 0), right: panels.right ? effRightW : 0, bottom: 0, top: "auto", height: effBottomH }
          },
          React.createElement(Toolbar, { panels: panels, mode: "bottom" }),
          React.createElement(SinglePane, { state: state, mode: "bottom" }),
          React.createElement(ResizeHandle, {
            side: "bottom-edge",
            horizontal: false,
            onStart: bottomEdge.onStart,
            onDrag: bottomEdge.onDrag,
            onEnd: bottomEdge.onEnd,
            style: { position: "absolute", left: 0, top: -3, width: "100%", height: 6, cursor: "row-resize", zIndex: 5 }
          })
        ) : null,
        React.createElement(DragHint, {})
      )
    );
  }

  return { WorkspaceView: WorkspaceView };
}
