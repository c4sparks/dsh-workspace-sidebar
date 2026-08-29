/**
 * dsh-workspace-sidebar — 纯常量（样式定义与注入见 ./styles）。
 */
import type { Mode, PresetId, WorkspaceState } from "./types";

export const APP_ID = "workspace";
/** class 前缀。 */
export const CLS = "dsh-workspace-sidebar";
export const WS_KEY = "dsh-workspace-sidebar:workspace:v1";
/** widget 声明式设置持久化键（独立于布局 WS_KEY，schema 升级不互相牵连）。 */
export const WIDGET_SETTINGS_KEY = "dsh-workspace-sidebar:widget-settings:v1";
export const SERVICE_VERSION = "0.1.0";
/** 侧车互斥事件（多个侧车入口共用：打开其一自动收起其它）。 */
export const SIDECAR_OPEN_EVENT = "dsh:sidecar-open";

// 区域尺寸钳制（px）
export const LEFT_DEFAULT = 280;
export const LEFT_MIN = 200;
export const LEFT_MAX = 480;
export const RIGHT_MIN = 220;
export const RIGHT_MAX = 480;
export const BOTTOM_MIN = 120;
export const BOTTOM_MAX_FRACTION = 0.5;

/** 覆盖层可用宽度小于此值时不渲染右栏/底栏（v1 简化响应式）。 */
export const NARROW_BREAKPOINT = 900;
export const OVERLAY_Z_INDEX = 30;

/** 侧边栏右缘测量兜底值（px）：未测得前不让覆盖层盖住侧边栏/按钮。 */
export const SIDEBAR_RIGHT_FALLBACK = 280;

// 左侧 / 右侧停靠模式的尺寸（px）
export const DOCK_DEFAULT = 320;
export const DOCK_MIN = 200;
// 底部停靠模式的高度（px）
export const BOTTOM_MODE_DEFAULT = 280;
export const BOTTOM_MODE_MIN = 120;
/** 停靠模式拖拽时的最大留白（px）：可拖到几乎占满。 */
export const MODE_EDGE_MARGIN = 96;

// ---- 布局钳制上限（px）--------------------------------------------------
/** 左 / 右停靠宽度上限（持久化 sanitize 用）。 */
export const DOCK_MAX = 1200;
/** 底部停靠高度上限（持久化 sanitize 用）。 */
export const BOTTOM_MODE_MAX = 1000;
/** 全屏模式底栏区域（regionSizes.bottom）高度上限。 */
export const REGION_BOTTOM_MAX = 600;
/** 停靠面板的主内容区最小留白（px）：ratio=1 也至少留这么多。 */
export const MIN_MAIN_AREA = 120;

export const PERSIST_DEBOUNCE_MS = 200;

/** 覆盖层模式（图标工具栏：全屏 / 左侧 / 右侧 / 底部）。 */
export const MODES: { id: Mode; label: string }[] = [
  { id: "fullscreen", label: "全屏" },
  { id: "left", label: "左侧" },
  { id: "right", label: "右侧" },
  { id: "bottom", label: "底部" }
];

/** 布局预设：label / 应用后的区域尺寸 / 是否显示区域 chrome。 */
export const PRESETS: Record<PresetId, {
  label: string;
  regionSizes: WorkspaceState["regionSizes"];
  chrome: boolean;
}> = {
  workbench: { label: "工作台", regionSizes: { left: 280, right: 320, bottom: 240 }, chrome: true },
  focus: { label: "专注", regionSizes: { left: 0, right: 0, bottom: 0 }, chrome: true },
  fullscreen: { label: "全屏", regionSizes: { left: 0, right: 0, bottom: 0 }, chrome: false }
};

// 样式定义与注入已移至 ./styles（styles.ts）。
