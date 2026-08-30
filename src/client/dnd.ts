/**
 * dsh-workspace-sidebar — dnd-kit 装配（拖拽事件层）。
 *
 * 分工：分屏布局渲染 + 分隔条（sash）缩放仍由 allotment 承担（split-pane.tsx）；
 * 本模块只负责 tab 的「拖拽」——dnd-kit 接管指针/触摸拖拽，碰撞检测命中落点，
 * `onDragMove` 算出吸附区/重排目标写入共享状态（tab-drag.ts），`onDragEnd` 落点生效。
 *
 * 落点类型（用 droppable 的 `data.kind` 区分）：
 *  - `tab`：指针在某个标签上 → 重排（插到该标签前）；碰撞检测让 tab 优先于 pane。
 *  - `pane`：指针在面板上 → `zoneAt` 算边缘拆分 / 中心移入。
 *
 * 关键点：
 *  - 拖拽中指针实时坐标用 window pointermove 跟踪（dnd-kit 事件不带 clientX/Y，
 *    吸附区 zone 需要原始坐标）。
 *  - 越界 / 落在分隔条（sash）间隙（over=null）时，**吸附到最近面板边缘给出拆分方向**（push），
 *    而不是沿用旧吸附区（旧 center 落点 = 移入 = 覆盖）；真越界（距所有面板 > SASH_SNAP）则清空。
 */
import type * as ReactTypes from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { setActiveDrop, clearDrop, getActiveDrop, applyDrop, zoneAt, snapToPaneEdge, type RectLike } from "./tab-drag";
import type { WorkspaceService, Mode, Region } from "./types";
import type { Icons } from "./icons";

/** 拖拽中指针的实时位置（模块级；由 DndWorkspace 挂的 window pointermove 更新）。 */
let lastPointer = { x: 0, y: 0 };

/** 落点碰撞检测：指针包含命中 + 标签落点（kind='tab'）优先于面板落点（kind='pane'）。 */
const workspaceCollisionDetection: CollisionDetection = function (args) {
  const hits = pointerWithin(args);
  const activeId = args.active?.id;
  const filtered = hits.filter(function (h) { return String(h.id) !== String(activeId); });
  filtered.sort(function (a, b) {
    const ak = (a.data as { kind?: string } | undefined)?.kind;
    const bk = (b.data as { kind?: string } | undefined)?.kind;
    if (ak === "tab" && bk !== "tab") return -1;
    if (ak !== "tab" && bk === "tab") return 1;
    return 0;
  });
  return filtered;
};

export interface DndWorkspaceDeps {
  React: typeof ReactTypes;
  service: WorkspaceService;
  icons: Icons;
}

export interface DndWorkspaceApi {
  /** 包住工作台视图的 DndContext 容器（含传感器 / 拖影 / 落点管线）。 */
  DndWorkspace: (props: { children: ReactTypes.ReactNode }) => ReactTypes.ReactNode;
}

export function createDndWorkspace(deps: DndWorkspaceDeps): DndWorkspaceApi {
  const { React, service, icons } = deps;
  const { useState, useEffect, useRef } = React;

  function DndWorkspace(props: { children: ReactTypes.ReactNode }): ReactTypes.ReactNode {
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
    );
    // 实时指针位置（吸附区需要原始坐标；dnd-kit 事件不带 clientX/Y）
    useEffect(function () {
      const onMove = function (e: PointerEvent) { lastPointer = { x: e.clientX, y: e.clientY }; };
      window.addEventListener("pointermove", onMove);
      return function () { window.removeEventListener("pointermove", onMove); };
    }, []);

    const [dragInfo, setDragInfo] = useState<{ instanceId: string; widgetId: string } | null>(null);
    const dragInfoRef = useRef(dragInfo);
    dragInfoRef.current = dragInfo;
    const widget = dragInfo !== null ? service.getWidget(dragInfo.widgetId) : null;

    function onDragStart(e: DragStartEvent) {
      const data = e.active.data.current as { instanceId?: string; widgetId?: string } | undefined;
      setDragInfo({
        instanceId: data?.instanceId ?? String(e.active.id),
        widgetId: data?.widgetId ?? String(e.active.id),
      });
      clearDrop();
    }
    function onDragMove(e: DragMoveEvent) {
      const over = e.over;
      if (over !== null && String(over.id) !== String(e.active.id)) {
        const data = (over.data.current ?? {}) as { kind?: string; paneId?: string; instanceId?: string; mode?: Mode; region?: Region };
        if (data.kind === "tab") {
          // 指针在标签上：显示所在面板中心覆盖层示意；落点动作（重排）在 onDragEnd 处理
          setActiveDrop({ paneId: data.paneId ?? String(over.id), zone: "center", x: lastPointer.x, y: lastPointer.y, mode: "fullscreen", region: "center" });
        } else {
          const r = over.rect;
          const rect: RectLike = { left: r.left, top: r.top, width: r.width, height: r.height };
          setActiveDrop({ paneId: String(over.id), zone: zoneAt(lastPointer.x, lastPointer.y, rect), x: lastPointer.x, y: lastPointer.y, mode: data.mode ?? "fullscreen", region: data.region ?? "center" });
        }
      } else {
        // 分隔条（sash）间隙 / 越界 / 拖拽自身：吸附到最近面板边缘 → 拆分（push），
        // 不再沿用旧吸附区（旧 center 落点 = 移入 = 覆盖）。真越界（> SASH_SNAP）则清空。
        const snap = snapToPaneEdge(lastPointer.x, lastPointer.y);
        if (snap !== null) setActiveDrop(snap);
        else setActiveDrop(null);
      }
    }
    function onDragEnd(e: DragEndEvent) {
      const info = dragInfoRef.current;
      const over = e.over;
      const drop = getActiveDrop();
      if (info !== null && drop !== null) {
        const data = (over?.data.current ?? {}) as { kind?: string; instanceId?: string };
        if (data.kind === "tab" && over !== null && String(over.id) !== info.instanceId) {
          // 拖到标签上 → 插到该标签前（重排 / 跨 pane 移入）
          service.insertTabBefore(info.instanceId, data.instanceId ?? String(over.id));
        } else if (over === null || String(over.id) !== info.instanceId) {
          // 落点在面板（zone 来自 onDragMove）或分隔条间隙（over=null，drop 来自吸附）→ 拆分 / 移入
          applyDrop(service, info.instanceId, {
            paneId: drop.paneId,
            zone: drop.zone,
            mode: drop.mode,
            region: drop.region,
          });
        }
      }
      clearDrop();
      setDragInfo(null);
    }
    function onDragCancel() {
      clearDrop();
      setDragInfo(null);
    }

    const ghostTitle = widget ? (typeof widget.title === "function" ? widget.title() : widget.title) : "";
    const ghostStyle: ReactTypes.CSSProperties = {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 6,
      background: "var(--dsw-alias-bg-layer-1,#f7f7f8)",
      color: "var(--dsw-alias-label-primary,#333)",
      boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      border: "1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))",
      fontSize: 12,
      whiteSpace: "nowrap",
      pointerEvents: "none",
    };
    return React.createElement(
      DndContext,
      {
        sensors: sensors,
        collisionDetection: workspaceCollisionDetection,
        onDragStart: onDragStart,
        onDragMove: onDragMove,
        onDragEnd: onDragEnd,
        onDragCancel: onDragCancel,
      },
      props.children,
      React.createElement(
        DragOverlay,
        { dropAnimation: null },
        dragInfo !== null && widget
          ? React.createElement("div", { style: ghostStyle },
              React.createElement("span", { style: { display: "flex" } }, icons.resolveNode(widget.icon, 14) ?? "\u{1F9E9}"),
              React.createElement("span", null, ghostTitle))
          : null
      )
    );
  }

  return { DndWorkspace: DndWorkspace };
}
