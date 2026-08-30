/**
 * dsh-workspace-sidebar — tab 拖拽分屏逻辑（tab-drag）。
 *
 * 独立模块：吸附区划分 / 覆盖层样式 / 共享拖拽状态 / 落点生效。拖拽事件本身由
 * dnd-kit 接管（见 ./dnd.ts：DndContext + useDraggable/useDroppable + 自定义
 * zone 碰撞检测），本模块只保留「落点语义」：zone 判定、覆盖层、落点动作。
 * 是否启用分屏由 `WorkspaceState.splitEnabled` 控制（settings「布局配置」）。
 */
import type { CSSProperties } from "react";
import type { Mode, Region, WorkspaceService } from "./types";

/** 吸附区类型：边缘四向（拆分）+ 中心（移入）。 */
export type DropZoneKind = 'left' | 'right' | 'up' | 'down' | 'center';

/** 与 dnd-kit droppable rect 兼容的最小矩形形状。 */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 指针在面板内相对位置 → VSCode 式吸附区（25% 边缘为拆分方向，中心为移入）。 */
export function zoneAt(clientX: number, clientY: number, rect: RectLike): DropZoneKind {
  if (rect.width === 0 || rect.height === 0) return 'center';
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0.25) return 'left';
  if (x > 0.75) return 'right';
  if (y < 0.25) return 'up';
  if (y > 0.75) return 'down';
  return 'center';
}

/** 吸附区覆盖层样式：边缘半透明蓝色块（落点侧 40%）+ 虚线标界；中心整层淡蓝。
 *  注意：base 用显式 top/right/bottom/left:0，**不用 `inset:0` 简写**——实测 inset 简写
 *  与 zone 的 `left:auto`/`top:auto` 长属性覆盖冲突（left:auto 盖不掉 inset 的 left:0），
 *  导致 right/down 覆盖层被锚到面板左上角、看不到高亮。 */
export function dropOverlayStyle(zone: DropZoneKind): CSSProperties {
  const base: CSSProperties = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, pointerEvents: "none", background: "rgba(59,130,246,0.22)", border: "2px dashed #3b82f6", borderRadius: 4 };
  if (zone === "left") return { ...base, right: "auto", width: "40%", borderLeft: "none" };
  if (zone === "right") return { ...base, left: "auto", width: "40%", borderRight: "none" };
  if (zone === "up") return { ...base, bottom: "auto", height: "40%", borderTop: "none" };
  if (zone === "down") return { ...base, top: "auto", height: "40%", borderBottom: "none" };
  return { ...base, background: "rgba(59,130,246,0.12)" };
}

/** 吸附区文案（浮动提示用）。 */
export const DROP_HINT_TEXT: Record<DropZoneKind, string> = {
  left: "拆分到左侧", right: "拆分到右侧", up: "拆分到上方", down: "拆分到下方", center: "移入此面板"
};

// ---- 共享拖拽状态（由 dnd-kit onDragOver/onDragEnd 写入 / 读取）----
/** 吸附区状态：落点面板 + 方向 + 指针坐标 + 目标面板的 mode/region（应用落点必需）。
 *  mode/region 由 PaneDropTarget 的 data-dnd-* 携带，over=null（落在分隔条间隙）时也能定位。 */
export type DropState = { paneId: string; zone: DropZoneKind; x: number; y: number; mode: Mode; region: Region };
let activeDrop: DropState | null = null;
const dropListeners = new Set<() => void>();

export function setActiveDrop(v: DropState | null): void {
  activeDrop = v;
  for (const fn of dropListeners) fn();
}
export function subscribeDrop(fn: () => void): () => void {
  dropListeners.add(fn);
  return function () { dropListeners.delete(fn); };
}
/** 清除当前拖拽吸附区（拖拽结束 / 取消时用）。 */
export function clearDrop(): void { setActiveDrop(null); }
export function getActiveDrop(): DropState | null { return activeDrop; }

/** 分隔条（sash）间隙 / 面板外的吸附容差（px）：指针距某面板边缘此距离内 → 视为拖到该边缘（拆分）。 */
const SASH_SNAP = 16;

/**
 * 指针落在分隔条（sash）间隙 / 面板外时，吸附到**最近面板的边缘**并给出拆分方向（push），
 * 而不是沿用旧吸附区（旧 center 落点 = 移入 = 覆盖）。mode/region 从 DOM 的 data-dnd-* 读；
 * 距所有面板都超过 SASH_SNAP 返回 null（真越界，放弃）。
 */
export function snapToPaneEdge(x: number, y: number): DropState | null {
  const nodes = document.querySelectorAll<HTMLElement>("[data-dnd-pane]");
  let best: { el: HTMLElement; r: RectLike; d: number } | null = null;
  for (const el of Array.from(nodes)) {
    const r = el.getBoundingClientRect();
    const rect: RectLike = { left: r.left, top: r.top, width: r.width, height: r.height };
    const dx = x < rect.left ? rect.left - x : x > rect.left + rect.width ? x - (rect.left + rect.width) : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.top + rect.height ? y - (rect.top + rect.height) : 0;
    const d = Math.hypot(dx, dy);
    if (d > SASH_SNAP) continue;
    if (best === null || d < best.d) best = { el: el, r: rect, d: d };
  }
  if (best === null) return null;
  const paneId = best.el.getAttribute("data-dnd-pane") ?? "";
  if (paneId === "") return null;
  const mode = (best.el.getAttribute("data-dnd-mode") ?? "fullscreen") as Mode;
  const region = (best.el.getAttribute("data-dnd-region") ?? "center") as Region;
  // 指针在矩形外（over=null 场景），方向取指针相对矩形的位置，不会是 center
  let zone: DropZoneKind;
  if (x < best.r.left) zone = "left";
  else if (x >= best.r.left + best.r.width) zone = "right";
  else if (y < best.r.top) zone = "up";
  else zone = "down";
  return { paneId: paneId, zone: zone, x: x, y: y, mode: mode, region: region };
}

/**
 * 落点生效：按当前拖拽的落点（`drop`：来自 dnd-kit onDragEnd 的 over + zone）
 * 拆分（边缘）/ 移入（中心）。`splitEnabled=false` 时忽略（不可拖拽拆分）。
 * `drop.mode/region` 来自目标 pane droppable 的 data。
 */
export function applyDrop(service: WorkspaceService, instanceId: string, drop: { paneId: string; zone: DropZoneKind; mode: Mode; region: Region }): void {
  clearDrop();
  if (service.getState().splitEnabled === false) return;
  if (drop.zone === "center") {
    service.moveTab(instanceId, drop.paneId, drop.mode);
  } else {
    const dir: 'row' | 'col' = (drop.zone === "left" || drop.zone === "right") ? 'row' : 'col';
    const before = (drop.zone === "left" || drop.zone === "up");
    service.splitPane(drop.region, drop.paneId, dir, instanceId, drop.mode, before);
  }
}
